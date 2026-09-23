# MetaYB — One-Page Summary

## What it does

MetaYB lets a manufacturer's distributors order online from a catalogue
showing live stock. Each order is checked the moment it is placed: stock is
set aside, the distributor's loyalty discount is applied, and the order is
confirmed if it fits their credit limit or held for a sales manager if not.

## Who uses it

- **Distributors** — browse the catalogue, place and cancel their own
  orders, and track each order, their points, tier and remaining credit.
- **Sales managers** — approve or reject held orders, see every order, and
  mark orders dispatched and delivered.

## What it replaces

Phone and email ordering with manual stock and credit checks, discounts
worked out by hand, and orders re-typed into the company's ERP system.

## Key rules it applies automatically

- Out-of-stock products are shown but cannot be ordered; stock can never be
  sold twice.
- Points are earned only on confirmed orders and taken back if a confirmed
  order is cancelled. Points from the last 90 days set the tier: Bronze,
  Silver (3% off) or Gold (6% off), fixed on each order when it is placed.
- Cancelling or rejecting an order before it ships returns its stock.
- Every status change records who made it and when, and is sent on for the
  ERP; temporary sending failures are retried automatically.

## Status

All required features work and are tested, using demonstration data.

## Before real use

- Connect the real ERP system; updates currently go to a stand-in.
- Restrict account creation; anyone can currently sign up, even as a sales
  manager.
- Load real products, distributors, credit limits and recent order history.
- Add a screen for updates the ERP permanently rejects.
