import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface MemlogEntry {
  type:
    | "decision"
    | "constraint"
    | "capability"
    | "assumption"
    | "question"
    | "direction"
    | "note"
    | "event";
  text: string;
  by?: string;
}

export interface MemlogData {
  frontmatter: Record<string, string>;
  entries: MemlogEntry[];
}

function frontmatterToString(fm: Record<string, string>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (v) lines.push(`${k}: ${v}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

function frontmatterFromString(raw: string): { frontmatter: Record<string, string>; body: string } {
  const frontmatter: Record<string, string> = {};
  if (!raw.startsWith("---")) return { frontmatter, body: raw };

  const endIndex = raw.indexOf("---", 3);
  if (endIndex === -1) return { frontmatter, body: raw };

  const fmBlock = raw.slice(3, endIndex).trim();
  const body = raw.slice(endIndex + 3).trim();

  for (const line of fmBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

function entryToLine(entry: MemlogEntry): string {
  const by = entry.by ? ` @${entry.by}` : "";
  return `- (${entry.type}) ${entry.text}${by}`;
}

function lineToEntry(line: string): MemlogEntry | null {
  const match = line.match(/^\s*-\s*\((\w+)\)\s+(.+)/);
  if (!match) return null;
  const type = match[1] as MemlogEntry["type"];
  const rest = match[2];
  const byMatch = rest.match(/(.+?)\s+@(\S+)$/);
  if (byMatch) {
    return { type, text: byMatch[1].trim(), by: byMatch[2] };
  }
  return { type, text: rest.trim() };
}

function getPath(ws: string): string {
  return resolve(ws, ".memlog.md");
}

function ensureDir(fp: string) {
  const dir = dirname(fp);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function init(workspace: string, fields: Record<string, string>) {
  const fp = getPath(workspace);
  ensureDir(fp);
  const fm = frontmatterToString({ ...fields, updated: new Date().toISOString() });
  // Use atomic write
  const tmp = fp + ".tmp";
  writeFileSync(tmp, fm, "utf-8");
  writeFileSync(fp, fm, "utf-8");
}

function append(workspace: string, entry: MemlogEntry) {
  const fp = getPath(workspace);
  ensureDir(fp);
  const existing = existsSync(fp) ? readFileSync(fp, "utf-8") : "";

  let frontmatter: Record<string, string> = {};
  let body = "";

  if (existing.startsWith("---")) {
    const parsed = frontmatterFromString(existing);
    frontmatter = parsed.frontmatter;
    body = parsed.body;
  } else {
    body = existing.trim();
  }

  frontmatter.updated = new Date().toISOString();
  const newLine = entryToLine(entry);
  const content = frontmatterToString(frontmatter) + (body ? body + "\n" : "") + newLine + "\n";

  const tmp = fp + ".tmp";
  writeFileSync(tmp, content, "utf-8");
  writeFileSync(fp, content, "utf-8");
}

function set(workspace: string, key: string, value: string) {
  const fp = getPath(workspace);
  ensureDir(fp);
  const existing = existsSync(fp) ? readFileSync(fp, "utf-8") : "";
  const { frontmatter, body } = frontmatterFromString(existing);
  frontmatter[key] = value;
  frontmatter.updated = new Date().toISOString();
  const content = frontmatterToString(frontmatter) + (body || "");

  const tmp = fp + ".tmp";
  writeFileSync(tmp, content, "utf-8");
  writeFileSync(fp, content, "utf-8");
}

function read(workspace: string): MemlogData {
  const fp = getPath(workspace);
  if (!existsSync(fp)) return { frontmatter: {}, entries: [] };
  const raw = readFileSync(fp, "utf-8");
  const { frontmatter, body } = frontmatterFromString(raw);
  const entries: MemlogEntry[] = [];
  for (const line of body.split("\n")) {
    const entry = lineToEntry(line);
    if (entry) entries.push(entry);
  }
  return { frontmatter, entries };
}

export function memlog() {
  return { init, append, set, read };
}
