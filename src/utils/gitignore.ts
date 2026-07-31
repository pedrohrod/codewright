import { execSync } from "node:child_process";

/**
 * Checks if a path is ignored by Git based on .gitignore rules.
 * @param targetPath The absolute path to check.
 * @param cwd The working directory (project root).
 * @returns true if the path is ignored, false otherwise or if git is unavailable.
 */
export function isPathGitignored(targetPath: string, cwd: string): boolean {
  try {
    // git check-ignore -q exits with 0 if the path is ignored, 1 if not ignored.
    // We use stdio: "pipe" to suppress output.
    execSync(`git check-ignore -q "${targetPath}"`, { cwd, stdio: "pipe" });
    return true;
  } catch {
    // Non-zero exit code (1) means not ignored.
    // ENOENT or other errors (128) mean git is unavailable or not a repo.
    return false;
  }
}
