// Shared TypeScript models and helper types

// Define D1Database type if not available globally
interface D1Database {
  // Add minimal interface - this will be properly typed by wrangler types
  exec(query: string): Promise<D1Result>;
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

interface D1Result {
  results?: Record<string, unknown>[];
  success: boolean;
  meta: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<D1Result & { results: T[] }>;
}

export interface Env {
  DB: D1Database;
}

export interface Headache {
  id?: number;
  timestamp: string; // ISO-8601 UTC
  severity: number; // 0-10
  aura: 0 | 1;
  readonly user_id: string;
}

export interface EventItem {
  id?: number;
  timestamp: string;
  event_type: string;
  value: string;
  readonly user_id: string;
}

// Helper types for pagination and filtering
export type ISO8601String = string;
export type AuraFlag = 0 | 1;
export type SortOrder = "asc" | "desc";

export interface PaginationParams {
  // Maximum number of items to return
  limit?: number;
  // Number of items to skip (offset-based pagination)
  offset?: number;
  // Opaque cursor token for cursor-based pagination
  cursor?: string;
  // Sort order for time-based fields (e.g., timestamp)
  order?: SortOrder;
}

export interface DateRangeFilter {
  // Inclusive start of the time range
  start?: ISO8601String;
  // Inclusive end of the time range
  end?: ISO8601String;
}

export interface HeadacheFilterParams {
  range?: DateRangeFilter;
  minSeverity?: number;
  maxSeverity?: number;
  aura?: AuraFlag;
}

export interface EventFilterParams {
  range?: DateRangeFilter;
  // Filter by one or more event types
  event_types?: string[];
  // Optional value match (exact/partial per implementation)
  value?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
  prevCursor?: string;
  total?: number;
}

// Auth identities (for UI)
export type IdentityProvider = 'SIWE' | 'GOOGLE';
export interface Identity {
  provider: IdentityProvider;
  identifier: string;
  email?: string | null;
  display_name?: string | null;
  created_at?: string | null;
}

