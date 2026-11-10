# Roadmap

Version 0.2 provides a tested order workflow with optional durable local SQLite storage. The following work remains open and can be developed in separate, reviewable changes.

## 1. Production database and migrations

Add a PostgreSQL adapter and a repeatable migration/seed command, extending the existing restart tests to that database. Run the complete HTTP suite on PostgreSQL, including requests from two API processes. Add backup/restore verification. Keep both local SQLite modes for development.

## 2. Production identity and organization boundaries

Replace local Basic fixtures with an OIDC integration. Define whether users belong to one organization, multiple tenants or branches before adding record filters. Verify issuer/audience, role mapping, cross-organization denial and audit actor identity with automated tests.

## 3. Request idempotency

Add a client idempotency key with a durable payload fingerprint and response record. Replaying the same payload must return the original order without reserving more stock. Reusing a key with different input must return a conflict. Test simultaneous requests and retries after a response is lost.

## 4. Inventory ledger and fulfillment

Replace direct administrative stock replacement with explicit receipts and adjustments carrying a reason. Introduce fulfillment states and decide when cancellation can release inventory. Reconcile the ledger against available stock and test partial fulfillment/cancellation.

## 5. Operations interface

Build a customer/product search and order entry interface against the API. Show server totals, remaining inventory, conflicts and version changes. Add keyboard-accessible forms and browser tests for create/cancel. Keep API permissions enforced independently of the UI.

## 6. Delivery and observability

Add a production image/deployment after storage and identity are implemented. Define readiness against the database, structured request/error logs, inventory conflict metrics and a restore drill. Record measured load-test results instead of extrapolating from local tests.
