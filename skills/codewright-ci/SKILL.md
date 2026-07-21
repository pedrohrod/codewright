---
name: codewright:ci
description: "Generate CI workflow — GitHub Actions based on project stack"
---

# Codewright CI

## Activation
When the user says: "codewright ci", "generate ci", "setup ci", "add github actions", "ci workflow"

## Operation
<workflow>
  <step n="1" goal="Load project configuration">
    <action>Read .codewright/config.yaml to detect stack, framework, test runner</action>
  </step>
  <step n="2" goal="Generate CI workflow">
    <action>Run: `npx codewright ci`</action>
    <action>Creates .github/workflows/ci.yml with appropriate steps:
      - **Node**: npm ci → build → test → lint
      - **Python**: pip install → pytest
      - **Go**: go mod download → go test → go vet
    </action>
  </step>
  <step n="3" goal="Explain the workflow">
    <action>Show the generated workflow content</action>
    <action>Tell the user it runs on push to main and on pull requests</action>
  </step>
</workflow>

## Finalization
CI workflow generated. Tell the user to push to GitHub to see it run.
