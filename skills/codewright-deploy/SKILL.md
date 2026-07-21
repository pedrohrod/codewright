---
name: codewright:deploy
description: "Generate deployment configuration — Dockerfile, .dockerignore"
phase: operations
---

# Codewright Deploy

## Activation
When the user says: "codewright deploy", "generate dockerfile", "docker setup", "deployment config", "containerize"

## Operation
<workflow>
  <step n="1" goal="Generate Dockerfile">
    <action>Run: `npx codewright deploy dockerfile`</action>
    <action>Generates a multi-stage Dockerfile based on project stack:
      - **Node.js**: node:20-alpine, build + production stages
      - **Python**: python:3.12-alpine
      - **Go**: golang:1.22-alpine + scratch (minimal image)
    </action>
  </step>
  <step n="2" goal="Generate .dockerignore">
    <action>Run: `npx codewright deploy dockerignore`</action>
    <action>Creates .dockerignore excluding node_modules, dist, .git, etc.</action>
  </step>
  <step n="3" goal="Build and test">
    <action>Suggest running: `docker build -t <project> .`</action>
    <action>Suggest running: `docker run -p 3000:3000 <project>`</action>
  </step>
</workflow>

## Finalization
Deployment configuration generated. Remind the user to test the Docker build locally.
