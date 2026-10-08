# Taj Ritheek site: how to run

A React front end and a Flask JSON API over the same MySQL database (`hotel_pbl`) and the
same business rules as the CLI and Streamlit apps. It lives entirely in `app_site/`;
`db/`, `app/` and `app_web/` are untouched.

## Setup (once)

1. The database must exist: run `db/01` to `db/04` in Workbench.
2. The login is read from `app/.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
   Nothing is hardcoded and the password is never printed or logged.
3. Needs Python 3.10+ and Node 18+. `run.sh` installs the Python and npm packages on first run.

## Start

```bash
bash app_site/run.sh
```

Opens http://localhost:5173. The Flask API runs on port 5001 and Vite proxies `/api` to it.
Stop with Ctrl+C. To change ports: `MERIDIAN_API_PORT=5002 MERIDIAN_SITE_PORT=5180 bash app_site/run.sh`
(if you change the API port, also edit the proxy target in `app_site/web/vite.config.js`).

If the site says it cannot reach the database, check that MySQL is running and that
`app/.env` matches the login in Workbench.

## Tests

```bash
python3 -m pytest app_site/tests -v                     # 43 API tests, live DB, auto-restored
python3 app_site/tests/e2e_clickthrough.py              # browser click-through (site must be running)
```

Both snapshot the database first and put it back afterwards (rows deleted, statuses and
AUTO_INCREMENT counters restored). `app_site/tests/last_run_report.txt` lists what the last
pytest run created before removing it. If a run is killed half way, run
`app_site/tests/cleanup_manual.sql` in Workbench.

## What the API does

| Area | Endpoints |
|---|---|
| Front desk | `GET /api/dashboard`, `/api/rooms`, `/api/timeline?start=&end=` |
| Booking | `GET /api/availability`, `POST /api/reservations`, `.../check-in`, `.../cancel` |
| Stays and billing | `GET /api/stays/in-house`, `.../quote`, `POST .../check-out`, `GET /api/invoices[/id]`, `POST /api/invoices/id/payments` |
| Guest services | `GET/POST /api/services` |
| Housekeeping | `GET/POST /api/housekeeping`, `PATCH /api/housekeeping/id` |
| Guests | `GET/POST /api/guests`, `PUT/DELETE /api/guests/id`, `GET /api/guests/id/stays` |
| Reports, search | `GET /api/reports` (all 8 views), `GET /api/search?q=` |

Every value is a `%s` parameter. Multi-step operations (book with a new guest, check-in,
check-out, log a service with a charge, finish a cleaning) use `run_transaction`.
Failures return `{"error": "<rule>", "message": "<database text>"}` with 409 (a rule or state
refused it), 422 (bad input), 404, 503 (database down) or 500.

## 3-minute demo script

1. **Front desk (0:00).** Watch the key fobs drop onto the rack. Point at the count-up stats.
   Click room 201: the fob lifts into a drawer with its reservations.
2. **Timeline (0:30).** Open Reservation timeline. Drag across free nights on room 301:
   a dashed selection follows the mouse, then the booking sheet opens with the dates filled in.
3. **Book (0:50).** Choose a rate, pick "New guest", fill a name and email, watch the slip total
   count up, confirm. A fob drops in to confirm the booking.
4. **Rejected double booking (1:20).** Book the same room for overlapping dates again. The
   claret error shows the database trigger's own words and nothing is saved.
5. **Check in (1:40).** Check-in and check-out, Arrivals, Check in: the fob turns from green to brass.
6. **Service (1:55).** Guest services: pick the guest, tap "Minibar", Log and charge.
7. **Check out (2:10).** In house, Preview bill (nights, services, 5% tax), Check out and issue
   invoice. The fob turns slate: the room is now with housekeeping.
8. **Billing (2:25).** Open the receipt. Try Rs 99,999: the overpayment trigger refuses it.
   Pay the balance: the wax seal stamps "Paid in full".
9. **Housekeeping (2:45).** Add a task for the room, drag its card across to Done: the room is free.
10. **Cmd+K (2:55).** Press Ctrl or Cmd + K, type a guest name, Enter: their stay history opens.
    Reports shows all eight views as charts.

## Cleaning up after your own demo

Booking, checking in and paying in the site writes real rows. To remove a demo guest and
everything attached to them, adapt `app_site/tests/cleanup_manual.sql` (it deletes by the
test email domain `example.test`; swap in your demo guest's email).

## Put it on GitHub so anyone can open and book (GitHub Pages demo)

The Pages build (`VITE_DEMO=1`) answers the API inside the browser from the sample data
(`app_site/web/src/demo.js`), with the same rules and messages as the database. A visitor can
book a room, get a double booking rejected, check in, add a service charge, check out, overpay
(rejected), pay in full and finish housekeeping. Nothing is stored: a reload restores the sample
data. It does not touch your MySQL database. The real Flask + MySQL site is unchanged.

1. Create a repository on GitHub and push this folder to the `main` branch.
   Check first that `app/.env` is NOT in `git status` (the root `.gitignore` excludes it).
2. On GitHub: Settings, Pages, Source = **GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` builds and publishes. When it finishes, the link is
   `https://<your-username>.github.io/<repository-name>/` (shown in the Actions run).
4. Send that link. The page shows a banner saying it is a live demo.

To try the demo build locally first:

```bash
cd app_site/web
VITE_DEMO=1 npm run build && npx vite preview
```

## Deploy the real thing online (Flask + MySQL, one link)

This puts the real site on the internet: the same code, a hosted MySQL, and a staff password.
Two free services are needed: a hosted MySQL (Aiven) and a host for the site (Render).
Create both accounts yourself; no passwords go into the repository.

### 1. Hosted MySQL (Aiven, free plan)
1. Sign up at aiven.io, create a **MySQL** service on the free plan, wait until it shows Running.
2. From its overview page note: Host, Port, User, Password, Database name.
3. Load the tables, the 10 triggers, the sample data and the 8 views into it, from your laptop:

```bash
cd "<project folder>"
DB_HOST=<host> DB_PORT=<port> DB_USER=<user> DB_PASSWORD='<password>' DB_NAME=<database> DB_SSL=1 \
  python3 app_site/db_tools/init_hosted_db.py
```

It prints each file and ends with "Rooms in the hosted database: 7". It refuses to run if the tables
already exist (use `--reset` to wipe and reload; add `--no-sample-data` for an empty hotel).

### 2. The site (Render, free plan)
1. Push the repository to GitHub (check `app/.env` is not listed by `git status`).
2. On render.com: New, **Blueprint**, pick the repository. It reads `render.yaml` and the `Dockerfile`.
3. When asked, fill in: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (the Aiven values)
   and `STAFF_PASSWORD` (the password mam will type). Leave the rest as it is.
4. Deploy. The link is `https://taj-ritheek.onrender.com` (Render shows the exact name).

Give mam the link and the staff password. The free Render plan sleeps after 15 minutes without
visitors, so the first load can take about a minute: open it yourself shortly before she does.

### How it behaves online
- Every `/api` route needs the staff password (sign-in screen, 12 hour session, Sign out button).
  Locally, with no `STAFF_PASSWORD` set, there is no login.
- Bookings and payments are real rows in the hosted database. To put the sample data back:
  `init_hosted_db.py --reset` (same variables as above).
- Run the same stack on your laptop to check it first:
  `STAFF_PASSWORD=test SECRET_KEY=x python3 -m gunicorn --chdir app_site/api app:app` after
  `cd app_site/web && npm run build` (serves the site and the API on port 8000).

### Not verified from here
The sign-in, gunicorn serving the built site, and the SQL splitting were tested on this laptop. The
Docker build, the Aiven connection and Render itself were not run (no Docker here, and no accounts),
so the first deploy is the real test. If a step fails, the Render logs show why; send them to me.
