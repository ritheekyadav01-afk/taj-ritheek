"""
views.py -- the nine screens. Each function draws one page.

All data access goes through services.py; every write goes through
services.attempt(), which returns (ok, result_or_message) so a rule
violation is shown as a clear banner instead of a stack trace.
"""
from datetime import date, timedelta
from decimal import Decimal

import altair as alt
import pandas as pd
import streamlit as st

import reports
import services
import theme
from theme import (inr, d_, dt_, esc, label, page_header, section, source_note, stat_band,
                   chip, status_chip, rejected, flash, key_rack, legend, receipt)


# ------------------------------------------------------------ shared helpers

def table(rows, money=(), dates=(), datetimes=(), status=(), rename=None,
          empty="Nothing here yet."):
    """Show rows as a tidy, read-only table (money in rupees, friendly dates)."""
    if not rows:
        st.info(empty, icon=":material/inbox:")
        return
    df = pd.DataFrame(rows)
    for c in money:
        if c in df:
            df[c] = df[c].map(inr)
    for c in dates:
        if c in df:
            df[c] = df[c].map(lambda v: d_(v, True))
    for c in datetimes:
        if c in df:
            df[c] = df[c].map(dt_)
    for c in status:
        if c in df:
            df[c] = df[c].map(label)
    names = {c: c.replace("_", " ").capitalize() for c in df.columns}
    names.update(rename or {})
    st.dataframe(df.rename(columns=names), hide_index=True, width="stretch")


def bar_chart(df, x, y, title_y, color=theme.SPRUCE, height=260, horizontal=False):
    enc_x = alt.X(f"{x}:N", title=None, axis=alt.Axis(labelAngle=0, labelColor="#667674"))
    enc_y = alt.Y(f"{y}:Q", title=title_y, axis=alt.Axis(labelColor="#667674", titleColor="#667674", gridColor="#E3E8E5"))
    if horizontal:
        enc_x, enc_y = enc_y.axis(grid=True), alt.Y(f"{x}:N", title=None, sort="-x")
        enc_x = alt.X(f"{y}:Q", title=title_y, axis=alt.Axis(gridColor="#E3E8E5"))
    chart = (alt.Chart(df).mark_bar(color=color, cornerRadiusEnd=4, size=34 if not horizontal else 18)
             .encode(x=enc_x, y=enc_y, tooltip=[x, y])
             .properties(height=height)
             .configure_view(strokeWidth=0).configure(background="transparent"))
    st.altair_chart(chart, width="stretch")


def go(page):
    st.session_state["page"] = page


# ------------------------------------------------------------ 1. front desk

def dashboard():
    today = date.today()
    page_header("Front desk", today.strftime("%A, %d %B %Y"))
    s = services.dashboard_stats()
    stat_band([
        (f'{s["occupancy_pct"]:.0f}%', "Occupancy", f'{s["occupied_rooms"]} of {s["total_rooms"]} rooms', False),
        (str(int(s["in_house_guests"])), "Guests in house", f'{s["vacant_rooms"]} rooms vacant now', False),
        (str(s["arrivals_7d"]), "Arrivals this week", "next 7 days", False),
        (str(s["open_tasks"]), "Open tasks", "housekeeping, not yet done", False),
        (inr(s["balance_due"]), "Balance due", f'{inr(s["collected"])} collected', True),
    ])

    section("Room board", "Updates the moment a guest checks in or out")
    legend()
    key_rack(services.room_board())

    left, right = st.columns(2, gap="large")
    with left:
        section("Arriving soon")
        table(services.upcoming_arrivals(), dates=["arrives", "departs"],
              rename={"reservation_id": "Booking"}, empty="No upcoming arrivals. Book a room to add one.")
    with right:
        section("In house, due out")
        table(services.due_out(), dates=["departs"], empty="Nobody is checked in right now.")

    section("Money collected by month")
    rev = reports.total_revenue()
    if rev:
        df = pd.DataFrame(rev)
        df["revenue_collected"] = df["revenue_collected"].astype(float)
        bar_chart(df, "month", "revenue_collected", "Rupees")
    else:
        st.info("No payments recorded yet.", icon=":material/payments:")


# ------------------------------------------------------------ 2. book a room

def book():
    page_header("Book a room", "Pick dates and a room, then confirm. The database enforces every booking rule.")
    today = date.today()
    c1, c2, c3, c4, c5 = st.columns([1.25, 1.25, .8, .8, 1.5], vertical_alignment="bottom")
    ci = c1.date_input("Check-in", value=today, key="bk_in", format="DD/MM/YYYY")
    co = c2.date_input("Check-out", value=today + timedelta(days=2), key="bk_out", format="DD/MM/YYYY")
    adults = c3.number_input("Adults", 1, 10, 2, key="bk_adults")
    children = c4.number_input("Children", 0, 10, 0, key="bk_children")
    show_all = c5.toggle("Include booked rooms", key="bk_all",
                         help="Booked rooms are normally hidden. Turn this on to try a double booking and see the database refuse it.")
    if co <= ci:
        st.warning("Check-out must be after check-in.", icon=":material/event_busy:")
        return
    nights = (co - ci).days
    party = adults + children

    rooms = services.search_rooms(ci, co)
    visible = rooms if show_all else [r for r in rooms if not r["booked"]]
    by_id = {r["room_id"]: r for r in visible}
    if st.session_state.get("bk_room") not in by_id:
        st.session_state["bk_room"] = None

    left, right = st.columns([3, 2], gap="large")
    with left:
        section(f"{len(visible)} room{'s' if len(visible) != 1 else ''} for {nights} night{'s' if nights != 1 else ''}",
                f"{d_(ci)} to {d_(co)}")
        if not visible:
            st.info("No rooms are free for these dates. Try different dates.", icon=":material/bed:")
        for r in visible:
            with st.container(border=True):
                a, b, c, d = st.columns([1.1, 2.6, 1.5, 1.1], vertical_alignment="center")
                a.markdown(f'<div class="roomno">{esc(r["room_number"])}<small>{esc(r["type_name"])}</small></div>',
                           unsafe_allow_html=True)
                tags = [chip(f'Sleeps {r["capacity"]}')]
                if r["booked"]:
                    tags.append(chip("Booked on these dates", "bad"))
                if party > r["capacity"]:
                    tags.append(chip(f"Too small for {party}", "warn"))
                b.markdown(f'<div class="muted" style="font-size:.9rem">{esc(r["description"] or "")}</div>'
                           f'<div style="margin-top:.4rem">{" ".join(tags)}</div>', unsafe_allow_html=True)
                c.markdown(f'<div class="price">{inr(r["from_rate"]).replace(".00", "")}<small> / night</small></div>',
                           unsafe_allow_html=True)
                picked = st.session_state["bk_room"] == r["room_id"]
                if d.button("Chosen" if picked else "Select", key=f'sel_{r["room_id"]}',
                            type="primary" if picked else "secondary", width="stretch"):
                    st.session_state["bk_room"] = r["room_id"]
                    st.rerun()

    with right:
        section("Reservation")
        room = by_id.get(st.session_state["bk_room"])
        with st.container(border=True):
            if not room:
                st.markdown('<span class="muted">Select a room on the left to continue.</span>', unsafe_allow_html=True)
                return
            st.markdown(f'<div class="serif" style="font-size:1.35rem;font-weight:600">Room {esc(room["room_number"])}, {esc(room["type_name"])}</div>'
                        f'<div class="muted" style="margin-bottom:.8rem">{d_(ci, True)} to {d_(co, True)} · {nights} night{"s" if nights != 1 else ""} · {adults} adult{"s" if adults != 1 else ""}'
                        f'{f", {children} child" + ("ren" if children != 1 else "") if children else ""}</div>',
                        unsafe_allow_html=True)
            plans = services.rate_plans(room["type_id"])
            plan = st.selectbox("Rate plan", plans, key=f'bk_plan_{room["type_id"]}',
                                format_func=lambda p: f'{p["plan_name"]}  ·  {inr(p["nightly_rate"]).replace(".00", "")} / night')
            if plan and plan["description"]:
                st.caption(plan["description"])
            est = Decimal(plan["nightly_rate"]) * nights
            st.markdown(f'<div style="display:flex;justify-content:space-between;margin:.2rem 0 .9rem"><span class="muted">Room charge, before 5% tax</span>'
                        f'<span class="price">{inr(est)}</span></div>', unsafe_allow_html=True)

            who = st.radio("Guest", ["Existing guest", "New guest"], horizontal=True, key="bk_who")
            guest_id, new_guest = None, None
            if who == "Existing guest":
                gl = services.guests()
                g = st.selectbox("Choose a guest", gl, key="bk_guest",
                                 format_func=lambda g: f'{g["full_name"]}  ·  {g["email"]}')
                guest_id = g["guest_id"] if g else None
            else:
                name = st.text_input("Full name", key="bk_name")
                email = st.text_input("Email", key="bk_email")
                phone = st.text_input("Phone (optional)", key="bk_phone")

            if st.button("Confirm reservation", type="primary", width="stretch", key="bk_confirm"):
                if who == "New guest":
                    if not name.strip() or not email.strip():
                        st.warning("Enter the guest's full name and email.", icon=":material/person:")
                        return
                    new_guest = (name.strip(), email.strip(), phone.strip() or None)
                ok, res = services.attempt(services.create_reservation, room["room_id"], plan["rate_plan_id"],
                                           ci, co, adults, children, guest_id=guest_id, new_guest=new_guest)
                if ok:
                    gname = new_guest[0] if new_guest else g["full_name"]
                    flash("success", f'Reservation #{res[1]} created for {gname}: room {room["room_number"]}, {d_(ci)} to {d_(co)}.')
                    st.session_state["bk_room"] = None
                    st.rerun()
                else:
                    rejected(res, "Booking rejected")


# ------------------------------------------------------------ 3. reservations

def reservations_page():
    page_header("Reservations", "Every booking, with check-in and cancellation.")
    f1, f2 = st.columns([1, 2])
    status = f1.selectbox("Status", ["All"] + services.RESERVATION_STATUSES, key="rs_status", format_func=label)
    q = f2.text_input("Search by guest name or room number", key="rs_q", placeholder="For example Priya or 201")
    rows = services.reservations(None if status == "All" else status, q.strip() or None)
    table(rows, dates=["check_in", "check_out"], status=["status"], rename={"id": "Booking"},
          empty="No reservations match. Clear the filters or book a room.")

    section("Take action on a booking")
    booked = [r for r in services.reservations("booked")]
    if not booked:
        st.info("No bookings are waiting to be checked in.", icon=":material/event_available:")
        return
    pick = st.selectbox("Booking", booked, key="rs_pick",
                        format_func=lambda r: f'#{r["id"]}  ·  {r["guest"]}  ·  room {r["room"]}  ·  {d_(r["check_in"])} to {d_(r["check_out"])}')
    a, b, _ = st.columns([1, 1, 3])
    if a.button("Check in", type="primary", width="stretch", key="rs_ci"):
        ok, res = services.attempt(services.check_in, pick["id"])
        if ok:
            flash("success", f'Checked in {pick["guest"]} to room {pick["room"]}. Stay #{res} started.')
            st.rerun()
        else:
            rejected(res, "Check-in rejected")
    with b.popover("Cancel booking", width="stretch"):
        st.markdown(f'Cancel booking **#{pick["id"]}** for {esc(pick["guest"])}? The record is kept for reports.')
        if st.button("Yes, cancel it", key="rs_cancel"):
            ok, res = services.attempt(services.cancel_reservation, pick["id"])
            if ok:
                flash("success", f'Booking #{pick["id"]} cancelled.')
                st.rerun()
            else:
                rejected(res, "Cancellation rejected")


# ------------------------------------------------------------ 4. in-house guests

@st.dialog("Check out")
def _checkout_dialog(stay):
    ok, q = services.attempt(services.checkout_quote, stay["stay_id"])
    if not ok:
        rejected(q, "Check-out unavailable")
        return
    st.markdown(f'**{esc(stay["guest"])}**, room {esc(stay["room"])}')
    rows = [(f'Room, {q["nights"]} night{"s" if q["nights"] != 1 else ""} × {inr(q["rate"]).replace(".00", "")}', inr(q["room_charge"]), False),
            ("Services", inr(q["services"]), False),
            ("Tax (5%)", inr(q["tax"]), True)]
    receipt("Bill preview", rows, "Total", q["total"])
    st.caption("Confirming closes the stay and creates the invoice in one step. If either part fails, neither happens.")
    if st.button("Confirm check-out and issue invoice", type="primary", width="stretch"):
        ok, res = services.attempt(services.check_out, stay["stay_id"])
        if ok:
            flash("success", f'Checked out {stay["guest"]}. Invoice #{res["invoice_id"]} for {inr(res["total"])} is ready in Billing.')
            st.rerun()
        else:
            rejected(res, "Check-out rejected")


def in_house_page():
    page_header("In-house guests", "Everyone checked in right now, with the bill so far.")
    stays = services.in_house()
    if not stays:
        st.info("Nobody is checked in. Check in a booking from Reservations.", icon=":material/hotel:")
        return
    for s in stays:
        running = Decimal(s["nightly_rate"]) * int(s["nights"]) + Decimal(s["services"])
        overdue = " " + chip("Past due-out date", "bad") if s["planned_check_out"] < date.today() else ""
        with st.container(border=True):
            a, b, c, d = st.columns([1, 3, 2, 1.4], vertical_alignment="center")
            a.markdown(f'<div class="roomno">{esc(s["room"])}<small>{esc(s["room_type"])}</small></div>', unsafe_allow_html=True)
            b.markdown(f'<div style="font-weight:700;font-size:1.05rem">{esc(s["guest"])}</div>'
                       f'<div class="muted" style="font-size:.88rem">In since {dt_(s["actual_check_in"])} · due out {d_(s["planned_check_out"])}{overdue} · '
                       f'{s["adults"]} adult{"s" if s["adults"] != 1 else ""}{f", {s["children"]} child" + ("ren" if s["children"] != 1 else "") if s["children"] else ""}</div>',
                       unsafe_allow_html=True)
            c.markdown(f'<div class="price">{inr(running)}</div><div class="muted" style="font-size:.82rem">{s["nights"]} night{"s" if s["nights"] != 1 else ""} + {inr(s["services"]).replace(".00", "")} services</div>',
                       unsafe_allow_html=True)
            if d.button("Check out", key=f'co_{s["stay_id"]}', type="primary", width="stretch"):
                _checkout_dialog(s)


# ------------------------------------------------------------ 5. guest services

SERVICES = ["Room service", "Laundry", "Spa", "Minibar", "Airport transfer", "Extra bed", "Other"]


def services_page():
    page_header("Guest services", "Log what a guest asked for, and charge it to their room.")
    stays = services.in_house()
    left, right = st.columns([2, 3], gap="large")
    with left:
        section("New request")
        if not stays:
            st.info("Services can only be logged for guests who are checked in.", icon=":material/room_service:")
        else:
            with st.container(border=True):
                stay = st.selectbox("Guest", stays, key="sv_stay",
                                    format_func=lambda s: f'Room {s["room"]}  ·  {s["guest"]}')
                svc = st.selectbox("Service", SERVICES, key="sv_svc")
                if svc == "Other":
                    svc = st.text_input("Describe the service", key="sv_other").strip()
                charge = st.toggle("Charge to the room bill", value=True, key="sv_charge")
                desc, amount = None, None
                if charge:
                    desc = st.text_input("Charge description", value=svc if svc else "", key=f"sv_desc_{svc}")
                    amount = st.number_input("Amount (₹)", min_value=0.0, step=50.0, key="sv_amt", format="%.2f")
                if st.button("Log request", type="primary", width="stretch", key="sv_go"):
                    if not svc or (charge and not desc.strip()):
                        st.warning("Enter the service and a description for the charge.", icon=":material/edit:")
                    else:
                        ok, res = services.attempt(services.log_service, stay["stay_id"], svc,
                                                   desc.strip() if charge else None, amount if charge else None)
                        if ok:
                            extra = f' and charged {inr(amount)}' if charge else ""
                            flash("success", f'{svc} logged for room {stay["room"]}{extra}.')
                            st.rerun()
                        else:
                            rejected(res, "Request rejected")
    with right:
        section("Recent requests")
        log = [{k: v for k, v in r.items() if k != "id"} for r in services.service_log()]
        table(log, money=["charged"], datetimes=["requested"], status=["status"], empty="No requests yet.")


# ------------------------------------------------------------ 6. housekeeping

HK_TASKS = ["Daily cleaning", "Post-checkout cleaning", "Deep clean", "Turndown service", "Maintenance check"]
HK_COLOR = {"pending": theme.SLATE, "in_progress": theme.BRASS, "done": theme.SAGE}


def housekeeping_page():
    page_header("Housekeeping", "Move each task along. Finishing one frees the room.")
    tasks = services.hk_tasks()

    with st.expander("Assign a new task", icon=":material/add_task:"):
        with st.form("hk_new", clear_on_submit=True):
            a, b, c = st.columns(3)
            room = a.selectbox("Room", services.rooms(), format_func=lambda r: f'{r["room_number"]}  ·  {label(r["status"])}')
            ttype = b.selectbox("Task", HK_TASKS)
            person = c.selectbox("Assign to", services.staff(), format_func=lambda s: f'{s["full_name"]}, {s["role"]}')
            if st.form_submit_button("Assign task", type="primary"):
                ok, res = services.attempt(services.create_task, room["room_id"], ttype, person["staff_id"])
                if ok:
                    flash("success", f'{ttype} assigned to {person["full_name"]} for room {room["room_number"]}.')
                    st.rerun()
                else:
                    rejected(res, "Task rejected")

    cols = st.columns(3, gap="large")
    plan = [("pending", "To do", "Start"), ("in_progress", "In progress", "Mark done"), ("done", "Done", None)]
    for col, (status, title, action) in zip(cols, plan):
        items = [t for t in tasks if t["task_status"] == status]
        if status == "done":
            items = sorted(items, key=lambda t: t["completed_at"] or t["scheduled_at"], reverse=True)[:8]
        with col:
            total = len([t for t in tasks if t["task_status"] == status])
            st.markdown(f'<div class="colhead">{title}<span class="n">{total}</span></div>', unsafe_allow_html=True)
            if not items:
                st.markdown('<div class="muted" style="font-size:.9rem">Nothing here.</div>', unsafe_allow_html=True)
            for t in items:
                when = f'Done {dt_(t["completed_at"])}' if status == "done" else f'Scheduled {dt_(t["scheduled_at"])}'
                st.markdown(f'<div class="hk" style="--tag:{HK_COLOR[status]}"><div class="r">Room {esc(t["room_number"])}</div>'
                            f'<div style="font-weight:600;font-size:.92rem">{esc(t["task_type"])}</div>'
                            f'<div class="m">{esc(t["assigned_staff"] or "Unassigned")} · {when}</div></div>', unsafe_allow_html=True)
                if action:
                    nxt = "in_progress" if status == "pending" else "done"
                    if st.button(action, key=f'hk_{t["task_id"]}', width="stretch"):
                        ok, res = services.attempt(services.set_task_status, t["task_id"], nxt)
                        if ok:
                            extra = f' Room {t["room_number"]} is available again.' if nxt == "done" else ""
                            flash("success", f'Task #{t["task_id"]} is now {label(nxt).lower()}.{extra}')
                            st.rerun()
                        else:
                            rejected(res, "Update rejected")
                st.markdown("<div style='height:.5rem'></div>", unsafe_allow_html=True)


# ------------------------------------------------------------ 7. billing

def billing_page():
    page_header("Billing", "Invoices, what has been paid, and what is still owed.")
    inv = services.invoices()
    if not inv:
        st.info("No invoices yet. They are created when a guest checks out.", icon=":material/receipt_long:")
        return
    total = sum(Decimal(i["total"]) for i in inv)
    paid = sum(Decimal(i["paid"]) for i in inv)
    stat_band([(inr(total), "Invoiced", f'{len(inv)} invoice{"s" if len(inv) != 1 else ""}', False),
               (inr(paid), "Collected", "successful payments", False),
               (inr(total - paid), "Outstanding", f'{len([i for i in inv if i["status"] != "paid"])} open', True)])

    section("Invoices")
    table(inv, money=["subtotal", "tax", "total", "paid"], dates=["invoice_date"], status=["status"],
          rename={"invoice_id": "Invoice", "stay_id": "Stay"})

    section("Invoice detail and payment")
    unpaid_first = sorted(inv, key=lambda i: (i["status"] == "paid", -i["invoice_id"]))
    sel = st.selectbox("Invoice", unpaid_first, key="bl_pick",
                       format_func=lambda i: f'#{i["invoice_id"]}  ·  {i["guest"]}  ·  room {i["room"]}  ·  {label(i["status"])}')
    lines = services.invoice_lines(sel["stay_id"])
    svc_total = sum(Decimal(l["amount"]) for l in lines)
    balance = Decimal(sel["total"]) - Decimal(sel["paid"])
    rows = [("Room charges", inr(Decimal(sel["subtotal"]) - svc_total), False)]
    rows += [(l["description"] or "Service", inr(l["amount"]), False) for l in lines]
    rows += [("Subtotal", inr(sel["subtotal"]), True), ("Tax (5%)", inr(sel["tax"]), True),]

    a, b = st.columns([1, 1], gap="large")
    with a:
        receipt(f'Invoice #{sel["invoice_id"]}  ·  {sel["guest"]}', rows, "Total", sel["total"], balance=balance)
    with b:
        st.markdown(f'Status: {status_chip(sel["status"])}', unsafe_allow_html=True)
        pays = services.invoice_payments(sel["invoice_id"])
        st.markdown("<div style='height:.6rem'></div>", unsafe_allow_html=True)
        table(pays, money=["amount"], datetimes=["payment_date"], status=["payment_status"],
              rename={"payment_id": "Payment", "payment_date": "When", "payment_method": "Method"},
              empty="No payments yet.")
        if balance > 0:
            with st.form("bl_pay", clear_on_submit=False):
                st.markdown("**Record a payment**")
                amt = st.number_input("Amount (₹)", min_value=0.01, value=float(balance), step=100.0, format="%.2f")
                method = st.selectbox("Method", ["cash", "card", "upi", "netbanking"], format_func=lambda m: {"upi": "UPI", "netbanking": "Net banking"}.get(m, m.capitalize()))
                if st.form_submit_button("Record payment", type="primary"):
                    ok, res = services.attempt(services.record_payment, sel["invoice_id"], Decimal(str(amt)), method)
                    if ok:
                        flash("success", f'Payment of {inr(amt)} recorded on invoice #{sel["invoice_id"]}.')
                        st.rerun()
                    else:
                        rejected(res, "Payment rejected")
        else:
            st.success("Paid in full.", icon=":material/check_circle:")


# ------------------------------------------------------------ 8. guests

def guests_page():
    page_header("Guests", "Contact details and stay history.")
    gl = services.guests()
    counts = {r["guest_id"]: r["reservations"] for r in services.guest_stats()}
    q = st.text_input("Search by name or email", key="gs_q", placeholder="For example Sharma")
    shown = [g for g in gl if q.strip().lower() in (g["full_name"] + " " + g["email"]).lower()] if q.strip() else gl
    for g in shown:
        g["reservations"] = counts.get(g["guest_id"], 0)
    table(shown, rename={"guest_id": "Guest"}, empty="No guests match that search.")

    with st.expander("Add a guest", icon=":material/person_add:"):
        with st.form("gs_add", clear_on_submit=True):
            a, b, c = st.columns(3)
            n, e, p = a.text_input("Full name"), b.text_input("Email"), c.text_input("Phone (optional)")
            if st.form_submit_button("Add guest", type="primary"):
                if not n.strip() or not e.strip():
                    st.warning("Enter a full name and an email.", icon=":material/person:")
                else:
                    ok, res = services.attempt(services.add_guest, n.strip(), e.strip(), p.strip() or None)
                    if ok:
                        flash("success", f"{n.strip()} added as guest #{res}.")
                        st.rerun()
                    else:
                        rejected(res, "Guest rejected")

    if not gl:
        return
    section("Open a guest")
    g = st.selectbox("Guest", gl, key="gs_pick", format_func=lambda g: f'{g["full_name"]}  ·  {g["email"]}')
    t1, t2, t3 = st.tabs(["Stay history", "Contact details", "Delete"])
    with t1:
        hist = reports.guest_history(g["guest_id"])
        table(hist, money=["service_spend", "invoice_total"], datetimes=["actual_check_in", "actual_check_out"],
              rename={"reservation_id": "Booking"}, empty="No stays yet.")
        source_note("v_guest_history")
    with t2:
        with st.form(f'gs_edit_{g["guest_id"]}'):
            a, b, c = st.columns(3)
            n = a.text_input("Full name", value=g["full_name"])
            e = b.text_input("Email", value=g["email"])
            p = c.text_input("Phone", value=g["phone"] or "")
            if st.form_submit_button("Save changes", type="primary"):
                ok, res = services.attempt(services.update_guest, g["guest_id"], n.strip(), e.strip(), p.strip() or None)
                if ok:
                    flash("success", f'Updated {n.strip()}.')
                    st.rerun()
                else:
                    rejected(res, "Update rejected")
    with t3:
        n_res = counts.get(g["guest_id"], 0)
        if n_res:
            st.markdown(f'{esc(g["full_name"])} has **{n_res}** reservation{"s" if n_res != 1 else ""}, so the database will not allow deletion. '
                        f'Guests with history are kept for reports.', unsafe_allow_html=True)
        else:
            st.markdown("This guest has no reservations and can be deleted.")
        with st.popover("Delete guest"):
            st.markdown(f'Delete **{esc(g["full_name"])}** permanently?')
            if st.button("Yes, delete", key="gs_del"):
                ok, res = services.attempt(services.delete_guest, g["guest_id"])
                if ok:
                    flash("success", f'{g["full_name"]} deleted.')
                    st.rerun()
                else:
                    rejected(res, "Deletion rejected")


# ------------------------------------------------------------ 9. reports

def reports_page():
    page_header("Reports", "Each report is read straight from a database view.")
    tabs = st.tabs(["Occupancy", "Revenue", "Housekeeping", "Guest history", "Cancellations"])

    with tabs[0]:
        o = reports.occupancy_rate()
        stat_band([(f'{o["occupancy_pct"]:.0f}%', "Occupancy rate", f'{o["occupied_rooms"]} of {o["total_rooms"]} rooms occupied', True),
                   (str(len(reports.vacant_rooms())), "Vacant rooms", "available now", False)])
        source_note("v_occupancy_rate")
        section("Who is in which room")
        table(reports.current_occupancy(), datetimes=["actual_check_in"], dates=["planned_check_out"],
              rename={"room_id": "Room ID"}, empty="Nobody is checked in.")
        source_note("v_current_occupancy")
        section("Vacant rooms")
        table(reports.vacant_rooms(), rename={"room_id": "Room ID"}, empty="No vacant rooms.")
        source_note("v_vacant_rooms")

    with tabs[1]:
        section("Money collected by month")
        rev = reports.total_revenue()
        if rev:
            df = pd.DataFrame(rev)
            df["revenue_collected"] = df["revenue_collected"].astype(float)
            bar_chart(df, "month", "revenue_collected", "Rupees")
        else:
            st.info("No payments yet.", icon=":material/payments:")
        source_note("v_total_revenue")
        section("Service revenue by stay")
        sr = reports.service_revenue()
        if sr:
            df = pd.DataFrame(sr)
            df["total_service_revenue"] = df["total_service_revenue"].astype(float)
            df["stay"] = "Stay " + df["stay_id"].astype(str) + ", " + df["guest_name"]
            bar_chart(df, "stay", "total_service_revenue", "Rupees", color=theme.BRASS, height=220)
            table(sr, money=["total_service_revenue"], rename={"stay_id": "Stay", "guest_name": "Guest"})
        else:
            st.info("No service charges yet.", icon=":material/room_service:")
        source_note("v_service_revenue")

    with tabs[2]:
        hk = reports.housekeeping_status()
        n = lambda s: len([t for t in hk if t["task_status"] == s])
        stat_band([(str(n("pending")), "To do", "", False), (str(n("in_progress")), "In progress", "", False),
                   (str(n("done")), "Done", "", False)])
        section("All tasks")
        table(hk, datetimes=["scheduled_at", "completed_at"], status=["task_status"], rename={"task_id": "Task"})
        source_note("v_housekeeping_status")

    with tabs[3]:
        hist = reports.guest_history()
        table(hist, money=["service_spend", "invoice_total"], datetimes=["actual_check_in", "actual_check_out"],
              rename={"guest_id": "Guest", "reservation_id": "Booking"}, empty="No stays recorded.")
        source_note("v_guest_history")

    with tabs[4]:
        table(reports.cancellations(), dates=["planned_check_in", "planned_check_out"], status=["reservation_status"],
              rename={"reservation_id": "Booking"}, empty="No cancellations or no-shows.")
        source_note("v_cancellations")
