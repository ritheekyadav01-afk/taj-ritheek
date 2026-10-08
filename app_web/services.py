"""
services.py -- every database operation the web UI performs.

This is the web counterpart of the menu functions in the CLI's main.py: the
SQL and the transaction boundaries are the same, but each function returns
data (or raises) instead of printing, so the UI decides how to show it.

Rules of the road
  * All user input goes in as %s parameters -- never string-concatenated.
  * Multi-step operations use run_transaction (all-or-nothing).
  * The database is the authority: business rules live in triggers/CHECKs.
    When one fires, attempt() turns the error into a plain-English message.
"""
from decimal import Decimal, ROUND_HALF_UP

from mysql.connector import Error

from db import run_query, run_transaction, Ref
import reports

TAX_RATE = Decimal("0.05")
CENT = Decimal("0.01")


# ------------------------------------------------------------ error handling

class Rejected(Exception):
    """An application-level refusal (e.g. cancelling a stay already in progress)."""


CHECK_MESSAGES = {
    "chk_dates": "Check-out must be after check-in.",
    "chk_occupants": "A booking needs at least one adult, and children can't be negative.",
    "chk_payment_nonneg": "A payment can't be negative.",
    "chk_charge_nonneg": "A charge can't be negative.",
    "chk_stay_dates": "Check-out time must be after check-in time.",
    "chk_invoice_nonneg": "Invoice amounts can't be negative.",
    "chk_rate_nonneg": "A rate can't be negative.",
    "chk_room_type_capacity": "Room capacity must be at least 1.",
}


def friendly_error(e):
    """Translate a MySQL error into a message a front-desk user can act on."""
    code = getattr(e, "errno", None)
    text = getattr(e, "msg", None) or str(e)
    if code == 1451:
        return "This record is still referenced by other data (for example, the guest has reservations), so it can't be deleted."
    if code == 1062:
        return "That value must be unique and already exists (for example, an email address already in use)."
    if code == 1452:
        return "A referenced record doesn't exist. Check the selection and try again."
    if code in (3819, 4025):                      # CHECK constraint (MySQL / MariaDB)
        for name, msg in CHECK_MESSAGES.items():
            if name in text:
                return msg
    return text                                   # trigger SIGNAL messages are already readable


def attempt(fn, *args, **kwargs):
    """Run an action. Returns (True, result) or (False, message)."""
    try:
        return True, fn(*args, **kwargs)
    except Rejected as e:
        return False, str(e)
    except Error as e:
        return False, friendly_error(e)


# ------------------------------------------------------------ dashboard

def room_board():
    """Every room with its status, current guest and next arrival (the key rack)."""
    return run_query("""
        SELECT r.room_id, r.room_number, rt.type_name, rt.capacity, r.status,
               (SELECT g.full_name
                  FROM stay s
                  JOIN reservation res ON s.reservation_id = res.reservation_id
                  JOIN guest g ON g.guest_id = res.guest_id
                 WHERE res.room_id = r.room_id AND s.actual_check_out IS NULL
                 LIMIT 1) AS guest_name,
               (SELECT MIN(res.planned_check_in)
                  FROM reservation res
                 WHERE res.room_id = r.room_id AND res.reservation_status = 'booked'
                   AND res.planned_check_in >= CURDATE()) AS next_arrival
        FROM room r JOIN room_type rt ON rt.type_id = r.type_id
        ORDER BY r.room_number
    """, fetch=True)


def dashboard_stats():
    occ = reports.occupancy_rate()
    vacant = len(reports.vacant_rooms())
    row = run_query("""
        SELECT
          (SELECT COALESCE(SUM(res.adults + res.children), 0)
             FROM stay s JOIN reservation res ON s.reservation_id = res.reservation_id
            WHERE s.actual_check_out IS NULL)                              AS in_house_guests,
          (SELECT COUNT(*) FROM reservation
            WHERE reservation_status = 'booked'
              AND planned_check_in BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)) AS arrivals_7d,
          (SELECT COUNT(*) FROM housekeeping_task WHERE task_status <> 'done') AS open_tasks,
          (SELECT COALESCE(SUM(amount), 0) FROM payment WHERE payment_status = 'success') AS collected,
          (SELECT COALESCE(SUM(total), 0) FROM invoice)
            - (SELECT COALESCE(SUM(amount), 0) FROM payment WHERE payment_status = 'success') AS balance_due
    """, fetch=True)[0]
    row.update(occ)
    row["vacant_rooms"] = vacant
    return row


def upcoming_arrivals(limit=6):
    return run_query("""
        SELECT res.reservation_id, g.full_name AS guest, r.room_number AS room,
               res.planned_check_in AS arrives, res.planned_check_out AS departs
        FROM reservation res
        JOIN guest g ON g.guest_id = res.guest_id
        JOIN room r ON r.room_id = res.room_id
        WHERE res.reservation_status = 'booked' AND res.planned_check_in >= CURDATE()
        ORDER BY res.planned_check_in LIMIT %s
    """, (limit,), fetch=True)


def due_out():
    return run_query("""
        SELECT room_number AS room, guest_name AS guest, planned_check_out AS departs
        FROM v_current_occupancy ORDER BY planned_check_out
    """, fetch=True)


# ------------------------------------------------------------ booking

def search_rooms(check_in, check_out):
    """All bookable rooms (not under maintenance) with a `booked` flag for the
    dates. Same overlap test as the CLI search and the database trigger."""
    return run_query("""
        SELECT r.room_id, r.room_number, rt.type_id, rt.type_name, rt.capacity, rt.description,
               (SELECT MIN(rp.nightly_rate) FROM rate_plan rp WHERE rp.type_id = rt.type_id) AS from_rate,
               EXISTS (SELECT 1 FROM reservation res
                        WHERE res.room_id = r.room_id
                          AND res.reservation_status NOT IN ('cancelled', 'no_show')
                          AND %s < res.planned_check_out AND %s > res.planned_check_in) AS booked
        FROM room r JOIN room_type rt ON r.type_id = rt.type_id
        WHERE r.status <> 'maintenance'
        ORDER BY rt.capacity, r.room_number
    """, (check_in, check_out), fetch=True)


def rate_plans(type_id):
    return run_query(
        "SELECT rate_plan_id, plan_name, nightly_rate, description FROM rate_plan "
        "WHERE type_id = %s ORDER BY nightly_rate", (type_id,), fetch=True)


def guests():
    return run_query("SELECT guest_id, full_name, email, phone FROM guest ORDER BY full_name", fetch=True)


def create_reservation(room_id, rate_plan_id, check_in, check_out, adults, children,
                       guest_id=None, new_guest=None):
    """One transaction: a new guest is only kept if the reservation succeeds too.
    Returns (guest_id, reservation_id)."""
    stmts = []
    if new_guest:
        stmts.append(("INSERT INTO guest (full_name, email, phone) VALUES (%s, %s, %s)", new_guest))
        gid = Ref(0)
    else:
        gid = guest_id
    stmts.append((
        """INSERT INTO reservation (guest_id, room_id, rate_plan_id, planned_check_in,
                                    planned_check_out, adults, children)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (gid, room_id, rate_plan_id, check_in, check_out, adults, children)))
    res = run_transaction(stmts)
    return (res[0] if new_guest else guest_id), res[-1]


# ------------------------------------------------------------ reservations

RESERVATION_STATUSES = ["booked", "checked_in", "completed", "cancelled", "no_show"]


def reservations(status=None, search=None):
    sql = """
        SELECT res.reservation_id AS id, g.full_name AS guest, r.room_number AS room,
               rt.type_name AS room_type, rp.plan_name AS rate_plan,
               res.planned_check_in AS check_in, res.planned_check_out AS check_out,
               DATEDIFF(res.planned_check_out, res.planned_check_in) AS nights,
               res.adults, res.children, res.reservation_status AS status
        FROM reservation res
        JOIN guest g ON g.guest_id = res.guest_id
        JOIN room r ON r.room_id = res.room_id
        JOIN room_type rt ON rt.type_id = r.type_id
        JOIN rate_plan rp ON rp.rate_plan_id = res.rate_plan_id
        WHERE 1 = 1
    """
    params = []
    if status:
        sql += " AND res.reservation_status = %s"
        params.append(status)
    if search:
        sql += " AND (g.full_name LIKE %s OR r.room_number LIKE %s)"
        params += [f"%{search}%", f"%{search}%"]
    sql += " ORDER BY res.planned_check_in DESC, res.reservation_id DESC"
    return run_query(sql, tuple(params), fetch=True)


def _status_of(reservation_id):
    row = run_query("SELECT reservation_status FROM reservation WHERE reservation_id = %s",
                    (reservation_id,), fetch=True)
    if not row:
        raise Rejected("Reservation not found.")
    return row[0]["reservation_status"]


def check_in(reservation_id):
    """One transaction: stay + reservation status + room status together."""
    status = _status_of(reservation_id)
    if status != "booked":
        raise Rejected(f"Only booked reservations can be checked in (this one is {status.replace('_', ' ')}).")
    res = run_transaction([
        ("INSERT INTO stay (reservation_id, actual_check_in) VALUES (%s, NOW())", (reservation_id,)),
        ("UPDATE reservation SET reservation_status = 'checked_in' WHERE reservation_id = %s", (reservation_id,)),
        ("UPDATE room SET status = 'occupied' "
         "WHERE room_id = (SELECT room_id FROM reservation WHERE reservation_id = %s)", (reservation_id,)),
    ])
    return res[0]          # stay_id


def cancel_reservation(reservation_id):
    status = _status_of(reservation_id)
    if status != "booked":
        raise Rejected(f"Only booked reservations can be cancelled (this one is {status.replace('_', ' ')}).")
    run_query("UPDATE reservation SET reservation_status = 'cancelled' WHERE reservation_id = %s",
              (reservation_id,))


# ------------------------------------------------------------ stays and billing

def in_house():
    return run_query("""
        SELECT s.stay_id, res.reservation_id, g.full_name AS guest, r.room_number AS room,
               rt.type_name AS room_type, s.actual_check_in, res.planned_check_out,
               rp.plan_name, rp.nightly_rate, res.adults, res.children,
               GREATEST(DATEDIFF(CURDATE(), DATE(s.actual_check_in)), 1) AS nights,
               COALESCE((SELECT SUM(sc.amount) FROM service_charge sc WHERE sc.stay_id = s.stay_id), 0) AS services
        FROM stay s
        JOIN reservation res ON s.reservation_id = res.reservation_id
        JOIN guest g ON g.guest_id = res.guest_id
        JOIN room r ON r.room_id = res.room_id
        JOIN room_type rt ON rt.type_id = r.type_id
        JOIN rate_plan rp ON rp.rate_plan_id = res.rate_plan_id
        WHERE s.actual_check_out IS NULL
        ORDER BY r.room_number
    """, fetch=True)


def checkout_quote(stay_id):
    """What the bill would be if the guest left now: nights x rate + services + 5% tax."""
    row = run_query("""
        SELECT rp.nightly_rate,
               DATEDIFF(CURDATE(), DATE(s.actual_check_in)) AS nights
        FROM stay s
        JOIN reservation res ON s.reservation_id = res.reservation_id
        JOIN rate_plan rp ON res.rate_plan_id = rp.rate_plan_id
        WHERE s.stay_id = %s AND s.actual_check_out IS NULL
    """, (stay_id,), fetch=True)
    if not row:
        raise Rejected("This stay was not found or has already been checked out.")
    nights = max(int(row[0]["nights"]), 1)
    rate = Decimal(row[0]["nightly_rate"])
    services = Decimal(run_query(
        "SELECT COALESCE(SUM(amount), 0) AS t FROM service_charge WHERE stay_id = %s",
        (stay_id,), fetch=True)[0]["t"])
    room_charge = (rate * nights).quantize(CENT)
    subtotal = room_charge + services
    tax = (subtotal * TAX_RATE).quantize(CENT, rounding=ROUND_HALF_UP)
    return {"nights": nights, "rate": rate, "room_charge": room_charge, "services": services,
            "subtotal": subtotal, "tax": tax, "total": subtotal + tax}


def check_out(stay_id):
    """One transaction: closing the stay and creating its invoice are inseparable.
    (A trigger then marks the reservation completed and the room 'cleaning'.)"""
    q = checkout_quote(stay_id)
    res = run_transaction([
        # GREATEST(...) keeps the stamp strictly after check-in, so a same-second
        # check-in/check-out (e.g. in a live demo) still satisfies chk_stay_dates.
        ("UPDATE stay SET actual_check_out = GREATEST(NOW(), actual_check_in + INTERVAL 1 SECOND) "
         "WHERE stay_id = %s", (stay_id,)),
        ("INSERT INTO invoice (stay_id, subtotal, tax, total) VALUES (%s, %s, %s, %s)",
         (stay_id, q["subtotal"], q["tax"], q["total"])),
    ])
    q["invoice_id"] = res[1]
    return q


def invoices():
    return run_query("""
        SELECT i.invoice_id, i.stay_id, g.full_name AS guest, r.room_number AS room,
               i.invoice_date, i.subtotal, i.tax, i.total,
               COALESCE((SELECT SUM(p.amount) FROM payment p
                          WHERE p.invoice_id = i.invoice_id AND p.payment_status = 'success'), 0) AS paid,
               i.status
        FROM invoice i
        JOIN stay s ON s.stay_id = i.stay_id
        JOIN reservation res ON res.reservation_id = s.reservation_id
        JOIN guest g ON g.guest_id = res.guest_id
        JOIN room r ON r.room_id = res.room_id
        ORDER BY i.invoice_id DESC
    """, fetch=True)


def invoice_lines(stay_id):
    return run_query("SELECT description, amount, charged_at FROM service_charge "
                     "WHERE stay_id = %s ORDER BY charged_at", (stay_id,), fetch=True)


def invoice_payments(invoice_id):
    return run_query("SELECT payment_id, payment_date, amount, payment_method, payment_status "
                     "FROM payment WHERE invoice_id = %s ORDER BY payment_date", (invoice_id,), fetch=True)


def record_payment(invoice_id, amount, method):
    return run_query("INSERT INTO payment (invoice_id, amount, payment_method) VALUES (%s, %s, %s)",
                     (invoice_id, amount, method))


# ------------------------------------------------------------ guest services

def log_service(stay_id, service_name, charge_description=None, amount=None):
    """One transaction: request + charge + marking the request fulfilled."""
    stmts = [("INSERT INTO service_request (stay_id, service_name) VALUES (%s, %s)", (stay_id, service_name))]
    if charge_description is not None:
        stmts.append(("INSERT INTO service_charge (stay_id, service_request_id, description, amount) "
                      "VALUES (%s, %s, %s, %s)", (stay_id, Ref(0), charge_description, amount)))
        stmts.append(("UPDATE service_request SET status = 'fulfilled' WHERE service_request_id = %s", (Ref(0),)))
    return run_transaction(stmts)


def service_log(limit=30):
    return run_query("""
        SELECT sr.service_request_id AS id, r.room_number AS room, g.full_name AS guest,
               sr.service_name AS service, sr.status, sr.requested_at AS requested,
               COALESCE(SUM(sc.amount), 0) AS charged
        FROM service_request sr
        JOIN stay s ON s.stay_id = sr.stay_id
        JOIN reservation res ON res.reservation_id = s.reservation_id
        JOIN room r ON r.room_id = res.room_id
        JOIN guest g ON g.guest_id = res.guest_id
        LEFT JOIN service_charge sc ON sc.service_request_id = sr.service_request_id
        GROUP BY sr.service_request_id, r.room_number, g.full_name, sr.service_name, sr.status, sr.requested_at
        ORDER BY sr.requested_at DESC, sr.service_request_id DESC
        LIMIT %s
    """, (limit,), fetch=True)


# ------------------------------------------------------------ housekeeping

def hk_tasks():
    return reports.housekeeping_status()


def staff():
    return run_query("SELECT staff_id, full_name, role FROM staff ORDER BY full_name", fetch=True)


def rooms():
    return run_query("SELECT room_id, room_number, status FROM room ORDER BY room_number", fetch=True)


def create_task(room_id, task_type, staff_id):
    return run_query("INSERT INTO housekeeping_task (room_id, task_type, assigned_to, scheduled_at) "
                     "VALUES (%s, %s, %s, NOW())", (room_id, task_type, staff_id))


def set_task_status(task_id, status):
    """One transaction when finishing: mark done AND release the room."""
    if status == "done":
        stmts = [("UPDATE housekeeping_task SET task_status = %s, completed_at = NOW() WHERE task_id = %s",
                  (status, task_id)),
                 ("UPDATE room SET status = 'available' "
                  "WHERE room_id = (SELECT room_id FROM housekeeping_task WHERE task_id = %s)", (task_id,))]
    else:
        stmts = [("UPDATE housekeeping_task SET task_status = %s WHERE task_id = %s", (status, task_id))]
    run_transaction(stmts)


# ------------------------------------------------------------ guests

def add_guest(name, email, phone):
    return run_query("INSERT INTO guest (full_name, email, phone) VALUES (%s, %s, %s)", (name, email, phone))


def update_guest(guest_id, name, email, phone):
    return run_query("UPDATE guest SET full_name = %s, email = %s, phone = %s WHERE guest_id = %s",
                     (name, email, phone, guest_id))


def delete_guest(guest_id):
    return run_query("DELETE FROM guest WHERE guest_id = %s", (guest_id,))


def guest_stats():
    return run_query("""
        SELECT g.guest_id,
               (SELECT COUNT(*) FROM reservation res WHERE res.guest_id = g.guest_id) AS reservations
        FROM guest g
    """, fetch=True)
