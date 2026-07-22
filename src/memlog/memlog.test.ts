import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { memlog } from "./memlog.js";

describe("memlog", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "memlog-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should initialize a memlog file with frontmatter", () => {
    const ml = memlog();
    ml.init(tmpDir, { topic: "Test", goal: "Test goal" });

    const data = ml.read(tmpDir);
    expect(data.frontmatter.topic).toBe("Test");
    expect(data.frontmatter.goal).toBe("Test goal");
    expect(data.frontmatter.updated).toBeDefined();
    expect(data.entries).toEqual([]);
  });

  it("should append entries", () => {
    const ml = memlog();
    ml.init(tmpDir, { topic: "Test", goal: "" });
    ml.append(tmpDir, { type: "capability", text: "CAP-1: Create user" });
    ml.append(tmpDir, { type: "decision", text: "Use PostgreSQL", by: "dev" });

    const data = ml.read(tmpDir);
    expect(data.entries).toHaveLength(2);
    expect(data.entries[0].text).toBe("CAP-1: Create user");
    expect(data.entries[1].text).toBe("Use PostgreSQL");
    expect(data.entries[1].by).toBe("dev");
  });

  it("should set frontmatter fields", () => {
    const ml = memlog();
    ml.init(tmpDir, { topic: "Test", goal: "" });
    ml.set(tmpDir, "goal", "MVP in 1 week");
    ml.set(tmpDir, "priority", "high");

    const data = ml.read(tmpDir);
    expect(data.frontmatter.goal).toBe("MVP in 1 week");
    expect(data.frontmatter.priority).toBe("high");
  });

  it("should append entries without prior init", () => {
    const ml = memlog();
    ml.append(tmpDir, { type: "note", text: "First entry" });

    const data = ml.read(tmpDir);
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].text).toBe("First entry");
  });

  it("should handle empty or non-existent workspace", () => {
    const ml = memlog();
    const data = ml.read("/nonexistent/path");
    expect(data.frontmatter).toEqual({});
    expect(data.entries).toEqual([]);
  });
});
