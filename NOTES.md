# Architecture

Browser single-page app → JSON REST API → MySQL 8. The frontend calls the API
with a signed bearer token; the API reloads the user on every request and
derives the acting distributor or sales manager from it, never from request
bodies. Controllers validate, services hold all business rules, repositories
reach the database. ERP events go to `ERP_ENDPOINT_URL` (default: built-in
`/mockerp` stand-in); a background worker in the API retries failures.

Where each rule is enforced (API = `order.service.ts` unless noted):

- **R1** — API + database: placement locks product rows (`FOR UPDATE`) and
  decrements stock; cancel/reject release it once, keyed on the status read
  under the order's row lock. "Permanent at Dispatched" holds because no
  transition leaves Dispatched except to Delivered.
- **R2** — API: discount computed once and stored on the order.
- **R3** — API: available credit summed live with the distributor row locked.
- **R4** — API: points written in the transaction that enters Confirmed.
- **R5** — API: a negative ledger row reverses points; tier is derived on
  every read, never stored.
- **R6** — API, by omission: no endpoint edits an order's lines or prices.
- **R7** — API rejects it; the frontend also hides "Add to order".
- **R8** — API + database: each change writes an event (actor, timestamp)
  in the same transaction; database triggers reject updates/deletes of events.
- **Background job**: ERP retry with exponential backoff (1/2/4/8 min).

# Key decisions

1. **One transition function for every status change.** Rejected: status
   updates inside each endpoint. Every workflow calls the same locked,
   map-checked function, which writes the event and ERP record.
2. **Pessimistic row locks, not optimistic versioning.** Rejected: version
   columns with retry. Locks serialise concurrent orders for the last unit
   and concurrent credit checks with no client retry logic.
3. **Transactional outbox for ERP events.** Rejected: sending after commit
   only. The event row commits with the status change, so it cannot be
   lost; delivery happens after commit and the retry worker owns failures.
4. **Idempotency via stored keys and unique constraints.** Rejected: an
   in-memory lock, which fails across server instances. Order keys live on
   `orders`, transition keys on `order_events`; a repeat returns the original
   result, and a key reused for a different request gets 422.
5. **UUID primary keys.** Rejected: auto-increment ids, which are guessable
   on by-id endpoints.

# Not implemented

All Section C requirements, Q1–Q16, are implemented, each covered by a test
script or the README verification steps. Remaining work outside Section C,
in implementation order:

1. Restrict account creation (invite-only or admin-created) — ~4h.
2. Reconcile the development database with the migrations (see Known
   defects) — ~1h.
3. Screen for permanently failed ERP events, with manual re-send — ~3h.

# Known defects

- **Open self-registration.** Anyone can sign up as a Sales Manager, or as a
  Distributor linked to any existing distributor and then see its orders.
- **Schema drift.** The development database predates some migrations: it
  has `users.contactNumber varchar(50)` (migrations create 255), a duplicate
  foreign key on `orders.distributor_id`, and different constraint names.
- **Seed is not re-runnable**: a second run fails on duplicate keys.
- **Test scripts use the configured database.** `test:webhookretry` runs
  the retry worker, which could also claim genuinely due events in that
  database and deliver them to its fake endpoint.
- **Tokens are kept in `localStorage`** (readable by any script on the page).
  Logout revokes the token server-side (`revoked_tokens`), but only that
  one token; other sessions stay valid until expiry.
- `nextRetryAt` has one-second precision (retries can be ~1s early/late).
- UUID validation is a format regex, not RFC-strict.

# AI tools

**Claude Code** (Anthropic), used as an agent in the repository for:
scaffolding; implementing business rules against their rule numbers;
migrations and seed data; authentication; test scripts; debugging; and
drafting these documents. Outputs were checked by running the application
and the test scripts.

**Incorrect output:** `cancelOrder` chose what to undo from an unlocked read
taken before the transition locked the order row. An approval committing in
between would leave a Cancelled order with its points still awarded. It was
found by re-reading the code during Part II hardening, not by a test; side
effects now use the status read under the lock.

**Most useful prompt (verbatim):**

> Implement a centralized order status transition function... Create a
> method OrderService.transitionOrder(orderId, newStatus, actorType,
> actorId) that is the ONLY way any order's status changes from now on...
> Do NOT put any side effects (points, stock release) in this function
> itself - it should only be the transition mechanic. We'll call this
> function FROM the endpoints that need side effects (approve/reject/
> cancel), and those endpoints add their own logic before or after calling
> transitionOrder.

Every later workflow reused that mechanic.
