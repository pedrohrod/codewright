import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";

export interface CodewrightConfig {
  codewright_version: string;
  project_name: string;
  stack: string;
  communication_language: string;
  output_folder: string;
  context_file: string;

  // Auto-detected fields
  framework?: string;
  test_runner?: string;
  lint_tools?: string[];
  project_language?: string;
  strict_mode?: boolean;
}

const DEFAULTS: CodewrightConfig = {
  codewright_version: "0.1.0",
  project_name: "",
  stack: "node",
  communication_language: "en",
  output_folder: ".codewright-output",
  context_file: ".codewright-output/project-context.md",
};

function loadYaml(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf-8");
    return (load(raw) as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

function mergeConfigs(
  ...sources: Record<string, unknown>[]
): CodewrightConfig {
  const merged: Record<string, unknown> = { ...DEFAULTS };
  for (const src of sources) {
    Object.assign(merged, src);
  }
  return merged as unknown as CodewrightConfig;
}

export function loadConfig(cwd: string): CodewrightConfig {
  const projectConfig = loadYaml(resolve(cwd, ".codewright", "config.yaml"));
  const userConfig = loadYaml(resolve(cwd, ".codewright", "config.user.yaml"));
  return mergeConfigs(projectConfig, userConfig);
}

export function resolveOutputDir(cwd: string, config: CodewrightConfig): string {
  return resolve(cwd, config.output_folder);
}

export function resolveSpecDir(cwd: string, config: CodewrightConfig, slug: string): string {
  return resolve(resolveOutputDir(cwd, config), "specs", `spec-${slug}`);
}

/** Resolve {template} variables in a string using the config */
export function resolveTemplates(input: string, config: CodewrightConfig): string {
  const vars: Record<string, string> = {
    "project-root": process.cwd(),
    "output-folder": config.output_folder,
    "skills-dir": ".agents/skills",
    "config-dir": ".codewright",
    "project-name": config.project_name || "",
  };
  return input.replace(/\{(\w[\w-]*\w|\w)\}/g, (_, key) => vars[key] || `{${key}}`);
}
