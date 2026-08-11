import type {
  TicketProvider,
  Ticket,
  TicketStatus,
  FindTicketsOptions,
  ClaimContext,
  ClaimResult,
} from "../ticket-provider.js";
import {
  ProviderError,
  ProviderAuthenticationError,
  ProviderNotFoundError,
  ProviderConflictError,
  ProviderRateLimitError,
} from "../errors.js";

/**
 * Configuration for the GitHub Issues ticket provider.
 */
export interface GitHubIssuesConfig {
  /** GitHub API token */
  token?: string;
  /** Repository owner */
  owner?: string;
  /** Repository name */
  repo?: string;
  /** Label that marks a ticket as ready for AI */
  readyLabel?: string;
  /** Label that marks a ticket as in progress */
  workingLabel?: string;
  /** Label that marks a ticket as in review */
  reviewLabel?: string;
  /** Label that marks a ticket as blocked */
  blockedLabel?: string;
  /** Label that marks a ticket as completed */
  completedLabel?: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: Array<{ name: string; color: string }>;
  html_url: string;
  user: { login: string } | null;
}

/**
 * GitHub Issues ticket provider.
 * Uses GitHub Issues as the ticket source.
 */
export class GitHubIssuesTicketProvider implements TicketProvider {
  readonly name = "github-issues";

  private token: string;
  private owner: string;
  private repo: string;
  private readyLabel: string;
  private workingLabel: string;
  private reviewLabel: string;
  private blockedLabel: string;
  private completedLabel: string;
  private baseUrl: string;

  constructor(config: GitHubIssuesConfig) {
    this.token = config.token || process.env.GITHUB_TOKEN || "";
    this.owner = config.owner || process.env.GITHUB_REPOSITORY?.split("/")[0] || "";
    this.repo = config.repo || process.env.GITHUB_REPOSITORY?.split("/")[1] || "";
    this.readyLabel = config.readyLabel ?? "codewright:ready";
    this.workingLabel = config.workingLabel ?? "codewright:working";
    this.reviewLabel = config.reviewLabel ?? "codewright:review";
    this.blockedLabel = config.blockedLabel ?? "codewright:blocked";
    this.completedLabel = config.completedLabel ?? "codewright:done";
    this.baseUrl = "https://api.github.com";
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...options?.headers },
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json() as Promise<T>;
  }

  private async handleError(response: Response): Promise<never> {
    const retryAfter = response.headers.get("Retry-After");
    const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;

    let message = `GitHub API error: ${response.status}`;
    try {
      const body = await response.json() as { message?: string };
      message = body.message ?? message;
    } catch {
      // ignore parse error
    }

    switch (response.status) {
      case 401:
      case 403:
        throw new ProviderAuthenticationError(this.name, message);
      case 404:
        throw new ProviderNotFoundError(this.name, message);
      case 409:
        throw new ProviderConflictError(this.name, message);
      case 422:
        throw new ProviderError(message, this.name);
      case 429:
        throw new ProviderRateLimitError(this.name, retryAfterMs);
      default:
        throw new ProviderError(message, this.name);
    }
  }

  private ensureConfigured(): void {
    if (!this.token) {
      throw new ProviderAuthenticationError(
        this.name,
        "Missing GITHUB_TOKEN environment variable",
      );
    }
    if (!this.owner || !this.repo) {
      throw new ProviderError(
        "Missing GITHUB_REPOSITORY environment variable or owner/repo config",
        this.name,
      );
    }
  }

  async findReadyTickets(options?: FindTicketsOptions): Promise<Ticket[]> {
    this.ensureConfigured();

    const issues = await this.request<GitHubIssue[]>(
      `/repos/${this.owner}/${this.repo}/issues?labels=${encodeURIComponent(this.readyLabel)}&state=open&per_page=100`,
    );

    let tickets = issues.map((issue) => this.issueToTicket(issue));

    if (options?.ticketId) {
      tickets = tickets.filter((t) =>
        t.externalId === options.ticketId || t.id === options.ticketId,
      );
    }

    if (options?.limit) {
      tickets = tickets.slice(0, options.limit);
    }

    return tickets;
  }

  async getTicket(id: string): Promise<Ticket> {
    this.ensureConfigured();

    const issue = await this.request<GitHubIssue>(
      `/repos/${this.owner}/${this.repo}/issues/${id}`,
    );

    return this.issueToTicket(issue);
  }

  async claimTicket(ticket: Ticket, _context: ClaimContext): Promise<ClaimResult> {
    this.ensureConfigured();

    try {
      // Verify the ticket still has the ready label
      const issue = await this.request<GitHubIssue>(
        `/repos/${this.owner}/${this.repo}/issues/${ticket.id}`,
      );

      const hasReadyLabel = issue.labels.some((l) => l.name === this.readyLabel);
      if (!hasReadyLabel) {
        return {
          success: false,
          alreadyClaimed: true,
          message: "Ticket no longer has the ready label",
        };
      }

      // Remove ready label, add working label
      const currentLabels = issue.labels
        .map((l) => l.name)
        .filter((n) => n !== this.readyLabel);

      await this.request(`/repos/${this.owner}/${this.repo}/issues/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labels: [...currentLabels, this.workingLabel],
        }),
      });

      return { success: true };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      return {
        success: false,
        alreadyClaimed: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateStatus(ticket: Ticket, status: TicketStatus): Promise<void> {
    this.ensureConfigured();

    const labelMap: Record<TicketStatus, string> = {
      ready: this.readyLabel,
      in_progress: this.workingLabel,
      review: this.reviewLabel,
      blocked: this.blockedLabel,
      failed: this.blockedLabel,
      completed: this.completedLabel,
    };

    const targetLabel = labelMap[status];

    // Get current issue labels
    const issue = await this.request<GitHubIssue>(
      `/repos/${this.owner}/${this.repo}/issues/${ticket.id}`,
    );

    // Remove all codewright labels, add the target one
    const codewrightLabels = [
      this.readyLabel,
      this.workingLabel,
      this.reviewLabel,
      this.blockedLabel,
      this.completedLabel,
    ];

    const currentLabels = issue.labels
      .map((l) => l.name)
      .filter((n) => !codewrightLabels.includes(n));

    await this.request(`/repos/${this.owner}/${this.repo}/issues/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labels: [...currentLabels, targetLabel],
      }),
    });
  }

  async addComment(ticket: Ticket, comment: string): Promise<void> {
    this.ensureConfigured();

    await this.request(
      `/repos/${this.owner}/${this.repo}/issues/${ticket.id}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment }),
      },
    );
  }

  async releaseTicket(ticket: Ticket): Promise<void> {
    await this.updateStatus(ticket, "ready");
  }

  private issueToTicket(issue: GitHubIssue): Ticket {
    return {
      id: String(issue.number),
      externalId: `#${issue.number}`,
      title: issue.title,
      description: issue.body ?? undefined,
      url: issue.html_url,
      labels: issue.labels.map((l) => l.name),
      metadata: {
        author: issue.user?.login,
        state: issue.state,
      },
    };
  }
}

/**
 * Create a GitHub Issues ticket provider.
 */
export function githubIssues(config?: GitHubIssuesConfig): GitHubIssuesTicketProvider {
  return new GitHubIssuesTicketProvider(config ?? {});
}
