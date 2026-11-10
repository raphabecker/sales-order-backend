# Changelog

## 0.2.0 — 2026-11-10

- Completed order creation with catalog pricing, exact money calculations and the existing order discount rule.
- Added transactional conditional inventory reservation and cancellation with stock restoration.
- Added role-based write restrictions, immutable order/audit APIs, unique normalized emails, ETags and reference protection.
- Replaced generated placeholder fixtures and broken sample requests with reproducible examples.
- Added domain tests and real HTTP tests, including competing requests and failure rollback.
- Added a repeatable npm build, compiled-service verification, local demo and Linux/Windows CI.
- Added persistent local SQLite, restart tests, schema-version checks and protection against reseeding existing data.
- Separated business rules and order orchestration from the CAP persistence adapter.
- Documented the API, architecture, operating scope and remaining project work.
