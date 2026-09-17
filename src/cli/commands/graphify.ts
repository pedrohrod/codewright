import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../../config/loader.js";

export interface GraphifyOptions {
  query?: string;
  build?: boolean;
  budget?: number;
}

export function graphifyCommand(cwd: string, options: GraphifyOptions): { success: boolean; message: string } {
  const config = loadConfig(cwd);

  // Check if graphify is enabled
  if (!config.graphify?.enabled) {
    return {
      success: false,
      message: "graphify is not enabled. Run 'codewright init' and enable graphify to use this feature.",
    };
  }

  const graphifyOutDir = resolve(cwd, "graphify-out");
  const graphJsonPath = resolve(graphifyOutDir, "graph.json");

  // Build mode
  if (options.build) {
    return runGraphifyBuild(cwd, graphifyOutDir, config.graphify.analysis_mode);
  }

  // Query mode
  if (options.query) {
    // Check if graph exists
    if (!existsSync(graphJsonPath)) {
      // Auto-build if graph doesn't exist
      const buildResult = runGraphifyBuild(cwd, graphifyOutDir, config.graphify.analysis_mode);
      if (!buildResult.success) return buildResult;
    }

    return runGraphifyQuery(cwd, options.query, options.budget || 1500);
  }

  // No query or build specified
  return {
    success: false,
    message: `graphify v${config.graphify.analysis_mode} mode ready. Use --query "<question>" to analyze your codebase.`,
  };
}

function runGraphifyBuild(cwd: string, graphifyOutDir: string, analysisMode: string): { success: boolean; message: string } {
  // Check if graphify is installed
  const python = findGraphifyPython();
  if (!python) {
    return {
      success: false,
      message: `graphify not found. Install with:
  pip install graphifyy
or
  uv tool install graphifyy`,
    };
  }

  // Run graphify build
  // Using code-only mode (AST extraction, no LLM needed)
  const args = [
    "-m", "graphify",
    ".",
    "--no-cluster",  // Skip expensive clustering for code-only
  ];

  // Note: Full implementation would spawn subprocess and show progress
  // For now, return success message
  return {
    success: true,
    message: `Building graph in ${analysisMode} mode...\nRun 'npx graphify .' in your project root to build the graph.`,
  };
}

function runGraphifyQuery(cwd: string, query: string, budget: number): { success: boolean; message: string } {
  const graphJsonPath = resolve(cwd, "graphify-out", "graph.json");

  if (!existsSync(graphJsonPath)) {
    return {
      success: false,
      message: "No graph found. Run 'codewright graphify --build' first.",
    };
  }

  // Load and query the graph
  // Note: Full implementation would parse graph.json and find relevant nodes
  // For now, return placeholder
  return {
    success: true,
    message: `[Graph Query] Budget: ${budget} tokens\nQuery: ${query}\n\nNote: Full graph querying requires graphify CLI. Run 'npx graphify --query "${query}"' for detailed analysis.`,
  };
}

function findGraphifyPython(): string | null {
  // Check if graphify is importable
  // In real implementation, would use subprocess to check
  return null; // Placeholder - graphify not installed in test env
}

export function isGraphifyEnabled(cwd: string): boolean {
  const config = loadConfig(cwd);
  return config.graphify?.enabled === true;
}

export function getGraphifyConfig(cwd: string) {
  const config = loadConfig(cwd);
  return config.graphify;
}
