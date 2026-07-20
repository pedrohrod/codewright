import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../../config/loader.js";
import { writeArtifact } from "../../artifacts/writer.js";

export function contextGenerateCommand(cwd: string) {
  const config = loadConfig(cwd);

  const sections: string[] = [];

  // Technology Stack
  const pkgPath = resolve(cwd, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const depList = Object.entries(deps)
      .map(([name, ver]) => `  - ${name}: ${ver}`)
      .join("\n");

    sections.push(`## Technology Stack & Versions
- **Name:** ${pkg.name || "unknown"}
- **Version:** ${pkg.version || "0.0.0"}
- **Stack:** ${config.stack}
- **Dependencies:\n${depList}`);
  }

  // Project Structure
  const srcPath = resolve(cwd, "src");
  if (existsSync(srcPath)) {
    const modules = readdirSync(srcPath, { recursive: true })
      .filter((f: string) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .map((f: string) => `  - src/${f}`)
      .join("\n");

    sections.push(`## Project Structure
  src/
${modules}`);
  }

  // AGENTS.md rules
  const agentsPath = resolve(cwd, ".codewright", "AGENTS.md");
  if (existsSync(agentsPath)) {
    const rules = readFileSync(agentsPath, "utf-8");
    sections.push(`## Critical Rules\n${rules}`);
  }

  // Config
  sections.push(`## Configuration
- **Project:** ${config.project_name}
- **Stack:** ${config.stack}
- **Language:** ${config.communication_language}
- **Output:** ${config.output_folder}`);

  const content = `# Project Context\n\n${sections.join("\n\n")}\n`;

  const path = writeArtifact({
    cwd,
    outputFolder: config.output_folder,
    subpath: ".",
    filename: "project-context.md",
    content,
  });

  return { path };
}
