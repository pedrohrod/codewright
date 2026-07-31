import { resolve } from "node:path";
import { loadGraphifyConfig, checkGraphifyAvailable, checkGraphExists, updateGraph, graphQuery, graphExplain, graphAffected, graphPath, graphStatus } from "../../config/graphify.js";
import { loadConfig } from "../../config/loader.js";

export interface GraphResult {
  success: boolean;
  output: string;
  command?: string;
}

function getGraphifyCommand(cwd: string): string {
  const config = loadConfig(cwd);
  const graphifyConfig = loadGraphifyConfig(config as unknown as Record<string, unknown>);
  return graphifyConfig.command;
}

function getGraphPath(cwd: string): string {
  const config = loadConfig(cwd);
  const graphifyConfig = loadGraphifyConfig(config as unknown as Record<string, unknown>);
  return graphifyConfig.graph_path;
}

export async function graphStatusCommand(cwd: string): Promise<GraphResult> {
  const command = getGraphifyCommand(cwd);
  const { available } = await checkGraphifyAvailable(command);
  if (!available) {
    return { success: false, output: "Graphify is not installed. Install it with: npm install -g graphify" };
  }
  return await graphStatus(cwd, command);
}

export async function graphUpdateCommand(cwd: string): Promise<GraphResult> {
  const command = getGraphifyCommand(cwd);
  const { available } = await checkGraphifyAvailable(command);
  if (!available) {
    return { success: false, output: "Graphify is not installed. Install it with: npm install -g graphify" };
  }
  const result = await updateGraph(cwd, command);
  return { success: result.success, output: result.message };
}

export async function graphQueryCommand(cwd: string, query: string, budget?: number): Promise<GraphResult> {
  const config = loadConfig(cwd);
  const graphifyConfig = loadGraphifyConfig(config as unknown as Record<string, unknown>);
  const command = graphifyConfig.command;
  const { available } = await checkGraphifyAvailable(command);
  if (!available) {
    return { success: false, output: "Graphify is not installed. Install it with: npm install -g graphify" };
  }
  const graphExists = checkGraphExists(cwd, graphifyConfig.graph_path);
  if (!graphExists) {
    return { success: false, output: "Graph not found. Run: codewright graph update" };
  }
  return await graphQuery(cwd, command, query, budget || graphifyConfig.query_budget);
}

export async function graphExplainCommand(cwd: string, symbol: string): Promise<GraphResult> {
  const config = loadConfig(cwd);
  const graphifyConfig = loadGraphifyConfig(config as unknown as Record<string, unknown>);
  const command = graphifyConfig.command;
  const { available } = await checkGraphifyAvailable(command);
  if (!available) {
    return { success: false, output: "Graphify is not installed. Install it with: npm install -g graphify" };
  }
  return await graphExplain(cwd, command, symbol);
}

export async function graphAffectedCommand(cwd: string, symbol: string, depth: number = 3): Promise<GraphResult> {
  const config = loadConfig(cwd);
  const graphifyConfig = loadGraphifyConfig(config as unknown as Record<string, unknown>);
  const command = graphifyConfig.command;
  const { available } = await checkGraphifyAvailable(command);
  if (!available) {
    return { success: false, output: "Graphify is not installed. Install it with: npm install -g graphify" };
  }
  return await graphAffected(cwd, command, symbol, depth);
}

export async function graphPathCommand(cwd: string, from: string, to: string): Promise<GraphResult> {
  const config = loadConfig(cwd);
  const graphifyConfig = loadGraphifyConfig(config as unknown as Record<string, unknown>);
  const command = graphifyConfig.command;
  const { available } = await checkGraphifyAvailable(command);
  if (!available) {
    return { success: false, output: "Graphify is not installed. Install it with: npm install -g graphify" };
  }
  return await graphPath(cwd, command, from, to);
}
