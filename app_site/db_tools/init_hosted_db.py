"""
init_hosted_db.py -- load the Taj Ritheek schema, triggers, sample data and views into a
HOSTED MySQL database (Aiven, Railway, ...). Reads the same DB_* settings as the site.

  DB_HOST=... DB_PORT=... DB_USER=... DB_PASSWORD=... DB_NAME=... DB_SSL=1 \
      python3 app_site/db_tools/init_hosted_db.py [--reset] [--no-sample-data]

It runs db/01_schema.sql, 02_triggers.sql, 03_sample_data.sql and 04_views_reports.sql with
the CREATE DATABASE / DROP DATABASE / USE lines removed (a hosted login owns one database
that already exists). It refuses to run if the tables already exist unless you pass --reset,
which drops them first. It never touches anything on your laptop unless DB_HOST points there.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "api"))
import db  # noqa: E402

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db"
TABLES = ["payment", "invoice", "service_charge", "service_request", "housekeeping_task", "stay",
          "reservation", "staff", "guest", "rate_plan", "room", "room_type"]
VIEWS = ["v_current_occupancy", "v_vacant_rooms", "v_cancellations", "v_housekeeping_status",
         "v_guest_history", "v_service_revenue", "v_total_revenue", "v_occupancy_rate"]


def statements(text):
    """Split a MySQL script into statements, honouring DELIMITER changes (triggers)."""
    out, delim, buf = [], ";", []
    for line in text.splitlines():
        stripped = line.strip()
        m = re.match(r"^DELIMITER\s+(\S+)\s*$", stripped, re.I)
        if m:
            delim = m.group(1)
            continue
        if not stripped or stripped.startswith("--"):
            continue
        if re.match(r"^(DROP DATABASE|CREATE DATABASE|USE)\b", stripped, re.I):
            continue
        buf.append(line)
        if stripped.endswith(delim):
            stmt = "\n".join(buf).rstrip()
            out.append(stmt[: -len(delim)].rstrip())
            buf = []
    if buf and "".join(buf).strip():
        out.append("\n".join(buf).strip())
    return [s for s in out if s]


def main():
    reset = "--reset" in sys.argv
    sample = "--no-sample-data" not in sys.argv
    err = db.ping()
    if err:
        sys.exit(f"Cannot reach the database: {err}")
    conn = db.get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SHOW TABLES LIKE 'room'")
        if cur.fetchall():
            if not reset:
                sys.exit("The tables already exist. Re-run with --reset to drop and recreate them (this deletes the data).")
            cur.execute("SET FOREIGN_KEY_CHECKS = 0")
            for v in VIEWS:
                cur.execute(f"DROP VIEW IF EXISTS {v}")
            for t in TABLES:
                cur.execute(f"DROP TABLE IF EXISTS {t}")
            cur.execute("SET FOREIGN_KEY_CHECKS = 1")
            print("Dropped the existing tables.")
        files = ["01_schema.sql", "02_triggers.sql"] + (["03_sample_data.sql"] if sample else []) + ["04_views_reports.sql"]
        for name in files:
            stmts = statements((SQL_DIR / name).read_text())
            for s in stmts:
                cur.execute(s)
            conn.commit()
            print(f"  {name}: {len(stmts)} statements")
        cur.execute("SELECT COUNT(*) FROM room")
        print("Done. Rooms in the hosted database:", cur.fetchone()[0])
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
