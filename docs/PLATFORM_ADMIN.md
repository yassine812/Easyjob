# EasyJob Platform Admin

The platform backoffice is exposed under `/platform-admin` in the web application and `/api/v1/platform-admin/*` in the API. The legacy `/admin/*` routes remain as compatibility aliases.

## RBAC

`PLATFORM_ADMIN` remains the existing full-access role. The extensible platform roles are `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `BILLING_ADMIN`, `SUPPORT_ADMIN`, and `READ_ONLY_ADMIN`. They are separate from `COMPANY_ADMIN`, recruiter roles, and `CANDIDATE`. API authorization requires both a platform role and the endpoint permission.

The permission vocabulary includes `admin.users`, `admin.companies`, `admin.jobs`, `admin.analytics`, `admin.subscriptions`, `admin.billing`, `admin.plans`, `admin.support`, `admin.audit`, `admin.system`, and `admin.platform_admins`.

The server-operator command can grant a role without exposing a password: `npm run admin:grant -- verified-owner@domain.com --role=SUPER_ADMIN`. It requires an existing active verified account and never creates a production default account.

For a clean installation, create the single initial administrator outside the public signup flow. Set `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` and optionally `PLATFORM_ADMIN_NAME`, then run `npm run admin:create`. The command creates one `SUPER_ADMIN`, marks that account verified, never prints the password, and refuses to run if any platform administrator already exists. Public registration only creates candidate accounts; it cannot request or assign an admin role.

## Implemented

- Dedicated responsive `PlatformAdminShell` with grouped navigation and a visible Platform Admin identity.
- Platform namespace aliases for dashboard, companies, users, jobs, subscriptions, invoices, plans, support, audit, analytics, roles, permissions, and system health.
- Real dashboard metrics for active companies, new companies, active candidates, active jobs, paid subscriptions, pending companies, support tickets, failed payments, recent companies, and an action center.
- Financial data excludes seed/dev/test providers and reports unavailable data instead of inventing revenue.
- Company detail DTO with members, subscription history, jobs, application/interview counts, and last audited activity.
- Company status changes are audited.
- Company provisioning is transactional and creates the company, owner membership, selected company subscription, verification record, password reset token, and delivery outbox row atomically.
- Owner delivery no longer contains a generated password. It contains a single-use activation link that lets the owner choose a password. Reset completion verifies the email and invalidates sessions.
- Users, support, audit, subscriptions, invoices, plans, and system-health surfaces reuse existing backend services and DTOs.

## Partial / not yet implemented

- Full company detail tabs and plan editing are partial; the V1 detail view now covers overview, members, subscriptions, activity counters, and audited suspend/reactivate.
- Full invoice model and downloadable invoice documents; the invoice view currently exposes persisted payment records.
- Plan editor/versioning and entitlement mutation UI; plans are read-only in this V1 surface.
- Global admin search, ticket assignment UI, notification center, feature-flag editor, GDPR workflows, and full FR/EN/AR admin translations.
- Automatic email delivery status remains backed by the existing outbox worker; provider-specific webhook details are not exposed as secrets.
- Dedicated admin 404 and mobile card variants are not yet split from the shared shell.

## Verification

Backend typecheck and build pass. Frontend TypeScript and production build pass. RBAC/auth/company workspace unit tests pass, and the frontend permissions/guard tests pass.
