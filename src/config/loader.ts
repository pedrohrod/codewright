import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { load } from "js-yaml";

export interface CodewrightConfig {
  codewright_version: string;
  project_name: string;
  stack: string;
  communication_language: string;
  output_folder: string;
  context_file: string;
}

const DEFAULTS: CodewrightConfig = {
  codewright_version: "0.1.0",
  project_name: "",
  stack: "node",
  communication_language: "en",
  output_folder: ".codewright-output",
  context_file: ".codewright-output/project-context.md",
};

export function loadConfig(cwd: string): CodewrightConfig {
  const configPath = resolve(cwd, ".codewright", "config.yaml");
  if (!existsSync(configPath)) {
    return { ...DEFAULTS };
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = load(raw) as Partial<CodewrightConfig>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function resolveOutputDir(cwd: string, config: CodewrightConfig): string {
  return resolve(cwd, config.output_folder);
}

export function resolveSpecDir(cwd: string, config: CodewrightConfig, slug: string): string {
  return resolve(resolveOutputDir(cwd, config), "specs", `spec-${slug}`);
}
