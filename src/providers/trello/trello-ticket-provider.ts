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

const BASE_URL = "https://api.trello.com/1";
const RATE_LIMIT_RESET_MS = 10_000;

export interface TrelloConfig {
  apiKey: string;
  token: string;
  boardId: string;
  readyList: string;
  workingList: string;
  reviewList: string;
  blockedList: string;
}

interface TrelloLabel {
  id: string;
  name: string;
}

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  url: string;
  labels: TrelloLabel[];
  idList: string;
  shortLink?: string;
  idShort?: number;
}

interface TrelloList {
  id: string;
  name: string;
}

interface ListMap {
  ready: string;
  working: string;
  review: string;
  blocked: string;
}

function looksLikeId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value);
}

export class TrelloTicketProvider implements TicketProvider {
  readonly name = "trello";

  private readonly config: TrelloConfig;
  private listCache: ListMap | null = null;

  constructor(config: TrelloConfig) {
    this.config = config;
  }

  private authParams(): string {
    return `key=${this.config.apiKey}&token=${this.config.token}`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${BASE_URL}${path}${separator}${this.authParams()}`;

    const response = await fetch(url, init);

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json() as Promise<T>;
  }

  private async handleError(response: Response): Promise<never> {
    const status = response.status;

    if (status === 401) {
      throw new ProviderAuthenticationError(this.name);
    }

    if (status === 404) {
      throw new ProviderNotFoundError(this.name, "resource");
    }

    if (status === 429) {
      const retryAfter = this.parseRetryAfter(response);
      throw new ProviderRateLimitError(this.name, retryAfter);
    }

    const body = await response.text().catch(() => "unknown error");
    throw new ProviderError(
      `Trello API error ${status}: ${body}`,
      this.name,
    );
  }

  private parseRetryAfter(response: Response): number {
    const header = response.headers.get("retry-after");
    if (header) {
      const seconds = Number(header);
      if (!Number.isNaN(seconds)) {
        return seconds * 1000;
      }
    }
    return RATE_LIMIT_RESET_MS;
  }

  private async resolveListId(value: string): Promise<string> {
    if (looksLikeId(value)) {
      return value;
    }
    const lists = await this.fetchLists();
    const match = lists.find(
      (l) => l.name.toLowerCase() === value.toLowerCase(),
    );
    if (!match) {
      throw new ProviderNotFoundError(
        this.name,
        `list "${value}"`,
      );
    }
    return match.id;
  }

  private async fetchLists(): Promise<TrelloList[]> {
    return this.request<TrelloList[]>(
      `/boards/${this.config.boardId}/lists`,
    );
  }

  private async ensureLists(): Promise<ListMap> {
    if (this.listCache) {
      return this.listCache;
    }

    // If all values look like IDs, no need to fetch lists
    const allIds =
      looksLikeId(this.config.readyList) &&
      looksLikeId(this.config.workingList) &&
      looksLikeId(this.config.reviewList) &&
      looksLikeId(this.config.blockedList);

    if (allIds) {
      this.listCache = {
        ready: this.config.readyList,
        working: this.config.workingList,
        review: this.config.reviewList,
        blocked: this.config.blockedList,
      };
      return this.listCache;
    }

    const lists = await this.fetchLists();
    const findId = (nameOrId: string): string => {
      if (looksLikeId(nameOrId)) {
        return nameOrId;
      }
      const match = lists.find(
        (l) => l.name.toLowerCase() === nameOrId.toLowerCase(),
      );
      if (!match) {
        throw new ProviderNotFoundError(
          this.name,
          `list "${nameOrId}"`,
        );
      }
      return match.id;
    };

    this.listCache = {
      ready: findId(this.config.readyList),
      working: findId(this.config.workingList),
      review: findId(this.config.reviewList),
      blocked: findId(this.config.blockedList),
    };

    return this.listCache;
  }

  private cardToTicket(card: TrelloCard): Ticket {
    return {
      id: card.id,
      externalId: card.shortLink ?? String(card.idShort ?? card.id),
      title: card.name,
      description: card.desc || undefined,
      url: card.url,
      labels: card.labels?.map((l) => l.name) ?? [],
    };
  }

  async findReadyTickets(options?: FindTicketsOptions): Promise<Ticket[]> {
    const lists = await this.ensureLists();
    const cards = await this.request<TrelloCard[]>(
      `/lists/${lists.ready}/cards?fields=id,name,desc,url,labels,idList,shortLink,idShort`,
    );

    let tickets = cards.map((c) => this.cardToTicket(c));

    if (options?.ticketId) {
      tickets = tickets.filter((t) => t.id === options.ticketId);
    }

    if (options?.limit !== undefined && options.limit > 0) {
      tickets = tickets.slice(0, options.limit);
    }

    return tickets;
  }

  async getTicket(id: string): Promise<Ticket> {
    const card = await this.request<TrelloCard>(
      `/cards/${id}?fields=id,name,desc,url,labels,idList,shortLink,idShort`,
    );
    return this.cardToTicket(card);
  }

  async claimTicket(
    ticket: Ticket,
    _context: ClaimContext,
  ): Promise<ClaimResult> {
    const lists = await this.ensureLists();

    // Verify card is still in ready list
    const card = await this.request<TrelloCard>(
      `/cards/${ticket.id}?fields=idList`,
    );

    if (card.idList !== lists.ready) {
      return { success: false, alreadyClaimed: true };
    }

    // Move to working list
    await this.request<TrelloCard>(
      `/cards/${ticket.id}?idList=${lists.working}`,
      { method: "PUT" },
    );

    return { success: true };
  }

  async updateStatus(
    ticket: Ticket,
    status: TicketStatus,
  ): Promise<void> {
    const lists = await this.ensureLists();

    const statusToList: Record<TicketStatus, string> = {
      ready: lists.ready,
      in_progress: lists.working,
      review: lists.review,
      blocked: lists.blocked,
      failed: lists.blocked,
      completed: lists.review,
    };

    const targetListId = statusToList[status];

    await this.request<TrelloCard>(
      `/cards/${ticket.id}?idList=${targetListId}`,
      { method: "PUT" },
    );
  }

  async addComment(ticket: Ticket, comment: string): Promise<void> {
    await this.request<unknown>(
      `/cards/${ticket.id}/actions/comments?text=${encodeURIComponent(comment)}`,
      { method: "POST" },
    );
  }

  async releaseTicket(ticket: Ticket): Promise<void> {
    const lists = await this.ensureLists();

    await this.request<TrelloCard>(
      `/cards/${ticket.id}?idList=${lists.ready}`,
      { method: "PUT" },
    );
  }
}

export function trello(config: TrelloConfig): TrelloTicketProvider {
  return new TrelloTicketProvider(config);
}
