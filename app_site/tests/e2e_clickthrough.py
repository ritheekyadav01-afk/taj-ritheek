"""
e2e_clickthrough.py -- drives the real site in a browser through the whole guest journey:
book, rejected double booking, check in, service charge, check out, overpay (rejected),
pay in full (wax seal), finish a housekeeping task, plus a timeline drag. The database is
snapshotted first and restored afterwards (dbsnap.py), so nothing is left behind.

Needs the site running (bash app_site/run.sh) and Playwright installed.
Run:  python3 app_site/tests/e2e_clickthrough.py [shots_dir]
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dbsnap  # noqa: E402

import os

BASE = os.environ.get("E2E_BASE", "http://localhost:5173")   # demo build: http://localhost:4173/#
DEMO = os.environ.get("E2E_DEMO") == "1"                      # demo data lives in the browser, nothing to restore
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)
GUEST = "ZZ Demo Guest"


def step(msg):
    print("  ok  " + msg, flush=True)


def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 950})
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.set_default_timeout(8000)

        def go(path):
            # the demo build keeps its data in the page, so move with hash routes instead of reloading
            if DEMO:
                if "#" not in pg.url:
                    pg.goto(BASE + "/")
                    pg.wait_for_timeout(600)
                pg.evaluate("location.hash = '/'")
                pg.wait_for_selector("text=The key rack")
                pg.wait_for_timeout(900)
                pg.evaluate(f"location.hash = '{path}'")
                pg.wait_for_timeout(900)
            else:
                pg.goto(BASE + path)

        def book(room="Room 102, Standard", guest_new=True):
            go("/book")
            pg.wait_for_selector("text=Choose a room and a rate")
            dates = pg.locator("input[type=date]")
            dates.nth(0).fill("2031-02-10")
            dates.nth(1).fill("2031-02-12")
            pg.wait_for_timeout(700)
            pg.get_by_role("radio", name=room).click()
            if guest_new:
                pg.get_by_role("radio", name="New guest").click()
                pg.get_by_label("Full name").fill(GUEST)
                pg.get_by_label("Email").fill("zz.demo.guest@example.test")
            else:
                pg.get_by_label("Guest on file").select_option(label=f"{GUEST} (zz.demo.guest@example.test)")
            pg.get_by_role("button", name="Confirm booking").click()

        # 1 book
        book()
        pg.wait_for_selector(f"text=Reserved for {GUEST}")
        pg.wait_for_timeout(1300)
        pg.screenshot(path=SHOTS / "1_booked.png")
        step("booked room 102")

        # 2 rejected double booking (same room, overlapping dates, guest now on file)
        book(guest_new=False)
        alert = pg.get_by_role("alert").filter(has_text="overlapping")
        expect(alert).to_be_visible()
        pg.wait_for_timeout(1300)
        pg.screenshot(path=SHOTS / "2_rejected_overlap.png")
        step("double booking rejected with the database's own message")

        # 3 check in
        go("/stays")
        row = pg.locator("li", has_text=GUEST)
        row.get_by_role("button", name="Check in").click()
        pg.get_by_role("dialog").get_by_role("button", name="Check in").click()
        pg.wait_for_selector("text=Welcome, ZZ")
        pg.wait_for_timeout(1600)
        pg.screenshot(path=SHOTS / "3_checked_in.png")
        pg.get_by_role("button", name="Done").click()
        step("checked in")

        # 4 service charge
        go("/services")
        pg.get_by_label("Guest and room").select_option(label=f"Room 102, {GUEST}")
        pg.get_by_role("button", name="Minibar").click()
        pg.get_by_role("button", name="Log and charge").click()
        pg.wait_for_selector("text=Charged to the room")
        pg.wait_for_timeout(900)
        pg.screenshot(path=SHOTS / "4_service.png")
        step("service request logged and charged (380.00)")

        # 5 check out
        go("/stays?tab=inhouse")
        pg.locator("li", has_text=GUEST).get_by_role("button", name="Preview bill").click()
        pg.wait_for_selector("text=Total due")
        pg.wait_for_timeout(1200)
        pg.screenshot(path=SHOTS / "5_bill_preview.png")
        pg.get_by_role("button", name="Check out and issue invoice").click()
        pg.wait_for_selector("text=now with housekeeping")
        pg.get_by_role("button", name="Open the receipt").click()
        pg.wait_for_selector("text=Receipt", state="attached")
        step("checked out, invoice issued")

        # 6 overpay rejected, then pay in full
        pg.wait_for_selector("text=Record a payment")
        pg.get_by_label("Amount, up to").fill("999999")
        pg.get_by_role("button", name="Record payment").click()
        expect(pg.get_by_role("alert").filter(has_text="exceed")).to_be_visible()
        pg.wait_for_timeout(1300)
        pg.screenshot(path=SHOTS / "6_overpay_rejected.png")
        step("overpayment rejected by the trigger")
        pg.get_by_label("Amount, up to").fill("1000")
        pg.get_by_role("button", name="Record payment").click()
        pg.wait_for_selector("text=Payment recorded")
        # pay the rest: the field refills with the new balance after the payment
        pg.wait_for_function("document.querySelector('input[inputmode=decimal]')?.value === '1604.00'")
        pg.wait_for_timeout(600)
        pg.get_by_role("button", name="Record payment").click()
        pg.wait_for_selector("text=Paid in full")
        pg.wait_for_timeout(2200)
        pg.screenshot(path=SHOTS / "7_paid_seal.png")
        expect(pg.get_by_role("img", name="Paid in full")).to_be_visible()
        step("paid in full, wax seal stamped")

        # 7 housekeeping
        go("/housekeeping")
        pg.get_by_text("Room 102 needs cleaning").wait_for()
        pg.get_by_role("button", name="Add a task").click()
        pg.get_by_role("button", name="Add to the board").click()
        pg.wait_for_selector("text=Task added")
        pg.wait_for_timeout(900)
        card = pg.locator("li", has_text="Room 102").filter(has_text="Post-checkout").first
        card.get_by_role("button", name="Start").click()
        pg.wait_for_timeout(900)
        # real mouse drag into the Done column
        card = pg.locator("li", has_text="Room 102").filter(has_text="Post-checkout").first
        box = card.bounding_box()
        done = pg.locator("section[aria-labelledby=col-done]").bounding_box()
        pg.mouse.move(box["x"] + 60, box["y"] + 30)
        pg.mouse.down()
        pg.mouse.move(box["x"] + 200, box["y"] + 60, steps=8)
        pg.mouse.move(done["x"] + done["width"] / 2, done["y"] + 140, steps=14)
        pg.wait_for_timeout(300)
        pg.screenshot(path=SHOTS / "8_kanban_dragging.png")
        pg.mouse.up()
        pg.wait_for_selector("text=Room 102 is free")
        pg.wait_for_timeout(1200)
        pg.screenshot(path=SHOTS / "9_kanban_done.png")
        step("housekeeping card dragged to Done, room 102 freed")

        # 8 timeline drag
        go("/timeline")
        pg.wait_for_selector("text=Room 301")
        pg.wait_for_timeout(1800)
        track = pg.get_by_role("group", name="Room 301. Arrow keys choose nights, Enter books.").bounding_box()
        y = track["y"] + track["height"] / 2
        pg.mouse.move(track["x"] + 50 * 5 + 20, y)
        pg.mouse.down()
        pg.mouse.move(track["x"] + 50 * 7 + 20, y, steps=10)
        pg.wait_for_timeout(300)
        pg.screenshot(path=SHOTS / "10_timeline_drag.png")
        pg.mouse.up()
        pg.wait_for_selector("text=Book room 301")
        pg.wait_for_timeout(1200)
        pg.screenshot(path=SHOTS / "11_timeline_booking.png")
        step("timeline drag opened the booking sheet with the dates filled in")
        pg.keyboard.press("Escape")

        # 9 command palette
        go("/")
        pg.wait_for_selector("text=The key rack")
        pg.wait_for_timeout(1500)
        pg.keyboard.press("Control+k")
        pg.keyboard.type("sharma")
        pg.get_by_role("option").filter(has_text="Priya Sharma").wait_for()
        pg.wait_for_timeout(500)
        pg.screenshot(path=SHOTS / "12_palette.png")
        pg.keyboard.press("Enter")
        pg.wait_for_selector("text=Stay history")
        step("command palette found and opened a guest")

        print("console/page errors:", [e for e in errors if "favicon" not in e][:5])
        b.close()


if __name__ == "__main__":
    if DEMO:
        run()
        sys.exit(0)
    snap = dbsnap.take()
    try:
        run()
    finally:
        print("Rows the click-through created (now being removed):")
        print("\n".join(dbsnap.created(snap)) or "  none")
        dbsnap.restore(snap)
        print("Database restored.")
