"""
db.py (web) -- the one place that owns the MySQL connection for the web UI.

Same design as the CLI's db.py (credentials from .env, one fresh connection
per call, run_transaction = all-or-nothing), with one difference: when MySQL
is unreachable it raises DatabaseUnavailable instead of calling sys.exit(),
so the web page can show a helpful message instead of crashing.

Credentials: app_web/.env is used if present; otherwise the CLI's app/.env
is reused, so there is nothing new to configure.
"""
import os
from pathlib import Path

import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

_HERE = Path(__file__).resolve().parent
load_dotenv(_HERE / ".env")
load_dotenv(_HERE.parent / "app" / ".env")   # does not override values already set

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "hotel_pbl"),
}


class DatabaseUnavailable(Exception):
    """MySQL could not be reached or the login was refused."""


def get_connection():
    """Open a fresh connection. Caller is responsible for closing it."""
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Error as e:
        raise DatabaseUnavailable(str(e)) from e


def ping():
    """Return None if the database answers, else the error text."""
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
