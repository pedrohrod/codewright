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
  ProviderRateLimitError,
} from "../errors.js";

/**
 * Configuration for the Sentry ticket provider.
 */
export interface SentryConfig {
  /** Sentry auth token (env: SENTRY_AUTH_TOKEN) */
  token?: string;
  /** Organization slug (env: SENTRY_ORG) */
  organization?: string;
  /** Project slug, optional filter (env: SENTRY_PROJECT) */
  project?: string;
  /** Self-hosted Sentry URL (env: SENTRY_SERVER_URL, default: https://sentry.io) */
  serverUrl?: string;
  /** Custom search query (default: "is:unresolved") */
  query?: string;
  /** Filter by error level: fatal, error, warning, info */
  level?: string;
}

interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  type: string;
  level: string;
  status: string;
  firstSeen: string;
  lastSeen: string;
  count: string;
  userCount: number;
  metadata: {
    title: string;
    type: string;
    value?: string;
    filename?: string;
    function?: string;
  };
  permalink: string;
}

interface SentryEvent {
  eventID: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename?: string;
          function?: string;
          lineno?: number;
          colno?: number;
          context_line?: string;
          in_app?: boolean;
        }>;
      };
    }>;
  };
}

/**
 * Sentry ticket provider.
 * Uses Sentry issues as the ticket source, enriching them with stacktrace context.
 */
export class SentryTicketProvider implements TicketProvider {
  readonly name = "sentry";

  private token: string;
  private organization: string;
  private project: string | undefined;
  private baseUrl: string;
  private query: string;
  private level: string | undefined;

  constructor(config: SentryConfig) {
    this.token = config.token || process.env.SENTRY_AUTH_TOKEN || "";
    this.organization = config.organization || process.env.SENTRY_ORG || "";
    this.project = config.project || process.env.SENTRY_PROJECT || undefined;
    this.baseUrl = (config.serverUrl || process.env.SENTRY_SERVER_URL || "https://sentry.io").replace(/\/$/, "");
    this.query = config.query || "is:unresolved";
    this.level = config.level;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
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

    let message = `Sentry API error: ${response.status}`;
    try {
      const body = await response.json() as { detail?: string; message?: string };
      message = body.detail ?? body.message ?? message;
    } catch {
      // ignore parse error
    }

    switch (response.status) {
      case 401:
      case 403:
        throw new ProviderAuthenticationError(this.name, message);
      case 404:
        throw new ProviderNotFoundError(this.name, message);
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
        "Missing SENTRY_AUTH_TOKEN environment variable",
      );
    }
    if (!this.organization) {
      throw new ProviderError(
        "Missing SENTRY_ORG environment variable or organization config",
        this.name,
      );
    }
  }

  async findReadyTickets(options?: FindTicketsOptions): Promise<Ticket[]> {
    this.ensureConfigured();

    const query = this.level
      ? `${this.query} level:${this.level}`
      : this.query;

    const params = new URLSearchParams({ query });
    if (this.project) {
      params.set("project", this.project);
    }
    params.set("per_page", "100");

    const issues = await this.request<SentryIssue[]>(
      `/api/0/organizations/${this.organization}/issues/?${params}`,
    );

    // Fetch events for each issue to get stacktraces (limit parallel requests)
    const tickets = await Promise.all(
      issues.map((issue) => this.issueToTicket(issue)),
    );

    let filtered = tickets;
    if (options?.ticketId) {
      filtered = tickets.filter(
        (t) => t.id === options.ticketId || t.externalId === options.ticketId,
      );
    }

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  async getTicket(id: string): Promise<Ticket> {
    this.ensureConfigured();

    const issue = await this.request<SentryIssue>(
      `/api/0/organizations/${this.organization}/issues/${id}/`,
    );

    return this.issueToTicket(issue);
  }

  async claimTicket(ticket: Ticket, _context: ClaimContext): Promise<ClaimResult> {
    this.ensureConfigured();

    try {
      // Verify the issue is still unresolved
      const issue = await this.request<SentryIssue>(
        `/api/0/organizations/${this.organization}/issues/${ticket.id}/`,
      );

      if (issue.status !== "unresolved") {
        return {
          success: false,
          alreadyClaimed: true,
          message: `Issue status is "${issue.status}", not "unresolved"`,
        };
      }

      // Sentry has no "working" state — claim is a verification only
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

    if (status === "completed") {
      // Resolve the issue
      await this.request(
        `/api/0/organizations/${this.organization}/issues/${ticket.id}/`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "resolved" }),
        },
      );
    } else if (status === "review") {
      // Add a comment noting the PR was created (Sentry has no "in review" status)
      // The caller should use addComment directly for the PR link
    }
    // For other statuses (blocked, failed, in_progress), no Sentry state change needed
  }

  async addComment(ticket: Ticket, comment: string): Promise<void> {
    this.ensureConfigured();

    await this.request(
      `/api/0/organizations/${this.organization}/issues/${ticket.id}/comments/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: comment }),
      },
    );
  }

  async releaseTicket(_ticket: Ticket): Promise<void> {
    // No-op: Sentry issues stay unresolved until explicitly resolved
  }

  private async issueToTicket(issue: SentryIssue): Promise<Ticket> {
    // Fetch latest event to get stacktrace
    let stacktrace = "";
    try {
      const events = await this.request<SentryEvent[]>(
        `/api/0/organizations/${this.organization}/issues/${issue.id}/events/`,
      );
      if (events.length > 0) {
        stacktrace = this.extractStacktrace(events[0]);
      }
    } catch {
      // Stacktrace enrichment is best-effort
    }

    const description = this.buildDescription(issue, stacktrace);

    return {
      id: issue.id,
      externalId: issue.shortId,
      title: issue.title,
      description,
      url: issue.permalink,
      labels: [issue.level, issue.type],
      metadata: {
        culprit: issue.culprit,
        stacktrace,
        level: issue.level,
        type: issue.type,
        count: issue.count,
        userCount: issue.userCount,
        firstSeen: issue.firstSeen,
        lastSeen: issue.lastSeen,
      },
    };
  }

  private buildDescription(issue: SentryIssue, stacktrace: string): string {
    const parts: string[] = [];

    parts.push(`**Error Type:** ${issue.metadata.type}`);
    parts.push(`**Level:** ${issue.level}`);
    parts.push(`**Culprit:** ${issue.culprit}`);
    parts.push(`**Occurrences:** ${issue.count} (${issue.userCount} users)`);
    parts.push(`**First Seen:** ${issue.firstSeen}`);
    parts.push(`**Last Seen:** ${issue.lastSeen}`);

    if (stacktrace) {
      parts.push(`\n**Stacktrace:**\n\`\`\`\n${stacktrace}\n\`\`\``);
    }

    return parts.join("\n");
  }

  private extractStacktrace(event: SentryEvent): string {
    if (!event.exception?.values?.length) return "";

    const frames: string[] = [];
    for (const exc of event.exception.values) {
      if (!exc.stacktrace?.frames) continue;

      // Sentry frames are in reverse order (most recent last)
      const relevantFrames = exc.stacktrace.frames
        .filter((f) => f.in_app !== false && !f.filename?.includes("node_modules"))
        .slice(-10);

      for (const frame of relevantFrames) {
        const fn = frame.function || "<anonymous>";
        const file = frame.filename || "?";
        const line = frame.lineno ?? "?";
        const col = frame.colno ?? "?";
        frames.push(`  at ${fn} (${file}:${line}:${col})`);
        if (frame.context_line) {
          frames.push(`    ${frame.context_line}`);
        }
      }
    }

    return frames.join("\n");
  }
}

/**
 * Create a Sentry ticket provider.
 */
export function sentry(config?: SentryConfig): SentryTicketProvider {
  return new SentryTicketProvider(config ?? {});
}
