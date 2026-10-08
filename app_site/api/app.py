"""
app.py (site) -- the Taj Ritheek JSON API.

Run:  python3 app_site/api/app.py        (port 5001; Vite proxies /api to it)

Every route is a thin wrapper over services.py. Errors always come back as
    {"error": "<rule>", "message": "<readable text>"}
with HTTP 409 (a business rule or state refused it), 422 (bad input),
404 (not found), 503 (database unreachable) or 500 (anything unexpected).
"""
import hmac
import os
import sys
import time as clock
from datetime import date, datetime, timedelta, time
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from flask import Flask, jsonify, request, send_from_directory, session
from flask.json.provider import DefaultJSONProvider
from mysql.connector import Error
from werkzeug.exceptions import HTTPException

import db
import services as svc

DIST = Path(__file__).resolve().parent.parent / "web" / "dist"


class MeridianJSON(DefaultJSONProvider):
    """Money as numbers, dates as ISO strings, timedeltas as seconds."""
    sort_keys = False

    @staticmethod
    def default(o):
        if isinstance(o, Decimal):
            return float(o)
        if isinstance(o, datetime):
            return o.isoformat(timespec="seconds")
        if isinstance(o, date):
            return o.isoformat()
        if isinstance(o, (timedelta, time)):
            return str(o)
        return DefaultJSONProvider.default(o)


def create_app():
    app = Flask(__name__, static_folder=None)
    app.json = MeridianJSON(app)

    # ---------------------------------------------------------------- staff login
    # Off unless STAFF_PASSWORD is set, so local use needs nothing. On a public host
    # set STAFF_PASSWORD and SECRET_KEY: every /api route except the four below then needs a login.
    staff_password = os.getenv("STAFF_PASSWORD", "")
    app.secret_key = os.getenv("SECRET_KEY") or os.urandom(32)
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "").lower() in ("1", "true", "yes"),
        PERMANENT_SESSION_LIFETIME=60 * 60 * 12,
    )
    OPEN = {"/api/health", "/api/login", "/api/logout", "/api/session"}

    @app.before_request
    def _guard():
        if staff_password and request.path.startswith("/api/") and request.path not in OPEN and not session.get("staff"):
            return jsonify({"error": "login", "message": "Please sign in with the staff password."}), 401
        return None

    # ---------------------------------------------------------------- errors
    def fail(status, rule, message):
        return jsonify({"error": rule, "message": message}), status

    @app.errorhandler(svc.Rejected)
    def _rejected(e):
        return fail(e.status, e.rule, e.message)

    @app.errorhandler(Error)
    def _mysql(e):
        status, rule, message = svc.classify_error(e)
        if status == 500:
            app.logger.error("database error %s: %s", getattr(e, "errno", "?"), getattr(e, "msg", ""))
        return fail(status, rule, message)

    @app.errorhandler(db.DatabaseUnavailable)
    def _down(e):
        return fail(503, "unavailable",
                    "Can't reach the database. Check that MySQL is running and the login in app/.env is correct.")

    @app.errorhandler(404)
    def _nf(e):
        return fail(404, "not_found", "That page or record does not exist.")

    @app.errorhandler(405)
    def _bad_method(e):
        return fail(405, "method", "That action is not allowed here.")

    @app.errorhandler(Exception)
    def _boom(e):
        if isinstance(e, HTTPException):
            return fail(e.code or 400, "http", e.description or "The request could not be understood.")
        app.logger.exception("unexpected error")
        return fail(500, "server", "Something unexpected went wrong on the server.")

    def body():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise svc.Invalid("Send the details as a JSON object.")
        return data

    # ---------------------------------------------------------------- health
    @app.get("/api/health")
    def health():
        err = db.ping()
        if err:
            return fail(503, "unavailable", "Can't reach the database.")
        return jsonify({"ok": True})

    @app.get("/api/session")
    def session_state():
        return jsonify({"auth_required": bool(staff_password), "authenticated": (not staff_password) or bool(session.get("staff"))})

    @app.post("/api/login")
    def login():
        given = str((request.get_json(silent=True) or {}).get("password", ""))
        if staff_password and hmac.compare_digest(given.encode(), staff_password.encode()):
            session.clear()
            session["staff"] = True
            session.permanent = True
            return jsonify({"ok": True})
        clock.sleep(0.6)                              # slows down password guessing
        return fail(401, "login", "That password is not right.")

    @app.post("/api/logout")
    def logout():
        session.clear()
        return jsonify({"ok": True})

    # ---------------------------------------------------------------- front desk
    @app.get("/api/dashboard")
    def dashboard():
        return jsonify({
            "stats": svc.dashboard_stats(),
            "board": svc.room_board(),
            "arrivals": svc.upcoming_arrivals(),
            "due_out": svc.due_out(),
        })

    @app.get("/api/rooms")
    def rooms():
        return jsonify(svc.rooms())

    @app.get("/api/room-types")
    def room_types():
        return jsonify({"types": svc.room_types(), "plans": svc.rate_plans()})

    @app.get("/api/timeline")
    def timeline():
        today = date.today()
        start = request.args.get("start") or (today - timedelta(days=7)).isoformat()
        end = request.args.get("end") or (today + timedelta(days=45)).isoformat()
        return jsonify(svc.timeline(start, end))

    # ---------------------------------------------------------------- booking
    @app.get("/api/availability")
    def availability():
        return jsonify(svc.search_rooms(
            request.args.get("check_in"), request.args.get("check_out"),
            request.args.get("adults", 1), request.args.get("children", 0)))

    @app.post("/api/reservations")
    def create_reservation():
        d = body()
        new_guest = d.get("new_guest") if isinstance(d.get("new_guest"), dict) else None
        guest_id, reservation_id = svc.create_reservation(
            d.get("room_id"), d.get("rate_plan_id"), d.get("check_in"), d.get("check_out"),
            d.get("adults", 1), d.get("children", 0),
            guest_id=d.get("guest_id"), new_guest=new_guest)
        return jsonify({"reservation_id": reservation_id, "guest_id": guest_id}), 201

    @app.get("/api/reservations")
    def reservations():
        return jsonify(svc.reservations(request.args.get("status") or None, request.args.get("q") or None))

    @app.post("/api/reservations/<int:rid>/check-in")
    def check_in(rid):
        return jsonify({"stay_id": svc.check_in(rid)}), 201

    @app.post("/api/reservations/<int:rid>/cancel")
    def cancel(rid):
        svc.cancel_reservation(rid)
        return jsonify({"ok": True})

    # ---------------------------------------------------------------- stays and billing
    @app.get("/api/stays/in-house")
    def in_house():
        return jsonify(svc.in_house())

    @app.get("/api/stays/<int:sid>/quote")
    def quote(sid):
        return jsonify(svc.checkout_quote(sid))

    @app.post("/api/stays/<int:sid>/check-out")
    def check_out(sid):
        return jsonify(svc.check_out(sid)), 201

    @app.get("/api/invoices")
    def invoices():
        return jsonify(svc.invoices())

    @app.get("/api/invoices/<int:iid>")
    def invoice(iid):
        return jsonify(svc.invoice_detail(iid))

    @app.post("/api/invoices/<int:iid>/payments")
    def pay(iid):
        d = body()
        return jsonify(svc.record_payment(iid, d.get("amount"), d.get("method"))), 201

    # ---------------------------------------------------------------- guest services
    @app.get("/api/services")
    def services_log():
        return jsonify(svc.service_log())

    @app.post("/api/services")
    def services_new():
        d = body()
        return jsonify(svc.log_service(d.get("stay_id"), d.get("service_name"),
                                       d.get("charge_description"), d.get("amount"))), 201

    # ---------------------------------------------------------------- housekeeping
    @app.get("/api/housekeeping")
    def housekeeping():
        return jsonify({"tasks": svc.hk_tasks(), "staff": svc.staff(),
                        "awaiting": svc.rooms_needing_tasks()})

    @app.post("/api/housekeeping")
    def housekeeping_new():
        d = body()
        tid = svc.create_task(d.get("room_id"), d.get("task_type"), d.get("staff_id"))
        return jsonify({"task_id": tid}), 201

    @app.patch("/api/housekeeping/<int:tid>")
    def housekeeping_move(tid):
        d = body()
        return jsonify({"task_id": tid, "status": svc.set_task_status(tid, d.get("status"))})

    # ---------------------------------------------------------------- guests
    @app.get("/api/guests")
    def guests():
        return jsonify(svc.guest_list(request.args.get("q") or None))

    @app.post("/api/guests")
    def guest_add():
        return jsonify({"guest_id": svc.add_guest(body())}), 201

    @app.put("/api/guests/<int:gid>")
    def guest_edit(gid):
        svc.update_guest(gid, body())
        return jsonify({"ok": True})

    @app.delete("/api/guests/<int:gid>")
    def guest_delete(gid):
        svc.delete_guest(gid)
        return jsonify({"ok": True})

    @app.get("/api/guests/<int:gid>/stays")
    def guest_history(gid):
        return jsonify(svc.guest_stays(gid))

    # ---------------------------------------------------------------- reports and search
    @app.get("/api/reports")
    def reports():
        return jsonify(svc.all_reports())

    @app.get("/api/search")
    def search():
        return jsonify(svc.search(request.args.get("q")))

    # ---------------------------------------------------------------- built site (optional)
    if DIST.exists():
        @app.get("/", defaults={"path": ""})
        @app.get("/<path:path>")
        def spa(path):
            if path.startswith("api/"):
                return fail(404, "not_found", "That page or record does not exist.")
            target = DIST / path
            if path and target.is_file():
                return send_from_directory(DIST, path)
            return send_from_directory(DIST, "index.html")

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("MERIDIAN_API_PORT", "5001"))
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
