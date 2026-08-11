/**
 * Normalized ticket model.
 * Providers convert their native formats to this.
 */
export interface Ticket {
  /** Provider-specific ID (e.g. Trello card ID) */
  id: string;
  /** Human-readable ID (e.g. "TRELLO-123") */
  externalId: string;
  title: string;
  description?: string;
  url?: string;
  priority?: string;
  labels?: string[];
  metadata?: Record<string, unknown>;
}

export type TicketStatus =
  | "ready"
  | "in_progress"
  | "review"
  | "blocked"
  | "failed"
  | "completed";

export interface FindTicketsOptions {
  limit?: number;
  ticketId?: string;
}

export interface ClaimContext {
  /** Branch name that will be created */
  branchName?: string;
  /** Run identifier for logging */
  runId?: string;
}

export interface ClaimResult {
  success: boolean;
  /** If claim failed because another process owns it */
  alreadyClaimed?: boolean;
  message?: string;
}

/**
 * Ticket provider contract.
 * Implement this to integrate with any ticket system.
 */
export interface TicketProvider {
  readonly name: string;

  /** Find tickets eligible for AI processing */
  findReadyTickets(options?: FindTicketsOptions): Promise<Ticket[]>;

  /** Get a specific ticket by ID */
  getTicket(id: string): Promise<Ticket>;

  /** Claim a ticket for processing (atomic move to in_progress) */
  claimTicket(ticket: Ticket, context: ClaimContext): Promise<ClaimResult>;

  /** Update ticket status */
  updateStatus(ticket: Ticket, status: TicketStatus): Promise<void>;

  /** Add a comment to the ticket */
  addComment(ticket: Ticket, comment: string): Promise<void>;

  /** Release a claimed ticket (optional, for cleanup) */
  releaseTicket?(ticket: Ticket): Promise<void>;
}
