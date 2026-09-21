export interface PaginationOptions {
  page?: number;
  limit?: number;
  maxLimit?: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function resolvePagination(options: PaginationOptions = {}, maxLimit = 100): {
  page: number;
  limit: number;
  skip: number;
  take: number;
} {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(Math.max(1, options.limit ?? 20), options.maxLimit ?? maxLimit);
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
