import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ValidationCheck,
  ValidationResult,
  ValidationConfig,
} from "../providers/validation.js";

interface PackageJson {
  scripts?: Record<string, string>;
}

/**
 * Detect available scripts from package.json.
 */
function detectAvailableScripts(cwd: string): string[] {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    return [];
  }
  try {
    const pkg: PackageJson = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return Object.keys(pkg.scripts ?? {});
  } catch {
    return [];
  }
}

/**
 * Run a single validation command.
 * Returns PASS, FAIL, or SKIPPED.
 */
function runCommand(
  command: string,
  cwd: string,
  availableScripts: string[],
): ValidationCheck {
  // Parse the command to check if it's a known script
  const parts = command.trim().split(/\s+/);
  const scriptName = parts[0];

  // If it's a plain script name (like "test", "lint") and not in package.json, skip
  if (scriptName && !scriptName.includes("/") && !scriptName.includes("&&")) {
    if (!availableScripts.includes(scriptName)) {
      return {
        name: scriptName,
        command,
        result: "SKIPPED",
        output: `Script '${scriptName}' not found in package.json`,
      };
    }
  }

  try {
    const output = execFileSync("sh", ["-c", command], {
      cwd,
      encoding: "utf-8",
      timeout: 120_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return {
      name: scriptName ?? command,
      command,
      result: "PASS",
      output: output.trim().slice(0, 2000),
    };
  } catch (err: unknown) {
    const error = err as { stderr?: string; stdout?: string; message?: string };
    const detail = (error.stderr ?? error.stdout ?? error.message ?? "").trim().slice(0, 2000);
    return {
      name: scriptName ?? command,
      command,
      result: "FAIL",
      output: detail,
    };
  }
}

/**
 * Run configured validation commands and return a ValidationResult.
 */
export function runValidation(
  config: ValidationConfig,
  cwd: string,
): ValidationResult {
  const commands = config.commands ?? [];
  const availableScripts = detectAvailableScripts(cwd);

  const checks: ValidationCheck[] = commands.map((cmd) =>
    runCommand(cmd, cwd, availableScripts),
  );

  const passed = checks.every((c) => c.result !== "FAIL");

  return { checks, passed };
}
