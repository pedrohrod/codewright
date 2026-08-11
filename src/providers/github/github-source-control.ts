import type {
  SourceControlProvider,
  RepositoryInfo,
  CreateBranchOptions,
  BranchInfo,
  PushBranchOptions,
  CreatePullRequestOptions,
  PullRequest,
} from "../source-control-provider.js";
import {
  ProviderError,
  ProviderAuthenticationError,
  ProviderNotFoundError,
  ProviderConflictError,
  ProviderRateLimitError,
} from "../errors.js";

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

const BASE_URL = "https://api.github.com";

const PROVIDER_NAME = "github";

function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function handleErrorResponse(response: Response): Promise<never> {
  const retryAfter = response.headers.get("Retry-After");
  const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;

  switch (response.status) {
    case 401:
    case 403:
      throw new ProviderAuthenticationError(PROVIDER_NAME);
    case 404:
      throw new ProviderNotFoundError(PROVIDER_NAME, "Resource");
    case 409:
      throw new ProviderConflictError(PROVIDER_NAME, "Resource already exists");
    case 429:
      throw new ProviderRateLimitError(PROVIDER_NAME, retryAfterMs);
    default: {
      const body = await response.text().catch(() => "Unknown error");
      throw new ProviderError(
        `GitHub API error (${response.status}): ${body}`,
        PROVIDER_NAME,
      );
    }
  }
}

export class GitHubSourceControlProvider implements SourceControlProvider {
  readonly name = PROVIDER_NAME;

  private readonly token: string;
  private readonly owner: string;
  private readonly repo: string;

  constructor(config: GitHubConfig) {
    this.token = config.token;
    this.owner = config.owner;
    this.repo = config.repo;
  }

  private get apiBase(): string {
    return `${BASE_URL}/repos/${this.owner}/${this.repo}`;
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const url = `${this.apiBase}${path}`;
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        ...buildHeaders(this.token),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    return (await response.json()) as T;
  }

  async getRepositoryInfo(): Promise<RepositoryInfo> {
    const data = await this.request<{
      owner: { login: string };
      name: string;
      default_branch: string;
      clone_url: string;
    }>("/");

    return {
      owner: this.owner,
      name: data.name,
      defaultBranch: data.default_branch,
      cloneUrl: data.clone_url,
    };
  }

  async createBranch(options: CreateBranchOptions): Promise<BranchInfo> {
    let sha: string;

    if (options.fromSha) {
      // Caller already knows the SHA — use it directly
      sha = options.fromSha;
    } else {
      // Resolve the HEAD of the default branch
      const branchRef = await this.request<{
        object: { sha: string };
      }>(`/git/ref/heads/HEAD`);
      sha = branchRef.object.sha;
    }

    // Create the branch
    const data = await this.request<{
      ref: string;
      object: { sha: string };
    }>("/git/refs", {
      method: "POST",
      body: {
        ref: `refs/heads/${options.name}`,
        sha,
      },
    });

    return {
      name: options.name,
      sha: data.object.sha,
    };
  }

  async pushBranch(_options: PushBranchOptions): Promise<void> {
    // No-op: local git push is handled by GitClient.
    // The branch ref is already created on remote via createBranch.
  }

  async createPullRequest(options: CreatePullRequestOptions): Promise<PullRequest> {
    const data = await this.request<{
      number: number;
      html_url: string;
      draft: boolean;
    }>("/pulls", {
      method: "POST",
      body: {
        title: options.title,
        head: options.head,
        base: options.base,
        body: options.body,
        draft: options.draft ?? true,
      },
    });

    return {
      number: data.number,
      url: data.html_url,
      draft: data.draft,
    };
  }

  async getPullRequest(id: string): Promise<PullRequest> {
    const data = await this.request<{
      number: number;
      html_url: string;
      draft: boolean;
    }>(`/pulls/${id}`);

    return {
      number: data.number,
      url: data.html_url,
      draft: data.draft,
    };
  }
}

function resolveConfig(explicit?: GitHubConfig): GitHubConfig {
  if (explicit) {
    return explicit;
  }

  const repoEnv = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN ?? process.env.GITHUBITHUB_TOKEN;

  if (!repoEnv) {
    throw new ProviderError(
      "GITHUB_REPOSITORY env var not set (expected 'owner/repo' format)",
      PROVIDER_NAME,
    );
  }

  if (!token) {
    throw new ProviderError(
      "GitHub token not provided. Set GITHUB_TOKEN env var or pass a config.",
      PROVIDER_NAME,
    );
  }

  const parts = repoEnv.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ProviderError(
      `Invalid GITHUB_REPOSITORY format: '${repoEnv}'. Expected 'owner/repo'.`,
      PROVIDER_NAME,
    );
  }

  return {
    token,
    owner: parts[0],
    repo: parts[1],
  };
}

export function github(config?: GitHubConfig): GitHubSourceControlProvider {
  const resolved = resolveConfig(config);
  return new GitHubSourceControlProvider(resolved);
}
