import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Simple TOML parser for flat key-value tables.
 * Handles: [section], key = "value", key = true/false, key = [array]
 * Does NOT handle: inline tables, dotted keys, multi-line strings.
 */
function parseSimpleToml(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentSection = "";

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Section header [section]
    const sectionMatch = trimmed.match(/^\[(\w+)]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    // Key = value
    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const rawValue = kvMatch[2].trim();
      const fullKey = currentSection ? `${currentSection}.${key}` : key;

      let value: unknown;
      if (rawValue === "true") value = true;
      else if (rawValue === "false") value = false;
      else if (rawValue.startsWith('"') && rawValue.endsWith('"')) value = rawValue.slice(1, -1);
      else if (rawValue.startsWith("[")) {
        // Simple array of strings: ["a", "b", "c"]
        value = rawValue
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
      } else {
        value = rawValue;
      }

      result[fullKey] = value;
    }
  }

  return result;
}

function loadToml(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf-8");
    return parseSimpleToml(raw);
  } catch {
    return {};
  }
}

const CACHE = new Map<string, Record<string, unknown>>();

export function loadCustomization(cwd: string, skillName: string): Record<string, unknown> {
  const cacheKey = `${cwd}:${skillName}`;
  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey)!;

  const customDir = resolve(cwd, ".codewright", "custom");

  // Layer 1: Find the skill customize.toml (in package skills or .agents skills)
  const skillDir = resolve(cwd, "skills", skillName);
  const agentsSkillDir = resolve(cwd, ".agents", "skills", skillName);
  const skillToml = existsSync(resolve(skillDir, "customize.toml"))
    ? resolve(skillDir, "customize.toml")
    : existsSync(resolve(agentsSkillDir, "customize.toml"))
      ? resolve(agentsSkillDir, "customize.toml")
      : "";

  const defaults = skillToml ? loadToml(skillToml) : {};
  const teamOverrides = loadToml(resolve(customDir, `${skillName}.toml`));
  const userOverrides = loadToml(resolve(customDir, `${skillName}.user.toml`));

  // Merge: defaults → team → user (user wins)
  const merged: Record<string, unknown> = { ...defaults };
  Object.assign(merged, teamOverrides);
  Object.assign(merged, userOverrides);

  CACHE.set(cacheKey, merged);
  return merged;
}

export function clearCustomizationCache() {
  CACHE.clear();
}
