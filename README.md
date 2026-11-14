# Sheets Ecosystem Map

A map of departments, Google Sheets, connected apps and the links between them. The map is drawn from a plain Markdown file.

## Run locally

Double-click `start.command` (macOS), or in a terminal in this folder:

    python3 server.py

Then open:

- http://localhost:8000/ for your map (`maps/work.md`)
- http://localhost:8000/?map=demo.md for the example data (`maps/demo.md`)

`maps/work.md` is private and not tracked by git. Create your own copy (for example from `maps/demo.md`) and edit it. Without it the page shows the built-in demo.

Opening `index.html` directly also works, but it can only show the built-in demo. Browsers block reading `maps/*.md` from a file path.

## Edit

1. Edit `maps/work.md` in any text editor, then refresh the page. Or tap Edit in the page and change the text there.
2. In the page, press Save (or Cmd/Ctrl+S in the editor). It writes straight to `maps/work.md` and keeps the previous version as `maps/work.md.bak`. This needs `server.py`, which `start.command` runs.
3. Download .md is still there if you want a separate copy.

## Markdown format

    # Map title

    ## Department name
    Lead: free text line (optional)
    > Section title (yellow card, repeat as needed)
      Optional note, indented two spaces
    - Sheet name | owner | high | https://link     (criticality: high, medium or low; link optional)
      Optional note, indented two spaces
    - Another sheet | owner | medium
    > Next section
    - Sheet in the next section | owner | low

    ## Apps
    - App name | what it does
      Optional note

    ## Links
    - Sheet A -> Sheet B | IMPORTRANGE
    - Sheet C -> Sheet D | manual copy               (a note containing "manual" is drawn dashed)

- A `>` line starts a section. The `-` lines under it belong to that section. A department can have as many sections as you like.
- An indented line under a section or an item is its note. Tap the card on the map to open a note card with the note, the owner, the sheet link and what it sends to or receives from. Cards with a note show a small "i".
- Names in Links must match a sheet or app name exactly (capitals ignored). A mismatch shows a warning under the map.

## Files

- `index.html`: the whole app (parser, layout, editor). No build step, no dependencies. Fonts load from Google Fonts when online and fall back to system fonts.
- `maps/demo.md`: example data.
- `maps/work.md`: your map. Start here.
- `server.py`: the local server. It serves the folder and accepts saves to `maps/*.md` only, from this page only, on localhost only.
- `start.command`: runs `server.py` and opens the browser on macOS.
