import type { ReviewResult, ReviewFinding } from "../providers/validation.js";
import type { GitClient } from "../providers/git/git-client.js";

const BINARY_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp",
  ".mp3", ".mp4", ".wav", ".avi", ".mov",
  ".pdf", ".zip", ".tar", ".gz", ".rar",
  ".woff", ".woff2", ".ttf", ".eot",
  ".exe", ".dll", ".so", ".dylib",
];

const LARGE_FILE_THRESHOLD = 500_000; // 500 KB

function isBinaryFile(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return BINARY_EXTENSIONS.includes(ext);
}

function estimateLineCount(diff: string): number {
  // Count lines that start with '+' or '-' (excluding +++, ---)
  return diff
    .split("\n")
    .filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---")).length;
}

function changedSourceFiles(diff: string): string[] {
  const files: string[] = [];
  const headerRegex = /^diff --git a\/.+ b\/(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(diff)) !== null) {
    files.push(match[1]);
  }
  return files;
}

function hasTestChanges(changedFiles: string[]): boolean {
  return changedFiles.some(
    (f) => f.includes(".test.") || f.includes(".spec.") || f.includes("__tests__/"),
  );
}

/**
 * Run a simple deterministic review on the git diff.
 * Intentionally minimal - real LLM review comes later.
 */
export async function runReview(git: GitClient): Promise<ReviewResult> {
  const findings: ReviewFinding[] = [];
  const diff = await git.diff();
  const files = changedSourceFiles(diff);

  // Check for binary files
  for (const file of files) {
    if (isBinaryFile(file)) {
      findings.push({
        severity: "medium",
        file,
        message: "Binary file detected in diff",
        recommendation: "Verify binary files are intentional and not accidentally committed.",
      });
    }
  }

  // Check for very large diffs (> 500 changed lines)
  const lineCount = estimateLineCount(diff);
  if (lineCount > LARGE_FILE_THRESHOLD) {
    findings.push({
      severity: "low",
      message: `Large diff detected (${lineCount} changed lines). Consider breaking into smaller changes.`,
    });
  }

  // Check if source files changed but no test files
  const sourceFiles = files.filter(
    (f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.includes(".test.") && !f.includes(".spec."),
  );
  if (sourceFiles.length > 0 && !hasTestChanges(files)) {
    findings.push({
      severity: "low",
      message: "Source files changed but no test files were modified.",
      recommendation: "Consider adding or updating tests for changed source files.",
    });
  }

  const hasCritical = findings.some((f) => f.severity === "critical" || f.severity === "high");

  return {
    status: hasCritical ? "changes_requested" : "approved",
    findings,
  };
}
