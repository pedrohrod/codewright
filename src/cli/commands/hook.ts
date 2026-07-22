import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const PRE_COMMIT_HOOK = `#!/bin/sh
# Codewright pre-commit hook
# Installed by \`codewright hook install\`

echo "🔍 Codewright: Running pre-commit checks..."

# Check for TODO/FIXME in staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)
HAS_ISSUES=0

for FILE in $STAGED_FILES; do
  if [ -f "$FILE" ]; then
    # Check for TODO/FIXME without ticket number
    grep -n "TODO:\|FIXME:" "$FILE" 2>/dev/null | grep -v "TODO:[A-Z]\+-" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
      echo "  ⚠️  $FILE has TODO/FIXME without ticket number"
      HAS_ISSUES=1
    fi

    # Check for debugger statements
    grep -n "debugger\|console\.log" "$FILE" 2>/dev/null | head -5 > /dev/null 2>&1
    if [ $? -eq 0 ]; then
      echo "  ⚠️  $FILE has debugger/console.log statements"
      HAS_ISSUES=1
    fi
  fi
done

if [ $HAS_ISSUES -eq 1 ]; then
  echo "⚠️  Codewright: Found issues (not blocking)"
fi

echo "✓ Codewright: Pre-commit checks complete"
exit 0
`;

const COMMIT_MSG_HOOK = `#!/bin/sh
# Codewright commit-msg hook
# Installed by \`codewright hook install\`

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Check conventional commit format
echo "🔍 Codewright: Checking commit message..."

if ! echo "$COMMIT_MSG" | grep -qE "^(feat|fix|docs|style|refactor|test|chore|ci|perf|build|revert)(\(.+\))?!?: .{1,}$"; then
  echo ""
  echo "⚠️  Invalid commit message format."
  echo ""
  echo "Expected: type(scope): description"
  echo ""
  echo "Valid types: feat, fix, docs, style, refactor, test, chore, ci, perf, build, revert"
  echo ""
  echo "Example: feat(auth): add login feature"
  echo ""
fi

echo "✓ Codewright: Commit message check complete"
exit 0
`;

export function hookInstallCommand(cwd: string) {
  const codewrightHookDir = resolve(cwd, ".codewright", "hooks");
  const gitHookDir = resolve(cwd, ".git", "hooks");

  if (!existsSync(gitHookDir)) {
    return "Error: No .git/hooks directory found. Is this a git repository?";
  }

  // Create .codewright/hooks directory
  if (!existsSync(codewrightHookDir)) mkdirSync(codewrightHookDir, { recursive: true });

  const hooks = [
    { name: "pre-commit", content: PRE_COMMIT_HOOK },
    { name: "commit-msg", content: COMMIT_MSG_HOOK },
  ];

  let installed = 0;
  for (const hook of hooks) {
    const hookPath = resolve(codewrightHookDir, hook.name);
    const gitHookPath = resolve(gitHookDir, hook.name);

    // Write hook to .codewright/hooks
    writeFileSync(hookPath, hook.content, { mode: 0o755 });

    // Symlink or copy to .git/hooks
    if (!existsSync(gitHookPath)) {
      writeFileSync(gitHookPath, hook.content, { mode: 0o755 });
      installed++;
    } else {
      // Backup existing hook and create a wrapper
      const existingContent = readFileSync(gitHookPath, "utf-8");
      if (!existingContent.includes("Codewright")) {
        const backupPath = resolve(gitHookDir, `${hook.name}.backup`);
        writeFileSync(backupPath, existingContent, { mode: 0o755 });
        // Write wrapper that runs both
        const wrapper = `#!/bin/sh
# Codewright wrapper - preserves the existing hook, then runs Codewright
if [ -f "${backupPath}" ]; then
  sh "${backupPath}" "$@" || exit $?
fi
if [ -f "${hookPath}" ]; then
  sh "${hookPath}" "$@" || exit $?
fi
`;
        writeFileSync(gitHookPath, wrapper, { mode: 0o755 });
        installed++;
      }
    }
  }

  return `✓ Installed ${installed} git hooks:
  - pre-commit (checks TODO/FIXME, debugger statements)
  - commit-msg (validates conventional commit format)

Hooks stored in .codewright/hooks/`;
}

export function hookUninstallCommand(cwd: string) {
  const gitHookDir = resolve(cwd, ".git", "hooks");
  const codewrightHookDir = resolve(cwd, ".codewright", "hooks");
  if (!existsSync(gitHookDir)) return "No .git/hooks directory found.";

  let removed = 0;
  for (const hook of ["pre-commit", "commit-msg"]) {
    const gitHookPath = resolve(gitHookDir, hook);
    const managedPath = resolve(codewrightHookDir, hook);
    const backupPath = resolve(gitHookDir, hook + ".backup");
    if (existsSync(backupPath)) {
      writeFileSync(gitHookPath, readFileSync(backupPath), { mode: 0o755 });
      unlinkSync(backupPath);
      removed++;
    } else if (existsSync(gitHookPath) && readFileSync(gitHookPath, "utf-8").includes("Codewright")) {
      unlinkSync(gitHookPath);
      removed++;
    }
    if (existsSync(managedPath)) unlinkSync(managedPath);
  }
  return "✓ Removed " + removed + " Codewright hook(s) and restored available backups.";
}

export function hookListCommand(cwd: string) {
  const gitHookDir = resolve(cwd, ".git", "hooks");
  const codewrightHookDir = resolve(cwd, ".codewright", "hooks");

  if (!existsSync(gitHookDir)) {
    return "No .git/hooks directory found.";
  }

  const hooks = ["pre-commit", "commit-msg", "pre-push", "post-commit"];
  const result: string[] = ["Git hooks:"];

  for (const hook of hooks) {
    const gitHook = resolve(gitHookDir, hook);
    const cwHook = resolve(codewrightHookDir, hook);
    if (existsSync(gitHook)) {
      const type = existsSync(cwHook) ? " (codewright)" : "";
      result.push(`  - ${hook}${type}`);
    } else {
      result.push(`  - ${hook} (not installed)`);
    }
  }

  return result.join("\n");
}
