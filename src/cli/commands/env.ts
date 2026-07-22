import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function envSetupCommand(cwd: string): string {
  const envExamplePath = resolve(cwd, ".env.example");
  const envPath = resolve(cwd, ".env");

  if (!existsSync(envExamplePath)) {
    return "No .env.example found. Create one first with the required variables.";
  }

  if (existsSync(envPath)) {
    // Compare and show missing vars
    const exampleVars = parseEnvFile(envExamplePath);
    const currentVars = parseEnvFile(envPath);
    const missing = exampleVars.filter((v) => !currentVars.includes(v));

    if (missing.length === 0) {
      return ".env is complete. All variables from .env.example are set.";
    }

    return `.env exists but missing ${missing.length} variable(s):\n${missing.join("\n")}`;
  }

  // Create .env from .env.example
  const content = readFileSync(envExamplePath, "utf-8");
  writeFileSync(envPath, content, "utf-8");

  return `.env created from .env.example with ${content.split("\n").filter((l) => l.trim() && !l.startsWith("#")).length} variables.`;
}

export function envListCommand(cwd: string): string {
  const envPath = resolve(cwd, ".env");

  if (!existsSync(envPath)) {
    return "No .env file found.";
  }

  const content = readFileSync(envPath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const vars = lines.map((l) => {
    const eqIdx = l.indexOf("=");
    if (eqIdx === -1) return `  - ${l}`;
    const key = l.slice(0, eqIdx).trim();
    const isSet = l.slice(eqIdx + 1).trim().length > 0;
    return `  - ${key}: ${isSet ? "set" : "unset"}`;
  });

  return `Environment variables (${vars.length}):\n${vars.join("\n")}`;
}

function parseEnvFile(path: string): string[] {
  const content = readFileSync(path, "utf-8");
  return content
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const eqIdx = l.indexOf("=");
      return eqIdx > 0 ? l.slice(0, eqIdx).trim() : "";
    })
    .filter(Boolean);
}
