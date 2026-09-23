# MetaYB

Distributor ordering, warehouse stock and points-based loyalty for a
consumer-goods manufacturer. Built against `Assesment Overview.md`.
Design notes: `NOTES.md` · database: `schema.dbml` · pitch: `pitch.md` ·
summary: `onepager.md`.

## What it does

- **Distributors** sign in, browse the catalogue with live stock (out-of-stock
  items stay visible but can't be ordered), place multi-line orders, see
  their orders with full status history, cancel orders that haven't shipped,
  and see their loyalty tier, trailing-90-day points and available credit.
- **Every order** is priced on the server: the distributor's current tier
  discount (Bronze 0%, Silver 3%, Gold 6%) is fixed onto the order, stock is
  reserved, and the order is **Confirmed** if it fits the distributor's
  available credit or held as **PendingApproval** if it doesn't.
- **Sales Managers** work a queue of orders awaiting approval
  (approve/reject), see every order, cancel where allowed, and move
  confirmed orders to Dispatched and Delivered.
- **Automatically:** points (`floor(total / 100)`) are awarded when an order
  is Confirmed and reversed if it's cancelled; stock is released exactly once
  on cancel/reject; every status change is written to an append-only event
  log and sent to an ERP endpoint, with retries if delivery fails.

## Prerequisites

- Node.js 18+ and npm
- MySQL 8 — either Docker (the bundled `docker-compose.yml`) or your own
  local MySQL 8 server

## Run it — 5 commands

From a clean checkout, at the repository root, in a POSIX-style shell
(macOS/Linux terminal, Git Bash or WSL on Windows) or PowerShell 7+ —
Windows PowerShell 5.1 and `cmd` don't support the `&&`/`cp` in step 2:

```
1. docker compose up -d
2. cd backend && cp .env.example .env && npm install && npm run migrate && npm run seed
3. npm run dev                          # backend on http://localhost:4000 - leave running
4. cd frontend && npm install           # second terminal, from the repository root
5. npm run dev                          # frontend on http://localhost:5173 - open this
```

- Step 1 starts MySQL 8 with database `metayb`, user `root`, password `root`,
  which is exactly what `backend/.env.example` expects. MySQL needs a few
  seconds after start-up before it accepts connections; if step 2's
  `migrate` reports a connection error, wait a moment and re-run step 2.
- **Without Docker:** skip step 1, create an empty database in your own MySQL
  (`CREATE DATABASE metayb;`), then after step 2's `cp` edit `backend/.env`'s
  `DB_*` values to match your server before running the rest of step 2.
- `npm run seed` expects an **empty, freshly migrated** database; running it a
  second time fails with a duplicate-key error. To reseed, drop and recreate
  the database, then run `npm run migrate && npm run seed` again.
- `frontend/.env` is optional — without it the frontend calls
  `http://localhost:4000/api`.

## Environment variables

`backend/.env` (copied from `backend/.env.example`):

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | Backend HTTP port | `4000` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection | `localhost`, `3306`, `root`, `root`, `metayb` in the example file |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Signing key and lifetime of sign-in tokens; the backend refuses to start with `NODE_ENV=production` and no `JWT_SECRET` | example: `change-me-in-production`, `1d` |
| `ERP_ENDPOINT_URL` | Where order status events are POSTed | `http://localhost:4000/mockerp` (built-in stand-in) |
| `ERP_WEBHOOK_TIMEOUT_MS` | Per-attempt delivery timeout | `5000` |
| `ERP_MAX_RETRY_ATTEMPTS` | Delivery attempts before an event stays `Failed` | `5` |
| `ERP_RETRY_BASE_DELAY_MS` | Exponential backoff base: attempts 2–5 wait 1x, 2x, 4x, 8x | `60000` (1/2/4/8 min) |
| `ERP_RETRY_DELAYS_MS` | Optional explicit comma-separated schedule; overrides the above | unset |
| `ERP_RETRY_POLL_INTERVAL_MS` | How often the retry worker looks for due events | `30000` |
| `LOG_LEVEL` | Winston log level (`error`, `warn`, `info`, `debug`); logs are JSON lines on stdout | `info` |

`frontend/.env` (optional, from `frontend/.env.example`): `VITE_API_URL` —
API base URL, default `http://localhost:4000/api`.

## Database

- Schema is created only by migrations (`npm run migrate`, 8 migrations in
  `backend/src/migrations`); TypeORM `synchronize` is off. `schema.dbml`
  documents every table, column, key and index; `schema.sql` is a
  hand-written reference DDL (the migrations are the source of truth).
- `npm run seed` creates 8 products (SKU-003 has 0 stock, SKU-004 has 1),
  3 distributors — Bronze Traders Ltd (credit 5,000), Silver Distribution Co
  (20,000; 1,500 recent points → Silver) and Gold Wholesale Group (50,000;
  5,625 recent points → Gold) — one sales manager (Jordan Price) and the two
  demo logins below. The Silver/Gold points come from seeded historical
  **Confirmed** orders (as B5 asks), which also count against their credit,
  so new Silver/Gold orders go to PendingApproval; the Bronze demo
  distributor is the one to use for instantly-confirmed orders.

## Demo credentials

| Role | Email | Password | Linked to |
| --- | --- | --- | --- |
| Distributor | `distributor.demo@example.com` | `Distributor@123` | Bronze Traders Ltd |
| Sales Manager | `manager.demo@example.com` | `Manager@123` | Jordan Price |

Passwords are stored as bcrypt hashes. New accounts can be created at
`/signup` (see Known limitations).

## Verify the main workflows

1. **Sign in** as the distributor → lands on the Distributor Dashboard.
2. **Catalogue** (`/`) → all 8 products with price and stock; SKU-003 shows
   "Out of stock" and has no "Add to order" button.
3. **Place an order within credit**: "Add to order" on SKU-001, go back,
   "Add to order" on SKU-008, set quantities (e.g. 12 and 6 = 750.00),
   "Place order" → **Confirmed**; "View order details" shows line items,
   subtotal, discount, total and the event log (Placed → Confirmed).
4. **Place an order over credit**: Place Order → SKU-006 × 5 (6,250.00) →
   **PendingApproval**. The dashboard now shows it, the points earned from
   step 3 (7) and the reduced available credit.
5. **Stock rules**: ordering more than is in stock (e.g. SKU-004 × 2) is
   refused with the SKU and the quantity available.
6. **Sign out, sign in as the sales manager** → lands on the Approval Queue
   with the step-4 order. Approve it (or Reject). On any order, Dispatch
   then Deliver when Confirmed; Cancel is offered while Placed,
   PendingApproval or Confirmed. Each action adds to the event log.
7. **Cancel as the distributor**: back as the distributor, open the step-3
   order and cancel it → stock returns and its 7 points are reversed.
8. **Access control**: a distributor opening `/sales-manager-queue` sees a
   403 page; signed-out users are sent to Sign In.

ERP deliveries go to the built-in `/mockerp` stand-in, which logs each
event to the backend console and always returns 200.

## Tests

From `backend/`, against the database in `backend/.env` (each script creates
its own data and removes it afterwards — use a development database, never a
production one):

```
npm run test:transitions    # state machine: invalid transitions rejected, order untouched
npm run test:concurrency    # two simultaneous orders for the last unit -> exactly one succeeds
npm run test:idempotency    # repeated order / transition requests are applied once
npm run test:distributor    # ownership, pagination, cancellation side effects, 90-day loyalty
npm run test:webhookretry   # ERP retry: exponential backoff, timeout, max attempts, 4xx vs 5xx
npm run test:eventlog       # append-only event log, chronological history
npm run test:loyaltywindow  # trailing-90-day window, reversal on cancel, tier recalculation
npm run test:api            # the HTTP API end to end: auth/logout, access control, errors, full workflow, B6 example
```

Type checks: `npx tsc --noEmit -p .` in `backend/`; `npm run build` in
`frontend/`. There is no unit-test framework; these scripts print PASS/FAIL
per check and exit non-zero on any failure.

## API overview

All routes are under `/api`; every route except sign-up, sign-in and the
sign-up distributor list requires `Authorization: Bearer <token>`. The
acting distributor/sales manager is always taken from the token, never
from the request. Status-changing requests accept an optional
`Idempotency-Key` header (order placement also accepts `idempotencyKey` in
the body).

| Mount | Covers |
| --- | --- |
| `/api/auth` | `signup`, `signin`, `me`, `logout`, `distributors` (public list for the sign-up form) |
| `/api/product` | Catalogue (paginated, search, sort, stock filter) — any signed-in user |
| `/api/order` | `placeorder` (distributor); list/detail/approve/reject/dispatch/deliver (sales manager); `cancelorder` (either; distributors only their own) |
| `/api/distributor` | Own dashboard, orders, order detail, cancel, loyalty — distributor role, own records only |
| `/api/salesmanager` | All orders, approval queue, detail, approve/reject/cancel/dispatch/deliver — sales manager role |
| `/mockerp` | Stand-in ERP receiver (not under `/api`, unauthenticated) |

## Known limitations

- **Open self-registration.** `/signup` lets anyone create a Sales Manager
  account, or a Distributor account attached to any existing distributor
  (which then sees that distributor's orders). Fine for a demo; account
  creation must be restricted before real use.
- **ERP target is a stand-in.** Events go to `/mockerp` unless
  `ERP_ENDPOINT_URL` is set; no real ERP contract was specified.
- **Revoked tokens are checked in the database on every request.** Logout
  revokes only the token that made the logout request; other sessions of the
  same account stay signed in until their tokens expire.
- **No screen for permanently failed ERP events** — they stay in the
  `outbound_events` table with their last error.
- **Seed is not re-runnable** on a populated database (see above).
- Full itemised list with details: `NOTES.md` → Known defects.
