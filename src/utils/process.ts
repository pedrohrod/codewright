import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFileCb);

export interface ProcessResult {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  failed: boolean;
}

export interface ProcessOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export async function runProcess(
  command: string,
  args: string[],
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const { cwd, timeout = 30000, env } = options;

  try {
    const result = await execFileAsync(command, args, {
      cwd,
      timeout,
      env: { ...process.env, ...env },
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return {
      command,
      args,
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: false,
      failed: false,
    };
  } catch (error: unknown) {
    const err = error as {
      code?: string;
      stdout?: string;
      stderr?: string;
      killed?: boolean;
      message?: string;
    };

    const isTimeout = err.killed === true || err.code === "ETIMEDOUT";
    const exitCode = typeof err.code === "number" ? err.code : 1;

    return {
      command,
      args,
      exitCode,
      stdout: err.stdout || "",
      stderr: err.stderr || err.message || "",
      timedOut: isTimeout,
      failed: true,
    };
  }
}

export function formatProcessResult(result: ProcessResult, human = true): string {
  if (human) {
    if (result.failed) {
      if (result.timedOut) return `Command timed out: ${result.command} ${result.args.join(" ")}`;
      return `Command failed (exit ${result.exitCode}): ${result.command} ${result.args.join(" ")}\n${result.stderr}`;
    }
    return result.stdout;
  }
  return JSON.stringify(result, null, 2);
}
