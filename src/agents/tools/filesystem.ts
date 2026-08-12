import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "node:fs";
import { join, relative, resolve, basename } from "node:path";
import type { Tool, ToolContext } from "./tool.js";

/**
 * Validate that a path stays within the workspace.
 * Prevents directory traversal attacks.
 */
function validatePath(filePath: string, context: ToolContext): string {
  const resolved = resolve(context.cwd, filePath);
  const rel = relative(context.cwd, resolved);
  if (rel.startsWith("..")) {
    throw new Error(`Path escapes workspace: ${filePath}`);
  }
  return resolved;
}

/**
 * Read a file's contents.
 */
export function readFile(): Tool {
  return {
    name: "read_file",
    description: "Read the contents of a file. Optionally read a specific line range.",
    parameters: {
      path: {
        type: "string",
        description: "Path to the file (relative to workspace)",
        required: true,
      },
      startLine: {
        type: "number",
        description: "Start line number (1-based, inclusive)",
        required: false,
      },
      endLine: {
        type: "number",
        description: "End line number (1-based, inclusive)",
        required: false,
      },
    },
    async execute(input: Record<string, unknown>, context: ToolContext): Promise<string> {
      const filePath = input.path as string;
      if (!filePath) {
        throw new Error("path is required");
      }

      const resolved = validatePath(filePath, context);
      const content = readFileSync(resolved, "utf-8");

      const startLine = input.startLine as number | undefined;
      const endLine = input.endLine as number | undefined;

      if (startLine !== undefined || endLine !== undefined) {
        const lines = content.split("\n");
        const start = (startLine ?? 1) - 1;
        const end = endLine ?? lines.length;
        const maxLines = context.maxLines ?? 1000;
        const sliced = lines.slice(start, Math.min(end, start + maxLines));
        return sliced.join("\n");
      }

      const maxLines = context.maxLines ?? 1000;
      const lines = content.split("\n");
      if (lines.length > maxLines) {
        return lines.slice(0, maxLines).join("\n") + `\n\n... (${lines.length - maxLines} more lines)`;
      }

      return content;
    },
  };
}

/**
 * Write content to a file. Creates parent directories if needed.
 */
export function writeFile(): Tool {
  return {
    name: "write_file",
    description: "Write content to a file. Creates parent directories if needed.",
    parameters: {
      path: {
        type: "string",
        description: "Path to the file (relative to workspace)",
        required: true,
      },
      content: {
        type: "string",
        description: "Content to write to the file",
        required: true,
      },
    },
    async execute(input: Record<string, unknown>, context: ToolContext): Promise<string> {
      const filePath = input.path as string;
      const content = input.content as string;
      if (!filePath) {
        throw new Error("path is required");
      }
      if (content === undefined) {
        throw new Error("content is required");
      }

      const resolved = validatePath(filePath, context);
      const dir = join(resolved, "..");
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolved, content, "utf-8");

      return `File written: ${filePath}`;
    },
  };
}

/**
 * Edit a file by finding and replacing text.
 */
export function editFile(): Tool {
  return {
    name: "edit_file",
    description: "Edit a file by finding and replacing the first occurrence of a string.",
    parameters: {
      path: {
        type: "string",
        description: "Path to the file (relative to workspace)",
        required: true,
      },
      oldString: {
        type: "string",
        description: "String to find and replace",
        required: true,
      },
      newString: {
        type: "string",
        description: "Replacement string",
        required: true,
      },
    },
    async execute(input: Record<string, unknown>, context: ToolContext): Promise<string> {
      const filePath = input.path as string;
      const oldString = input.oldString as string;
      const newString = input.newString as string;

      if (!filePath) {
        throw new Error("path is required");
      }
      if (oldString === undefined) {
        throw new Error("oldString is required");
      }
      if (newString === undefined) {
        throw new Error("newString is required");
      }

      const resolved = validatePath(filePath, context);
      const content = readFileSync(resolved, "utf-8");

      if (!content.includes(oldString)) {
        throw new Error(`oldString not found in ${filePath}`);
      }

      const updated = content.replace(oldString, newString);
      writeFileSync(resolved, updated, "utf-8");

      return `File edited: ${filePath}`;
    },
  };
}

/**
 * List files in a directory recursively.
 */
export function listFiles(): Tool {
  return {
    name: "list_files",
    description: "List files in a directory recursively. Supports optional glob pattern filtering.",
    parameters: {
      path: {
        type: "string",
        description: "Directory path (relative to workspace). Defaults to '.'.",
        required: false,
      },
      pattern: {
        type: "string",
        description: "Simple glob pattern to filter files (e.g., '*.ts')",
        required: false,
      },
    },
    async execute(input: Record<string, unknown>, context: ToolContext): Promise<string> {
      const dirPath = (input.path as string) ?? ".";
      const pattern = input.pattern as string | undefined;

      const resolved = validatePath(dirPath, context);
      const stat = statSync(resolved, { throwIfNoEntry: false });
      if (!stat || !stat.isDirectory()) {
        throw new Error(`Not a directory: ${dirPath}`);
      }

      const results: string[] = [];
      const maxResults = 200;

      function walk(dir: string, prefix: string): void {
        if (results.length >= maxResults) return;

        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxResults) return;

          const full = join(dir, entry.name);
          const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

          // Skip common unwanted directories
          if (entry.isDirectory() && ["node_modules", ".git", "dist", ".codewright-output"].includes(entry.name)) {
            continue;
          }

          if (entry.isDirectory()) {
            walk(full, relPath);
          } else {
            if (pattern && !matchGlob(relPath, pattern)) {
              continue;
            }
            results.push(relPath);
          }
        }
      }

      walk(resolved, "");

      if (results.length >= maxResults) {
        results.push(`\n... (${maxResults}+ results, truncated)`);
      }

      return results.length > 0 ? results.join("\n") : "No files found";
    },
  };
}

/**
 * Simple glob pattern matching (supports * wildcards).
 */
function matchGlob(filePath: string, pattern: string): boolean {
  // Convert simple glob to regex: * matches anything except /
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*/g, "[^/]*");
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(basename(filePath));
}

/**
 * Search for patterns in file contents.
 */
export function searchCode(): Tool {
  return {
    name: "search_code",
    description: "Search for patterns in file contents using string matching.",
    parameters: {
      pattern: {
        type: "string",
        description: "Search pattern (string to find)",
        required: true,
      },
      path: {
        type: "string",
        description: "Directory to search in (relative to workspace). Defaults to '.'.",
        required: false,
      },
      glob: {
        type: "string",
        description: "File glob to filter (e.g., '*.ts')",
        required: false,
      },
    },
    async execute(input: Record<string, unknown>, context: ToolContext): Promise<string> {
      const searchPattern = input.pattern as string;
      const dirPath = (input.path as string) ?? ".";
      const fileGlob = input.glob as string | undefined;

      if (!searchPattern) {
        throw new Error("pattern is required");
      }

      const resolved = validatePath(dirPath, context);
      const maxResults = 100;
      const results: string[] = [];

      function walk(dir: string): void {
        if (results.length >= maxResults) return;

        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxResults) return;

          const full = join(dir, entry.name);

          if (entry.isDirectory() && ["node_modules", ".git", "dist", ".codewright-output"].includes(entry.name)) {
            continue;
          }

          if (entry.isDirectory()) {
            walk(full);
          } else {
            if (fileGlob && !matchGlob(entry.name, fileGlob)) {
              continue;
            }

            try {
              const content = readFileSync(full, "utf-8");
              const lines = content.split("\n");
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(searchPattern)) {
                  const relPath = relative(context.cwd, full);
                  results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
                  if (results.length >= maxResults) break;
                }
              }
            } catch {
              // Skip binary or unreadable files
            }
          }
        }
      }

      walk(resolved);

      if (results.length >= maxResults) {
        results.push(`\n... (${maxResults}+ results, truncated)`);
      }

      return results.length > 0 ? results.join("\n") : "No matches found";
    },
  };
}
