import type { PaginationMeta } from "@app/shared-logic";

export type PaginationOptions = {
  page?: unknown;
  pageSize?: unknown;
};

export type ParsedPagination = PaginationMeta;

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePagination(options: PaginationOptions): ParsedPagination {
  const page = parsePositiveInteger(options.page, 1);
  const requestedPageSize = parsePositiveInteger(
    options.pageSize,
    DEFAULT_PAGE_SIZE,
  );
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  return {
    page,
    pageSize,
    totalItems: 0,
    totalPages: 0,
  };
}

export function paginateArray<T>(
  items: readonly T[],
  options: PaginationOptions,
): { items: T[]; pagination: PaginationMeta } {
  const parsed = parsePagination(options);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / parsed.pageSize));
  const page = Math.min(parsed.page, totalPages);
  const start = (page - 1) * parsed.pageSize;

  return {
    items: items.slice(start, start + parsed.pageSize),
    pagination: {
      page,
      pageSize: parsed.pageSize,
      totalItems,
      totalPages,
    },
  };
}
