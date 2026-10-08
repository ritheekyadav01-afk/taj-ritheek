> Paths below are relative to the `review-3/` folder.

# Review 3 — Hotel Reservation and Guest Services Management System

Project 12 — DBMS PBL · Dandigam Ritheek · AI-ML · Woxsen University

A working Python CLI application backed by a MySQL database implementing
the full system from the Review 1 ER diagram: 12 tables, normalized to 3NF (two documented, trigger-guarded exceptions), constraints
and triggers for every business rule, reporting views, and a menu-driven
app covering all required operations.

## Folder contents

```
db/
  01_schema.sql        tables, keys, CHECK constraints
  02_triggers.sql       business-rule triggers (overlap, capacity, payment limits)
  03_sample_data.sql     sample/test data
  04_views_reports.sql   reporting views (occupancy, vacancy, cancellations,
                          housekeeping, guest history, revenue)
  05_queries.sql         labeled demo queries (joins, subqueries, aggregation)
app/
  main.py                the CLI application (menu-driven, 11 operations)
  db.py                   database connection
  reports.py               report queries
  requirements.txt           Python dependencies
  .env.example               copy to .env and fill in your MySQL credentials
docs/
  sample_run_log.txt      full transcript of a real session, start to finish
  error_handling_demo.txt  transcript of deliberate errors being handled
  validation_tests.md      database, application and transaction tests
  viva_prep.md             likely viva questions with answers
  how_to_run.md            this file
```

## Setup

1. In MySQL Workbench (or the `mysql` CLI), run scripts 01, 02, 03, 04 in `db/`
   **in order** (05 is only demo queries — run it last, optionally).

2. Create a dedicated app user (don't use `root` for the app):
   ```sql
   CREATE USER 'hotel_app'@'localhost' IDENTIFIED BY 'choose-a-password';
   GRANT ALL PRIVILEGES ON hotel_pbl.* TO 'hotel_app'@'localhost';
   FLUSH PRIVILEGES;
   ```

3. In `app/`, copy the env template and edit it in a text editor —
   **never put real credentials in a prompt or in chat**:
   ```bash
   cd app
   cp .env.example .env
   ```
   Open `.env` and fill in `DB_PASSWORD` with the password you chose above.

4. Install dependencies and run:
   ```bash
   pip install -r requirements.txt
   python3 main.py
   ```

## What it covers

Every operation from the Review 3 brief, as menu options:

1. Search room availability (by date range)
2. Create reservation (new or existing guest)
3. Check in a guest (creates a Stay)
4. Check out a guest (auto-generates the invoice: room charge + services + tax)
5. Log a service request and post its charge
6. Assign or update a housekeeping task
7. Record a payment (rejected if it would exceed the invoice total)
8. View an invoice and its payments
9. Reports — occupancy, vacant rooms, cancellations, housekeeping status,
   guest history, service revenue, total revenue by month, occupancy rate
10. Cancel a reservation (booked reservations only; the row is kept for reports)
11. Manage guests — update contact details, or delete a guest who has no reservations

All eight business rules are enforced at the database
level (triggers + CHECK constraints), not just in the app — see
`docs/validation_tests.md` for the tests proving this.
