import { resolve } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { loadConfig, resolveSpecDir } from "../../config/loader.js";
import { writeArtifact } from "../../artifacts/writer.js";
import { storyTemplate } from "../../templates/story-template.js";

export interface StoryCreateOptions {
  cwd: string;
  spec: string;
  id: string;
  title: string;
  phase?: string;
}

export function storyCreateCommand(opts: StoryCreateOptions) {
  const config = loadConfig(opts.cwd);

  const storyId = opts.id;
  const filename = `${storyId}-${opts.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.md`;

  const content = storyTemplate({
    story_id: storyId,
    story_title: opts.title,
    phase: opts.phase || "1",
    spec_name: opts.spec,
  });

  const path = writeArtifact({
    cwd: opts.cwd,
    outputFolder: config.output_folder,
    subpath: `specs/spec-${opts.spec}/stories`,
    filename,
    content,
  });

  return { path, filename };
}

export function storyListCommand(cwd: string, spec: string) {
  const config = loadConfig(cwd);
  const specDir = resolveSpecDir(cwd, config, spec);
  const storiesDir = resolve(specDir, "stories");

  if (!existsSync(storiesDir)) return [];

  const stories: Array<{ id: string; title: string; status: string; file: string }> = [];
  for (const file of readdirSync(storiesDir).filter((f: string) => f.endsWith(".md"))) {
    const content = readFileSync(resolve(storiesDir, file), "utf-8");
    const idMatch = content.match(/^id:\s*(.+)/m);
    const statusMatch = content.match(/^status:\s*(\S+)/m);
    const titleMatch = content.match(/^#\s+(.+)/m);
    stories.push({
      id: idMatch?.[1] || "unknown",
      title: titleMatch?.[1] || file,
      status: statusMatch?.[1]?.trim() || "unknown",
      file,
    });
  }

  return stories;
}
