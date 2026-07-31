# Migration Guide: V1 to V2

## Overview

This guide helps you migrate from Codewright V1 to V2. The V2 release introduces several breaking changes, including a new manifest format, atomic installation, and multi-agent support.

## Key Changes

### 1. Manifest Format

**V1 Format:**
```yaml
# .codewright/manifest.yaml
version: "1.0"
skills:
  - codewright-spec
  - codewright-story
  - codewright-dev
```

**V2 Format:**
```yaml
# .codewright/manifest.yaml
version: "2.0"
project:
  name: my-project
  created: 2026-07-30
agents:
  - claude
  - cursor
graphify:
  mode: advisory
skills:
  - name: codewright-spec
    version: 2.1.0
  - name: codewright-story
    version: 2.0.5
```

### 2. Directory Structure

**V1:**
```
.codewright/
├── config.yaml
└── skills/
```

**V2:**
```
.codewright/
├── config.yaml
├── config.user.yaml
├── agents.yaml
├── manifest.yaml
├── custom/
├── rules/
└── graph/
.agents/
└── skills/
.claude/
└── skills/
.cursor/
└── commands/
```

### 3. Atomic Installation

V2 uses atomic installation to ensure that `init` either completes fully or rolls back completely.

### 4. Multi-agent Support

V2 supports multiple AI agents simultaneously.

## Migration Steps

### Step 1: Backup Your Project

```bash
cp -r .codewright .codewright.backup
```

### Step 2: Update Manifest

Update your manifest to V2 format:

```yaml
# .codewright/manifest.yaml
version: "2.0"
project:
  name: my-project
  created: 2026-07-30
agents:
  - claude
graphify:
  mode: off
skills:
  - name: codewright-spec
    version: 2.1.0
  - name: codewright-story
    version: 2.0.5
  - name: codewright-dev
    version: 2.2.0
```

### Step 3: Reinitialize

```bash
# Remove old installation
rm -rf .codewright .agents .claude .cursor .cline

# Reinitialize with V2
codewright init --agents claude
```

### Step 4: Verify Migration

```bash
# Check project health
codewright doctor

# Check agent health
codewright agents doctor

# Check graph status (if enabled)
codewright graph status
```

## Automated Migration

For projects with complex configurations, use the automated migration tool:

```bash
codewright migrate --from v1 --to v2
```

This tool will:
1. Back up your existing configuration
2. Convert the manifest format
3. Reorganize the directory structure
4. Preserve your custom settings

## Common Issues

### Issue: Skills Not Found

**Solution:**
```bash
codewright agents repair
```

### Issue: Configuration Not Loaded

**Solution:**
```bash
# Check for syntax errors
codewright doctor --verbose

# Regenerate configuration
codewright context
```

### Issue: Graph Not Built

**Solution:**
```bash
codewright graph update --force
```

## Rollback

If you need to rollback to V1:

```bash
# Restore from backup
rm -rf .codewright .agents .claude .cursor .cline
cp -r .codewright.backup .codewright

# Reinitialize with V1
codewright@1 init
```

## Breaking Changes Reference

### CLI Commands

| V1 Command | V2 Command |
|------------|------------|
| `codewright init` | `codewright init` (same) |
| `codewright status` | `codewright doctor` |
| `codewright check` | `codewright agents doctor` |

### Configuration Files

| V1 File | V2 File |
|---------|---------|
| `.codewright/config.yaml` | `.codewright/config.yaml` (same) |
| `.codewright/manifest.yaml` | `.codewright/manifest.yaml` (new format) |
| - | `.codewright/config.user.yaml` (new) |
| - | `.codewright/agents.yaml` (new) |

### Skills

All skills have been updated to V2 format. The core workflow remains the same, but some skill names have changed:

| V1 Skill | V2 Skill |
|----------|----------|
| `codewright:spec` | `codewright-spec` |
| `codewright:story` | `codewright-story` |
| `codewright:dev` | `codewright-dev` |

## Support

If you encounter issues during migration:

1. Check the troubleshooting section in `README.md`
2. Run `codewright doctor` for diagnostics
3. Open an issue on GitHub
