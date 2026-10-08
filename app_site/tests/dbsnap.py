"""dbsnap.py -- snapshot the live database, then put it back exactly as it was.

Used by conftest.py (pytest) and e2e_clickthrough.py (Playwright). Rows created
after the snapshot are deleted child-first, changed columns are restored, and
AUTO_INCREMENT counters are reset.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "api"))
import db  # noqa: E402

TABLES = [
    ("payment", "payment_id"), ("invoice", "invoice_id"), ("service_charge", "charge_id"),
    ("service_request", "service_request_id"), ("housekeeping_task", "task_id"), ("stay", "stay_id"),
    ("reservation", "reservation_id"), ("guest", "guest_id"), ("staff", "staff_id"),
    ("rate_plan", "rate_plan_id"), ("room", "room_id"), ("room_type", "type_id"),
]


def _max_id(table, pk):
    return db.run_query(f"SELECT COALESCE(MAX({pk}), 0) AS m FROM {table}", fetch=True)[0]["m"]


def take():
    q = lambda sql: db.run_query(sql, fetch=True)  # noqa: E731
    return {
        "baseline": {t: _max_id(t, pk) for t, pk in TABLES},
        "rooms": q("SELECT room_id, status FROM room"),
        "reservations": q("SELECT reservation_id, reservation_status FROM reservation"),
        "invoices": q("SELECT invoice_id, status FROM invoice"),
        "stays": q("SELECT stay_id, actual_check_out FROM stay"),
        "tasks": q("SELECT task_id, task_status, completed_at FROM housekeeping_task"),
        "requests": q("SELECT service_request_id, status FROM service_request"),
        "guests": q("SELECT guest_id, full_name, email, phone FROM guest"),
    }


def created(snap):
    out = []
    for t, pk in TABLES:
        n = db.run_query(f"SELECT COUNT(*) AS n FROM {t} WHERE {pk} > %s", (snap["baseline"][t],), fetch=True)[0]["n"]
        if n:
            out.append(f"  {t:<20} {n} row(s) with {pk} > {snap['baseline'][t]}")
    return out


def restore(snap):
    run = db.run_query
    for t, pk in TABLES:
        run(f"DELETE FROM {t} WHERE {pk} > %s", (snap["baseline"][t],))
    for r in snap["rooms"]:
        run("UPDATE room SET status = %s WHERE room_id = %s", (r["status"], r["room_id"]))
    for r in snap["reservations"]:
        run("UPDATE reservation SET reservation_status = %s WHERE reservation_id = %s", (r["reservation_status"], r["reservation_id"]))
    for r in snap["invoices"]:
        run("UPDATE invoice SET status = %s WHERE invoice_id = %s", (r["status"], r["invoice_id"]))
    for r in snap["stays"]:
        run("UPDATE stay SET actual_check_out = %s WHERE stay_id = %s", (r["actual_check_out"], r["stay_id"]))
    for r in snap["tasks"]:
        run("UPDATE housekeeping_task SET task_status = %s, completed_at = %s WHERE task_id = %s", (r["task_status"], r["completed_at"], r["task_id"]))
    for r in snap["requests"]:
        run("UPDATE service_request SET status = %s WHERE service_request_id = %s", (r["status"], r["service_request_id"]))
    for r in snap["guests"]:
        run("UPDATE guest SET full_name = %s, email = %s, phone = %s WHERE guest_id = %s", (r["full_name"], r["email"], r["phone"], r["guest_id"]))
    for t, pk in TABLES:
        run(f"ALTER TABLE {t} AUTO_INCREMENT = {int(snap['baseline'][t]) + 1}")
