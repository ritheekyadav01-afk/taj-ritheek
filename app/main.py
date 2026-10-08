"""
main.py — Hotel Reservation and Guest Services Management System
Project 12 — DBMS PBL, Review 3

Menu-driven CLI covering: availability search, reservation, check-in/out,
service posting, housekeeping assignment, billing, payment, and reports.
"""
from datetime import datetime
from mysql.connector import Error
from db import run_query, run_transaction, Ref
import reports

# ---------------------------------------------------------------- helpers

def print_table(rows):
    if not rows:
        print("  (no rows)")
        return
    cols = list(rows[0].keys())
    widths = {c: max(len(c), max(len(str(r[c])) for r in rows)) for c in cols}
    header = " | ".join(c.ljust(widths[c]) for c in cols)
    print(" " + header)
    print(" " + "-" * len(header))
    for r in rows:
        print(" " + " | ".join(str(r[c]).ljust(widths[c]) for c in cols))


def prompt_date(label):
    while True:
        raw = input(f"{label} (YYYY-MM-DD): ").strip()
        try:
            datetime.strptime(raw, "%Y-%m-%d")
            return raw
        except ValueError:
            print("  Invalid date format, try again (e.g. 2026-10-15).")


def prompt_int(label, min_value=None):
    while True:
        raw = input(f"{label}: ").strip()
        try:
            val = int(raw)
            if min_value is not None and val < min_value:
                print(f"  Must be at least {min_value}.")
                continue
            return val
        except ValueError:
            print("  Please enter a whole number.")


def prompt_float(label, min_value=0):
    while True:
        raw = input(f"{label}: ").strip()
        try:
            val = float(raw)
            if val < min_value:
                print(f"  Must be at least {min_value}.")
                continue
            return val
        except ValueError:
            print("  Please enter a number.")


def prompt_nonempty(label):
    while True:
        raw = input(f"{label}: ").strip()
        if raw:
            return raw
        print("  This field can't be empty.")


def run_safe(fn, *args, **kwargs):
    """Run a DB-touching action; show a friendly message on failure
    instead of a raw traceback (this is where trigger SIGNALs land)."""
    try:
        return fn(*args, **kwargs)
    except Error as e:
        code = getattr(e, "errno", None)
        if code == 1451:
            msg = "This record is still referenced by other data (e.g. the guest has reservations), so it cannot be deleted."
        elif code == 1062:
            msg = "That value must be unique and already exists (e.g. an email already in use)."
        elif code == 1452:
            msg = "A referenced record does not exist - check the ID you entered."
        else:
            msg = e.msg if hasattr(e, "msg") else str(e)
        print(f"\n  [Rejected] {msg}")
        return None


# ---------------------------------------------------------------- 1. availability

def search_availability():
    print("\n-- Search room availability --")
    check_in = prompt_date("Check-in date")
    check_out = prompt_date("Check-out date")
    if check_out <= check_in:
        print("  Check-out must be after check-in.")
        return

    sql = """
        SELECT r.room_id, r.room_number, rt.type_name, rt.capacity, rp.nightly_rate
        FROM room r
        JOIN room_type rt ON r.type_id = rt.type_id
        JOIN rate_plan rp ON rp.type_id = rt.type_id
        WHERE r.status != 'maintenance'
          AND r.room_id NOT IN (
              SELECT room_id FROM reservation
              WHERE reservation_status NOT IN ('cancelled','no_show')
                AND %s < planned_check_out AND %s > planned_check_in
          )
        ORDER BY rt.type_name, r.room_number
    """
    rows = run_safe(run_query, sql, (check_in, check_out), fetch=True)
    if rows is not None:
        print_table(rows)


# ---------------------------------------------------------------- 2. reservation

def create_reservation():
    print("\n-- Create reservation --")
    print_table(run_query("SELECT guest_id, full_name, email FROM guest", fetch=True))
    guest_id = prompt_int("Guest ID (or 0 to add a new guest)")
    new_guest = None
    if guest_id == 0:
        name = prompt_nonempty("Full name")
        email = prompt_nonempty("Email")
        phone = input("Phone (optional): ").strip() or None
        new_guest = (name, email, phone)

    print_table(run_query("SELECT room_id, room_number, type_id, status FROM room", fetch=True))
    room_id = prompt_int("Room ID")
    print_table(run_query("SELECT rate_plan_id, plan_name, nightly_rate FROM rate_plan WHERE type_id = (SELECT type_id FROM room WHERE room_id=%s)", (room_id,), fetch=True))
    rate_plan_id = prompt_int("Rate plan ID")
    check_in = prompt_date("Planned check-in")
    check_out = prompt_date("Planned check-out")
    adults = prompt_int("Adults", min_value=1)
    children = prompt_int("Children", min_value=0)

    # One transaction: a new guest is only kept if the reservation succeeds too.
    stmts, gid = [], guest_id
    if new_guest:
        stmts.append(("INSERT INTO guest (full_name, email, phone) VALUES (%s,%s,%s)", new_guest))
        gid = Ref(0)
    stmts.append((
        """INSERT INTO reservation (guest_id, room_id, rate_plan_id, planned_check_in,
           planned_check_out, adults, children)
           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        (gid, room_id, rate_plan_id, check_in, check_out, adults, children)))
    res = run_safe(run_transaction, stmts)
    if res:
        if new_guest:
            print(f"  New guest created: guest_id={res[0]}")
        print(f"  Reservation created: reservation_id={res[-1]}")


# ---------------------------------------------------------------- 3/4. check-in / check-out

def check_in():
    print("\n-- Check in a guest --")
    print_table(run_query(
        "SELECT reservation_id, guest_id, room_id, planned_check_in, planned_check_out "
        "FROM reservation WHERE reservation_status = 'booked'", fetch=True))
    reservation_id = prompt_int("Reservation ID to check in")
    row = run_query("SELECT reservation_status FROM reservation WHERE reservation_id=%s",
                    (reservation_id,), fetch=True)
    if not row:
        print("  Reservation not found.")
        return
    if row[0]["reservation_status"] != "booked":
        print(f"  Only 'booked' reservations can be checked in (this one is '{row[0]['reservation_status']}').")
        return

    # One transaction: stay + reservation status + room status succeed or fail together.
    res = run_safe(run_transaction, [
        ("INSERT INTO stay (reservation_id, actual_check_in) VALUES (%s, NOW())", (reservation_id,)),
        ("UPDATE reservation SET reservation_status='checked_in' WHERE reservation_id=%s", (reservation_id,)),
        ("UPDATE room SET status='occupied' WHERE room_id = (SELECT room_id FROM reservation WHERE reservation_id=%s)", (reservation_id,)),
    ])
    if res:
        print(f"  Checked in. stay_id={res[0]}")


def check_out():
    print("\n-- Check out a guest (generates invoice) --")
    print_table(run_query(
        "SELECT s.stay_id, g.full_name, r.room_number, s.actual_check_in "
        "FROM stay s JOIN reservation res ON s.reservation_id=res.reservation_id "
        "JOIN guest g ON res.guest_id=g.guest_id JOIN room r ON res.room_id=r.room_id "
        "WHERE s.actual_check_out IS NULL", fetch=True))
    stay_id = prompt_int("Stay ID to check out")

    # Room charges: nights * nightly_rate (only for a stay that is still open)
    row = run_query("""
        SELECT res.reservation_id, rp.nightly_rate, s.actual_check_in,
               DATEDIFF(CURDATE(), DATE(s.actual_check_in)) AS nights
        FROM stay s JOIN reservation res ON s.reservation_id = res.reservation_id
        JOIN rate_plan rp ON res.rate_plan_id = rp.rate_plan_id
        WHERE s.stay_id = %s AND s.actual_check_out IS NULL
    """, (stay_id,), fetch=True)
    if not row:
        print("  Stay not found or already checked out.")
        return
    nights = max(row[0]["nights"], 1)
    room_charge = float(row[0]["nightly_rate"]) * nights

    service_total_row = run_query(
        "SELECT COALESCE(SUM(amount),0) AS t FROM service_charge WHERE stay_id=%s",
        (stay_id,), fetch=True)
    service_total = float(service_total_row[0]["t"])

    subtotal = room_charge + service_total
    tax = round(subtotal * 0.05, 2)
    total = round(subtotal + tax, 2)

    # One transaction: closing the stay and creating its invoice are inseparable.
    res = run_safe(run_transaction, [
        ("UPDATE stay SET actual_check_out = NOW() WHERE stay_id=%s", (stay_id,)),
        ("INSERT INTO invoice (stay_id, subtotal, tax, total) VALUES (%s,%s,%s,%s)",
         (stay_id, subtotal, tax, total)),
    ])
    if res:
        print(f"  Checked out. invoice_id={res[1]}  room={room_charge:.2f} "
              f"services={service_total:.2f} tax={tax:.2f} total={total:.2f}")


# ---------------------------------------------------------------- 5. service posting

def log_service_request():
    print("\n-- Log a service request --")
    print_table(run_query(
        "SELECT stay_id, reservation_id FROM stay WHERE actual_check_out IS NULL", fetch=True))
    stay_id = prompt_int("Stay ID")
    service_name = prompt_nonempty("Service name (e.g. Room Service, Spa, Laundry)")
    charge = None
    if input("  Post a charge for this now? (y/n): ").strip().lower() == "y":
        desc = prompt_nonempty("Charge description")
        amount = prompt_float("Amount")
        charge = (desc, amount)

    stmts = [("INSERT INTO service_request (stay_id, service_name) VALUES (%s,%s)", (stay_id, service_name))]
    if charge:
        stmts.append(("INSERT INTO service_charge (stay_id, service_request_id, description, amount) VALUES (%s,%s,%s,%s)",
                      (stay_id, Ref(0), charge[0], charge[1])))
        stmts.append(("UPDATE service_request SET status='fulfilled' WHERE service_request_id=%s", (Ref(0),)))
    res = run_safe(run_transaction, stmts)
    if res:
        print(f"  Service request logged: id={res[0]}")
        if charge:
            print(f"  Charge recorded: id={res[1]}")


# ---------------------------------------------------------------- 6. housekeeping

def assign_housekeeping():
    print("\n-- Assign / update a housekeeping task --")
    print("1. New task   2. Update task status")
    choice = input("Choice: ").strip()
    if choice == "1":
        print_table(run_query("SELECT room_id, room_number FROM room", fetch=True))
        room_id = prompt_int("Room ID")
        task_type = prompt_nonempty("Task type (e.g. Daily cleaning, Post-checkout cleaning)")
        print_table(run_query("SELECT staff_id, full_name, role FROM staff", fetch=True))
        staff_id = prompt_int("Assign to staff ID")
        task_id = run_safe(run_query,
            "INSERT INTO housekeeping_task (room_id, task_type, assigned_to, scheduled_at) VALUES (%s,%s,%s,NOW())",
            (room_id, task_type, staff_id))
        if task_id:
            print(f"  Task created: id={task_id}")
    elif choice == "2":
        print_table(reports.housekeeping_status())
        task_id = prompt_int("Task ID to update")
        status = input("New status (pending/in_progress/done): ").strip()
        if status not in ("pending", "in_progress", "done"):
            print("  Invalid status.")
            return
        stmts = [("UPDATE housekeeping_task SET task_status=%s WHERE task_id=%s", (status, task_id))]
        if status == "done":
            stmts = [("UPDATE housekeeping_task SET task_status=%s, completed_at = NOW() WHERE task_id=%s", (status, task_id)),
                     ("UPDATE room SET status='available' WHERE room_id = (SELECT room_id FROM housekeeping_task WHERE task_id=%s)", (task_id,))]
        # One transaction: finishing a task and freeing the room happen together.
        if run_safe(run_transaction, stmts) is not None:
            print("  Updated.")


# ---------------------------------------------------------------- 7. billing / payment

def record_payment():
    print("\n-- Record a payment --")
    print_table(run_query(
        "SELECT invoice_id, stay_id, total, status FROM invoice WHERE status != 'paid'", fetch=True))
    invoice_id = prompt_int("Invoice ID")
    amount = prompt_float("Payment amount")
    method = input("Method (cash/card/upi/netbanking): ").strip()
    if method not in ("cash", "card", "upi", "netbanking"):
        print("  Invalid payment method.")
        return
    payment_id = run_safe(run_query,
        "INSERT INTO payment (invoice_id, amount, payment_method) VALUES (%s,%s,%s)",
        (invoice_id, amount, method))
    if payment_id:
        print(f"  Payment recorded: id={payment_id}")


def view_invoice():
    print("\n-- View invoice --")
    invoice_id = prompt_int("Invoice ID")
    inv = run_query("SELECT * FROM invoice WHERE invoice_id=%s", (invoice_id,), fetch=True)
    if not inv:
        print("  Not found.")
        return
    print_table(inv)
    print("  Payments:")
    print_table(run_query("SELECT * FROM payment WHERE invoice_id=%s", (invoice_id,), fetch=True))


# ---------------------------------------------------------------- 10/11. cancel + guest management (Update / Delete)

def cancel_reservation():
    print("\n-- Cancel a reservation --")
    print_table(run_query(
        "SELECT reservation_id, guest_id, room_id, planned_check_in, planned_check_out, reservation_status "
        "FROM reservation WHERE reservation_status = 'booked'", fetch=True))
    reservation_id = prompt_int("Reservation ID to cancel")
    row = run_query("SELECT reservation_status FROM reservation WHERE reservation_id=%s",
                    (reservation_id,), fetch=True)
    if not row:
        print("  Reservation not found.")
        return
    status = row[0]["reservation_status"]
    if status != "booked":
        print(f"  Only 'booked' reservations can be cancelled (this one is '{status}').")
        return
    if input("  Confirm cancellation? (y/n): ").strip().lower() != "y":
        print("  Not cancelled.")
        return
    ok = run_safe(run_query,
        "UPDATE reservation SET reservation_status='cancelled' WHERE reservation_id=%s",
        (reservation_id,))
    if ok is not None:
        print(f"  Reservation {reservation_id} cancelled.")


def manage_guests():
    print("\n-- Manage guests --")
    print_table(run_query("SELECT guest_id, full_name, email, phone FROM guest", fetch=True))
    print("1. Update contact details   2. Delete a guest   3. Back")
    choice = input("Choice: ").strip()
    if choice == "1":
        guest_id = prompt_int("Guest ID")
        phone = input("New phone (blank = keep): ").strip()
        email = input("New email (blank = keep): ").strip()
        if not phone and not email:
            print("  Nothing to update.")
            return
        sets, params = [], []
        if phone:
            sets.append("phone=%s"); params.append(phone)
        if email:
            sets.append("email=%s"); params.append(email)
        params.append(guest_id)
        changed = run_safe(run_query, f"UPDATE guest SET {', '.join(sets)} WHERE guest_id=%s", tuple(params))
        if changed is not None:
            print("  Updated." if changed else "  Guest not found (or nothing changed).")
    elif choice == "2":
        guest_id = prompt_int("Guest ID to delete")
        if input("  Delete this guest permanently? (y/n): ").strip().lower() != "y":
            print("  Not deleted.")
            return
        deleted = run_safe(run_query, "DELETE FROM guest WHERE guest_id=%s", (guest_id,))
        if deleted is not None:
            print("  Guest deleted." if deleted else "  Guest not found.")


# ---------------------------------------------------------------- 8. reports menu

def reports_menu():
    options = {
        "1": ("Current occupancy", reports.current_occupancy),
        "2": ("Vacant rooms", reports.vacant_rooms),
        "3": ("Cancellations", reports.cancellations),
        "4": ("Housekeeping status", reports.housekeeping_status),
        "5": ("Guest history", reports.guest_history),
        "6": ("Service revenue", reports.service_revenue),
        "7": ("Total revenue by month", reports.total_revenue),
        "8": ("Occupancy rate", reports.occupancy_rate),
    }
    print("\n-- Reports --")
    for k, (label, _) in options.items():
        print(f"  {k}. {label}")
    choice = input("Choice: ").strip()
    if choice in options:
        label, fn = options[choice]
        print(f"\n{label}:")
        result = fn()
        if isinstance(result, dict):
            print_table([result])
        else:
            print_table(result)
    else:
        print("  Invalid choice.")


# ---------------------------------------------------------------- main menu

MENU = """
==================================================
 Hotel Reservation & Guest Services Management
==================================================
 1. Search room availability
 2. Create reservation
 3. Check in a guest
 4. Check out a guest (generates invoice)
 5. Log a service request / charge
 6. Assign / update housekeeping task
 7. Record a payment
 8. View an invoice
 9. Reports
 10. Cancel a reservation
 11. Manage guests (update / delete)
 0. Exit
--------------------------------------------------
"""


def main():
    while True:
        print(MENU)
        choice = input("Choice: ").strip()
        if choice == "1":
            search_availability()
        elif choice == "2":
            create_reservation()
        elif choice == "3":
            check_in()
        elif choice == "4":
            check_out()
        elif choice == "5":
            log_service_request()
        elif choice == "6":
            assign_housekeeping()
        elif choice == "7":
            record_payment()
        elif choice == "8":
            view_invoice()
        elif choice == "9":
            reports_menu()
        elif choice == "10":
            cancel_reservation()
        elif choice == "11":
            manage_guests()
        elif choice == "0":
            print("Goodbye.")
            break
        else:
            print("  Invalid choice, try again.")


if __name__ == "__main__":
    main()
