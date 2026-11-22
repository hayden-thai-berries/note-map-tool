#!/usr/bin/env python3
"""Local server for the Sheets Ecosystem Map.

Serves this folder on http://localhost:8000 and lets the page save maps/<name>.md
and maps/<name>.json (tickets). Only PUT /maps/<name>.md or .json is writable, only
from this same page, and the previous version is kept as a .bak next to it.
GET /api/maps lists the maps (maps/*.md without the .flows.md files). A PUT with
X-Map-Create: 1 only creates the file and answers 409 if the name is taken.
"""
import http.server, json, os, re, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8000"))
ALLOWED_ORIGINS = ("http://localhost:%d" % PORT, "http://127.0.0.1:%d" % PORT)
SAVE_PATH = re.compile(r"^/maps/([\w.-]+\.(?:md|json))$")
MAX_BYTES = 1_000_000


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] != "/api/maps":
            return super().do_GET()
        names = sorted(n for n in os.listdir(os.path.join(ROOT, "maps"))
                       if n.endswith(".md") and not n.endswith(".flows.md") and re.match(r"^[\w.-]+$", n))
        body = json.dumps(names).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_PUT(self):
        m = SAVE_PATH.match(self.path.split("?")[0])
        if (not m or self.headers.get("Origin", "") not in ALLOWED_ORIGINS
                or self.headers.get("X-Map-Save") != "1"):
            return self.send_error(403, "Not allowed")
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BYTES:
            return self.send_error(413, "Bad size")
        data = self.rfile.read(length)
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            return self.send_error(400, "Not UTF-8")
        if m.group(1).endswith(".json"):
            try:
                json.loads(text)
            except ValueError:
                return self.send_error(400, "Not JSON")
        path = os.path.join(ROOT, "maps", m.group(1))
        if self.headers.get("X-Map-Create") == "1" and os.path.exists(path):
            return self.send_error(409, "Already exists")
        if os.path.exists(path):
            shutil.copyfile(path, path + ".bak")
        tmp = path + ".tmp"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, path)
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("Sheets map running at http://localhost:%d/  (Ctrl+C to stop)" % PORT)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
