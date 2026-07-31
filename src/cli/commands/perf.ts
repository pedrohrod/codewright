// Legacy perf.ts - now a wrapper for the new perf module
// This file is kept for backward compatibility but all functionality
// has been moved to the perf/ directory with subcommands

export { perfInitCommand, perfValidateCommand, perfRunCommand, perfReportCommand, perfCleanupCommand } from "./perf/index.js";
export type { PerfConfig, PerfScenario, PerfThresholds, PerfResult } from "./perf/types.js";
export type { ProcessResult } from "../../utils/process.js";
