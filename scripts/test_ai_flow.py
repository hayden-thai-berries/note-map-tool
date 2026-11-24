"""Tests for generating a flow from a brief: what is sent to the AI, how its answer is checked, and what the endpoint says. Fake provider only.
Run: python3 scripts/test_ai_flow.py"""
import http.client, json, os, sys, tempfile, threading, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..")); sys.path.insert(0, os.path.join(HERE, "lib"))
import ai, ai_flow, server
from ai_stub import AiStub

KEY = "sk-secret-123456"
DATA = {"schemaVersion": 1, "removed": [{"id": "x1", "kind": "ticket", "label": "SECRET-REMOVED-TICKET"}], "links": [],
        "departments": [{"id": "d1", "name": "Finance", "text": ["Pays suppliers. Contact: boss@example.com"], "members": [{"id": "m1", "name": "Secret Person", "role": "Lead", "email": "secret.person@example.com"}],
                         "sections": [{"id": "s1", "title": "Payroll", "note": "Run on Fridays, see T20261112.001"}]}],
        "sheets": [{"id": "h1", "name": "Payroll Sheet", "kind": "sheet", "departmentId": "d1", "sectionId": "s1", "url": "https://secret.example/doc", "docs": [{"label": "x", "url": "https://secret.example/docs"}], "owner": "Secret Owner"}, {"id": "h2", "name": "CRM", "kind": "app"}],
        "flows": [{"id": "f1", "title": "OTHER-FLOW-TITLE", "every": "", "teams": [], "steps": []}],
        "tickets": {"nextId": 2, "extra": {}, "items": [{"id": "T20261112.001", "title": "SECRET-TICKET-TITLE"}]}}
GOOD = {"chart": "swimlane", "reason": "Two teams hand work over.", "teams": ["Sales", "Finance"], "steps": [
    {"team": "Sales", "title": "Send quote", "kind": "start", "sheet": "crm"},
    {"team": "Finance", "title": "Price OK?", "kind": "decision", "waits": [{"on": 0, "msg": "quote"}]},
    {"team": "Sales", "title": "Send order", "waits": [{"on": 1, "msg": "Yes"}], "sheet": "Mystery Sheet", "day": "Fri"},
    {"team": "Sales", "title": "Rework quote", "waits": [{"on": 1, "msg": "No"}]}],
    "notes": [{"text": "I assumed Finance approves", "step": 1}, {"text": "Who owns pricing?", "step": None}]}


class Generate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); os.makedirs(os.path.join(self.tmp.name, "data"))
        with open(os.path.join(self.tmp.name, "data", "m.json"), "w") as f: json.dump(DATA, f)
        server.ROOT = self.tmp.name
        self.srv = server.http.server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler); self.port = self.srv.server_port
        threading.Thread(target=self.srv.serve_forever, daemon=True).start(); self.stub = None

    def tearDown(self):
        self.srv.shutdown(); self.srv.server_close(); self.tmp.cleanup()
        if self.stub: self.stub.close()

    def on(self, reply, provider="claude"):
        self.stub = AiStub(key=KEY, reply=reply if isinstance(reply, str) else json.dumps(reply))
        with open(os.path.join(self.tmp.name, "data", ".ai.json"), "w") as f: json.dump({"provider": provider, "apiKey": KEY, "baseUrl": self.stub.url}, f)

    def post(self, body, origin=True, path="/api/ai/flow"):
        h = {"Origin": "http://localhost:%d" % self.port, "X-Map-Save": "1"} if origin else {}
        c = http.client.HTTPConnection("127.0.0.1", self.port); c.request("POST", path, body=json.dumps(body), headers=h)
        r = c.getresponse(); data = r.read(); c.close(); return r.status, (json.loads(data) if data.startswith(b"{") else data)

    def sent(self): return json.dumps(self.stub.requests[0]["body"])

    # what is sent
    def test_only_allowed_text_is_sent_and_emails_and_tickets_are_stripped(self):
        self.on(GOOD)
        st, out = self.post({"mapId": "m", "title": "Quotes", "brief": "Mail me at me@example.com about T20261113.002", "draft": "- send"})
        self.assertTrue(out["ok"], out); sent = self.sent()
        for good in ("Finance", "Pays suppliers", "Payroll", "Payroll Sheet", "CRM", "Quotes", "Mail me"): self.assertIn(good, sent)
        for bad in ("example.com", "secret.person", "Secret Person", "Secret Owner", "secret.example", "SECRET-TICKET-TITLE", "T20261112.001", "T20261113.002", "OTHER-FLOW-TITLE", "SECRET-REMOVED-TICKET", KEY):
            self.assertNotIn(bad, sent, bad)
        self.assertIn("[email removed]", sent); self.assertIn("[ticket]", sent)

    def test_the_key_goes_to_the_provider_only(self):
        self.on(GOOD); st, out = self.post({"mapId": "m", "title": "t", "brief": "b"})
        self.assertEqual(self.stub.requests[0]["key"], KEY); self.assertNotIn(KEY, json.dumps(out))

    def test_an_unknown_map_still_works_with_no_context(self):
        self.on(GOOD); st, out = self.post({"mapId": "../../etc/passwd", "title": "t", "brief": "b"}); self.assertTrue(out["ok"])
        self.assertIn("(none)", self.sent())

    # what comes back
    def test_a_good_answer_is_checked_and_normalised(self):
        self.on(GOOD); f = self.post({"mapId": "m", "title": "t", "brief": "b"})[1]["flow"]
        self.assertEqual(f["teams"], ["Sales", "Finance"]); self.assertEqual([s["kind"] for s in f["steps"]], ["start", "decision", None, None])
        self.assertEqual(f["steps"][0]["sheet"], "CRM")                       # matched by name, case-insensitive
        self.assertEqual((f["steps"][2]["sheet"], f["steps"][2]["sheetName"]), (None, "Mystery Sheet")); self.assertEqual(f["unknownSheets"], ["Mystery Sheet"])
        self.assertEqual(f["steps"][2]["waits"], [{"on": 1, "msg": "Yes"}]); self.assertEqual(f["steps"][2]["day"], "Fri")
        self.assertEqual(f["notes"][0], {"text": "I assumed Finance approves", "step": 1})

    def test_json_in_a_code_fence_or_with_chatter_is_accepted(self):
        for wrap in ("```json\n%s\n```", "Here is your flow:\n%s\nHope it helps"):
            self.on(wrap % json.dumps(GOOD)); self.assertTrue(self.post({"mapId": "m", "title": "t", "brief": "b"})[1]["ok"])

    def test_forward_or_bad_references_are_dropped_not_trusted(self):
        bad = {"steps": [{"team": "A", "title": "one", "waits": [{"on": 0}, {"on": 5}, {"on": -1}, {"on": "x"}, {"on": True}]}, {"team": "A", "title": "two", "waits": [{"on": 0}, {"on": 0}]}]}
        f = ai_flow.parse_answer(json.dumps(bad), [])
        self.assertEqual([s["waits"] for s in f["steps"]], [[], [{"on": 0, "msg": ""}]])

    def test_unusable_answers_are_errors_and_change_nothing(self):
        for reply in ("not json at all", "{}", '{"steps": []}', '{"steps": [{"team": "", "title": "x"}]}', '{"steps": ["a"]}',
                      json.dumps({"steps": [{"team": "T%d" % i, "title": "x"} for i in range(13)]}), json.dumps({"steps": [{"team": "A", "title": "x"}] * 41})):
            self.on(reply); out = self.post({"mapId": "m", "title": "t", "brief": "b"})[1]
            self.assertFalse(out["ok"], reply[:40]); self.assertIn("Nothing was changed" if "Nothing" in out["error"] else "AI", out["error"])
            self.assertNotIn("flow", out)

    # the endpoint
    def test_off_empty_and_too_long(self):
        self.assertIn("not set up", self.post({"mapId": "m", "brief": "b"})[1]["error"])
        self.on(GOOD)
        self.assertIn("brief or a rough draft", self.post({"mapId": "m", "brief": "  ", "draft": ""})[1]["error"]); self.assertEqual(self.stub.requests, [])
        out = self.post({"mapId": "m", "brief": "x" * (ai.MAX_TEXT_CHARS + 1)})[1]; self.assertIn("too long", out["error"]); self.assertEqual(self.stub.requests, [])

    def test_wrong_key_and_other_origins(self):
        self.on(GOOD)
        with open(os.path.join(self.tmp.name, "data", ".ai.json"), "w") as f: json.dump({"provider": "deepseek", "apiKey": "wrong", "baseUrl": self.stub.url}, f)
        self.assertIn("refused", self.post({"mapId": "m", "brief": "b"})[1]["error"])
        self.assertEqual(self.post({"mapId": "m", "brief": "b"}, origin=False)[0], 403)

    def test_deepseek_reply_works_too(self):
        self.on(GOOD, "deepseek"); self.assertTrue(self.post({"mapId": "m", "title": "t", "brief": "b"})[1]["ok"])
        self.assertEqual(self.stub.requests[0]["path"], "/chat/completions")


if __name__ == "__main__":
    unittest.main(verbosity=2)
