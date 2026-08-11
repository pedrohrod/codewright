export interface RepositoryInfo {
  owner: string;
  name: string;
  defaultBranch: string;
  cloneUrl?: string;
}

export interface CreateBranchOptions {
  /** Branch name (without refs/heads/) */
  name: string;
  /** SHA of the commit to branch from (defaults to HEAD of default branch) */
  fromSha?: string;
}

export interface BranchInfo {
  name: string;
  sha: string;
}

export interface PushBranchOptions {
  branch: string;
}

export interface CreatePullRequestOptions {
  title: string;
  head: string;
  base: string;
  body: string;
  draft?: boolean;
}

export interface PullRequest {
  number?: number;
  url: string;
  draft: boolean;
}

/**
 * Source control provider contract.
 * Implement this to integrate with GitHub, GitLab, Bitbucket, etc.
 */
export interface SourceControlProvider {
  readonly name: string;

  /** Get repository information (owner, name, default branch) */
  getRepositoryInfo(): Promise<RepositoryInfo>;

  /** Create a new branch */
  createBranch(options: CreateBranchOptions): Promise<BranchInfo>;

  /** Push a branch to the remote */
  pushBranch(options: PushBranchOptions): Promise<void>;

  /** Create a pull request */
  createPullRequest(options: CreatePullRequestOptions): Promise<PullRequest>;

  /** Get a pull request by number or URL */
  getPullRequest?(id: string): Promise<PullRequest>;
}
