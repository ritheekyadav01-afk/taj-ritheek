"""
test_api.py -- exercises every endpoint against the live hotel_pbl database.
conftest.py snapshots the database first and restores it afterwards.

Run:  python3 -m pytest app_site/tests -v
"""
import sys
from pathlib import Path

import pytest
from mysql.connector import Error

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "api"))
import db  # noqa: E402

FAR = {"in": "2031-01-10", "out": "2031-01-12"}      # far-future dates never collide with real bookings
STATE = {}                                           # ids shared between the ordered flow tests


def count(table, where="1=1", params=()):
    return db.run_query(f"SELECT COUNT(*) AS n FROM {table} WHERE {where}", params, fetch=True)[0]["n"]


# ---------------------------------------------------------------- reads

@pytest.mark.parametrize("url", [
    "/api/health", "/api/dashboard", "/api/rooms", "/api/room-types", "/api/timeline",
    "/api/reservations", "/api/reservations?status=booked", "/api/stays/in-house", "/api/invoices",
    "/api/services", "/api/housekeeping", "/api/guests", "/api/guests?q=arjun", "/api/reports",
    "/api/search?q=mehta",
])
def test_reads_return_200(client, url):
    r = client.get(url)
    assert r.status_code == 200, r.get_data(as_text=True)


def test_dashboard_shape(client):
    d = client.get("/api/dashboard").get_json()
    assert {"stats", "board", "arrivals", "due_out"} <= set(d)
    assert len(d["board"]) == count("room")
    assert 0 <= d["stats"]["occupancy_pct"] <= 100


def test_reports_have_all_eight_views(client):
    r = client.get("/api/reports").get_json()
    assert set(r) == {"current_occupancy", "vacant_rooms", "cancellations", "housekeeping_status",
                      "guest_history", "service_revenue", "total_revenue", "occupancy_rate"}


def test_timeline_range_validation(client):
    r = client.get("/api/timeline?start=2031-02-01&end=2031-01-01")
    assert r.status_code == 422 and r.get_json()["error"] == "dates"


def test_unknown_route_is_clean_json(client):
    r = client.get("/api/nothing-here")
    assert r.status_code == 404 and r.get_json()["error"] == "not_found"


# ---------------------------------------------------------------- availability

def test_availability_flags_capacity_and_booking(client):
    rows = client.get("/api/availability?check_in=2031-01-10&check_out=2031-01-12&adults=3&children=0").get_json()
    standard = [r for r in rows if r["type_name"] == "Standard"][0]
    assert standard["over_capacity"] is True and standard["plans"]
    assert all(not r["booked"] for r in rows)


def test_availability_rejects_reversed_dates(client):
    r = client.get("/api/availability?check_in=2031-01-12&check_out=2031-01-10")
    assert r.status_code == 422 and r.get_json()["error"] == "dates"


# ---------------------------------------------------------------- the business rules

def test_rule_1_overlap_rejected_on_double_booking(client):
    ok = client.post("/api/reservations", json={
        "room_id": 2, "rate_plan_id": 1, "check_in": FAR["in"], "check_out": FAR["out"], "adults": 2, "children": 0,
        "new_guest": {"full_name": "ZZ Test Guest", "email": "zz.test.guest@example.test", "phone": "0000000000"}})
    assert ok.status_code == 201, ok.get_data(as_text=True)
    STATE["res"], STATE["guest"] = ok.get_json()["reservation_id"], ok.get_json()["guest_id"]

    clash = client.post("/api/reservations", json={
        "room_id": 2, "rate_plan_id": 1, "check_in": "2031-01-11", "check_out": "2031-01-13",
        "adults": 1, "children": 0, "guest_id": STATE["guest"]})
    assert clash.status_code == 409
    assert clash.get_json()["error"] == "overlap"
    assert "overlapping" in clash.get_json()["message"]


def test_rule_2_capacity_rejected(client):
    r = client.post("/api/reservations", json={
        "room_id": 1, "rate_plan_id": 1, "check_in": "2031-03-01", "check_out": "2031-03-03",
        "adults": 2, "children": 1, "guest_id": STATE["guest"]})
    assert r.status_code == 409 and r.get_json()["error"] == "capacity"


def test_rule_3_rate_plan_mismatch_rejected(client):
    r = client.post("/api/reservations", json={
        "room_id": 1, "rate_plan_id": 4, "check_in": "2031-03-01", "check_out": "2031-03-03",
        "adults": 1, "children": 0, "guest_id": STATE["guest"]})
    assert r.status_code == 409 and r.get_json()["error"] == "rate_plan"


def test_rule_4_reversed_dates_rejected_by_check(client):
    r = client.post("/api/reservations", json={
        "room_id": 1, "rate_plan_id": 1, "check_in": "2040-03-05", "check_out": "2040-03-03",
        "adults": 1, "children": 0, "guest_id": STATE["guest"]})
    assert r.status_code == 422 and r.get_json()["error"] == "dates"


def test_rule_5_zero_adults_rejected_by_check(client):
    r = client.post("/api/reservations", json={
        "room_id": 1, "rate_plan_id": 1, "check_in": "2040-03-01", "check_out": "2040-03-03",
        "adults": 0, "children": 0, "guest_id": STATE["guest"]})
    assert r.status_code == 422


def test_rule_6_and_7_triggers_not_reachable_from_the_api_fire_in_the_database():
    """Charge-stay mismatch and housekeeping room mismatch can't be produced by the
    API (it always sends consistent ids), so prove the triggers directly. The
    transaction is rolled back, so nothing is written."""
    conn = db.get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        conn.start_transaction()
        with pytest.raises(Error) as e1:
            cur.execute("INSERT INTO service_charge (stay_id, service_request_id, description, amount) "
                        "VALUES (2, 1, 'mismatch', 1.00)")          # request 1 belongs to stay 1
        assert "does not match its service request" in e1.value.msg
        with pytest.raises(Error) as e2:
            cur.execute("INSERT INTO housekeeping_task (room_id, stay_id, task_type, scheduled_at) "
                        "VALUES (2, 1, 'mismatch', NOW())")         # stay 1 is in room 3, not 2
        assert "does not match the stay" in e2.value.msg
    finally:
        conn.rollback()
        cur.close()
        conn.close()


def test_transaction_rolls_back_new_guest_when_booking_fails(client):
    before = count("guest")
    r = client.post("/api/reservations", json={
        "room_id": 2, "rate_plan_id": 1, "check_in": "2031-01-11", "check_out": "2031-01-12",
        "adults": 1, "children": 0,
        "new_guest": {"full_name": "ZZ Rollback Guest", "email": "zz.rollback@example.test", "phone": ""}})
    assert r.status_code == 409 and r.get_json()["error"] == "overlap"
    assert count("guest") == before
    assert count("guest", "email = %s", ("zz.rollback@example.test",)) == 0


def test_transaction_rolls_back_service_request_when_charge_fails(client):
    before = count("service_request")
    r = client.post("/api/services", json={"stay_id": 1, "service_name": "ZZ Rollback", "amount": "-5"})
    assert r.status_code in (409, 422)
    assert count("service_request") == before


# ---------------------------------------------------------------- the full guest journey

def test_check_in(client):
    r = client.post(f"/api/reservations/{STATE['res']}/check-in")
    assert r.status_code == 201
    STATE["stay"] = r.get_json()["stay_id"]
    assert db.run_query("SELECT status FROM room WHERE room_id = 2", fetch=True)[0]["status"] == "occupied"


def test_check_in_twice_is_refused(client):
    r = client.post(f"/api/reservations/{STATE['res']}/check-in")
    assert r.status_code == 409 and r.get_json()["error"] == "state"


def test_guest_service_with_charge(client):
    r = client.post("/api/services", json={
        "stay_id": STATE["stay"], "service_name": "Room Service - Dinner",
        "charge_description": "Dinner for 2", "amount": "750.00"})
    assert r.status_code == 201 and r.get_json()["charged"] is True
    log = client.get("/api/services").get_json()
    assert any(row["service"] == "Room Service - Dinner" and row["status"] == "fulfilled" for row in log)


def test_service_request_without_charge_stays_requested(client):
    r = client.post("/api/services", json={"stay_id": STATE["stay"], "service_name": "Extra pillows"})
    assert r.status_code == 201 and r.get_json()["charged"] is False


def test_checkout_quote_and_invoice(client):
    q = client.get(f"/api/stays/{STATE['stay']}/quote").get_json()
    assert q["nights"] == 1 and q["rate"] == 2500.0 and q["services"] == 750.0
    assert q["subtotal"] == 3250.0 and q["tax"] == 162.5 and q["total"] == 3412.5
    out = client.post(f"/api/stays/{STATE['stay']}/check-out")
    assert out.status_code == 201
    STATE["inv"] = out.get_json()["invoice_id"]
    assert out.get_json()["total"] == 3412.5
    assert db.run_query("SELECT status FROM room WHERE room_id = 2", fetch=True)[0]["status"] == "cleaning"
    assert db.run_query("SELECT reservation_status AS s FROM reservation WHERE reservation_id = %s",
                        (STATE["res"],), fetch=True)[0]["s"] == "completed"


def test_checkout_twice_is_refused(client):
    r = client.post(f"/api/stays/{STATE['stay']}/check-out")
    assert r.status_code == 404 and r.get_json()["error"] == "not_found"


def test_receipt_detail(client):
    inv = client.get(f"/api/invoices/{STATE['inv']}").get_json()
    assert inv["guest"] == "ZZ Test Guest" and inv["room_charge"] == 2500.0
    assert inv["balance"] == 3412.5 and len(inv["lines"]) == 1


def test_rule_8_overpayment_rejected(client):
    r = client.post(f"/api/invoices/{STATE['inv']}/payments", json={"amount": "4000", "method": "card"})
    assert r.status_code == 409 and r.get_json()["error"] == "overpayment"
    assert "exceed" in r.get_json()["message"]


def test_partial_then_full_payment(client):
    r1 = client.post(f"/api/invoices/{STATE['inv']}/payments", json={"amount": "1000", "method": "upi"})
    assert r1.status_code == 201 and r1.get_json()["status"] == "partially_paid"
    assert r1.get_json()["balance"] == 2412.5
    r2 = client.post(f"/api/invoices/{STATE['inv']}/payments", json={"amount": "2412.50", "method": "cash"})
    assert r2.status_code == 201 and r2.get_json()["status"] == "paid" and r2.get_json()["balance"] == 0


def test_payment_input_validation(client):
    assert client.post(f"/api/invoices/{STATE['inv']}/payments", json={"amount": "0", "method": "cash"}).status_code == 422
    assert client.post(f"/api/invoices/{STATE['inv']}/payments", json={"amount": "abc", "method": "cash"}).status_code == 422
    assert client.post(f"/api/invoices/{STATE['inv']}/payments", json={"amount": "5", "method": "bitcoin"}).status_code == 422
    assert client.post("/api/invoices/999999/payments", json={"amount": "5", "method": "cash"}).status_code == 404


# ---------------------------------------------------------------- housekeeping

def test_housekeeping_flow_frees_the_room(client):
    hk = client.get("/api/housekeeping").get_json()
    assert any(a["room_number"] == "102" for a in hk["awaiting"])
    created = client.post("/api/housekeeping", json={"room_id": 2, "task_type": "Post-checkout cleaning", "staff_id": 2})
    assert created.status_code == 201
    tid = created.get_json()["task_id"]
    assert client.patch(f"/api/housekeeping/{tid}", json={"status": "in_progress"}).status_code == 200
    assert db.run_query("SELECT status FROM room WHERE room_id = 2", fetch=True)[0]["status"] == "cleaning"
    assert client.patch(f"/api/housekeeping/{tid}", json={"status": "done"}).status_code == 200
    assert db.run_query("SELECT status FROM room WHERE room_id = 2", fetch=True)[0]["status"] == "available"
    assert client.patch(f"/api/housekeeping/{tid}", json={"status": "flying"}).status_code == 422
    assert client.patch("/api/housekeeping/999999", json={"status": "done"}).status_code == 404


# ---------------------------------------------------------------- cancel

def test_cancel_reservation(client):
    r = client.post("/api/reservations", json={
        "room_id": 4, "rate_plan_id": 3, "check_in": "2031-05-01", "check_out": "2031-05-03",
        "adults": 2, "children": 0, "guest_id": STATE["guest"]})
    rid = r.get_json()["reservation_id"]
    assert client.post(f"/api/reservations/{rid}/cancel").status_code == 200
    again = client.post(f"/api/reservations/{rid}/cancel")
    assert again.status_code == 409 and again.get_json()["error"] == "state"
    assert client.post("/api/reservations/999999/cancel").status_code == 404


# ---------------------------------------------------------------- guests

def test_guest_crud_and_delete_protection(client):
    r = client.post("/api/guests", json={"full_name": "ZZ Crud Guest", "email": "zz.crud@example.test", "phone": "111"})
    assert r.status_code == 201
    gid = r.get_json()["guest_id"]
    dup = client.post("/api/guests", json={"full_name": "ZZ Dup", "email": "zz.crud@example.test"})
    assert dup.status_code == 409 and dup.get_json()["error"] == "unique"
    bad = client.post("/api/guests", json={"full_name": "ZZ Bad", "email": "not-an-email"})
    assert bad.status_code == 422 and bad.get_json()["error"] == "email"
    assert client.put(f"/api/guests/{gid}", json={"full_name": "ZZ Crud Renamed", "email": "zz.crud@example.test",
                                                  "phone": "222"}).status_code == 200
    assert client.get("/api/guests?q=Renamed").get_json()[0]["phone"] == "222"
    assert client.get(f"/api/guests/{gid}/stays").get_json() == []
    assert client.delete(f"/api/guests/{gid}").status_code == 200
    assert client.delete(f"/api/guests/{gid}").status_code == 404

    blocked = client.delete(f"/api/guests/{STATE['guest']}")        # this guest has reservations
    assert blocked.status_code == 409 and blocked.get_json()["error"] == "referenced"
    assert "reservation" in blocked.get_json()["message"]
    history = client.get(f"/api/guests/{STATE['guest']}/stays").get_json()
    assert len(history) >= 2


def test_non_json_body_is_422(client):
    r = client.post("/api/guests", data="not json", content_type="text/plain")
    assert r.status_code == 422
