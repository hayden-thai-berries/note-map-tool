#!/usr/bin/env python3
"""Local server for the Sheets Ecosystem Map.

Serves this folder on http://localhost:8000 and lets the page save maps/<name>.md
and maps/<name>.json (tickets). Only PUT /maps/<name>.md or .json is writable, only
from this same page, and the previous version is kept as a .bak next to it.
GET /api/maps lists the maps (maps/*.md without the .flows.md files). A PUT with
X-Map-Create: 1 only creates the file and answers 409 if the name is taken.

Storage rules (see docs/DESIGN.md):
- Every GET and successful PUT of a map file carries X-Content-Hash (sha256 of the file bytes).
- A PUT may send X-Base-Hash, the hash the page loaded. If the file changed since, answer 409
  and write nothing, unless X-Force: 1. No X-Base-Hash = old page, accepted as before.
- Before a file is replaced it is copied to maps/.history/<name>/<UTC time><ext> (last 20 kept)
  and to <name>.bak. Writes go to a temp file first, then replace, so a crash never leaves half a file.
"""
import hashlib, http.server, json, os, re, shutil, time

ROOT = os.environ.get("SHEETS_MAP_ROOT") or os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8000"))
KEEP_HISTORY = 20
SAVE_PATH = re.compile(r"^/maps/([\w.-]+\.(?:md|json))$")
MAX_BYTES = 1_000_000


def file_hash(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def snapshot(path):
    """Copy the current file into maps/.history/<name>/ and keep only the newest KEEP_HISTORY."""
    folder = os.path.join(os.path.dirname(path), ".history", os.path.basename(path))
    os.makedirs(folder, exist_ok=True)
    stem, ext = os.path.splitext(os.path.basename(path))
    now = time.time_ns()  # fixed width, so a plain sort is chronological even for saves in the same second
    stamp = time.strftime("%Y%m%dT%H%M%S", time.gmtime(now // 10**9)) + "%09d" % (now % 10**9)
    dest, n = os.path.join(folder, "%s-%s%s" % (stem, stamp, ext)), 0
    while os.path.exists(dest):  # same nanosecond: never overwrite
        n += 1
        dest = os.path.join(folder, "%s-%s-%02d%s" % (stem, stamp, n, ext))
    shutil.copyfile(path, dest)
    for old in sorted(os.listdir(folder))[:-KEEP_HISTORY]:
        os.remove(os.path.join(folder, old))


class Handler(http.server.SimpleHTTPRequestHandler):
    content_hash = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        if self.content_hash:
            self.send_header("X-Content-Hash", self.content_hash)
            self.send_header("Access-Control-Expose-Headers", "X-Content-Hash")
        super().end_headers()

    def origins(self):
        p = self.server.server_port
        return ("http://localhost:%d" % p, "http://127.0.0.1:%d" % p)

    def do_GET(self):
        m = SAVE_PATH.match(self.path.split("?")[0])
        if m and os.path.isfile(os.path.join(ROOT, "maps", m.group(1))):
            self.content_hash = file_hash(os.path.join(ROOT, "maps", m.group(1)))
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
        if (not m or self.headers.get("Origin", "") not in self.origins()
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
        base = self.headers.get("X-Base-Hash")
        if os.path.exists(path) and base and self.headers.get("X-Force") != "1" and base != file_hash(path):
            body = json.dumps({"error": "changed", "hash": file_hash(path)}).encode("utf-8")
            self.send_response(409)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if os.path.exists(path):
            snapshot(path)
            shutil.copyfile(path, path + ".bak")
        tmp = path + ".tmp"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, path)
        self.content_hash = hashlib.sha256(data).hexdigest()
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("Sheets map running at http://localhost:%d/  (Ctrl+C to stop)" % PORT)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
