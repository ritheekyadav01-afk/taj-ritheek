# Web front end (Meridian): how to run

The web UI is a second front end for the same MySQL database and the same
business rules as the command-line app. It does not change the database.
Both can be used side by side.

## One-time setup

1. The database must already exist: run `db/01` to `db/04` in Workbench
   (the same scripts as before).
2. The login is read from `app/.env` (the same file the CLI uses), so there is
   nothing new to configure. Make sure `DB_USER`, `DB_PASSWORD` and `DB_NAME`
   are correct there.
3. Install the web dependencies once:

```bash
cd "/Users/rithhek/Desktop/dbms-hotel-review/review-3/app_web"
python3 -m pip install -r requirements.txt
```

## Start it

```bash
cd "/Users/rithhek/Desktop/dbms-hotel-review/review-3/app_web"
python3 -m streamlit run app.py
```

The browser opens at http://localhost:8501. Stop it with Ctrl+C in Terminal.
(If the folder is still named `dbms hotel review ` with a trailing space, use
that exact name in the path.)

## If the page says "Can't reach the database"

Fix the login in Workbench, then update `DB_PASSWORD` in `app/.env` to match:

```sql
ALTER USER 'hotel_app'@'localhost' IDENTIFIED BY 'Hotel2026ok';
```

## Screens and what they do

| Screen | What it covers (CLI menu equivalent) |
|---|---|
| Front desk | Live room board, occupancy, arrivals, due-out, money collected (reports) |
| Book a room | Availability search (1) and create reservation (2), new or existing guest |
| Reservations | Browse bookings, check in (3), cancel (10) |
| In-house guests | Running bill, check out and invoice (4) |
| Guest services | Log service request and charge (5) |
| Housekeeping | Assign tasks, start, mark done (6) |
| Billing | Invoices, record payment (7), view invoice (8) |
| Guests | Add, update, delete, stay history (11) |
| Reports | All eight database views (9), with charts |

## Demo script (about 3 minutes)

1. **Front desk**: point at the key-rack room board and the stat band.
2. **Book a room**: set check-in 22/09/2026 and check-out 26/09/2026, switch on
   *Include booked rooms*, choose room 103, click *Confirm reservation*.
   The red banner shows the database's own message: "Room is already booked
   for an overlapping date range." (business rule 1).
3. Pick 4 adults on a standard room to see rule 2 (occupant count exceeds capacity).
4. **Book a room** with free dates, then **Reservations** > *Check in*.
5. **Guest services**: log a Laundry charge of 350.
6. **In-house guests** > *Check out*: the bill preview, then confirm. The stay
   closes and the invoice is created in one transaction.
7. **Billing**: try a payment larger than the balance (rejected by the
   trigger), then pay the exact balance and watch the status become Paid.

## Viva notes for the web layer

- **How is it built?** Streamlit (Python). `services.py` holds every SQL
  statement, `views.py` draws the screens, `db.py` and `reports.py` are the same
  connection and reporting code as the CLI.
- **Where are the business rules enforced?** In the database (triggers and
  CHECK constraints), not in the UI. The UI only translates the database's
  error into plain English, so no screen can bypass a rule.
- **Transactions?** The same `run_transaction` as the CLI: new guest plus
  reservation, check-in, check-out plus invoice, service request plus charge,
  and finishing a housekeeping task plus freeing the room each commit or roll
  back as one unit.
- **SQL injection?** Every value goes in as a `%s` parameter; nothing is
  concatenated into SQL.
- **Why does the room board need no extra tables?** It is a read of `room`,
  `stay`, `reservation` and `guest`; the reports tab reads the eight views
  from `04_views_reports.sql`.
