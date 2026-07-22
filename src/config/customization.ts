import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "smol-toml";

function flattenToml(value: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry) && !(entry instanceof Date)) {
      Object.assign(result, flattenToml(entry as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = entry;
    }
  }
  return result;
}

function loadToml(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return flattenToml(parse(readFileSync(path, "utf-8")) as Record<string, unknown>);
  } catch {
    return {};
  }
}

const CACHE = new Map<string, Record<string, unknown>>();

export function loadCustomization(cwd: string, skillName: string): Record<string, unknown> {
  const cacheKey = `${cwd}:${skillName}`;
  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey)!;

  const customDir = resolve(cwd, ".codewright", "custom");
  const skillDir = resolve(cwd, "skills", skillName);
  const agentsSkillDir = resolve(cwd, ".agents", "skills", skillName);
  const skillToml = existsSync(resolve(skillDir, "customize.toml"))
    ? resolve(skillDir, "customize.toml")
    : existsSync(resolve(agentsSkillDir, "customize.toml"))
      ? resolve(agentsSkillDir, "customize.toml")
      : "";

  const merged: Record<string, unknown> = {
    ...(skillToml ? loadToml(skillToml) : {}),
    ...loadToml(resolve(customDir, `${skillName}.toml`)),
    ...loadToml(resolve(customDir, `${skillName}.user.toml`)),
  };

  CACHE.set(cacheKey, merged);
  return merged;
}

export function clearCustomizationCache() {
  CACHE.clear();
}
