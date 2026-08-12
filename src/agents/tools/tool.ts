/**
 * Tool interface for agent runtime.
 * Tools allow agents to interact with the world (filesystem, shell, git).
 */

export interface Tool {
  /** Unique tool name */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** Parameter definitions */
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
  }>;

  /** Execute the tool with given input and context */
  execute(input: Record<string, unknown>, context: ToolContext): Promise<string>;
}

/**
 * Context passed to tool execution.
 */
export interface ToolContext {
  /** Working directory for file operations */
  cwd: string;
  /** Maximum number of lines to return from file reads */
  maxLines?: number;
}
