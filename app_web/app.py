"""
app.py -- entry point for the Meridian web front end.

Run from this folder:   streamlit run app.py

Uses the same MySQL database (hotel_pbl) and the same business rules as the
command-line app; those rules live in the database (triggers + CHECKs), so
nothing the UI does can bypass them.
"""
import streamlit as st

import db
import theme
import views

st.set_page_config(page_title=f"{theme.BRAND} | Hotel reservations and guest services",
                   page_icon=":material/hotel:", layout="wide")
theme.inject_css()

PAGES = {
    "Front desk": views.dashboard,
    "Book a room": views.book,
    "Reservations": views.reservations_page,
    "In-house guests": views.in_house_page,
    "Guest services": views.services_page,
    "Housekeeping": views.housekeeping_page,
    "Billing": views.billing_page,
    "Guests": views.guests_page,
    "Reports": views.reports_page,
}
st.session_state.setdefault("page", "Front desk")

# ---- sidebar navigation
with st.sidebar:
    st.markdown(f'<div class="brand"><div class="mark">{theme.BRAND}<i></i></div>'
                f'<div class="tag">{theme.TAGLINE}</div></div>', unsafe_allow_html=True)
    for name in PAGES:
        active = st.session_state["page"] == name
        if st.button(name, key=f"nav_{name}", type="primary" if active else "secondary", width="stretch"):
            st.session_state["page"] = name
            st.rerun()

# ---- database must be reachable before anything else
problem = db.ping()
with st.sidebar:
    ok = problem is None
    st.markdown(f'<div class="dbstate"><span class="dot" style="background:{"#6CCB95" if ok else "#E07A80"}"></span>'
                f'{"Connected to <b>" + theme.esc(db.DB_CONFIG["database"]) + "</b>" if ok else "Database offline"}</div>',
                unsafe_allow_html=True)
if problem:
    theme.page_header("Can't reach the database", "The app needs MySQL running and valid login details.")
    st.error(problem, icon=":material/database_off:")
    st.markdown("""
**Check these, then refresh the page:**
1. MySQL is running (MySQL Workbench can connect to it).
2. `app/.env` (or `app_web/.env`) has the right `DB_USER` and `DB_PASSWORD`.
3. The scripts in `db/` have been run, so the `hotel_pbl` database exists.
""")
    st.stop()

# ---- current page
theme.show_flash()
try:
    PAGES[st.session_state["page"]]()
except db.DatabaseUnavailable as e:
    st.error(f"Lost the database connection: {e}", icon=":material/database_off:")
