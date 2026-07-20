export interface SpecTemplateOptions {
  slug: string;
  topic: string;
  goal: string;
  capabilities: Array<{ id: string; text: string }>;
  constraints: string[];
  decisions: string[];
}

export function specTemplate(opts: SpecTemplateOptions): string {
  const caps = opts.capabilities.length > 0
    ? opts.capabilities.map((c) => `- **${c.id}**\n  - **intent:** ${c.text}\n  - **success:** {Testable or demonstrable criterion}`).join("\n")
    : `- **CAP-1**
  - **intent:** {What the system allows — WHAT, not HOW}
  - **success:** {Testable or demonstrable criterion}`;

  const constraints = opts.constraints.length > 0
    ? opts.constraints.map((c) => `- ${c}`).join("\n")
    : "{Non-negotiable rules}";

  const decisions = opts.decisions.length > 0
    ? opts.decisions.map((d) => `- ${d}`).join("\n")
    : "";

  return `---
id: SPEC-${opts.slug}
companions: []
sources: []
---

# ${opts.topic}

## Why
${opts.goal || "{Problem being solved. Business context.}"}

## Capabilities
${caps}

## Constraints
${constraints}

## Non-goals
{What is NOT in scope}

## Success signal
{Concrete moment that proves it's done}
${decisions ? `\n## Architecture Decisions\n${decisions}` : ""}
`;
}
