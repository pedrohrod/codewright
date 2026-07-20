import { execSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, resolveSpecDir } from "../../config/loader.js";
import { writeArtifact } from "../../artifacts/writer.js";

export function devStartCommand(cwd: string, spec: string, storyId: string) {
  const config = loadConfig(cwd);
  const specDir = resolveSpecDir(cwd, config, spec);
  const storiesDir = resolve(specDir, "stories");

  if (!existsSync(storiesDir)) {
    throw new Error(`No stories directory found for spec '${spec}'`);
  }

  const files = readdirSync(storiesDir).filter((f: string) => f.startsWith(storyId));
  if (files.length === 0) {
    throw new Error(`Story '${storyId}' not found in spec '${spec}'`);
  }

  const storyFile = files[0];
  const storyPath = resolve(storiesDir, storyFile);
  let content = readFileSync(storyPath, "utf-8");

  content = content.replace(/^status:\s*pending/m, "status: in-progress");

  let baseline = "unknown";
  try {
    baseline = execSync("git rev-parse HEAD", { cwd, encoding: "utf-8" }).trim();
    content = content.replace(/^baseline_commit:\s*$/m, `baseline_commit: ${baseline}`);
  } catch {
    content = content.replace(/^baseline_commit:\s*$/m, `baseline_commit: none`);
  }

  writeArtifact({
    cwd,
    outputFolder: config.output_folder,
    subpath: `specs/spec-${spec}/stories`,
    filename: storyFile,
    content,
  });

  return {
    story: `${storyId} (${storyFile})`,
    baseline_commit: baseline,
    instructions: `Implement story ${storyId} following TDD (RED → GREEN → REFACTOR).
Keep scope limited to the Code Map and I/O Matrix.
Upon completion, mark tasks as done and change status to "review".`,
  };
}

export function reviewPrepareCommand(cwd: string, spec: string, storyId: string) {
  const config = loadConfig(cwd);
  const specDir = resolveSpecDir(cwd, config, spec);
  const storiesDir = resolve(specDir, "stories");

  const files = readdirSync(storiesDir).filter((f: string) => f.startsWith(storyId));
  if (files.length === 0) throw new Error(`Story '${storyId}' not found`);

  const storyPath = resolve(storiesDir, files[0]);
  const content = readFileSync(storyPath, "utf-8");

  const baselineMatch = content.match(/^baseline_commit:\s*(.+)/m);
  const baseline = baselineMatch?.[1]?.trim() || "none";

  let diff = "No baseline commit available.";
  if (baseline !== "none") {
    try {
      diff = execSync(`git diff ${baseline}..HEAD`, { cwd, encoding: "utf-8" });
    } catch {
      diff = "Could not generate diff from baseline.";
    }
  }

  const reviewContent = `# Review: ${storyId}

## Diff
\`\`\`
${diff.slice(0, 5000)}
\`\`\`

## Checklist
- [ ] Functionality implemented per I/O Matrix
- [ ] Edge cases covered
- [ ] Tests passing
- [ ] Code follows project patterns
- [ ] No regressions
- [ ] Documentation updated (if applicable)

## Notes
{reviewer notes}
`;

  const reviewFile = writeArtifact({
    cwd,
    outputFolder: config.output_folder,
    subpath: `specs/spec-${spec}/reviews`,
    filename: `review-${storyId}.md`,
    content: reviewContent,
  });

  return { reviewFile, baseline, diff: diff.slice(0, 2000) };
}
