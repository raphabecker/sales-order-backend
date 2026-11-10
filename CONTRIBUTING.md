# Contributing

Use Node.js 22.12+ and npm. Install with `npm ci`; the committed lockfile is the dependency source of truth.

Run `npm run check` before submitting changes. This checks TypeScript, domain tests, the live HTTP API, the build, the compiled API on both SQLite drivers, and restart/schema-version behavior. The integration suite starts its own server and does not need an existing process or external database.

Keep business rules in `srv/models/` and application orchestration in `srv/services/`. CAP-specific queries belong in the repository adapter. Financial amounts must use integer cents internally. Mutations that touch orders and inventory must remain within one request transaction.

Add tests when changing financial rules, permissions, inventory transitions, transaction boundaries or API contracts. Include at least one failure case for a new state transition. Update [API documentation](docs/api.md) when changing public behavior.

Use `npm run dev` for ephemeral local work or `npm run dev:persistent` to retain data in `.data/sales.sqlite`. Neither mode uses the old local `db.sqlite` file. Changes to a persisted schema require a reviewed migration and an updated schema version; never silently recreate an existing database. Never commit private service bindings, real credentials, databases, generated output or dependencies.
