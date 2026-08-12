import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  github,
  GitHubSourceControlProvider,
  type GitHubConfig,
} from "./github-source-control.js";
import {
  ProviderAuthenticationError,
  ProviderNotFoundError,
  ProviderConflictError,
  ProviderRateLimitError,
  ProviderError,
} from "../errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOKEN = "ghp_test-token-12345";
const OWNER = "test-owner";
const REPO = "test-repo";
const BASE_URL = `https://api.github.com/repos/${OWNER}/${REPO}`;

function config(overrides?: Partial<GitHubConfig>): GitHubConfig {
  return { token: TOKEN, owner: OWNER, repo: REPO, ...overrides };
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function emptyResponse(status: number, headers: Record<string, string> = {}) {
  return new Response(null, { status, headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("github() factory", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates provider from explicit config", () => {
    const provider = github(config());
    expect(provider).toBeInstanceOf(GitHubSourceControlProvider);
    expect(provider.name).toBe("github");
  });

  it("auto-detects from env vars", () => {
    process.env.GITHUB_REPOSITORY = "env-owner/env-repo";
    process.env.GITHUB_TOKEN = "env-token";

    const provider = github();
    expect(provider).toBeInstanceOf(GitHubSourceControlProvider);
    expect(provider.name).toBe("github");
  });

  it("throws when GITHUB_REPOSITORY is missing", () => {
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_TOKEN;
    expect(() => github()).toThrow("GITHUB_REPOSITORY env var not set");
  });

  it("throws when token is missing", () => {
    process.env.GITHUB_REPOSITORY = "owner/repo";
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUBITHUB_TOKEN;
    expect(() => github()).toThrow("GitHub token not provided");
  });

  it("throws on invalid GITHUB_REPOSITORY format", () => {
    process.env.GITHUB_REPOSITORY = "invalid-no-slash";
    process.env.GITHUB_TOKEN = "token";
    expect(() => github()).toThrow("Invalid GITHUB_REPOSITORY format");
  });
});

describe("getRepositoryInfo", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns repository info", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        owner: { login: OWNER },
        name: REPO,
        default_branch: "main",
        clone_url: `https://github.com/${OWNER}/${REPO}.git`,
      }),
    );

    const provider = github(config());
    const info = await provider.getRepositoryInfo();

    expect(info).toEqual({
      owner: OWNER,
      name: REPO,
      defaultBranch: "main",
      cloneUrl: `https://github.com/${OWNER}/${REPO}.git`,
    });

    expect(fetchSpy).toHaveBeenCalledWith(`${BASE_URL}/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: undefined,
    });
  });

  it("throws on authentication failure", async () => {
    fetchSpy.mockResolvedValueOnce(emptyResponse(401));

    const provider = github(config());
    await expect(provider.getRepositoryInfo()).rejects.toThrow(
      ProviderAuthenticationError,
    );
  });
});

describe("createBranch", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates branch from default branch", async () => {
    const baseSha = "abc123def456";
    const newSha = "789012345678";

    fetchSpy
      .mockResolvedValueOnce(
        // GET ref for default branch
        jsonResponse({ object: { sha: baseSha } }),
      )
      .mockResolvedValueOnce(
        // POST refs
        jsonResponse({ ref: "refs/heads/feature-branch", object: { sha: newSha } }),
      );

    const provider = github(config());
    const branch = await provider.createBranch({ name: "feature-branch" });

    expect(branch).toEqual({ name: "feature-branch", sha: newSha });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // First call: GET ref
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${BASE_URL}/git/ref/heads/HEAD`,
    );

    // Second call: POST refs
    expect(fetchSpy.mock.calls[1][0]).toBe(`${BASE_URL}/git/refs`);
    expect(fetchSpy.mock.calls[1][1].method).toBe("POST");
    expect(JSON.parse(fetchSpy.mock.calls[1][1].body)).toEqual({
      ref: "refs/heads/feature-branch",
      sha: baseSha,
    });
  });

  it("creates branch from explicit SHA without ref lookup", async () => {
    const explicitSha = "custom-sha-abc";
    const newSha = "new-sha-def";

    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ ref: "refs/heads/my-branch", object: { sha: newSha } }),
    );

    const provider = github(config());
    const branch = await provider.createBranch({
      name: "my-branch",
      fromSha: explicitSha,
    });

    expect(branch).toEqual({ name: "my-branch", sha: newSha });

    // Should skip the ref lookup and go straight to POST
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.sha).toBe(explicitSha);
    expect(body.ref).toBe("refs/heads/my-branch");
  });

  it("throws ProviderConflictError on 409", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        jsonResponse({ object: { sha: "base-sha" } }),
      )
      .mockResolvedValueOnce(emptyResponse(409));

    const provider = github(config());
    await expect(
      provider.createBranch({ name: "existing-branch" }),
    ).rejects.toThrow(ProviderConflictError);
  });
});

describe("pushBranch", () => {
  it("is a no-op", async () => {
    const provider = github(config());
    // Should not throw and not make any HTTP calls
    await expect(
      provider.pushBranch({ branch: "feature" }),
    ).resolves.toBeUndefined();
  });
});

describe("createPullRequest", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a draft PR by default", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        number: 42,
        html_url: `https://github.com/${OWNER}/${REPO}/pull/42`,
        draft: true,
      }),
    );

    const provider = github(config());
    const pr = await provider.createPullRequest({
      title: "feat: add feature",
      head: "feature-branch",
      base: "main",
      body: "PR description here",
    });

    expect(pr).toEqual({
      number: 42,
      url: `https://github.com/${OWNER}/${REPO}/pull/42`,
      draft: true,
    });

    expect(fetchSpy).toHaveBeenCalledWith(`${BASE_URL}/pulls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "feat: add feature",
        head: "feature-branch",
        base: "main",
        body: "PR description here",
        draft: true,
      }),
    });
  });

  it("creates a non-draft PR when draft=false", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        number: 43,
        html_url: `https://github.com/${OWNER}/${REPO}/pull/43`,
        draft: false,
      }),
    );

    const provider = github(config());
    const pr = await provider.createPullRequest({
      title: "release: v1.0.0",
      head: "release",
      base: "main",
      body: "Release notes",
      draft: false,
    });

    expect(pr.draft).toBe(false);

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.draft).toBe(false);
  });
});

describe("getPullRequest", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns PR info by number", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        number: 7,
        html_url: `https://github.com/${OWNER}/${REPO}/pull/7`,
        draft: false,
      }),
    );

    const provider = github(config());
    const pr = await provider.getPullRequest!("7");

    expect(pr).toEqual({
      number: 7,
      url: `https://github.com/${OWNER}/${REPO}/pull/7`,
      draft: false,
    });

    expect(fetchSpy).toHaveBeenCalledWith(`${BASE_URL}/pulls/7`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: undefined,
    });
  });

  it("throws ProviderNotFoundError on 404", async () => {
    fetchSpy.mockResolvedValueOnce(emptyResponse(404));

    const provider = github(config());
    await expect(provider.getPullRequest!("999")).rejects.toThrow(
      ProviderNotFoundError,
    );
  });
});

describe("error handling", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws ProviderAuthenticationError on 403", async () => {
    fetchSpy.mockResolvedValueOnce(emptyResponse(403));

    const provider = github(config());
    await expect(provider.getRepositoryInfo()).rejects.toThrow(
      ProviderAuthenticationError,
    );
  });

  it("throws ProviderRateLimitError on 429 with Retry-After", async () => {
    fetchSpy.mockResolvedValueOnce(emptyResponse(429, { "Retry-After": "30" }));

    const provider = github(config());
    try {
      await provider.getRepositoryInfo();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderRateLimitError);
      expect((err as ProviderRateLimitError).retryAfterMs).toBe(30_000);
    }
  });

  it("throws ProviderError on unexpected status", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Something went wrong", { status: 500 }),
    );

    const provider = github(config());
    try {
      await provider.getRepositoryInfo();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).message).toContain("500");
    }
  });
});

describe("token safety", () => {
  it("does not include token in logs", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        owner: { login: OWNER },
        name: REPO,
        default_branch: "main",
        clone_url: `https://github.com/${OWNER}/${REPO}.git`,
      }),
    );

    const provider = github(config({ token: "ghp_SUPER_SECRET_12345" }));
    await provider.getRepositoryInfo();

    const headers = fetchSpy.mock.calls[0][1].headers;
    // The token should be in Authorization header but not in any stringified output
    expect(headers.Authorization).toBe("Bearer ghp_SUPER_SECRET_12345");

    // Ensure the token is not part of the URL
    expect(fetchSpy.mock.calls[0][0]).not.toContain("SUPER_SECRET");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
