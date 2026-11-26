/**
 * Controls whether the external/aggregated catalogue is visible or collected.
 * Native EasyJob jobs are stored in Job and are always available independently.
 */
export function externalCatalogEnabled(): boolean {
  return process.env.JOB_CATALOG_MODE !== 'PLATFORM_ONLY';
}
