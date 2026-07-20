import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadConfig, resolveSpecDir } from "../../config/loader.js";
import { memlog } from "../../memlog/memlog.js";
import { writeArtifact } from "../../artifacts/writer.js";
import { specTemplate } from "../../templates/spec-template.js";

export interface SpecCreateOptions {
  cwd: string;
  slug: string;
  input?: string;
}

export function specCreateCommand(opts: SpecCreateOptions) {
  const config = loadConfig(opts.cwd);
  const specDir = resolveSpecDir(opts.cwd, config, opts.slug);

  const ml = memlog();
  ml.init(specDir, { topic: opts.slug, goal: "" });
  ml.append(specDir, { type: "note", text: `Spec ${opts.slug} created` });

  if (opts.input) {
    const inputPath = resolve(opts.cwd, opts.input);
    if (existsSync(inputPath)) {
      const inputContent = readFileSync(inputPath, "utf-8");
      ml.append(specDir, { type: "note", text: `Input loaded from ${opts.input}` });
      ml.append(specDir, { type: "note", text: `---\n${inputContent}\n---` });
    }
  }

  deriveSpec(specDir, opts.slug, config);
  return { specDir };
}

export function specUpdateCommand(cwd: string, slug: string) {
  const config = loadConfig(cwd);
  const specDir = resolveSpecDir(cwd, config, slug);
  deriveSpec(specDir, slug, config);
  return { specDir };
}

function deriveSpec(specDir: string, slug: string, _config: { output_folder: string }) {
  const ml = memlog();
  const data = ml.read(specDir);

  const topic = data.frontmatter.topic || slug;
  const goal = data.frontmatter.goal || "";

  const caps = data.entries
    .filter((e) => e.type === "capability")
    .map((e, i) => {
      const match = e.text.match(/^CAP-\d+:\s*(.+)/);
      return { id: `CAP-${i + 1}`, text: match ? match[1] : e.text };
    });

  const constraints = data.entries
    .filter((e) => e.type === "constraint")
    .map((e) => e.text);

  const decisions = data.entries
    .filter((e) => e.type === "decision")
    .map((e) => e.text);

  const content = specTemplate({ slug, topic, goal, capabilities: caps, constraints, decisions });

  writeFileSync(resolve(specDir, "SPEC.md"), content, "utf-8");
}
