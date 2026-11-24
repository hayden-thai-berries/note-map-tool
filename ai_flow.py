"""Generate a Flow from a brief: what is sent to the AI, and how its answer is checked. Server side only.

Sent: the brief and the draft the user typed, the Department names and descriptions, the Function titles and descriptions, and the names of
the Sheets and Apps on the map. Never sent: member names or emails, tickets, time logs, documentation links, other flows, removed entries, other maps.
Every text is also stripped of email addresses and ticket ids before it leaves.
"""
import json, os, re
import ai

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
TICKET = re.compile(r"\b[A-Z]{1,2}\d{8}\.\d{2,4}\b")   # such as T20261112.001
MAX_STEPS, MAX_TEAMS, MAX_NOTES = 40, 12, 8
KINDS = ("step", "start", "end", "decision")
DAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
CHARTS = ("swimlane", "flowchart", "waterfall", "entity")

SYSTEM = """You turn a short description of a business process into a flow diagram, as JSON only (no prose, no code fences).
Shape:
{"chart": "swimlane", "reason": "one short sentence", "teams": ["Sales", "Finance"],
 "steps": [{"team": "Sales", "title": "Send the quote", "kind": "start|step|decision|end", "day": null, "sheet": null, "note": "",
            "waits": [{"on": 0, "msg": "what is handed over"}]}],
 "notes": [{"text": "an assumption or open question", "step": null}]}
Rules:
- Use at most 40 steps and 12 teams. A step belongs to the team that does it; prefer the Department names given.
- "waits" lists the earlier steps (by 0-based index) this step waits on. Every step except the first and any second start should wait on at least one earlier step. "on" must be smaller than the step's own index.
- Mark the first step "start" and the last "end" only when the description makes the beginning and end clear. A "decision" step is a yes/no question; its outgoing arrows (steps that wait on it) use the msg "Yes" and "No".
- "sheet" must be copied exactly from the list of sheets and apps you are given, or null. Never invent a sheet.
- Do not guess. Put anything you assumed, and any question the description leaves open, into "notes" (use "step" for the step index it is about, or null).
- Always answer with "chart": "swimlane" for now. Keep titles short. Use the user's language."""


def clean(text):
    """Strip what must never leave: email addresses and ticket ids."""
    return TICKET.sub("[ticket]", EMAIL.sub("[email removed]", str(text or "")))


def map_context(root, map_id):
    """Department, Function and sheet names from the Data file. Returns {'departments': [...], 'sheets': [...]}; empty if there is no file."""
    name = re.sub(r"\.json$", "", str(map_id or ""))
    if not re.match(r"^[\w-][\w.-]*$", name):
        return {"departments": [], "sheets": []}
    path = os.path.join(root, "data", name + ".json")
    try:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
    except (OSError, ValueError):
        return {"departments": [], "sheets": []}
    deps = []
    for dep in d.get("departments") or []:
        fns = [{"title": clean(s.get("title") or ""), "note": clean(s.get("note") or "")} for s in dep.get("sections") or [] if (s.get("title") or s.get("note"))]
        deps.append({"name": clean(dep.get("name") or ""), "text": [clean(t) for t in dep.get("text") or []], "functions": fns})
    sheets = [clean(s.get("name") or "") for s in d.get("sheets") or [] if s.get("name")]
    return {"departments": deps, "sheets": sheets}


def build_user_message(title, brief, draft, ctx):
    out = ["Flow title: " + clean(title), "", "Brief:", clean(brief) or "(none)", "", "Rough draft of the steps:", clean(draft) or "(none)"]
    if ctx["departments"]:
        out += ["", "Departments and what they do:"]
        for d in ctx["departments"]:
            out.append("- " + d["name"] + (": " + " ".join(d["text"]) if d["text"] else ""))
            for f in d["functions"]:
                out.append("    * " + f["title"] + (": " + f["note"] if f["note"] else ""))
    out += ["", "Sheets and apps on the map (use these names exactly, or null):", ", ".join(ctx["sheets"]) or "(none)"]
    return "\n".join(out)


def _text(v, limit):
    return re.sub(r"\s+", " ", v).strip()[:limit] if isinstance(v, str) else ""


def parse_answer(raw, sheet_names):
    """The AI's reply -> a checked flow, or AiError. Unknown sheet names are kept as plain text and listed in 'unknownSheets'."""
    s = raw.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", s, re.S)
    if m: s = m.group(1).strip()
    if not s.startswith("{"):
        a, b = s.find("{"), s.rfind("}")
        s = s[a:b + 1] if 0 <= a < b else s
    try:
        j = json.loads(s)
    except ValueError:
        raise ai.AiError("The AI did not answer with a flow I can read. Nothing was changed; try again.")
    if not isinstance(j, dict) or not isinstance(j.get("steps"), list) or not j["steps"]:
        raise ai.AiError("The AI's answer had no steps. Nothing was changed; try again or add more detail to the brief.")
    if len(j["steps"]) > MAX_STEPS:
        raise ai.AiError("The AI made %d steps; the limit is %d. Nothing was changed; ask for a smaller flow." % (len(j["steps"]), MAX_STEPS))
    known = {n.lower(): n for n in sheet_names}
    teams, steps, unknown = [], [], []
    for i, st in enumerate(j["steps"]):
        if not isinstance(st, dict): raise ai.AiError("The AI's step %d was not understood. Nothing was changed." % (i + 1))
        team, title = _text(st.get("team"), 60), _text(st.get("title"), 140)
        if not team or not title: raise ai.AiError("The AI's step %d has no team or no title. Nothing was changed." % (i + 1))
        if team.lower() not in [t.lower() for t in teams]: teams.append(team)
        kind = st.get("kind") if st.get("kind") in KINDS else "step"
        waits = []
        for w in st.get("waits") or []:
            on = w.get("on") if isinstance(w, dict) else None
            if isinstance(on, int) and not isinstance(on, bool) and 0 <= on < i and on not in [x["on"] for x in waits]:
                waits.append({"on": on, "msg": _text(w.get("msg"), 80)})
        sheet, sheet_name = None, None
        raw_sheet = _text(st.get("sheet"), 100)
        if raw_sheet:
            if raw_sheet.lower() in known: sheet = known[raw_sheet.lower()]
            else: sheet_name = raw_sheet; unknown.append(raw_sheet)
        steps.append({"team": team, "title": title, "kind": None if kind == "step" else kind, "day": st.get("day") if st.get("day") in DAYS else None,
                      "sheet": sheet, "sheetName": sheet_name, "note": _text(st.get("note"), 400), "waits": waits})
    if len(teams) > MAX_TEAMS:
        raise ai.AiError("The AI used %d teams; the limit is %d. Nothing was changed; ask for fewer teams." % (len(teams), MAX_TEAMS))
    notes = []
    for n in (j.get("notes") or [])[:MAX_NOTES]:
        text = _text(n.get("text") if isinstance(n, dict) else None, 300)
        at = n.get("step") if isinstance(n, dict) else None
        if text: notes.append({"text": text, "step": at if isinstance(at, int) and not isinstance(at, bool) and 0 <= at < len(steps) else None})
    chart = j.get("chart") if j.get("chart") in CHARTS else "swimlane"
    return {"chart": chart, "reason": _text(j.get("reason"), 200), "teams": teams, "steps": steps, "notes": notes, "unknownSheets": sorted(set(unknown))}


def generate(root, map_id, title, brief, draft):
    """The whole request. Returns {'ok': True, 'flow': ..., 'provider': ...} or {'ok': False, 'error': ...}. Never raises."""
    cfg, problem = ai.load_config(root)
    if not cfg: return {"ok": False, "error": problem}
    try:
        brief, draft, title = (x if isinstance(x, str) else "" for x in (brief, draft, title))
        if not brief.strip() and not draft.strip(): raise ai.AiError("Write a brief or a rough draft first, so the AI has something to work from.")
        ai.check_length(brief=brief, draft=draft)
        ctx = map_context(root, map_id)
        raw = ai.complete(cfg, SYSTEM, build_user_message(title, brief, draft, ctx), max_tokens=ai.MAX_OUT_TOKENS)
        return {"ok": True, "flow": parse_answer(raw, ctx["sheets"]), "provider": cfg["provider"], "label": cfg["label"]}
    except ai.AiError as e:
        return {"ok": False, "error": str(e)}
