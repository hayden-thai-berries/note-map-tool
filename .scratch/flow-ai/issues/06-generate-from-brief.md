# 06: Generate a swimlane Flow from a brief

**What to build:** A Generate button builds a swimlane Flow from the brief, draft and optional Department and Function descriptions. The result is validated and shown as a preview with Accept/Discard. One brief makes one Flow.

**Blocked by:** 04: Brief and draft saved on a Flow; 05: AI provider setup

**Status:** ready-for-agent

- [ ] Privacy filter: no emails, tickets, time logs or other maps are sent
- [ ] Unknown sheet names are kept as plain text and flagged; the AI never creates sheets
- [ ] Assumptions and open questions arrive as notes, not guesses
- [ ] Output is validated against the schema; invalid output shows an error and changes nothing
- [ ] Accept applies through apply/undo; Discard drops it; nothing is saved until Save
- [ ] Provider name shown on the button and in the preview
- [ ] Browser test runs against the stub provider from 05
