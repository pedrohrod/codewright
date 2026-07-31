import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runProcess } from "../utils/process.js";

export type GraphifyMode = "off" | "advisory" | "required";
export type GraphifyUpdatePolicy = "never" | "missing" | "stale" | "always";

export interface GraphifyConfig {
  enabled: boolean;
  mode: GraphifyMode;
  command: string;
  graph_path: string;
  query_budget: number;
  update_policy: GraphifyUpdatePolicy;
  required_for: string[];
}

const DEFAULT_GRAPHIFY_CONFIG: GraphifyConfig = {
  enabled: true,
  mode: "advisory",
  command: "graphify",
  graph_path: "graphify-out/graph.json",
  query_budget: 4000,
  update_policy: "stale",
  required_for: ["analysis", "review", "debugging", "refactoring", "implementation", "architecture"],
};

export function loadGraphifyConfig(projectConfig: Record<string, unknown>): GraphifyConfig {
  const raw = (projectConfig as { graphify?: Partial<GraphifyConfig> }).graphify;
  if (!raw) return DEFAULT_GRAPHIFY_CONFIG;
  return { ...DEFAULT_GRAPHIFY_CONFIG, ...raw };
}

export async function checkGraphifyAvailable(command: string): Promise<{ available: boolean; version: string }> {
  const result = await runProcess(command, ["--version"], { timeout: 5000 });
  if (result.failed) return { available: false, version: "" };
  return { available: true, version: result.stdout.trim() };
}

export function checkGraphExists(cwd: string, graphPath: string): boolean {
  return existsSync(resolve(cwd, graphPath));
}

export async function checkGraphStale(cwd: string, command: string, graphPath: string): Promise<boolean> {
  const result = await runProcess(command, ["check-update", "--graph", graphPath], { cwd, timeout: 10000 });
  return result.stdout.includes("stale") || result.exitCode === 1;
}

export async function updateGraph(cwd: string, command: string): Promise<{ success: boolean; message: string }> {
  const result = await runProcess(command, ["update"], { cwd, timeout: 120000 });
  return { success: !result.failed, message: result.failed ? result.stderr : result.stdout };
}

export async function graphQuery(cwd: string, command: string, query: string, budget: number): Promise<{ success: boolean; output: string }> {
  const result = await runProcess(command, ["query", query, "--budget", String(budget)], { cwd, timeout: 30000 });
  return { success: !result.failed, output: result.failed ? result.stderr : result.stdout };
}

export async function graphExplain(cwd: string, command: string, symbol: string): Promise<{ success: boolean; output: string }> {
  const result = await runProcess(command, ["explain", symbol], { cwd, timeout: 15000 });
  return { success: !result.failed, output: result.failed ? result.stderr : result.stdout };
}

export async function graphAffected(cwd: string, command: string, symbol: string, depth: number): Promise<{ success: boolean; output: string }> {
  const result = await runProcess(command, ["affected", symbol, "--depth", String(depth)], { cwd, timeout: 15000 });
  return { success: !result.failed, output: result.failed ? result.stderr : result.stdout };
}

export async function graphPath(cwd: string, command: string, from: string, to: string): Promise<{ success: boolean; output: string }> {
  const result = await runProcess(command, ["path", from, to], { cwd, timeout: 15000 });
  return { success: !result.failed, output: result.failed ? result.stderr : result.stdout };
}

export async function graphStatus(cwd: string, command: string): Promise<{ success: boolean; output: string }> {
  const result = await runProcess(command, ["status"], { cwd, timeout: 10000 });
  return { success: !result.failed, output: result.failed ? result.stderr : result.stdout };
}

export function validateGraphifyConfig(config: GraphifyConfig): string[] {
  const errors: string[] = [];
  if (!["off", "advisory", "required"].includes(config.mode)) {
    errors.push(`Invalid graphify mode: ${config.mode}`);
  }
  if (!["never", "missing", "stale", "always"].includes(config.update_policy)) {
    errors.push(`Invalid update policy: ${config.update_policy}`);
  }
  if (config.query_budget < 100 || config.query_budget > 100000) {
    errors.push(`Query budget must be between 100 and 100000`);
  }
  return errors;
}
