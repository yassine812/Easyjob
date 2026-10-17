export const redisKeys = {
  analyticsCompany: (companyId: string) => `analytics:company:${companyId}`,
  analyticsPlatform: () => 'analytics:platform',
  cachePrefix: (key: string) => `cache:${key}`,
};
