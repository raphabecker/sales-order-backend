# Sales Order Backend

A sales order and inventory API that keeps pricing, stock and order history consistent when requests fail or arrive concurrently.

Built with **TypeScript, Node.js, SAP CAP, OData v4 and SQLite**. It runs locally without a SAP account, cloud subscription, global CAP CLI or database installation. The business rules and order service are independent of CAP; the framework is an adapter for HTTP, authorization and transactions.

## Run locally

Install Node.js 22.12 or newer and npm. Node 22 LTS is selected in `.nvmrc`.

```sh
npm ci
npm run check
npm run dev
```

The API listens on **http://127.0.0.1:4004/odata/v4/main**. The public liveness endpoint is **http://127.0.0.1:4004/health**.

In another terminal:

```sh
npm run demo
```

The demo creates a catalog product and an order, checks the server-calculated total and stock reduction, cancels the order, and checks that stock was restored. It leaves the cancelled order and its audit events available for inspection.

The quick-start mode uses SQLite through sql.js in memory and resets data on restart. For durable local work, run:

```sh
npm run dev:persistent
```

This stores customers, products, orders and audit events in `.data/sales.sqlite`, creating and seeding it only on first use. Restarts retain the existing data. The driver is installed by npm; it requires no separate database server. Use one API process per local database. Before copying the database for backup, stop the API and preserve the entire `.data/` directory. The schema version is checked on startup; incompatible files are refused without being overwritten. Automated schema upgrades are not implemented.

The included credentials are deliberate local fixtures and are activated only in the development profile. This version has no production deployment configuration.

| Local user | Password | Permissions |
| --- | --- | --- |
| `admin` | `admin-local-only` | Catalog and customer management, orders, audit reads |
| `sales` | `sales-local-only` | Catalog/customer reads, order creation and cancellation |
| `reader` | `reader-local-only` | Catalog, customer, order and item reads |

## Implemented behavior

- Customer and product management with validation, normalized unique customer emails and ETags.
- Orders with 1–100 distinct products and positive integer quantities.
- Catalog prices captured on order creation; client-supplied prices, totals and status cannot change the calculation.
- BRL money calculated with integer cents and `bigint`; 10% discount strictly above BRL 30,000, rounded half up.
- Conditional inventory updates, order persistence and audit insertion in one transaction.
- `OPEN → CANCELLED` transition with inventory restoration exactly once, including simultaneous cancellation requests.
- Historical orders and audit events cannot be edited or deleted through the API.
- Referenced customers and products cannot be deleted.
- Read, write and audit permissions enforced on the API, including item navigation routes.

## Try the API

List available products:

```sh
curl -u reader:reader-local-only 'http://127.0.0.1:4004/odata/v4/main/Products?$filter=stock%20gt%200&$orderby=name&$top=10'
```

Create a two-unit order using the seeded customer and USB-C dock:

```sh
curl -u sales:sales-local-only \
  -H 'Content-Type: application/json' \
  -d '{"customers_id":"38373147-201c-4e8d-bef6-165e14070769","items":[{"product_id":"8dd64f22-69d8-4141-b402-9216d5677437","quantity":2}]}' \
  http://127.0.0.1:4004/odata/v4/main/SalesOrderHeaders
```

The response contains a generated order ID, `status: OPEN`, `totalAmount: 599.80` and the item price of `299.90`. On Windows PowerShell, use `curl.exe` or the cross-platform `npm run demo`.

Cancel the returned order ID with an explicit precondition:

```sh
curl -u sales:sales-local-only -X POST \
  -H 'Content-Type: application/json' -H 'If-Match: *' -d '{}' \
  'http://127.0.0.1:4004/odata/v4/main/SalesOrderHeaders(ORDER_ID)/MainService.cancel'
```

Use the current ETag in `If-Match` for version-sensitive clients. The wildcard deliberately accepts the current version; repeated cancellation restores stock only once.

See [API contract](docs/api.md) and [REST Client requests](test/http/sales-order-headers.http) for more examples.

## Commands and verification

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run TypeScript locally |
| `npm start` | Build and run compiled JavaScript with the local development profile |
| `npm run dev:persistent` | Run TypeScript with SQLite in `.data/sales.sqlite` |
| `npm run start:persistent` | Build and run compiled JavaScript with persistent local SQLite |
| `npm run demo` | Exercise create → inspect → cancel against a running local server |
| `npm run typecheck` | Strict TypeScript checks, including test code |
| `npm test` | Domain and HTTP integration tests against the TypeScript service |
| `npm run build` | Compile JavaScript and package the local models and fixtures in `dist/` |
| `npm run test:built` | Repeat HTTP integration tests against compiled JavaScript; build first |
| `npm run test:persistent` | Repeat API and restart tests against compiled JavaScript and native SQLite; build first |
| `npm run check` | Typecheck, tests, build, compiled-service tests and persistent-storage tests |

HTTP tests start a real API process on an ephemeral loopback port and an isolated database. They exercise authorization, validation, price tampering, discount boundaries, reference integrity, rollback after failed insertion, ETags, competing stock reservations and concurrent cancellation. Restart tests verify durable orders, stock and audit records, and refusal of unsupported schema versions. The domain tests need no SAP runtime or network.

The [CI workflow](.github/workflows/ci.yml) runs the same checks on Linux and Windows with Node 22 and 24. Hosted CI results become available after pushing; local checks do not establish that the hosted jobs have run.

## Design and ongoing work

Read the [architecture and trade-offs](docs/architecture.md), [roadmap](docs/roadmap.md), [change log](CHANGELOG.md) and [contribution guide](CONTRIBUTING.md).

The current scope is a single-organization backend with both ephemeral and persistent local storage. Production identity, PostgreSQL deployment and migrations, fulfillment, a stock movement ledger and a user interface remain explicit next iterations. Orders currently have no tenant or per-salesperson ownership boundary. Auditing records business events, without serializing credentials or customer profiles.

[Project submission notes](docs/project-submission.md) contain a factual English description and a GitHub publication checklist.
