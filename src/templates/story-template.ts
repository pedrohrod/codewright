export interface StoryTemplateOptions {
  story_id: string;
  story_title: string;
  phase: string;
  spec_name: string;
}

export function storyTemplate(opts: StoryTemplateOptions): string {
  return `---
id: ${opts.story_id}
status: pending # pending | in-progress | review | done
baseline_commit:
phase: ${opts.phase}
spec: ${opts.spec_name}
---

# ${opts.story_title}

## Intent
Problem: {what problem it solves}
Approach: {how it will solve}

## Boundaries & Constraints
- Always: {always do}
- Ask First: {ask before}
- Never: {never do}

## I/O & Edge-Case Matrix
| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| 1 | Success  |       |                 |
| 2 |          |       |                 |

## Code Map
- {file} (CREATE | MODIFY | DELETE)

## Tasks
- [ ] Task 1
  - [ ] Subtask 1.1
  - [ ] Subtask 1.2
- [ ] Task 2

## Change Log
`;
}
