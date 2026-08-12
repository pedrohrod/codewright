import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFile, writeFile, editFile, listFiles, searchCode } from "./filesystem.js";
import type { ToolContext } from "./tool.js";

describe("filesystem tools", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    tmpDirs.length = 0;
  });

  function createTmpDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "fs-tool-test-"));
    tmpDirs.push(dir);
    return dir;
  }

  function ctx(cwd: string): ToolContext {
    return { cwd };
  }

  describe("readFile", () => {
    it("should read file contents", async () => {
      const dir = createTmpDir();
      writeFileSync(join(dir, "test.txt"), "hello world", "utf-8");

      const tool = readFile();
      const result = await tool.execute({ path: "test.txt" }, ctx(dir));
      expect(result).toBe("hello world");
    });

    it("should read specific line range", async () => {
      const dir = createTmpDir();
      writeFileSync(join(dir, "lines.txt"), "line1\nline2\nline3\nline4", "utf-8");

      const tool = readFile();
      const result = await tool.execute({ path: "lines.txt", startLine: 2, endLine: 3 }, ctx(dir));
      expect(result).toBe("line2\nline3");
    });

    it("should throw on missing path", async () => {
      const dir = createTmpDir();
      const tool = readFile();
      await expect(tool.execute({}, ctx(dir))).rejects.toThrow("path is required");
    });

    it("should throw on path traversal", async () => {
      const dir = createTmpDir();
      const tool = readFile();
      await expect(tool.execute({ path: "../etc/passwd" }, ctx(dir))).rejects.toThrow("escapes workspace");
    });
  });

  describe("writeFile", () => {
    it("should write file contents", async () => {
      const dir = createTmpDir();
      const tool = writeFile();
      const result = await tool.execute({ path: "output.txt", content: "test data" }, ctx(dir));
      expect(result).toBe("File written: output.txt");
    });

    it("should create parent directories", async () => {
      const dir = createTmpDir();
      const tool = writeFile();
      await tool.execute({ path: "sub/dir/file.txt", content: "nested" }, ctx(dir));

      const content = join(dir, "sub/dir/file.txt");
      const { readFileSync } = await import("node:fs");
      expect(readFileSync(content, "utf-8")).toBe("nested");
    });

    it("should throw on missing content", async () => {
      const dir = createTmpDir();
      const tool = writeFile();
      await expect(tool.execute({ path: "file.txt" }, ctx(dir))).rejects.toThrow("content is required");
    });
  });

  describe("editFile", () => {
    it("should replace first occurrence", async () => {
      const dir = createTmpDir();
      writeFileSync(join(dir, "editable.txt"), "hello world hello", "utf-8");

      const tool = editFile();
      const result = await tool.execute(
        { path: "editable.txt", oldString: "hello", newString: "hi" },
        ctx(dir),
      );
      expect(result).toBe("File edited: editable.txt");

      const { readFileSync } = await import("node:fs");
      expect(readFileSync(join(dir, "editable.txt"), "utf-8")).toBe("hi world hello");
    });

    it("should throw when oldString not found", async () => {
      const dir = createTmpDir();
      writeFileSync(join(dir, "file.txt"), "content", "utf-8");

      const tool = editFile();
      await expect(
        tool.execute({ path: "file.txt", oldString: "not_here", newString: "new" }, ctx(dir)),
      ).rejects.toThrow("oldString not found");
    });
  });

  describe("listFiles", () => {
    it("should list files recursively", async () => {
      const dir = createTmpDir();
      writeFileSync(join(dir, "a.txt"), "a", "utf-8");
      mkdirSync(join(dir, "sub"));
      writeFileSync(join(dir, "sub/b.txt"), "b", "utf-8");

      const tool = listFiles();
      const result = await tool.execute({}, ctx(dir));
      expect(result).toContain("a.txt");
      expect(result).toContain("sub/b.txt");
    });

    it("should filter by pattern", async () => {
      const dir = createTmpDir();
      writeFileSync(join(dir, "a.ts"), "a", "utf-8");
      writeFileSync(join(dir, "b.js"), "b", "utf-8");

      const tool = listFiles();
      const result = await tool.execute({ pattern: "*.ts" }, ctx(dir));
      expect(result).toContain("a.ts");
      expect(result).not.toContain("b.js");
    });

    it("should skip node_modules", async () => {
      const dir = createTmpDir();
      mkdirSync(join(dir, "node_modules"));
      writeFileSync(join(dir, "node_modules/pkg.js"), "pkg", "utf-8");
      writeFileSync(join(dir, "src.js"), "src", "utf-8");

      const tool = listFiles();
      const result = await tool.execute({}, ctx(dir));
      expect(result).toContain("src.js");
      expect(result).not.toContain("node_modules/pkg.js");
    });
  });

  describe("searchCode", () => {
    it("should find matching lines", async () => {
      const dir = createTmpDir();
      writeFileSync(join(dir, "code.ts"), "const x = 1;\nconst y = 2;\nconst z = 3;", "utf-8");

      const tool = searchCode();
      const result = await tool.execute({ pattern: "const y" }, ctx(dir));
      expect(result).toContain("code.ts");
      expect(result).toContain("const y = 2;");
    });

    it("should filter by glob", async () => {
      const dir = createTmpDir();
      writeFileSync(join(dir, "a.ts"), "const x = 1;", "utf-8");
      writeFileSync(join(dir, "b.js"), "const y = 2;", "utf-8");

      const tool = searchCode();
      const result = await tool.execute({ pattern: "const", glob: "*.ts" }, ctx(dir));
      expect(result).toContain("a.ts");
      expect(result).not.toContain("b.js");
    });

    it("should return no matches message when nothing found", async () => {
      const dir = createTmpDir();
      writeFileSync(join(dir, "file.txt"), "hello", "utf-8");

      const tool = searchCode();
      const result = await tool.execute({ pattern: "not_found" }, ctx(dir));
      expect(result).toBe("No matches found");
    });
  });
});
