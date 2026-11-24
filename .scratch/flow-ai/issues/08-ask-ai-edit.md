# 08: Ask AI to edit a Flow

**What to build:** The user types a change ("add a QA check before Finance") and sees a preview: new shapes highlighted, removed ones struck through, changed text marked. Accept or Discard.

**Blocked by:** 06: Generate a swimlane Flow from a brief (better after 07 so it also covers the free canvas)

**Status:** ready-for-agent

- [ ] Preview diff against the current Flow
- [ ] Accept goes through apply/undo and Removed; Discard changes nothing
- [ ] API failure leaves the Flow untouched and shows the reason
