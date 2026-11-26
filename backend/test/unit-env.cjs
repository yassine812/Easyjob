// Unit tests must not inherit a developer's or container's deployment switches.
// Individual mode tests override these values and restore them afterwards.
process.env.NODE_ENV = 'test';
process.env.JOB_CATALOG_MODE = 'EXTERNAL_ENABLED';
process.env.JOB_SOURCE_COMPANY_DIRECT_ENABLED = 'true';
