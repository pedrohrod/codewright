import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { loadConfig, resolveSpecDir } from "../../config/loader.js";
import { memlog } from "../../memlog/memlog.js";
import { writeArtifact } from "../../artifacts/writer.js";
import { specTemplate } from "../../templates/spec-template.js";

export interface SpecCreateOptions {
  cwd: string;
  slug: string;
  input?: string;
}

export function specCreateCommand(opts: SpecCreateOptions) {
  const config = loadConfig(opts.cwd);
  const specDir = resolveSpecDir(opts.cwd, config, opts.slug);

  const ml = memlog();
  ml.init(specDir, { topic: opts.slug, goal: "" });
  ml.append(specDir, { type: "note", text: `Spec ${opts.slug} created` });

  if (opts.input) {
    const inputPath = resolve(opts.cwd, opts.input);
    if (existsSync(inputPath)) {
      const inputContent = readFileSync(inputPath, "utf-8");
      ml.append(specDir, { type: "note", text: `Input loaded from ${opts.input}` });
      ml.append(specDir, { type: "note", text: `---\n${inputContent}\n---` });
    }
  }

  deriveSpec(specDir, opts.slug, config);
  return { specDir };
}

export function specUpdateCommand(cwd: string, slug: string) {
  const config = loadConfig(cwd);
  const specDir = resolveSpecDir(cwd, config, slug);
  deriveSpec(specDir, slug, config);
  return { specDir };
}

function deriveSpec(specDir: string, slug: string, _config: { output_folder: string }) {
  const ml = memlog();
  const data = ml.read(specDir);

  const topic = data.frontmatter.topic || slug;
  const goal = data.frontmatter.goal || "";

  const caps = data.entries
    .filter((e) => e.type === "capability")
    .map((e, i) => {
      const match = e.text.match(/^CAP-\d+:\s*(.+)/);
      return { id: `CAP-${i + 1}`, text: match ? match[1] : e.text };
    });

  const constraints = data.entries
    .filter((e) => e.type === "constraint")
    .map((e) => e.text);

  const decisions = data.entries
    .filter((e) => e.type === "decision")
    .map((e) => e.text);

  const content = specTemplate({ slug, topic, goal, capabilities: caps, constraints, decisions });

  writeFileSync(resolve(specDir, "SPEC.md"), content, "utf-8");
}

export function specHistoryCommand(cwd: string, slug: string): string {
  const config = loadConfig(cwd);
  const specDir = resolveSpecDir(cwd, config, slug);

  if (!existsSync(specDir)) {
    return `Error: Spec '${slug}' not found`;
  }

  try {
    const log = execSync(`git log --oneline --format="%h %ad %s" --date=short -20 -- .`, {
      cwd: specDir,
      encoding: "utf-8",
    }).trim();

    if (!log) {
      return `No version history for spec '${slug}'`;
    }

    return `Version history for '${slug}':\n${log}`;
  } catch {
    return `Error: Could not read git history for spec '${slug}'`;
  }
}

export function specDiffCommand(cwd: string, slug: string, from?: string): string {
  const config = loadConfig(cwd);
  const specDir = resolveSpecDir(cwd, config, slug);

  if (!existsSync(specDir)) {
    return `Error: Spec '${slug}' not found`;
  }

  try {
    const fromRef = from || "HEAD~1";
    const diff = execSync(`git diff ${fromRef}..HEAD -- .`, {
      cwd: specDir,
      encoding: "utf-8",
    }).trim();

    if (!diff) {
      return `No changes between ${fromRef} and HEAD for spec '${slug}'`;
    }

    return `Diff for spec '${slug}' (${fromRef}..HEAD):\n${diff}`;
  } catch {
    return `Error: Could not generate diff for spec '${slug}'`;
  }
}

export function specVersionCommand(cwd: string, slug: string): string {
  const config = loadConfig(cwd);
  const specDir = resolveSpecDir(cwd, config, slug);

  if (!existsSync(specDir)) {
    return `Error: Spec '${slug}' not found`;
  }

  try {
    // Stage all changes in spec directory
    execSync("git add .", { cwd: specDir });

    // Check if there are changes to commit
    const status = execSync("git status --porcelain", {
      cwd: specDir,
      encoding: "utf-8",
    }).trim();

    if (!status) {
      return `No changes to version for spec '${slug}'`;
    }

    // Create version commit
    const timestamp = new Date().toISOString().split("T")[0];
    execSync(`git commit -m "version: ${slug} ${timestamp}"`, { cwd: specDir });

    // Get the commit hash
    const hash = execSync("git rev-parse --short HEAD", {
      cwd: specDir,
      encoding: "utf-8",
    }).trim();

    return `✓ Version created for spec '${slug}' (commit ${hash})`;
  } catch {
    return `Error: Could not create version for spec '${slug}'`;
  }
}

export function specSyncCommand(cwd: string, slug: string): string {
  const config = loadConfig(cwd);
  const specDir = resolveSpecDir(cwd, config, slug);

  if (!existsSync(specDir)) {
    return `Error: Spec '${slug}' not found`;
  }

  try {
    // Read SPEC.md to extract requirements
    const specPath = resolve(specDir, "SPEC.md");
    if (!existsSync(specPath)) {
      return `Error: SPEC.md not found for spec '${slug}'`;
    }

    const specContent = readFileSync(specPath, "utf-8");

    // Extract capabilities from SPEC.md
    const capRegex = /\*\*CAP-\d+\*\*\s*\n\s*-\s*\*\*intent:\*\*\s*(.+)/g;
    const caps: string[] = [];
    let match;
    while ((match = capRegex.exec(specContent)) !== null) {
      caps.push(match[1].trim());
    }

    // Scan source files for implementation
    const srcDir = resolve(cwd, "src");
    const sourceFiles: string[] = [];

    if (existsSync(srcDir)) {
      const files = execSync("find . -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -not -path '*/node_modules/*' -not -path '*/dist/*' | head -30", {
        cwd,
        encoding: "utf-8",
      }).trim().split("\n").filter(f => f);

      for (const file of files) {
        try {
          const content = readFileSync(resolve(cwd, file), "utf-8");
          sourceFiles.push(`${file}: ${content.length} chars`);
        } catch {
          // skip
        }
      }
    }

    // Build sync report
    let report = `Spec Sync Report: '${slug}'\n\n`;
    report += `Requirements found in SPEC.md: ${caps.length}\n`;
    for (const cap of caps) {
      report += `  - ${cap}\n`;
    }

    report += `\nSource files scanned: ${sourceFiles.length}\n`;
    for (const file of sourceFiles.slice(0, 10)) {
      report += `  - ${file}\n`;
    }

    report += `\nNote: This is a basic sync check. For full validation, use codewright:readiness skill.`;

    return report;
  } catch {
    return `Error: Could not sync spec '${slug}'`;
  }
}
