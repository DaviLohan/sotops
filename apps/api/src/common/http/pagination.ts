import type { PaginatedResponse } from '@efed/shared';

export interface PageRequest {
  page: number;
  pageSize: number;
}

export function toSkipTake({ page, pageSize }: PageRequest): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paginated<T>(data: T[], total: number, request: PageRequest): PaginatedResponse<T> {
  return {
    data,
    meta: {
      page: request.page,
      pageSize: request.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / request.pageSize)),
    },
  };
}
