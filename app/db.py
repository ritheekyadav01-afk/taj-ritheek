"""
db.py — single place that owns the MySQL connection.
Reads credentials from a local .env file (never hardcoded, never pasted
anywhere) via python-dotenv.
"""
import os
import sys
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "hotel_pbl"),
}


def get_connection():
    """Open a fresh connection. Caller is responsible for closing it."""
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Error as e:
        print(f"\n[DB ERROR] Could not connect to MySQL: {e}")
        print("Check that MySQL is running and app/.env has the right credentials.")
        sys.exit(1)


def run_query(sql, params=None, fetch=False, many=False):
    """
    Execute one statement. Returns fetched rows if fetch=True,
    otherwise returns the number of affected rows (and lastrowid
    for inserts, via cursor.lastrowid where relevant).
    Raises mysql.connector.Error on failure -- callers catch it to
    show a friendly message (this is where trigger SIGNALs surface).
    """
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(sql, params or ())
        if fetch:
            rows = cur.fetchall()
            return rows
        conn.commit()
        return cur.lastrowid if cur.lastrowid else cur.rowcount
    finally:
        cur.close()
        conn.close()


class Ref:
    """Placeholder for the result (last insert id) of an earlier statement
    in the same transaction, e.g. Ref(0) = the id created by statement 0."""
    def __init__(self, i):
        self.i = i


def run_transaction(statements):
    """
    Run several statements as ONE all-or-nothing unit on a single connection.
    statements: list of (sql, params). Params may contain Ref(n) to use the
    id produced by statement n. Returns a list with one result per statement
    (last insert id for INSERTs, affected-row count otherwise).
    On any error everything is rolled back and the error is re-raised, so
    callers never end up with half-finished data.
    """
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
