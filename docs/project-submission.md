# Project submission and publication notes

## Suggested English project description

> I am building a TypeScript backend for sales orders and inventory. The current version supports customer and product management, server-side pricing, transactional stock reservation, cancellation with stock restoration, an immutable API audit history, and persistent local SQLite storage. SAP CAP currently provides the OData and database adapter, while the business rules and order service are framework-independent TypeScript.
>
> The engineering work focuses on correctness at failure boundaries: preventing overselling, avoiding floating-point money errors, rejecting client-controlled prices, enforcing role permissions, and keeping stock, orders and audit events in the same transaction. Automated tests exercise the real HTTP API, including simultaneous requests and rollback after a failed insert, and run against both TypeScript and compiled JavaScript.
>
> My next iterations are PostgreSQL deployment and migrations, production identity, request idempotency, an inventory movement ledger, fulfillment and an operations UI. The repository documents the current scope and the trade-offs still to resolve.

Adapt the personal motivation and next priorities to what you actually want to build. Do not claim production users, deployments or experience that are not yours. Review the implementation so you can explain the transaction boundaries, concurrency tests and framework choices yourself.

## Publish this working version

The existing remote is `https://github.com/raphabecker/sales-order-backend.git`. Preserve the existing history.

1. Run `npm ci` and `npm run check`.
2. Start `npm run dev`, then run `npm run demo` in another terminal.
3. Review `git status` and `git diff`. Only source, tests, documentation, configuration and the npm lockfile belong in this change. Generated output, dependencies, local databases, private bindings and portable tooling are ignored.
4. Commit the reviewed changes, for example `feat: complete transactional order workflow and verification`.
5. Push the branch to your existing GitHub repository. Check the Actions results on both operating systems before sharing the link.
6. Open the repository as a reviewer would and verify that the README, roadmap and quick start are easy to find.

There is no need to erase history, fabricate commits or describe this as production-ready. This version is a coherent checkpoint with further substantive work identified.

## Technical discussion preparation

Be prepared to explain:

- Why checking stock and later writing an absolute balance can race.
- Why the conditional decrement and order/audit inserts need one transaction.
- Why the cancellation state update must guard inventory restoration.
- What a stale ETag means and when the wildcard is appropriate.
- Why `bigint` cents are used and exactly how discount rounding works.
- What the local SQLite tests establish and what still needs validation on a persistent database.
- How the repository interface allows a different HTTP/database stack without duplicating pricing rules.
- Which parts were developed with AI assistance and how you checked them.
