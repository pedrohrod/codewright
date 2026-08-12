export interface GitStatus {
  currentBranch: string;
  isDirty: boolean;
  stagedFiles: string[];
  modifiedFiles: string[];
  untrackedFiles: string[];
}

export interface PushOptions {
  branch: string;
  remote?: string;
  force?: boolean;
}

/**
 * Local git operations.
 * Separate from SourceControlProvider (which handles remote API operations).
 */
export interface GitClient {
  /** Get current repository status */
  status(): Promise<GitStatus>;

  /** Get current branch name */
  currentBranch(): Promise<string>;

  /** Create and checkout a new branch */
  createBranch(name: string): Promise<void>;

  /** Stage files (all if no files specified) */
  add(files?: string[]): Promise<void>;

  /** Create a commit */
  commit(message: string): Promise<void>;

  /** Push to remote */
  push(options: PushOptions): Promise<void>;

  /** Get diff of uncommitted changes */
  diff(): Promise<string>;

  /** Get diff of staged changes */
  diffStaged(): Promise<string>;

  /** Check if there are any uncommitted changes */
  hasChanges(): Promise<boolean>;

  /** Get the SHA of HEAD */
  headSha(): Promise<string>;

  /** Get the SHA of a branch tip */
  branchSha(branch: string): Promise<string>;
}
