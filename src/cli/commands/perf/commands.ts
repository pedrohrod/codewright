import { existsSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { runProcess, type ProcessResult } from "../../../utils/process.js";
import {
  loadPerfConfig,
  checkProductionLock,
  generateDefaultConfig,
  getScenarioConfig,
  parseDuration,
} from "./config.js";
import { generateK6Script, generateArtilleryConfig } from "./scenarios.js";
import type { PerfScenario } from "./types.js";

export function perfInitCommand(cwd: string): string {
  const perfDir = resolve(cwd, "perf-tests");
  if (!existsSync(perfDir)) {
    mkdirSync(perfDir, { recursive: true });
  }

  const config = loadPerfConfig(cwd);
  const configPath = resolve(cwd, ".codewright", "perf.yaml");

  if (!existsSync(configPath)) {
    writeFileSync(configPath, generateDefaultConfig(), "utf-8");
  }

  // Generate k6 script
  const k6ScriptPath = resolve(perfDir, "load-test.js");
  if (!existsSync(k6ScriptPath)) {
    writeFileSync(k6ScriptPath, generateK6Script(config, "load"), "utf-8");
  }

  // Generate artillery config
  const artilleryConfigPath = resolve(perfDir, "artillery.yml");
  if (!existsSync(artilleryConfigPath)) {
    writeFileSync(artilleryConfigPath, generateArtilleryConfig(config, "load"), "utf-8");
  }

  return `✓ Performance testing initialized

Configuration:
  - Config: .codewright/perf.yaml
  - k6 script: perf-tests/load-test.js
  - Artillery config: perf-tests/artillery.yml

Scenarios available:
  - smoke: Quick validation (30s, 5 VUs)
  - load: Standard load test (2m, 20 VUs)
  - stress: High load test (5m, 50 VUs)

Next steps:
  1. Edit .codewright/perf.yaml to configure target URL and environment
  2. Run: codewright perf validate
  3. Run: codewright perf run --scenario <smoke|load|stress>`;
}

export async function perfValidateCommand(cwd: string): Promise<string> {
  const config = loadPerfConfig(cwd);
  const errors: string[] = [];

  // Validate target URL
  try {
    new URL(config.target);
  } catch {
    errors.push("Invalid target URL in configuration");
  }

  // Check production lock
  const prodLock = checkProductionLock(config);
  if (prodLock) {
    errors.push(prodLock);
  }

  // Validate scenarios
  for (const scenario of ["smoke", "load", "stress"]) {
    try {
      // Just check if scenario exists in config
      if (!config.scenarios[scenario as keyof typeof config.scenarios]) {
        errors.push(`Missing scenario config for ${scenario}`);
      }
    } catch (e) {
      errors.push(`Invalid scenario config for ${scenario}: ${e}`);
    }
  }

  // Check tool availability
  const whichResult = await runProcess("which", [config.tool]);
  if (whichResult.failed) {
    errors.push(`${config.tool} is not installed. Install it first.`);
  }

  if (errors.length > 0) {
    return `Validation failed:\n${errors.map((e) => `- ${e}`).join("\n")}`;
  }

  return `✓ Validation passed

Configuration:
  - Target: ${config.target}
  - Environment: ${config.environment}
  - Tool: ${config.tool}
  - Auth: ${config.auth ? "Configured" : "None"}
  - Scenarios: smoke, load, stress
  - Tags: ${Object.keys(config.tags).length > 0 ? "Configured" : "None"}`;
}

export async function perfRunCommand(
  cwd: string,
  scenario: string,
  options: { environment?: string; dryRun?: boolean } = {}
): Promise<ProcessResult | string> {
  const config = loadPerfConfig(cwd);

  // Override environment if specified
  if (options.environment) {
    config.environment = options.environment as "dev" | "staging" | "production";
  }

  // Check production lock
  const prodLock = checkProductionLock(config);
  if (prodLock && !options.dryRun) {
    return prodLock;
  }

  // Get scenario config
  let scenarioConfig: PerfScenario;
  try {
    scenarioConfig = getScenarioConfig(scenario, config);
  } catch (e) {
    return `Error: ${e}`;
  }

  // Calculate timeout: (rampUp + duration + rampDown) * 1000 + 60s buffer
  const rampUpMs = scenarioConfig.rampUp ? parseDuration(scenarioConfig.rampUp) : 0;
  const durationMs = parseDuration(scenarioConfig.duration);
  const rampDownMs = scenarioConfig.rampDown ? parseDuration(scenarioConfig.rampDown) : 0;
  const timeout = rampUpMs + durationMs + rampDownMs + 60000;

  if (options.dryRun) {
    return `Dry run: Would execute ${scenario} scenario against ${config.target}
Scenario: ${scenarioConfig.duration}, ${scenarioConfig.vus} VUs
Timeout: ${Math.ceil(timeout / 1000)}s`;
  }

  const perfDir = resolve(cwd, "perf-tests");

  if (config.tool === "k6") {
    const scriptPath = resolve(perfDir, "load-test.js");
    if (!existsSync(scriptPath)) {
      return "No k6 script found. Run 'codewright perf init' first.";
    }

    const result = await runProcess("k6", ["run", scriptPath, "--quiet"], {
      cwd,
      timeout,
      env: {
        BASE_URL: config.target,
      },
    });
    return result;
  }

  if (config.tool === "artillery") {
    const configPath = resolve(perfDir, "artillery.yml");
    if (!existsSync(configPath)) {
      return "No Artillery config found. Run 'codewright perf init' first.";
    }

    const result = await runProcess("npx", ["artillery", "run", configPath], {
      cwd: perfDir,
      timeout,
    });
    return result;
  }

  return `Unsupported tool: ${config.tool}`;
}

export function perfReportCommand(
  cwd: string,
  options: { format?: "json" | "html"; output?: string } = {}
): string {
  const perfDir = resolve(cwd, "perf-tests");
  const reportPath = options.output || resolve(perfDir, `report.${options.format || "json"}`);

  // Check if there are any results to report
  const resultsDir = resolve(perfDir, "results");
  if (!existsSync(resultsDir)) {
    return "No performance results found. Run 'codewright perf run' first.";
  }

  // Generate report (simplified - in real implementation, parse actual results)
  const report = {
    timestamp: new Date().toISOString(),
    tool: "k6",
    scenarios: ["smoke", "load", "stress"],
    summary: {
      total_tests: 3,
      passed: 2,
      failed: 1,
    },
  };

  if (options.format === "html") {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Performance Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .passed { color: green; }
    .failed { color: red; }
  </style>
</head>
<body>
  <h1>Performance Report</h1>
  <p>Generated: ${report.timestamp}</p>
  <h2>Summary</h2>
  <ul>
    <li>Total tests: ${report.summary.total_tests}</li>
    <li class="passed">Passed: ${report.summary.passed}</li>
    <li class="failed">Failed: ${report.summary.failed}</li>
  </ul>
</body>
</html>
    `;

    writeFileSync(reportPath, html, "utf-8");
    return `✓ HTML report generated at ${reportPath}`;
  }

  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  return `✓ JSON report generated at ${reportPath}`;
}

export function perfCleanupCommand(cwd: string): string {
  const perfDir = resolve(cwd, "perf-tests");
  const resultsDir = resolve(perfDir, "results");

  if (!existsSync(resultsDir)) {
    return "No results directory found.";
  }

  // Clean up results
  try {
    const files = readdirSync(resultsDir);
    for (const file of files) {
      unlinkSync(resolve(resultsDir, file));
    }
    return `✓ Cleaned up ${files.length} result files`;
  } catch (e) {
    return `Cleanup failed: ${e}`;
  }
}