# Validation & Error-Handling Tests

Each business rule was deliberately violated against the live MySQL database. Every violation was rejected by a CHECK constraint or trigger, and the row count of the affected table was unchanged afterwards.

| # | Rule | Enforced by | Result |
|---|------|-------------|--------|
| 1 | No overlapping room bookings | Trigger | **Rejected** — `Room is already booked for an overlapping date range.` |
| 2 | Occupants within room capacity | Trigger | **Rejected** — `Occupant count exceeds room type capacity.` |
| 3 | Check-out after check-in | CHECK | **Rejected** — `Check constraint 'chk_dates' is violated.` |
| 4 | Charge amounts not negative | CHECK | **Rejected** — `Check constraint 'chk_charge_nonneg' is violated.` |
| 5 | Payments cannot exceed invoice total | Trigger | **Rejected** — `Payment would exceed the invoice total.` |
| 6 | Rate plan belongs to the room's type | Trigger | **Rejected** — `Rate plan does not belong to this room type.` |
| 7 | Charge's stay matches its request's stay | Trigger | **Rejected** — `Service charge stay does not match its service request.` |
| 8 | Task's room matches its stay's room | Trigger | **Rejected** — `Housekeeping task room does not match the stay's room.` |

A valid, non-conflicting reservation was also inserted afterwards to confirm the rules block only genuine violations. The Python app catches each rejection and prints `[Rejected] <message>` instead of crashing (see `sample_run_log.txt`).

## Application-level tests (through the Python menu)

| # | Action attempted | What the operator sees |
|---|------------------|------------------------|
| 1 | Book an overlapping date range | `[Rejected] Room is already booked for an overlapping date range.` |
| 2 | Type an impossible date (`bad-date`) | `Invalid date format, try again (e.g. 2026-10-15).` and the prompt repeats |
| 3 | Book 4 adults into a room for 2 | `[Rejected] Occupant count exceeds room type capacity.` |
| 4 | Pay more than the invoice total | `[Rejected] Payment would exceed the invoice total.` |
| 5 | Give a guest an email another guest already uses | `[Rejected] That value must be unique and already exists (e.g. an email already in use).` |
| 6 | Delete a guest who has reservations | `[Rejected] This record is still referenced by other data (e.g. the guest has reservations), so it cannot be deleted.` |
| 7 | Cancel a reservation that is already checked in | `Only 'booked' reservations can be cancelled (this one is 'checked_in').` |
| 8 | Check out a stay that is already closed | `Stay not found or already checked out.` (its original check-out time was verified unchanged) |
| 9 | Check in a cancelled reservation | `Only 'booked' reservations can be checked in (this one is 'cancelled').` |

Both captured sessions (`sample_run_log.txt`, `error_handling_demo.txt`) contain no error traces. After the booking and payment attempts, the reservation and payment counts were unchanged.

## Transaction test

Multi-step operations (check-in, check-out, service posting, finishing a housekeeping task, new guest plus reservation) run through `run_transaction` in `db.py`: all statements on one connection, committed together or rolled back together.

Test: a two-statement transaction inserted a new guest, then inserted a second guest with an email that already exists (UNIQUE violation). The error was raised, the guest count was unchanged, and the first guest did **not** survive, so the rollback worked. A second transaction (new guest, then a reservation referencing that new guest's id) committed both rows, as expected; the test rows were then removed.

