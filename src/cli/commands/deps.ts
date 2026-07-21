import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

interface DepCheck {
  name: string;
  current: string;
  latest?: string;
  outdated: boolean;
}

export function depsCheckCommand(cwd: string): string {
  const pkgPath = resolve(cwd, "package.json");

  if (!existsSync(pkgPath)) {
    return "No package.json found. Only npm projects are supported.";
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
  const names = Object.keys(deps);
  const total = names.length;

  // Try npm outdated for latest version info
  let outdatedData: string[] = [];
  try {
    const result = execSync("npm outdated --json 2>/dev/null", {
      cwd,
      encoding: "utf-8",
    });
    if (result.trim()) {
      const parsed = JSON.parse(result);
      for (const [name, info] of Object.entries(parsed)) {
        const i = info as Record<string, string>;
        outdatedData.push(`  - ${name}: ${i.current} → ${i.latest}`);
      }
    }
  } catch {
    // npm outdated returns non-zero when packages are outdated
    try {
      const result = execSync("npm outdated --json 2>&1", {
        cwd,
        encoding: "utf-8",
      });
      if (result.trim()) {
        const parsed = JSON.parse(result);
        for (const [name, info] of Object.entries(parsed)) {
          const i = info as Record<string, string>;
          outdatedData.push(`  - ${name}: ${i.current} → ${i.latest}`);
        }
      }
    } catch {
      // ignore
    }
  }

  let report = `Dependency Check\n`;
  report += `Total dependencies: ${total}\n`;

  if (outdatedData.length > 0) {
    report += `\nOutdated packages (${outdatedData.length}):\n`;
    report += outdatedData.slice(0, 20).join("\n");
    if (outdatedData.length > 20) {
      report += `\n  ... and ${outdatedData.length - 20} more`;
    }
  } else {
    report += `\nAll packages are up to date! ✓`;
  }

  // Group by type
  const prodDeps = Object.keys(pkg.dependencies || {}).length;
  const devDeps = Object.keys(pkg.devDependencies || {}).length;
  report += `\n\nBreakdown:\n  - Production: ${prodDeps}\n  - Dev: ${devDeps}`;

  if (outdatedData.length > 0) {
    report += `\n\nRun \`npm outdated\` for full details or \`npm update\` to update.`;
  }

  return report;
}
