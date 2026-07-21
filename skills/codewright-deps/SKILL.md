---
name: codewright:deps
description: "Check project dependencies — find outdated or vulnerable packages"
---

# Codewright Deps

## Activation
When the user says: "codewright deps", "check dependencies", "outdated packages", "update deps", "dependency check"

## Operation
<workflow>
  <step n="1" goal="Check dependencies">
    <action>Run: `npx codewright deps`</action>
    <action>Shows:
      - Total dependency count (production + dev)
      - Outdated packages with current and latest versions
      - Summary of all dependencies
    </action>
  </step>
  <step n="2" goal="Update outdated packages">
    <action>If outdated packages found, suggest running `npm update` or `npm install <pkg>@latest`</action>
    <action>For major version updates, suggest checking changelog first</action>
  </step>
  <step n="3" goal="Keep dependencies healthy">
    <action>Suggest running `codewright deps` regularly to keep dependencies current</action>
  </step>
</workflow>

## Finalization
Dependency check complete. Report outdated packages and update recommendations.
