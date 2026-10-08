"""
services.py (site) -- every database operation the Taj Ritheek site performs.

Ported from app_web/services.py: the SQL and the transaction boundaries are the
same; this version adds the extra reads the timeline, receipts and command
palette need, and classifies rule rejections so the UI can animate the right
state.

Rules of the road
  * All user input goes in as %s parameters -- never string-concatenated.
  * Multi-step operations use run_transaction (all-or-nothing).
  * The database is the authority: business rules live in triggers/CHECKs.
    When one fires, classify_error() turns it into {status, rule, message}.
"""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from mysql.connector import Error

from db import run_query, run_transaction, Ref

TAX_RATE = Decimal("0.05")
CENT = Decimal("0.01")


# ------------------------------------------------------------ error handling

class Rejected(Exception):
    """An application-level refusal (e.g. cancelling a stay already in progress)."""

    def __init__(self, message, status=409, rule="rejected"):
        super().__init__(message)
        self.message = message
        self.status = status
        self.rule = rule


class Invalid(Rejected):
    """Bad input from the client (malformed date, missing field...)."""

    def __init__(self, message, rule="invalid"):
        super().__init__(message, status=422, rule=rule)


CHECK_MESSAGES = {
    "chk_dates": ("Check-out must be after check-in.", "dates"),
    "chk_occupants": ("A booking needs at least one adult, and children can't be negative.", "occupants"),
    "chk_payment_nonneg": ("A payment can't be negative.", "amount"),
    "chk_charge_nonneg": ("A charge can't be negative.", "amount"),
    "chk_stay_dates": ("Check-out time must be after check-in time.", "dates"),
    "chk_invoice_nonneg": ("Invoice amounts can't be negative.", "amount"),
    "chk_rate_nonneg": ("A rate can't be negative.", "amount"),
    "chk_room_type_capacity": ("Room capacity must be at least 1.", "capacity"),
}

# The eight business rules enforced by the triggers in db/02_triggers.sql, keyed
# by a fragment of each trigger's own message text.
TRIGGER_RULES = [
    ("overlapping date range", "overlap"),
    ("exceeds room type capacity", "capacity"),
    ("exceed the invoice total", "overpayment"),
    ("Rate plan does not belong", "rate_plan"),
    ("does not match its service request", "charge_stay"),
    ("does not match the stay", "task_room"),
]


def classify_error(e):
    """Translate a MySQL error into (http_status, rule, message)."""
    code = getattr(e, "errno", None)
    text = getattr(e, "msg", None) or str(e)
    if code == 1451:
        return 409, "referenced", ("This record is still referenced by other data "
                                    "(for example, the guest has reservations), so it can't be deleted.")
    if code == 1062:
        return 409, "unique", "That value must be unique and already exists (for example, an email address already in use)."
    if code == 1452:
        return 422, "reference", "A referenced record doesn't exist. Check the selection and try again."
    if code in (3819, 4025):                       # CHECK constraint (MySQL / MariaDB)
        for name, (msg, rule) in CHECK_MESSAGES.items():
            if name in text:
                return 422, rule, msg
        return 422, "check", text
    if code == 1644 or getattr(e, "sqlstate", None) == "45000":   # trigger SIGNAL
        for fragment, rule in TRIGGER_RULES:
            if fragment in text:
                return 409, rule, text
        return 409, "rule", text
    if code in (1406, 1264, 1366, 1292):
        return 422, "invalid", "One of the values is not valid for its field (too long or wrong format)."
    return 500, "database", "The database could not complete that request."


# ------------------------------------------------------------ input helpers

def parse_date(value, label="date"):
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        raise Invalid(f"Please give a valid {label} (YYYY-MM-DD).", rule="dates")


def parse_int(value, label, minimum=None, maximum=None):
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise Invalid(f"Please give a whole number for {label}.", rule="invalid")
    if minimum is not None and n < minimum:
        raise Invalid(f"{label.capitalize()} must be at least {minimum}.", rule="invalid")
    if maximum is not None and n > maximum:
        raise Invalid(f"{label.capitalize()} can be at most {maximum}.", rule="invalid")
    return n


def parse_money(value, label="amount"):
    try:
        d = Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)
    except Exception:
        raise Invalid(f"Please give a valid {label}.", rule="amount")
    return d


def clean_text(value, label, maximum, required=True):
    s = (value or "").strip() if isinstance(value, str) or value is None else str(value).strip()
    if required and not s:
        raise Invalid(f"{label.capitalize()} is required.", rule="required")
    if len(s) > maximum:
        raise Invalid(f"{label.capitalize()} is too long (max {maximum} characters).", rule="invalid")
    return s


# ------------------------------------------------------------ dashboard

def room_board():
    """Every room with its status, current guest and next arrival (the key rack)."""
    return run_query("""
        SELECT r.room_id, r.room_number, rt.type_id, rt.type_name, rt.capacity, r.status,
               (SELECT g.full_name
                  FROM stay s
                  JOIN reservation res ON s.reservation_id = res.reservation_id
                  JOIN guest g ON g.guest_id = res.guest_id
                 WHERE res.room_id = r.room_id AND s.actual_check_out IS NULL
                 LIMIT 1) AS guest_name,
               (SELECT s.stay_id
                  FROM stay s
                  JOIN reservation res ON s.reservation_id = res.reservation_id
                 WHERE res.room_id = r.room_id AND s.actual_check_out IS NULL
                 LIMIT 1) AS stay_id,
               (SELECT MIN(res.planned_check_in)
                  FROM reservation res
                 WHERE res.room_id = r.room_id AND res.reservation_status = 'booked'
                   AND res.planned_check_in >= CURDATE()) AS next_arrival
        FROM room r JOIN room_type rt ON rt.type_id = r.type_id
        ORDER BY r.room_number
    """, fetch=True)


def dashboard_stats():
    occ = run_query("SELECT * FROM v_occupancy_rate", fetch=True)
    occ = occ[0] if occ else {"occupied_rooms": 0, "total_rooms": 0, "occupancy_pct": 0}
    vacant = len(run_query("SELECT room_id FROM v_vacant_rooms", fetch=True))
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


def upcoming_arrivals(limit=8):
    return run_query("""
        SELECT res.reservation_id, g.full_name AS guest, r.room_number AS room,
               res.planned_check_in AS arrives, res.planned_check_out AS departs,
               res.adults, res.children
        FROM reservation res
        JOIN guest g ON g.guest_id = res.guest_id
        JOIN room r ON r.room_id = res.room_id
        WHERE res.reservation_status = 'booked' AND res.planned_check_in >= CURDATE()
        ORDER BY res.planned_check_in LIMIT %s
    """, (limit,), fetch=True)


def due_out():
    return run_query("""
        SELECT o.room_id, o.room_number AS room, o.guest_name AS guest, o.planned_check_out AS departs,
               s.stay_id
        FROM v_current_occupancy o
        JOIN reservation res ON res.room_id = o.room_id AND res.reservation_status = 'checked_in'
        JOIN stay s ON s.reservation_id = res.reservation_id AND s.actual_check_out IS NULL
        ORDER BY o.planned_check_out
    """, fetch=True)


# ------------------------------------------------------------ timeline

def timeline(start, end):
    """Rooms plus every live reservation overlapping [start, end)."""
    start, end = parse_date(start, "start date"), parse_date(end, "end date")
    if end <= start:
        raise Invalid("The timeline range must end after it starts.", rule="dates")
    if (end - start).days > 400:
        raise Invalid("Please keep the timeline range under 400 days.")
    rooms = run_query("""
        SELECT r.room_id, r.room_number, rt.type_name, rt.capacity, r.status
        FROM room r JOIN room_type rt ON rt.type_id = r.type_id
        ORDER BY r.room_number
    """, fetch=True)
    bars = run_query("""
        SELECT res.reservation_id AS id, res.room_id, g.guest_id, g.full_name AS guest,
               res.planned_check_in AS check_in, res.planned_check_out AS check_out,
               res.reservation_status AS status, res.adults, res.children,
               rp.plan_name, rp.nightly_rate,
               s.stay_id
        FROM reservation res
        JOIN guest g ON g.guest_id = res.guest_id
        JOIN rate_plan rp ON rp.rate_plan_id = res.rate_plan_id
        LEFT JOIN stay s ON s.reservation_id = res.reservation_id
        WHERE res.reservation_status NOT IN ('cancelled', 'no_show')
          AND %s < res.planned_check_out AND %s > res.planned_check_in
        ORDER BY res.planned_check_in
    """, (start, end), fetch=True)
    return {"start": start, "end": end, "rooms": rooms, "bars": bars}


# ------------------------------------------------------------ booking

def search_rooms(check_in, check_out, adults=1, children=0):
    """All bookable rooms (not under maintenance) with a `booked` flag for the
    dates and an `over_capacity` flag for the party. Same overlap test as the
    CLI search and the database trigger."""
    ci, co = parse_date(check_in, "check-in date"), parse_date(check_out, "check-out date")
    if co <= ci:
        raise Invalid("Check-out must be after check-in.", rule="dates")
    party = parse_int(adults, "adults", 1) + parse_int(children, "children", 0)
    rows = run_query("""
        SELECT r.room_id, r.room_number, rt.type_id, rt.type_name, rt.capacity, rt.description, r.status,
               EXISTS (SELECT 1 FROM reservation res
                        WHERE res.room_id = r.room_id
                          AND res.reservation_status NOT IN ('cancelled', 'no_show')
                          AND %s < res.planned_check_out AND %s > res.planned_check_in) AS booked
        FROM room r JOIN room_type rt ON r.type_id = rt.type_id
        WHERE r.status <> 'maintenance'
        ORDER BY rt.capacity, r.room_number
    """, (ci, co), fetch=True)
    plans = run_query("SELECT rate_plan_id, type_id, plan_name, nightly_rate, description "
                      "FROM rate_plan ORDER BY nightly_rate", fetch=True)
    nights = (co - ci).days
    for r in rows:
        r["booked"] = bool(r["booked"])
        r["over_capacity"] = party > r["capacity"]
        r["plans"] = [p for p in plans if p["type_id"] == r["type_id"]]
        r["nights"] = nights
    return rows


def rate_plans(type_id=None):
    if type_id:
        return run_query("SELECT rate_plan_id, type_id, plan_name, nightly_rate, description FROM rate_plan "
                         "WHERE type_id = %s ORDER BY nightly_rate", (type_id,), fetch=True)
    return run_query("SELECT rate_plan_id, type_id, plan_name, nightly_rate, description FROM rate_plan "
                     "ORDER BY type_id, nightly_rate", fetch=True)


def room_types():
    return run_query("SELECT type_id, type_name, capacity, description FROM room_type ORDER BY capacity", fetch=True)


def rooms():
    return run_query("""SELECT r.room_id, r.room_number, r.status, rt.type_name, rt.capacity
                        FROM room r JOIN room_type rt ON rt.type_id = r.type_id
                        ORDER BY r.room_number""", fetch=True)


def create_reservation(room_id, rate_plan_id, check_in, check_out, adults, children,
                       guest_id=None, new_guest=None):
    """One transaction: a new guest is only kept if the reservation succeeds too.
    Returns (guest_id, reservation_id)."""
    ci, co = parse_date(check_in, "check-in date"), parse_date(check_out, "check-out date")
    adults = parse_int(adults, "adults", 1)
    children = parse_int(children, "children", 0)
    room_id = parse_int(room_id, "room")
    rate_plan_id = parse_int(rate_plan_id, "rate plan")
    stmts = []
    if new_guest:
        name = clean_text(new_guest.get("full_name"), "guest name", 100)
        email = clean_text(new_guest.get("email"), "email", 100)
        phone = clean_text(new_guest.get("phone"), "phone", 20, required=False) or None
        stmts.append(("INSERT INTO guest (full_name, email, phone) VALUES (%s, %s, %s)", (name, email, phone)))
        gid = Ref(0)
    elif guest_id:
        gid = parse_int(guest_id, "guest")
    else:
        raise Invalid("Choose an existing guest or enter a new one.", rule="required")
    stmts.append((
        """INSERT INTO reservation (guest_id, room_id, rate_plan_id, planned_check_in,
                                    planned_check_out, adults, children)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (gid, room_id, rate_plan_id, ci, co, adults, children)))
    res = run_transaction(stmts)
    return (res[0] if new_guest else gid), res[-1]


# ------------------------------------------------------------ reservations

RESERVATION_STATUSES = ["booked", "checked_in", "completed", "cancelled", "no_show"]


def reservations(status=None, search=None):
    sql = """
        SELECT res.reservation_id AS id, g.guest_id, g.full_name AS guest, r.room_number AS room, r.room_id,
               rt.type_name AS room_type, rp.plan_name AS rate_plan, rp.nightly_rate,
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
        if status not in RESERVATION_STATUSES:
            raise Invalid("Unknown reservation status.")
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
        raise Rejected("Reservation not found.", status=404, rule="not_found")
    return row[0]["reservation_status"]


def check_in(reservation_id):
    """One transaction: stay + reservation status + room status together."""
    status = _status_of(reservation_id)
    if status != "booked":
        raise Rejected(f"Only booked reservations can be checked in (this one is {status.replace('_', ' ')}).",
                       rule="state")
    room = run_query("SELECT r.status FROM reservation res JOIN room r ON r.room_id = res.room_id "
                     "WHERE res.reservation_id = %s", (reservation_id,), fetch=True)[0]["status"]
    if room in ("occupied", "maintenance", "cleaning"):
        raise Rejected(f"The room is {room} right now, so the guest can't be checked in yet.", rule="room_state")
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
        raise Rejected(f"Only booked reservations can be cancelled (this one is {status.replace('_', ' ')}).",
                       rule="state")
    run_query("UPDATE reservation SET reservation_status = 'cancelled' WHERE reservation_id = %s",
              (reservation_id,))


# ------------------------------------------------------------ stays and billing

def in_house():
    return run_query("""
        SELECT s.stay_id, res.reservation_id, g.guest_id, g.full_name AS guest, r.room_id, r.room_number AS room,
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
        raise Rejected("This stay was not found or has already been checked out.", status=404, rule="not_found")
    nights = max(int(row[0]["nights"]), 1)
    rate = Decimal(row[0]["nightly_rate"])
    services = Decimal(run_query(
        "SELECT COALESCE(SUM(amount), 0) AS t FROM service_charge WHERE stay_id = %s",
        (stay_id,), fetch=True)[0]["t"])
    room_charge = (rate * nights).quantize(CENT)
    subtotal = room_charge + services
    tax = (subtotal * TAX_RATE).quantize(CENT, rounding=ROUND_HALF_UP)
    return {"stay_id": stay_id, "nights": nights, "rate": rate, "room_charge": room_charge,
            "services": services, "subtotal": subtotal, "tax": tax, "total": subtotal + tax,
            "lines": invoice_lines(stay_id)}


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
    return run_query("SELECT charge_id, description, amount, charged_at FROM service_charge "
                     "WHERE stay_id = %s ORDER BY charged_at, charge_id", (stay_id,), fetch=True)


def invoice_payments(invoice_id):
    return run_query("SELECT payment_id, payment_date, amount, payment_method, payment_status "
                     "FROM payment WHERE invoice_id = %s ORDER BY payment_date, payment_id", (invoice_id,), fetch=True)


def invoice_detail(invoice_id):
    """Everything a receipt needs: header, room charge, service lines, payments."""
    rows = run_query("""
        SELECT i.invoice_id, i.stay_id, i.invoice_date, i.subtotal, i.tax, i.total, i.status,
               g.guest_id, g.full_name AS guest, g.email, r.room_number AS room, rt.type_name AS room_type,
               rp.plan_name, rp.nightly_rate,
               s.actual_check_in, s.actual_check_out,
               res.adults, res.children
        FROM invoice i
        JOIN stay s ON s.stay_id = i.stay_id
        JOIN reservation res ON res.reservation_id = s.reservation_id
        JOIN guest g ON g.guest_id = res.guest_id
        JOIN room r ON r.room_id = res.room_id
        JOIN room_type rt ON rt.type_id = r.type_id
        JOIN rate_plan rp ON rp.rate_plan_id = res.rate_plan_id
        WHERE i.invoice_id = %s
    """, (invoice_id,), fetch=True)
    if not rows:
        raise Rejected("Invoice not found.", status=404, rule="not_found")
    inv = rows[0]
    lines = invoice_lines(inv["stay_id"])
    payments = invoice_payments(invoice_id)
    services = sum((Decimal(l["amount"]) for l in lines), Decimal("0"))
    inv["room_charge"] = Decimal(inv["subtotal"]) - services
    inv["lines"] = lines
    inv["payments"] = payments
    inv["paid"] = sum((Decimal(p["amount"]) for p in payments if p["payment_status"] == "success"), Decimal("0"))
    inv["balance"] = Decimal(inv["total"]) - inv["paid"]
    return inv


def record_payment(invoice_id, amount, method):
    amount = parse_money(amount)
    if amount <= 0:
        raise Invalid("A payment must be more than zero.", rule="amount")
    if method not in ("cash", "card", "upi", "netbanking"):
        raise Invalid("Choose a payment method: cash, card, UPI or net banking.", rule="method")
    if not run_query("SELECT 1 AS x FROM invoice WHERE invoice_id = %s", (invoice_id,), fetch=True):
        raise Rejected("Invoice not found.", status=404, rule="not_found")
    run_query("INSERT INTO payment (invoice_id, amount, payment_method) VALUES (%s, %s, %s)",
              (invoice_id, amount, method))
    return invoice_detail(invoice_id)


# ------------------------------------------------------------ guest services

def log_service(stay_id, service_name, charge_description=None, amount=None):
    """One transaction: request + charge + marking the request fulfilled."""
    stay_id = parse_int(stay_id, "stay")
    service_name = clean_text(service_name, "service name", 100)
    stmts = [("INSERT INTO service_request (stay_id, service_name) VALUES (%s, %s)", (stay_id, service_name))]
    if amount is not None and str(amount).strip() != "":
        amount = parse_money(amount, "charge amount")
        desc = clean_text(charge_description or service_name, "charge description", 255)
        stmts.append(("INSERT INTO service_charge (stay_id, service_request_id, description, amount) "
                      "VALUES (%s, %s, %s, %s)", (stay_id, Ref(0), desc, amount)))
        stmts.append(("UPDATE service_request SET status = 'fulfilled' WHERE service_request_id = %s", (Ref(0),)))
    res = run_transaction(stmts)
    return {"service_request_id": res[0], "charged": len(stmts) > 1}


def service_log(limit=40):
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

TASK_STATUSES = ["pending", "in_progress", "done"]


def hk_tasks():
    return run_query("""
        SELECT ht.task_id, ht.room_id, r.room_number, r.status AS room_status, ht.task_type,
               ht.assigned_to, st.full_name AS assigned_staff,
               ht.task_status, ht.scheduled_at, ht.completed_at
        FROM housekeeping_task ht
        JOIN room r ON ht.room_id = r.room_id
        LEFT JOIN staff st ON ht.assigned_to = st.staff_id
        ORDER BY ht.scheduled_at, ht.task_id
    """, fetch=True)


def rooms_needing_tasks():
    """Rooms in 'cleaning' that have no open task yet."""
    return run_query("""
        SELECT r.room_id, r.room_number
        FROM room r
        WHERE r.status = 'cleaning'
          AND NOT EXISTS (SELECT 1 FROM housekeeping_task ht
                           WHERE ht.room_id = r.room_id AND ht.task_status <> 'done')
        ORDER BY r.room_number
    """, fetch=True)


def staff():
    return run_query("SELECT staff_id, full_name, role FROM staff ORDER BY full_name", fetch=True)


def create_task(room_id, task_type, staff_id):
    room_id = parse_int(room_id, "room")
    task_type = clean_text(task_type, "task type", 50)
    sid = parse_int(staff_id, "staff member") if staff_id not in (None, "") else None
    return run_query("INSERT INTO housekeeping_task (room_id, task_type, assigned_to, scheduled_at) "
                     "VALUES (%s, %s, %s, NOW())", (room_id, task_type, sid))


def set_task_status(task_id, status):
    """One transaction when finishing: mark done AND release the room."""
    if status not in TASK_STATUSES:
        raise Invalid("Task status must be pending, in_progress or done.")
    cur = run_query("SELECT task_status FROM housekeeping_task WHERE task_id = %s", (task_id,), fetch=True)
    if not cur:
        raise Rejected("Task not found.", status=404, rule="not_found")
    if cur[0]["task_status"] == status:
        return status
    if status == "done":
        stmts = [("UPDATE housekeeping_task SET task_status = %s, completed_at = NOW() WHERE task_id = %s",
                  (status, task_id)),
                 ("UPDATE room SET status = 'available' "
                  "WHERE status = 'cleaning' "
                  "AND room_id = (SELECT room_id FROM housekeeping_task WHERE task_id = %s)", (task_id,))]
    else:
        stmts = [("UPDATE housekeeping_task SET task_status = %s, completed_at = NULL WHERE task_id = %s",
                  (status, task_id))]
    run_transaction(stmts)
    return status


# ------------------------------------------------------------ guests

def guest_list(q=None):
    sql = """
        SELECT g.guest_id, g.full_name, g.email, g.phone,
               (SELECT COUNT(*) FROM reservation res WHERE res.guest_id = g.guest_id) AS reservations,
               (SELECT COUNT(*) FROM stay s JOIN reservation res ON res.reservation_id = s.reservation_id
                 WHERE res.guest_id = g.guest_id) AS stays
        FROM guest g
    """
    params = ()
    if q:
        sql += " WHERE g.full_name LIKE %s OR g.email LIKE %s OR g.phone LIKE %s"
        params = (f"%{q}%",) * 3
    sql += " ORDER BY g.full_name"
    return run_query(sql, params, fetch=True)


def _guest_fields(data):
    name = clean_text(data.get("full_name"), "name", 100)
    email = clean_text(data.get("email"), "email", 100)
    if "@" not in email or "." not in email.split("@")[-1]:
        raise Invalid("Please give a valid email address.", rule="email")
    phone = clean_text(data.get("phone"), "phone", 20, required=False) or None
    return name, email, phone


def add_guest(data):
    name, email, phone = _guest_fields(data)
    return run_query("INSERT INTO guest (full_name, email, phone) VALUES (%s, %s, %s)", (name, email, phone))


def update_guest(guest_id, data):
    name, email, phone = _guest_fields(data)
    if not run_query("SELECT 1 AS x FROM guest WHERE guest_id = %s", (guest_id,), fetch=True):
        raise Rejected("Guest not found.", status=404, rule="not_found")
    run_query("UPDATE guest SET full_name = %s, email = %s, phone = %s WHERE guest_id = %s",
              (name, email, phone, guest_id))


def delete_guest(guest_id):
    n = run_query("SELECT COUNT(*) AS n FROM reservation WHERE guest_id = %s", (guest_id,), fetch=True)[0]["n"]
    if n:
        raise Rejected(f"This guest has {n} reservation{'s' if n != 1 else ''} on record, so they can't be deleted. "
                       "Their history must stay for the hotel's accounts.", rule="referenced")
    if not run_query("DELETE FROM guest WHERE guest_id = %s", (guest_id,)):
        raise Rejected("Guest not found.", status=404, rule="not_found")


def guest_stays(guest_id):
    """Every reservation for a guest, with the stay and spend where one exists."""
    return run_query("""
        SELECT res.reservation_id, r.room_number, rt.type_name AS room_type,
               res.reservation_status AS status, res.planned_check_in, res.planned_check_out,
               s.actual_check_in, s.actual_check_out,
               COALESCE((SELECT SUM(sc.amount) FROM service_charge sc WHERE sc.stay_id = s.stay_id), 0) AS service_spend,
               COALESCE((SELECT inv.total FROM invoice inv WHERE inv.stay_id = s.stay_id), 0) AS invoice_total
        FROM reservation res
        JOIN room r ON r.room_id = res.room_id
        JOIN room_type rt ON rt.type_id = r.type_id
        LEFT JOIN stay s ON s.reservation_id = res.reservation_id
        WHERE res.guest_id = %s
        ORDER BY res.planned_check_in DESC
    """, (guest_id,), fetch=True)


# ------------------------------------------------------------ reports (the 8 views)

def all_reports():
    return {
        "current_occupancy": run_query("SELECT * FROM v_current_occupancy", fetch=True),
        "vacant_rooms": run_query("SELECT * FROM v_vacant_rooms", fetch=True),
        "cancellations": run_query("SELECT * FROM v_cancellations", fetch=True),
        "housekeeping_status": run_query("SELECT * FROM v_housekeeping_status", fetch=True),
        "guest_history": run_query("SELECT * FROM v_guest_history", fetch=True),
        "service_revenue": run_query("SELECT * FROM v_service_revenue", fetch=True),
        "total_revenue": run_query("SELECT * FROM v_total_revenue", fetch=True),
        "occupancy_rate": (run_query("SELECT * FROM v_occupancy_rate", fetch=True) or [{}])[0],
    }


# ------------------------------------------------------------ command palette

def search(q):
    q = (q or "").strip()
    if not q:
        return {"guests": [], "rooms": []}
    like = f"%{q}%"
    return {
        "guests": run_query("SELECT guest_id, full_name, email FROM guest "
                            "WHERE full_name LIKE %s OR email LIKE %s ORDER BY full_name LIMIT 6",
                            (like, like), fetch=True),
        "rooms": run_query("SELECT r.room_id, r.room_number, r.status, rt.type_name FROM room r "
                           "JOIN room_type rt ON rt.type_id = r.type_id "
                           "WHERE r.room_number LIKE %s OR rt.type_name LIKE %s ORDER BY r.room_number LIMIT 6",
                           (like, like), fetch=True),
    }
