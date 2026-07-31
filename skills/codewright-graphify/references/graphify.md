# Graphify Reference

## Overview

Graphify is an external tool that builds a code knowledge graph for architectural analysis.

## Installation

```bash
npm install -g graphify
```

## Commands Reference

| Command | Purpose | Example |
|---------|---------|---------|
| `graphify query "question"` | Ask architectural question | `graphify query "What calls AuthService?"` |
| `graphify explain "symbol"` | Explain a symbol | `graphify explain "UserService"` |
| `graphify affected "symbol"` | Impact analysis | `graphify affected "UserService" --depth 3` |
| `graphify path "from" "to"` | Find call path | `graphify path "Controller.create" "Repo.save"` |
| `graphify status` | Check graph state | `graphify status` |
| `graphify update` | Refresh graph | `graphify update` |

## Budget

The `--budget` flag limits token usage. Default: 4000. Use higher values for complex queries.

## Limitations

- Graphify does NOT replace reading source code
- Graphify does NOT guarantee correctness
- Graphify may use external LLMs for semantic analysis
- Never send secrets or credentials to Graphify
