---
name: codewright:document
description: "Generate documentation for code, APIs, and modules"
phase: operations
---

# Codewright Document

## Activation
When the user says: "codewright document", "generate docs", "write documentation", "document this", "add JSDoc"

## Operation
<workflow>
  <step n="1" goal="Identify what to document">
    <action>Ask the user: file, module, API endpoint, or whole project?</action>
    <action>If not specified, scan the most recently changed files</action>
  </step>
  <step n="2" goal="Read and analyze">
    <action>Read the target code</action>
    <action>Extract: public exports, function signatures, parameters, return types, interfaces</action>
  </step>
  <step n="3" goal="Generate documentation">
    <action>Choose format based on project conventions:
      - **JSDoc/TSDoc**: Inline function/class documentation
      - **README.md**: Module overview, installation, usage examples
      - **API docs**: Endpoint descriptions, request/response schemas
    </action>
    <action>Include:
      - Purpose (what it does, not how)
      - Parameters and return values with types
      - Usage examples (1-2 minimal snippets)
      - Edge cases and error states
    </action>
  </step>
  <step n="4" goal="Write or update">
    <action>Add JSDoc/TSDoc comments to source files</action>
    <action>Create or update README.md files</action>
    <action>Keep documentation in sync with actual signatures</action>
  </step>
</workflow>

## Finalization
Documentation generated. Present a summary of what was documented and suggest areas that still need docs.
