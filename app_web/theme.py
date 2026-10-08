"""
theme.py -- look and feel, plus small HTML components.

Design idea: a hotel front desk. The room board is a rack of key tags; the
palette is deep spruce (the lobby wood), brass (the keys) and cool linen.
Everything is plain HTML/CSS injected into Streamlit -- no JavaScript.
"""
import html
from decimal import Decimal

import streamlit as st

BRAND = "Meridian"
TAGLINE = "Reservations and guest services"

SPRUCE = "#123C3A"
BRASS = "#B58A3C"
SAGE = "#4F9B72"
SKY = "#3F7FB0"
SLATE = "#7E8A90"
CORAL = "#C9484F"

STATUS_COLOR = {
    "available": SAGE, "occupied": BRASS, "cleaning": SKY, "maintenance": SLATE,
}

CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');

:root{
  --spruce:#123C3A; --spruce-2:#1D524F; --spruce-3:#2B6A66;
  --linen:#F3F5F2; --paper:#FFFFFF; --ink:#1B2A29; --muted:#667674; --line:#DCE3DF;
  --brass:#B58A3C; --brass-soft:#F4EAD2; --sage:#4F9B72; --sage-soft:#DDEFE4;
  --sky:#3F7FB0; --sky-soft:#DCE9F4; --slate:#7E8A90; --slate-soft:#E6E9EB;
  --coral:#C9484F; --coral-soft:#F8E0E1;
  --serif:'Fraunces', Georgia, 'Times New Roman', serif;
  --sans:'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif;
}

html, body, .stApp, .stApp button, .stApp input, .stApp textarea, .stApp select,
[data-testid="stMarkdownContainer"], [data-baseweb] { font-family: var(--sans) !important; }
.stApp { background: var(--linen); color: var(--ink); }
.stApp [data-testid="stIconMaterial"], .stApp .material-symbols-rounded { font-family: 'Material Symbols Rounded' !important; }
#MainMenu, footer, [data-testid="stToolbar"], [data-testid="stDecoration"] { display:none !important; }
header[data-testid="stHeader"] { background: transparent; height: 0; }
.block-container { padding-top: 2.4rem !important; padding-bottom: 4rem; max-width: 1180px; }

/* ---------- headings ---------- */
h1, h2, h3, .serif { font-family: var(--serif) !important; letter-spacing: -0.012em; color: var(--ink); }
h1 { font-weight: 600 !important; font-size: 2.35rem !important; line-height: 1.1 !important; padding: 0 !important; margin: 0 !important; }
h2, h3 { font-weight: 600 !important; font-size: 1.3rem !important; }
.page-head { margin-bottom: 1.4rem; }
.page-head .sub { color: var(--muted); font-size: 1.02rem; margin-top: .35rem; max-width: 62ch; }
.section-title { font-family: var(--serif); font-weight: 600; font-size: 1.28rem; margin: 2rem 0 .7rem; color: var(--ink); }
.section-title small { font-family: var(--sans); font-weight: 500; font-size: .86rem; color: var(--muted); margin-left: .6rem; }
.muted { color: var(--muted); }
.src { color: var(--muted); font-size: .82rem; margin-top: .35rem; }
.src code { background: var(--slate-soft); padding: 1px 6px; border-radius: 4px; font-size: .8rem; color: var(--ink); }

/* ---------- sidebar ---------- */
section[data-testid="stSidebar"] { background: var(--spruce); border-right: 0; }
section[data-testid="stSidebar"] > div { padding-top: 1.6rem; }
section[data-testid="stSidebar"] * { color: #E7EFEC; }
.brand { padding: 0 .4rem 1.4rem; }
.brand .mark { font-family: var(--serif); font-size: 1.9rem; font-weight: 600; color: #FFF; letter-spacing: -0.01em; line-height: 1; }
.brand .mark i { display:inline-block; width:.62rem; height:.62rem; border-radius:50%; background: var(--brass); margin-left:.3rem; vertical-align: .12em; }
.brand .tag { color: #9DBAB5; font-size: .86rem; margin-top: .45rem; }
section[data-testid="stSidebar"] .stButton { margin-bottom: 2px; }
section[data-testid="stSidebar"] .stButton > button {
  background: transparent; border: 0; border-radius: 8px; justify-content: flex-start;
  padding: .55rem .8rem; color: #CFE0DC; font-weight: 500; box-shadow: none; width: 100%;
  border-left: 3px solid transparent; transition: background .12s;
}
section[data-testid="stSidebar"] .stButton > button > div { justify-content: flex-start; width: 100%; }
section[data-testid="stSidebar"] .stButton > button p { color: inherit; text-align: left; font-size: .97rem; width: 100%; }
section[data-testid="stSidebar"] .stButton > button:hover { background: var(--spruce-2); color: #FFF; }
section[data-testid="stSidebar"] .stButton > button:focus-visible { outline: 2px solid var(--brass); outline-offset: 1px; }
section[data-testid="stSidebar"] .stButton > button[kind="primary"] {
  background: var(--spruce-2); color: #FFF; border-left: 3px solid var(--brass); font-weight: 600;
}
.dbstate { position: fixed; bottom: 1rem; left: 1.1rem; font-size: .8rem; color: #9DBAB5 !important; }
.dbstate b { color: #E7EFEC; font-weight: 600; }
.dot { display:inline-block; width:.5rem; height:.5rem; border-radius:50%; margin-right:.4rem; vertical-align: .05em; }

/* ---------- stat band ---------- */
.band { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; background: var(--paper);
        border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.band .stat { padding: 1.05rem 1.25rem 1rem; }
.band .stat + .stat { border-left: 1px solid var(--line); }
.band .v { font-family: var(--serif); font-size: 2rem; font-weight: 600; line-height: 1.1; color: var(--ink); font-variant-numeric: tabular-nums lining-nums; }
.band .v.brass { color: var(--brass); }
.band .l { font-weight: 600; font-size: .92rem; margin-top: .3rem; }
.band .s { color: var(--muted); font-size: .84rem; margin-top: .1rem; }
@media (max-width: 900px){ .band { grid-auto-flow: row; } .band .stat + .stat { border-left: 0; border-top: 1px solid var(--line); } }

/* ---------- key rack ---------- */
.legend { display:flex; gap: 1.1rem; flex-wrap: wrap; color: var(--muted); font-size: .86rem; margin: -.2rem 0 1rem; }
.legend span::before { content:""; display:inline-block; width:.6rem; height:.6rem; border-radius:50%; background: var(--c); margin-right:.4rem; }
.board { display: grid; grid-template-columns: repeat(auto-fill, minmax(156px, 1fr)); gap: 1rem; }
.key { position: relative; background: var(--paper); border: 1px solid var(--line); border-top: 6px solid var(--tag);
       border-radius: 8px 8px 22px 22px; padding: 1.55rem .95rem .95rem; min-height: 148px; }
.key::before { content:""; position:absolute; top:.5rem; left:50%; transform:translateX(-50%); width:.8rem; height:.8rem;
               border-radius:50%; background: var(--linen); box-shadow: inset 0 0 0 2px var(--tag); }
.key .top { display:flex; justify-content: space-between; align-items: baseline; gap:.4rem; }
.key .num { font-family: var(--serif); font-size: 2.1rem; font-weight: 600; line-height: 1; color: var(--ink); font-variant-numeric: lining-nums; }
.key .cap { color: var(--muted); font-size: .78rem; white-space: nowrap; }
.key .typ { color: var(--muted); font-size: .86rem; margin-top: .3rem; }
.key .st { font-weight: 700; font-size: .84rem; color: var(--tag); margin-top: .7rem; }
.key .who { font-size: .88rem; margin-top: .1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.key.maintenance { background: repeating-linear-gradient(135deg, #fff, #fff 9px, #F1F3F4 9px, #F1F3F4 18px); }

/* ---------- room card (booking list) ---------- */
.roomno { font-family: var(--serif); font-size: 2rem; font-weight: 600; line-height: 1; }
.roomno small { display:block; font-family: var(--sans); font-size: .8rem; font-weight: 500; color: var(--muted); margin-top: .3rem; }
.price { font-family: var(--serif); font-size: 1.25rem; font-weight: 600; font-variant-numeric: lining-nums; }
.price small { font-family: var(--sans); font-weight: 500; font-size: .8rem; color: var(--muted); }

/* ---------- chips ---------- */
.chip { display:inline-block; padding: .16rem .6rem; border-radius: 999px; font-size: .8rem; font-weight: 600; background: var(--slate-soft); color: #44525A; }
.chip.ok { background: var(--sage-soft); color: #1F6B45; }
.chip.warn { background: var(--brass-soft); color: #7B5A17; }
.chip.info { background: var(--sky-soft); color: #25587F; }
.chip.bad { background: var(--coral-soft); color: #9A2C32; }

/* ---------- receipt ---------- */
.receipt { background: var(--paper); border: 1px solid var(--line); border-radius: 14px; padding: 1.4rem 1.6rem; max-width: 520px; }
.receipt .rh { display:flex; justify-content: space-between; align-items: baseline; border-bottom: 1px dashed var(--line); padding-bottom: .8rem; margin-bottom: .6rem; }
.receipt .rh .t { font-family: var(--serif); font-size: 1.3rem; font-weight: 600; }
.receipt .row { display:flex; justify-content: space-between; padding: .28rem 0; font-variant-numeric: tabular-nums; }
.receipt .row.sub { color: var(--muted); }
.receipt .row.total { border-top: 1px solid var(--ink); margin-top: .5rem; padding-top: .6rem; font-weight: 700; font-size: 1.12rem; }
.receipt .row.total .amt { font-family: var(--serif); font-size: 1.5rem; }
.receipt .row.bal { color: var(--coral); font-weight: 700; }
.receipt .row.bal.zero { color: var(--sage); }

/* ---------- housekeeping board ---------- */
.hk { background: var(--paper); border: 1px solid var(--line); border-left: 4px solid var(--tag, var(--slate)); border-radius: 10px; padding: .75rem .9rem; margin-bottom: .2rem; }
.hk .r { font-family: var(--serif); font-weight: 600; font-size: 1.25rem; }
.hk .m { color: var(--muted); font-size: .86rem; }
.colhead { font-family: var(--serif); font-weight: 600; font-size: 1.1rem; margin-bottom: .6rem; display:flex; align-items:center; gap:.5rem; }
.colhead .n { font-family: var(--sans); font-size: .8rem; background: var(--slate-soft); color: #44525A; border-radius: 999px; padding: .05rem .55rem; }

/* ---------- native widgets ---------- */
[data-testid="stVerticalBlockBorderWrapper"] { border-radius: 12px; }
div[data-testid="stVerticalBlockBorderWrapper"]:has(> div > div[data-testid="stVerticalBlock"]) { border-color: var(--line); }
.stButton > button, .stFormSubmitButton > button { border-radius: 9px; font-weight: 600; border: 1px solid var(--line); }
.stApp .stButton > button[kind="primary"], .stApp .stFormSubmitButton > button[kind="primary"] { background: var(--spruce); color: #fff; border-color: var(--spruce); }
.stApp .stButton > button[kind="primary"]:hover, .stApp .stFormSubmitButton > button[kind="primary"]:hover { background: var(--spruce-2); border-color: var(--spruce-2); }
.stApp button[kind="primaryFormSubmit"] { background: var(--spruce); color: #fff; border: 1px solid var(--spruce); border-radius: 9px; font-weight: 600; }
.stApp button[kind="primaryFormSubmit"]:hover { background: var(--spruce-2); border-color: var(--spruce-2); }
.stApp button[kind="primaryFormSubmit"] p { color: #fff; }
.stApp .stButton > button:focus-visible { outline: 2px solid var(--brass); outline-offset: 2px; }
[data-testid="stAlert"] { border-radius: 10px; }
[data-testid="stTabs"] button[role="tab"] { font-weight: 600; }
[data-testid="stDataFrame"] { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
label, [data-testid="stWidgetLabel"] p { font-weight: 600 !important; font-size: .9rem !important; }
@media (prefers-reduced-motion: reduce){ * { transition: none !important; animation: none !important; } }
</style>
"""


def inject_css():
    st.markdown(CSS, unsafe_allow_html=True)


# ------------------------------------------------------------ formatting

def inr(x):
    """Indian-rupee format with lakh grouping: 4777.5 -> ₹4,777.50, 123456 -> ₹1,23,456.00"""
    d = Decimal(str(x or 0)).quantize(Decimal("0.01"))
    sign = "-" if d < 0 else ""
    whole, frac = f"{abs(d):.2f}".split(".")
    if len(whole) > 3:
        head, tail, parts = whole[:-3], whole[-3:], []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        whole = ",".join(parts) + "," + tail
    return f"{sign}₹{whole}.{frac}"


def _blank(x):
    """True for None and for pandas' NaT (which is not equal to itself)."""
    return x is None or x != x


def d_(x, with_year=False):
    if _blank(x):
        return "—"
    return x.strftime("%d %b %Y" if with_year else "%d %b")


def dt_(x):
    return "—" if _blank(x) else x.strftime("%d %b, %H:%M")


def esc(x):
    return html.escape(str(x if x is not None else ""))


def label(status):
    return str(status).replace("_", " ").capitalize()


# ------------------------------------------------------------ components

def page_header(title, subtitle=""):
    sub = f'<div class="sub">{esc(subtitle)}</div>' if subtitle else ""
    st.markdown(f'<div class="page-head"><h1>{esc(title)}</h1>{sub}</div>', unsafe_allow_html=True)


def section(title, note=""):
    n = f"<small>{esc(note)}</small>" if note else ""
    st.markdown(f'<div class="section-title">{esc(title)}{n}</div>', unsafe_allow_html=True)


def source_note(view):
    st.markdown(f'<div class="src">Data from the database view <code>{esc(view)}</code></div>', unsafe_allow_html=True)


def stat_band(items):
    """items: list of (value, label, sub, brass?)"""
    cells = "".join(
        f'<div class="stat"><div class="v{" brass" if b else ""}">{esc(v)}</div>'
        f'<div class="l">{esc(l)}</div><div class="s">{esc(s)}</div></div>'
        for v, l, s, b in items)
    st.markdown(f'<div class="band">{cells}</div>', unsafe_allow_html=True)


def chip(text, kind=""):
    return f'<span class="chip {kind}">{esc(text)}</span>'


STATUS_CHIP = {
    "booked": "info", "checked_in": "warn", "completed": "ok", "cancelled": "bad", "no_show": "bad",
    "open": "warn", "partially_paid": "info", "paid": "ok",
    "pending": "", "in_progress": "warn", "done": "ok",
    "requested": "info", "fulfilled": "ok",
}


def status_chip(status):
    return chip(label(status), STATUS_CHIP.get(status, ""))


def legend():
    items = "".join(f'<span style="--c:{c}">{label(s)}</span>' for s, c in STATUS_COLOR.items())
    st.markdown(f'<div class="legend">{items}</div>', unsafe_allow_html=True)


def key_rack(rooms):
    tiles = []
    for r in rooms:
        s = r["status"]
        who = r.get("guest_name")
        if who:
            line = f'<div class="who">{esc(who)}</div>'
        elif r.get("next_arrival") and s != "maintenance":
            line = f'<div class="who muted">Arrives {d_(r["next_arrival"])}</div>'
        else:
            line = '<div class="who">&nbsp;</div>'
        tiles.append(
            f'<div class="key {s}" style="--tag:{STATUS_COLOR.get(s, SLATE)}">'
            f'<div class="top"><div class="num">{esc(r["room_number"])}</div><div class="cap">sleeps {r["capacity"]}</div></div>'
            f'<div class="typ">{esc(r["type_name"])}</div>'
            f'<div class="st">{label(s)}</div>{line}</div>')
    st.markdown(f'<div class="board">{"".join(tiles)}</div>', unsafe_allow_html=True)


def receipt(title, rows, total_label, total, balance=None):
    """rows: list of (label, amount_text, is_sub)"""
    body = "".join(f'<div class="row{" sub" if sub else ""}"><span>{esc(l)}</span><span>{esc(a)}</span></div>'
                   for l, a, sub in rows)
    bal = ""
    if balance is not None:
        z = " zero" if Decimal(str(balance)) <= 0 else ""
        bal = f'<div class="row bal{z}"><span>Balance due</span><span>{inr(balance)}</span></div>'
    st.markdown(
        f'<div class="receipt"><div class="rh"><span class="t">{esc(title)}</span></div>{body}'
        f'<div class="row total"><span>{esc(total_label)}</span><span class="amt">{inr(total)}</span></div>{bal}</div>',
        unsafe_allow_html=True)


def rejected(msg, title="Rejected by the database"):
    st.error(f"**{title}.** {msg}", icon=":material/block:")


def flash(kind, msg):
    st.session_state.setdefault("_flash", []).append((kind, msg))


def show_flash():
    for kind, msg in st.session_state.pop("_flash", []):
        if kind == "error":
            rejected(msg)
        elif kind == "success":
            st.success(msg, icon=":material/check_circle:")
        else:
            st.info(msg)
