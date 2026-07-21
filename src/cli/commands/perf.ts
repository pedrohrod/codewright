import { existsSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { loadConfig } from "../../config/loader.js";

const K6_SCRIPT = `import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // ramp up
    { duration: '1m', target: 10 },   // steady
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% requests under 500ms
    http_req_failed: ['rate<0.01'],     // less than 1% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(BASE_URL);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
`;

const ARTILLERY_CONFIG = `config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 5
      rampTo: 20
      name: "Warm up"
    - duration: 120
      arrivalRate: 20
      name: "Sustained load"
  plugins:
    metrics-by-endpoint: {}

scenarios:
  - name: "GET /api"
    flow:
      - get:
          url: "/api"
      - think: 1
`;

function detectUrl(): string {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    const scripts = pkg.scripts || {};
    if (scripts.start) return "http://localhost:3000";
    if (scripts.dev) return "http://localhost:3000";
  } catch {}
  return "http://localhost:3000";
}

export function perfSetupCommand(cwd: string, tool: string): string {
  const perfDir = resolve(cwd, "perf-tests");
  if (!existsSync(perfDir)) {
    mkdirSync(perfDir, { recursive: true });
  }

  const url = detectUrl();

  if (tool === "k6" || !tool) {
    const scriptPath = resolve(perfDir, "load-test.js");
    if (!existsSync(scriptPath)) {
      writeFileSync(scriptPath, K6_SCRIPT, "utf-8");
    }

    return `✓ k6 test created at perf-tests/load-test.js

To run:
  npm install -g k6  # or: brew install k6
  k6 run perf-tests/load-test.js -e BASE_URL=${url}

Test scenario:
  - Ramp up: 30s to 10 users
  - Steady: 1m at 10 users
  - Ramp down: 30s to 0 users
  - Threshold: 95% requests under 500ms
  - Max error rate: 1%`;
  }

  if (tool === "artillery") {
    const configPath = resolve(perfDir, "artillery.yml");
    if (!existsSync(configPath)) {
      writeFileSync(configPath, ARTILLERY_CONFIG, "utf-8");
    }

    return `✓ Artillery config created at perf-tests/artillery.yml

To run:
  npm install -g artillery
  artillery run perf-tests/artillery.yml

Test scenario:
  - Warm up: 60s, 5→20 req/s
  - Sustained: 120s at 20 req/s
  - Target: ${url}`;
  }

  return `Unsupported tool: ${tool}. Use "k6" or "artillery".`;
}

export function perfRunCommand(cwd: string, tool: string): string {
  const perfDir = resolve(cwd, "perf-tests");

  if (tool === "k6") {
    const scriptPath = resolve(perfDir, "load-test.js");
    if (!existsSync(scriptPath)) {
      return "No k6 script found. Run 'codewright perf setup k6' first.";
    }

    try {
      execSync("which k6", { encoding: "utf-8" });
    } catch {
      return "k6 not installed. Install it: brew install k6";
    }

    try {
      const output = execSync(`k6 run ${scriptPath} --quiet 2>&1`, {
        cwd,
        encoding: "utf-8",
        timeout: 120000,
      }).trim();
      return output;
    } catch (e) {
      const err = e as Error;
      return `k6 run failed: ${err.message}`;
    }
  }

  if (tool === "artillery") {
    const configPath = resolve(perfDir, "artillery.yml");
    if (!existsSync(configPath)) {
      return "No Artillery config found. Run 'codewright perf setup artillery' first.";
    }

    try {
      const output = execSync(`npx artillery run ${configPath} 2>&1`, {
        cwd: perfDir,
        encoding: "utf-8",
        timeout: 180000,
      }).trim();
      return output;
    } catch (e) {
      const err = e as Error;
      return `Artillery run failed: ${err.message}`;
    }
  }

  return `Unsupported tool: ${tool}`;
}
