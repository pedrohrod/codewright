export interface PerfConfig {
  target: string;
  environment: "dev" | "staging" | "production";
  tool: "k6" | "artillery";
  auth?: {
    type: "bearer" | "basic" | "api-key";
    token?: string;
    username?: string;
    password?: string;
    header?: string;
  };
  scenarios: {
    smoke: PerfScenario;
    load: PerfScenario;
    stress: PerfScenario;
  };
  thresholds: PerfThresholds;
  tags: Record<string, string>;
}

export interface PerfScenario {
  name: string;
  duration: string;
  vus: number;
  rampUp?: string;
  rampDown?: string;
}

export interface PerfThresholds {
  http_req_duration: string[];
  http_req_failed: string[];
  [key: string]: string[];
}

export interface PerfResult {
  tool: string;
  scenario: string;
  environment: string;
  timestamp: string;
  duration: string;
  metrics: {
    http_req_duration: { avg: number; p90: number; p95: number; p99: number };
    http_req_failed: { rate: number };
    http_reqs: { rate: number };
  };
  thresholds: Record<string, { passed: boolean; value: number; threshold: number }>;
  passed: boolean;
}
