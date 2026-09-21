import { paginate, resolvePagination } from '../../src/common/utils/pagination';

describe('pagination', () => {
  it('applies defaults', () => {
    expect(resolvePagination({})).toEqual({ page: 1, limit: 20, skip: 0, take: 20 });
  });

  it('clamps page to at least 1', () => {
    expect(resolvePagination({ page: 0 }).page).toBe(1);
    expect(resolvePagination({ page: -5 }).page).toBe(1);
  });

  it('clamps limit to max', () => {
    expect(resolvePagination({ limit: 500 }).limit).toBe(100);
  });

  it('computes skip correctly', () => {
    expect(resolvePagination({ page: 3, limit: 25 })).toEqual({ page: 3, limit: 25, skip: 50, take: 25 });
  });

  it('builds paginated responses with total pages', () => {
    const result = paginate([1, 2], 42, 2, 20);
    expect(result).toEqual({ items: [1, 2], page: 2, limit: 20, total: 42, totalPages: 3 });
  });
});
