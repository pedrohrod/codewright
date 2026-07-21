# Skill Selection & Explanation Protocol

Before executing ANY task, the agent MUST follow this protocol:

## 1. Select
Determine which codewright skill matches the user's request by matching intent against skill names, descriptions, and activation phrases in SKILL.md files.

## 2. Analyze
Read the skill's SKILL.md from `.agents/skills/<name>/SKILL.md` or `skills/<name>/SKILL.md`. Understand the full workflow, customization options, and expected outputs.

## 3. Explain
Present a clear summary to the user before acting:
- Which skill was selected and why
- The workflow steps it will follow
- What it will produce
- Any configuration or customization applied

Only proceed after presenting this analysis to the user.
