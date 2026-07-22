import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { loadConfig, resolveSpecDir } from "../../config/loader.js";
import { writeArtifact } from "../../artifacts/writer.js";

export interface CommitOptions {
  branch?: string;
  amend?: boolean;
  push?: boolean;
  dryRun?: boolean;
}

export interface CommitResult {
  branch: string;
  commitHash: string | null;
  filesChanged: number;
  storyUpdated: boolean;
  pushed: boolean;
  plannedFiles: string[];
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

function storySlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseCodeMap(content: string): string[] {
  const section = content.match(/## Code Map\s*\n([\s\S]*?)(?=\n## |\s*$)/)?.[1] || "";
  return section.split("\n").map((line) => line.match(/^\s*-\s+(.+?)\s+\((?:CREATE|MODIFY|DELETE)\)\s*$/)?.[1])
    .filter((value): value is string => Boolean(value));
}

function changedFiles(cwd: string): string[] {
  const output = git(cwd, ["status", "--porcelain", "--untracked-files=all"]);
  return output ? output.split("\n").map((line) => line.slice(3).replace(/^.* -> /, "")) : [];
}

function updateStoryStatus(content: string, branch: string): string {
  let updated = content.replace(/^status:\s*(?:pending|in-progress|review).*$/m, "status: done");
  const date = new Date().toISOString().split("T")[0];
  const entry = `- ${date}: Committed as part of branch \`${branch}\``;
  if (updated.includes("## Change Log")) {
    updated = updated.replace("## Change Log", `## Change Log\n${entry}`);
  } else {
    updated += `\n## Change Log\n${entry}\n`;
  }
  return updated;
}

export function commitCommand(cwd: string, spec: string, storyId: string, options: CommitOptions = {}): CommitResult {
  try {
    git(cwd, ["rev-parse", "--git-dir"]);
  } catch {
    throw new Error("Not a git repository");
  }

  const config = loadConfig(cwd);
  const specDir = resolveSpecDir(cwd, config, spec);
  const storiesDir = resolve(specDir, "stories");
  if (!existsSync(storiesDir)) throw new Error(`No stories directory found for spec '${spec}'`);

  const files = readdirSync(storiesDir).filter((file) => file.startsWith(storyId));
  if (files.length === 0) throw new Error(`Story '${storyId}' not found in spec '${spec}'`);

  const storyFile = files[0];
  const storyPath = resolve(storiesDir, storyFile);
  const content = readFileSync(storyPath, "utf-8");
  const title = content.match(/^#\s+(.+)/m)?.[1]?.trim() || storyId;
  const branch = options.branch || `story/${storyId}-${storySlug(title)}`;

  try {
    git(cwd, ["rev-parse", "--verify", branch]);
    throw new Error(`Branch '${branch}' already exists`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) throw error;
  }

  const status = content.match(/^status:\s*([^\s#]+)/m)?.[1];
  if (status !== "in-progress" && status !== "review") {
    throw new Error(`Story status must be in-progress or review before commit (found ${status || "missing"})`);
  }

  const storyRelative = relative(cwd, storyPath);
  const reviewRelative = relative(cwd, resolve(specDir, "reviews", `review-${storyId}.md`));
  const codeMap = parseCodeMap(content);
  if (codeMap.length === 0) throw new Error("Story Code Map is empty or invalid");

  const allowed = new Set([...codeMap, storyRelative]);
  if (existsSync(resolve(cwd, reviewRelative))) allowed.add(reviewRelative);

  const staged = git(cwd, ["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
  const unrelatedStaged = staged.filter((file) => !allowed.has(file));
  if (unrelatedStaged.length > 0) {
    throw new Error(`Unrelated staged changes detected: ${unrelatedStaged.join(", ")}`);
  }

  const plannedFiles = changedFiles(cwd).filter((file) => allowed.has(file));
  const implementationFiles = plannedFiles.filter((file) => file !== storyRelative && file !== reviewRelative);
  if (implementationFiles.length === 0) {
    return { branch, commitHash: null, filesChanged: 0, storyUpdated: false, pushed: false, plannedFiles: [] };
  }
  if (options.dryRun) {
    const previewFiles = [...new Set([...plannedFiles, storyRelative])];
    return { branch, commitHash: null, filesChanged: previewFiles.length, storyUpdated: false, pushed: false, plannedFiles: previewFiles };
  }

  writeArtifact({
    cwd,
    outputFolder: config.output_folder,
    subpath: `specs/spec-${spec}/stories`,
    filename: storyFile,
    content: updateStoryStatus(content, branch),
  });

  const filesToStage = changedFiles(cwd).filter((file) => allowed.has(file));
  git(cwd, ["add", "--", ...filesToStage]);
  git(cwd, ["checkout", "-b", branch]);

  const message = `feat(${storySlug(title)}): ${title} (#${storyId})`;
  git(cwd, options.amend ? ["commit", "--amend", "-m", message] : ["commit", "-m", message]);
  let pushed = false;
  if (options.push) {
    git(cwd, ["push", "-u", "origin", branch]);
    pushed = true;
  }

  return {
    branch,
    commitHash: git(cwd, ["rev-parse", "--short", "HEAD"]),
    filesChanged: filesToStage.length,
    storyUpdated: true,
    pushed,
    plannedFiles: filesToStage,
  };
}
