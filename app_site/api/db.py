"""
db.py (site) -- the one place that owns the MySQL connection for the Taj Ritheek site.

Same design as app/db.py and app_web/db.py: credentials come from a .env file
(app_site/.env if present, otherwise the CLI's app/.env), one fresh connection
per call, and run_transaction is all-or-nothing. When MySQL is unreachable it
raises DatabaseUnavailable so the API can answer with a clean 503.

The password is only ever read into DB_CONFIG; it is never printed or logged.
"""
import os
from pathlib import Path

import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

_HERE = Path(__file__).resolve().parent
load_dotenv(_HERE.parent / ".env")
load_dotenv(_HERE.parent.parent / "app" / ".env")   # does not override values already set

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "hotel_pbl"),
}
# Hosted MySQL (Aiven, Railway, ...) requires TLS: set DB_SSL=1, and optionally DB_SSL_CA=/path/ca.pem
if os.getenv("DB_SSL", "").lower() in ("1", "true", "yes", "required"):
    DB_CONFIG["ssl_disabled"] = False
    if os.getenv("DB_SSL_CA"):
        DB_CONFIG["ssl_ca"] = os.getenv("DB_SSL_CA")
        DB_CONFIG["ssl_verify_cert"] = True


class DatabaseUnavailable(Exception):
    """MySQL could not be reached or the login was refused."""


def get_connection():
    """Open a fresh connection. Caller is responsible for closing it."""
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Error as e:
        raise DatabaseUnavailable(e.msg if getattr(e, "msg", None) else "Database unavailable") from e


def ping():
    """Return None if the database answers, else a short error text."""
    try:
        conn = get_connection()
    except DatabaseUnavailable as e:
        return str(e)
    conn.close()
    return None


def run_query(sql, params=None, fetch=False):
    """Execute one statement. Rows (as dicts) if fetch=True, otherwise the new
    row id / affected-row count. Raises mysql.connector.Error on failure --
    this is where trigger SIGNALs and CHECK violations surface."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(sql, params or ())
        if fetch:
            return cur.fetchall()
        conn.commit()
        return cur.lastrowid if cur.lastrowid else cur.rowcount
    finally:
        cur.close()
        conn.close()


class Ref:
    """Placeholder for the id created by an earlier statement in the same
    transaction, e.g. Ref(0) = the id produced by statement 0."""
    def __init__(self, i):
        self.i = i


def run_transaction(statements):
    """Run several statements as ONE all-or-nothing unit on one connection.
    statements: list of (sql, params); params may contain Ref(n). On any error
    everything is rolled back and the error is re-raised."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    results = []
    try:
        conn.start_transaction()
        for sql, params in statements:
            p = tuple(results[x.i] if isinstance(x, Ref) else x for x in (params or ()))
            cur.execute(sql, p)
            results.append(cur.lastrowid if cur.lastrowid else cur.rowcount)
        conn.commit()
        return results
    except Error:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
