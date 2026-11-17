# Stock Management System

A responsive inventory application built with Node.js, Express and PostgreSQL.

## Included functionality

- Admin and staff login roles.
- Both roles can register products, record purchases (stock in), and record sales (stock out).
- Stock movements are written to `stock_transactions` and update product stock in one database transaction.
- Sales are rejected when the requested quantity exceeds available stock.
- The dashboard reports today's sold and purchased quantities using the Asia/Kathmandu calendar day.
- Admin-only product deactivation (historical transaction rows are retained), product detail editing, categories and user management.
- Recent stock movement history.

## Local setup

1. Install Node.js 20 or later and PostgreSQL.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a long random `SESSION_SECRET`.
3. Install dependencies: `npm install`.
4. Create tables: `npm run init-db`.
5. Create the first admin: `npm run create-admin` (follow the prompts).
6. Start: `npm start`, then open `http://localhost:3000`.

Never commit `.env`. It contains database credentials and the session secret.

## Deploying the web app to Render

- Push this project to a private Git repository. Do not include `.env` or `node_modules`.
- Create a Render **Web Service** connected to the repository.
- Build command: `npm install`
- Start command: `npm start`
- Add environment variables `DATABASE_URL`, `SESSION_SECRET` (a long random value), and `NODE_ENV=production`.
- Use a separate managed PostgreSQL provider for the database. The Render free Postgres database expires after 30 days and has no backups, so it is not suitable as the only copy of real inventory data.
- After setting `DATABASE_URL`, run `npm run init-db` once against that database, then run `npm run create-admin` once to create the initial administrator.

Render's free web service sleeps after 15 minutes without traffic and can take about a minute to wake. Free services are best for testing, not business-critical production use.

## Database recommendation for a free test deployment

Neon's Free plan offers PostgreSQL with a 1 GB per-project storage limit and monthly compute allowance. Review its current limits and backup/restore options before relying on it for business records. Export regular backups independently.

## Inventory calculation

`current_stock = opening_stock + sum(purchases) - sum(sales)`

The API serializes stock updates with a row lock, preventing concurrent sales from overselling the same product.
