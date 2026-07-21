import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, resolveSpecDir } from "../../config/loader.js";
import { writeArtifact } from "../../artifacts/writer.js";

export interface CommitOptions {
  branch?: string;
  amend?: boolean;
}

export interface CommitResult {
  branch: string;
  commitHash: string | null;
  filesChanged: number;
  storyUpdated: boolean;
  pushed: boolean;
}

function storySlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseStoryFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const sep = line.indexOf(":");
    if (sep > 0) {
      fields[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
    }
  }
  return fields;
}

function updateStoryStatus(content: string, commitHash: string, branch: string): string {
  // Update status to done
  let updated = content.replace(/^status:\s*pending/m, "status: done");
  updated = updated.replace(/^status:\s*in-progress/m, "status: done");
  updated = updated.replace(/^status:\s*review/m, "status: done");

  // Add Change Log entry
  const now = new Date().toISOString().split("T")[0];
  const entry = `\n- ${now}: Committed as ${commitHash} on branch \`${branch}\``;

  if (updated.includes("## Change Log")) {
    updated = updated.replace("## Change Log", `## Change Log${entry}`);
  } else {
    updated += `\n## Change Log${entry}\n`;
  }

  return updated;
}

export function commitCommand(
  cwd: string,
  spec: string,
  storyId: string,
  options: CommitOptions = {}
): CommitResult {
  // Verify git repo first
  try {
    execSync("git rev-parse --git-dir", { cwd, encoding: "utf-8" });
  } catch {
    throw new Error("Not a git repository");
  }

  const config = loadConfig(cwd);
  const specDir = resolveSpecDir(cwd, config, spec);
  const storiesDir = resolve(specDir, "stories");

  if (!existsSync(storiesDir)) {
    throw new Error(`No stories directory found for spec '${spec}'`);
  }

  const files = readdirSync(storiesDir).filter((f) => f.startsWith(storyId));
  if (files.length === 0) {
    throw new Error(`Story '${storyId}' not found in spec '${spec}'`);
  }

  const storyFile = files[0];
  const storyPath = resolve(storiesDir, storyFile);
  const content = readFileSync(storyPath, "utf-8");
  const frontmatter = parseStoryFrontmatter(content);
  const title = frontmatter.id === storyId
    ? (content.match(/^#\s+(.+)/m)?.[1]?.trim() || storyId)
    : storyId;

  const slug = storySlug(title);
  const branchName = options.branch || `story/${storyId}-${slug}`;

  // Check if branch already exists
  const branchExists = (() => {
    try {
      execSync(`git rev-parse --verify "${branchName}"`, {
        cwd,
        encoding: "utf-8",
      });
      return true;
    } catch {
      return false;
    }
  })();

  if (branchExists) {
    throw new Error(`Branch '${branchName}' already exists`);
  }

  // Stage all changes
  execSync("git add -A", { cwd, encoding: "utf-8" });

  // Check if there's anything to commit
  const hasChanges = (() => {
    try {
      execSync("git diff --cached --quiet", { cwd });
      return false;
    } catch {
      return true;
    }
  })();

  if (!hasChanges) {
    return {
      branch: branchName,
      commitHash: null,
      filesChanged: 0,
      storyUpdated: false,
      pushed: false,
    };
  }

  // Count files changed
  const diffStat = execSync("git diff --cached --numstat", {
    cwd,
    encoding: "utf-8",
  });
  const filesChanged = diffStat.trim() ? diffStat.trim().split("\n").length : 0;

  // Create branch and switch to it
  execSync(`git checkout -b "${branchName}"`, { cwd, encoding: "utf-8" });

  // Commit
  const commitMsg = `feat(${slug}): ${title} (#${storyId})`;
  let commitHash: string;
  if (options.amend) {
    execSync(`git commit --amend -m "${commitMsg}"`, { cwd, encoding: "utf-8" });
  } else {
    execSync(`git commit -m "${commitMsg}"`, { cwd, encoding: "utf-8" });
  }
  commitHash = execSync("git rev-parse --short HEAD", {
    cwd,
    encoding: "utf-8",
  }).trim();

  // Push branch to remote
  let pushed = false;
  try {
    execSync(`git push -u origin "${branchName}"`, { cwd, encoding: "utf-8" });
    pushed = true;
  } catch {
    // No remote or push failed — not a fatal error
  }

  // Update story status
  const updatedContent = updateStoryStatus(content, commitHash, branchName);
  writeArtifact({
    cwd,
    outputFolder: config.output_folder,
    subpath: `specs/spec-${spec}/stories`,
    filename: storyFile,
    content: updatedContent,
  });

  return {
    branch: branchName,
    commitHash,
    filesChanged,
    storyUpdated: true,
    pushed,
  };
}
