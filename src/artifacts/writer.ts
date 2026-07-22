import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface WriteOptions {
  cwd: string;
  outputFolder: string;
  subpath: string;
  filename: string;
  content: string;
}

export function writeArtifact(opts: WriteOptions): string {
  const dir = resolve(opts.cwd, opts.outputFolder, opts.subpath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const fp = resolve(dir, opts.filename);
  writeFileSync(fp, opts.content, "utf-8");
  return fp;
}
