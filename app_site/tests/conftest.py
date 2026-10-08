"""
conftest.py -- run the API tests against the live hotel_pbl database without
leaving anything behind. The hotel_app login only has rights on hotel_pbl, so a
scratch database is not possible; dbsnap.py snapshots the database before the
first test and restores it after the last one (also when a test fails).
A list of the rows the tests created is written to tests/last_run_report.txt.
"""
import sys
from datetime import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dbsnap  # noqa: E402
from app import create_app  # noqa: E402

REPORT = Path(__file__).resolve().parent / "last_run_report.txt"


@pytest.fixture(scope="session", autouse=True)
def restore_database():
    snap = dbsnap.take()
    yield snap
    lines = [f"Test run finished {datetime.now().isoformat(timespec='seconds')}", "",
             "Rows created by the tests (all removed afterwards):"] + dbsnap.created(snap)
    try:
        dbsnap.restore(snap)
        lines += ["", "Restore: done. Row ids, statuses and AUTO_INCREMENT counters are back to the starting values."]
    except Exception as exc:                                        # pragma: no cover
        lines += ["", f"Restore FAILED: {type(exc).__name__}. Use the SQL in docs/how_to_run_site.md by hand."]
        raise
    finally:
        REPORT.write_text("\n".join(lines) + "\n")


@pytest.fixture(scope="session")
def client():
    return create_app().test_client()
