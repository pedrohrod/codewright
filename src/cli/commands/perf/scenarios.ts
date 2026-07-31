import type { PerfConfig, PerfScenario } from "./types.js";
import { getAuthHeaders, parseDuration } from "./config.js";

// k6 script generator
export function generateK6Script(config: PerfConfig, scenario: string): string {
  const scenarioConfig = getScenarioConfigFromConfig(scenario, config);
  const durationMs = parseDuration(scenarioConfig.duration);

  const authHeader = config.auth
    ? `\nconst AUTH_HEADERS = ${JSON.stringify(getAuthHeaders(config.auth))};`
    : "";

  const tags = Object.entries(config.tags)
    .map(([k, v]) => `    ${k}: "${v}",`)
    .join("\n");

  const stages = [];

  if (scenarioConfig.rampUp) {
    stages.push(`        { duration: '${scenarioConfig.rampUp}', target: ${Math.floor(scenarioConfig.vus * 0.5)} },`);
  }

  stages.push(`        { duration: '${scenarioConfig.duration}', target: ${scenarioConfig.vus} },`);

  if (scenarioConfig.rampDown) {
    stages.push(`        { duration: '${scenarioConfig.rampDown}', target: 0 },`);
  }

  return `import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  scenarios: {
    ${scenarioConfig.name}: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
${stages.join("\n")}
      ],
    },
  },
  thresholds: ${JSON.stringify(config.thresholds, null, 2)},
  tags: {
${tags}
    scenario: '${scenario}',
  },
};

const BASE_URL = __ENV.BASE_URL || '${config.target}';
${authHeader}

export default function () {
  const headers = typeof AUTH_HEADERS !== 'undefined' ? AUTH_HEADERS : {};
  const res = http.get(BASE_URL, { headers });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}`;
}

// Artillery config generator
export function generateArtilleryConfig(config: PerfConfig, scenario: string): string {
  const scenarioConfig = getScenarioConfigFromConfig(scenario, config);
  const warmupDuration = Math.floor(parseDuration(scenarioConfig.duration) / 4 / 1000);
  const sustainedDuration = Math.floor(parseDuration(scenarioConfig.duration) / 1000);

  const authHeaders = config.auth
    ? getAuthHeadersYaml(config.auth)
    : '      Content-Type: "application/json"';

  return `config:
  target: "${config.target}"
  phases:
    - duration: ${warmupDuration}
      arrivalRate: ${Math.floor(scenarioConfig.vus * 0.1)}
      rampTo: ${Math.floor(scenarioConfig.vus * 0.5)}
      name: "Warm up"
    - duration: ${sustainedDuration}
      arrivalRate: ${scenarioConfig.vus}
      name: "Sustained load"
  plugins:
    metrics-by-endpoint: {}
  defaults:
    headers:
${authHeaders}

scenarios:
  - name: "${scenarioConfig.name}"
    flow:
      - get:
          url: "/"
      - think: 1
`;
}

// Auth headers for YAML
function getAuthHeadersYaml(auth: PerfConfig["auth"]): string {
  const headers = getAuthHeaders(auth);
  return Object.entries(headers)
    .map(([k, v]) => `      ${k}: "${v}"`)
    .join("\n");
}

// Get scenario config from PerfConfig
function getScenarioConfigFromConfig(scenario: string, config: PerfConfig): PerfScenario {
  switch (scenario) {
    case "smoke":
      return config.scenarios.smoke;
    case "load":
      return config.scenarios.load;
    case "stress":
      return config.scenarios.stress;
    default:
      throw new Error(`Unknown scenario: ${scenario}. Available: smoke, load, stress`);
  }
}
