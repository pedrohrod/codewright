import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PerfConfig, PerfScenario } from "./types.js";

// Default configurations
const DEFAULT_CONFIG: PerfConfig = {
  target: "http://localhost:3000",
  environment: "dev",
  tool: "k6",
  scenarios: {
    smoke: {
      name: "smoke",
      duration: "30s",
      vus: 5,
    },
    load: {
      name: "load",
      duration: "2m",
      vus: 20,
      rampUp: "30s",
      rampDown: "30s",
    },
    stress: {
      name: "stress",
      duration: "5m",
      vus: 50,
      rampUp: "1m",
      rampDown: "1m",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
  tags: {},
};

// Environment detection
export function detectEnvironment(url: string): "dev" | "staging" | "production" {
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    return "dev";
  }
  if (url.includes("staging") || url.includes("stg")) {
    return "staging";
  }
  return "production";
}

// Production lock
export function checkProductionLock(config: PerfConfig): string | null {
  if (config.environment === "production") {
    return "PERF_TEST_BLOCKED: Production performance tests are not allowed without explicit override.";
  }
  return null;
}

// Configuration loader
export function loadPerfConfig(cwd: string): PerfConfig {
  const configPath = resolve(cwd, ".codewright", "perf.yaml");
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const lines = raw.split("\n");
    const config = { ...DEFAULT_CONFIG };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed) continue;

      const [key, ...valueParts] = trimmed.split(":");
      const value = valueParts.join(":").trim();

      if (key && value) {
        switch (key.trim()) {
          case "target":
            config.target = value;
            break;
          case "environment":
            config.environment = value as "dev" | "staging" | "production";
            break;
          case "tool":
            config.tool = value as "k6" | "artillery";
            break;
        }
      }
    }

    return config;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

// Scenario definitions
export function getScenarioConfig(scenario: string, baseConfig: PerfConfig): PerfScenario {
  switch (scenario) {
    case "smoke":
      return baseConfig.scenarios.smoke;
    case "load":
      return baseConfig.scenarios.load;
    case "stress":
      return baseConfig.scenarios.stress;
    default:
      throw new Error(`Unknown scenario: ${scenario}. Available: smoke, load, stress`);
  }
}

// Duration parser
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like "30s", "2m", "1h"`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    default:
      return value * 1000;
  }
}

// Auth headers
export function getAuthHeaders(auth: PerfConfig["auth"]): Record<string, string> {
  if (!auth) return {};

  switch (auth.type) {
    case "bearer":
      return { Authorization: `Bearer ${auth.token}` };
    case "basic":
      const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
      return { Authorization: `Basic ${credentials}` };
    case "api-key":
      return { [auth.header || "X-API-Key"]: auth.token || "" };
    default:
      return {};
  }
}

// Generate default config file
export function generateDefaultConfig(): string {
  return `# Codewright Performance Testing Configuration

# Target environment
target: "http://localhost:3000"
environment: "dev"  # dev, staging, production

# Tool selection (k6 or artillery)
tool: "k6"

# Authentication (optional)
# auth:
#   type: "bearer"  # bearer, basic, api-key
#   token: "your-token"
#   # For basic auth:
#   # username: "user"
#   # password: "pass"
#   # For api-key:
#   # header: "X-API-Key"

# Scenarios
scenarios:
  smoke:
    name: "smoke"
    duration: "30s"
    vus: 5
  load:
    name: "load"
    duration: "2m"
    vus: 20
    rampUp: "30s"
    rampDown: "30s"
  stress:
    name: "stress"
    duration: "5m"
    vus: 50
    rampUp: "1m"
    rampDown: "1m"

# Thresholds
thresholds:
  http_req_duration:
    - "p(95)<500"
  http_req_failed:
    - "rate<0.01"

# Tags for results
tags:
  # team: "backend"
  # service: "api"
`;
}
