"""reports.py — thin wrappers around the reporting views in 04_views_reports.sql"""
from db import run_query


def current_occupancy():
    return run_query("SELECT * FROM v_current_occupancy", fetch=True)


def vacant_rooms():
    return run_query("SELECT * FROM v_vacant_rooms", fetch=True)


def cancellations():
    return run_query("SELECT * FROM v_cancellations", fetch=True)


def housekeeping_status():
    return run_query("SELECT * FROM v_housekeeping_status", fetch=True)


def guest_history(guest_id=None):
    if guest_id:
        return run_query("SELECT * FROM v_guest_history WHERE guest_id = %s", (guest_id,), fetch=True)
    return run_query("SELECT * FROM v_guest_history", fetch=True)


def service_revenue():
    return run_query("SELECT * FROM v_service_revenue", fetch=True)


def total_revenue():
    return run_query("SELECT * FROM v_total_revenue", fetch=True)


def occupancy_rate():
    rows = run_query("SELECT * FROM v_occupancy_rate", fetch=True)
    return rows[0] if rows else {}
