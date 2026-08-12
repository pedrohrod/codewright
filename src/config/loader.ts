import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { load } from "js-yaml";

// ─── Config interfaces ────────────────────────────────────

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

  // Ticket automation
  tickets?: TicketConfig;
  sourceControl?: SourceControlConfig;
  workflow?: WorkflowAutomationConfig;
  validation?: ValidationAutomationConfig;
  execution?: ExecutionConfig;

  // Model provider
  model?: ModelProviderConfig;

  // Per-agent model overrides
  agents?: {
    planner?: { model?: ModelProviderConfig };
    engineer?: { model?: ModelProviderConfig };
    reviewer?: { model?: ModelProviderConfig };
  };
}

export interface TicketConfig {
  provider: string;
  /** Provider-specific fields (e.g. boardId for Trello) */
  [key: string]: unknown;
}

export interface SourceControlConfig {
  provider: string;
  /** Provider-specific fields */
  [key: string]: unknown;
}

export interface WorkflowAutomationConfig {
  draft?: boolean;
  maxIterations?: number;
  maxTicketsPerRun?: number;
}

export interface ValidationAutomationConfig {
  commands?: string[];
}

export interface ExecutionConfig {
  maxTicketsPerRun?: number;
}

export interface ModelProviderConfig {
  provider: string;
  apiKey?: string;
  model?: string;
  baseURL?: string;
}

// ─── defineConfig helper ──────────────────────────────────

export function defineConfig(config: CodewrightConfig): CodewrightConfig {
  return config;
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

/**
 * Load codewright.config.ts (TypeScript) if it exists.
 * Supports both defineConfig() and plain object exports.
 * Returns undefined if no TS config found or on import failure.
 */
async function loadTsConfig(cwd: string): Promise<Record<string, unknown> | undefined> {
  const tsConfigPath = resolve(cwd, "codewright.config.ts");
  if (!existsSync(tsConfigPath)) return undefined;

  try {
    const fileUrl = pathToFileURL(tsConfigPath).href;
    const mod = await import(fileUrl);
    const raw = mod.default;
    // defineConfig pattern: default export is a function, call it
    if (typeof raw === "function") {
      return raw() as Record<string, unknown>;
    }
    if (raw && typeof raw === "object") {
      return raw as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function loadConfigAsync(cwd: string): Promise<CodewrightConfig> {
  const tsConfig = await loadTsConfig(cwd);
  const yamlConfig = loadYaml(resolve(cwd, ".codewright", "config.yaml"));
  const userConfig = loadYaml(resolve(cwd, ".codewright", "config.user.yaml"));
  // TS config takes precedence over YAML config
  return mergeConfigs(yamlConfig, userConfig, ...(tsConfig ? [tsConfig] : []));
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
