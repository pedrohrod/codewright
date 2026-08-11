export type CheckResult = "PASS" | "FAIL" | "SKIPPED";

export interface ValidationCheck {
  name: string;
  command: string;
  result: CheckResult;
  output?: string;
}

export interface ValidationResult {
  checks: ValidationCheck[];
  passed: boolean;
}

export interface ReviewFinding {
  severity: "critical" | "high" | "medium" | "low";
  file?: string;
  line?: number;
  message: string;
  recommendation?: string;
}

export interface ReviewResult {
  status: "approved" | "changes_requested";
  findings: ReviewFinding[];
}

export interface EngineeringPlan {
  summary: string;
  problem: string;
  filesLikelyAffected: string[];
  steps: string[];
  risks: string[];
  validationPlan: string[];
}

export interface EngineeringResult {
  status: "completed" | "blocked" | "failed" | "no_changes";
  ticket: {
    id: string;
    externalId: string;
    title: string;
  };
  branch?: string;
  pullRequest?: {
    number?: number;
    url: string;
  };
  summary: string;
  changedFiles: string[];
  validation: ValidationResult;
  review: ReviewResult;
  blockers: string[];
  metrics: {
    iterations: number;
    durationMs: number;
  };
}

export interface WorkflowConfig {
  draft?: boolean;
  maxIterations?: number;
  maxTicketsPerRun?: number;
}

export interface ValidationConfig {
  commands?: string[];
}
