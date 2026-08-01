# Deployment checklist

- [ ] PR A is based on main and shows only NOV Talent body changes.
- [ ] PR A checks and human review pass.
- [ ] PR A is merged by a human.
- [ ] Main Pages workflow passes.
- [ ] PR B base is changed to main.
- [ ] PR B shows only HUB registry/session/guard changes.
- [ ] Existing Permission Model names are unchanged.
- [ ] Mock Identity cannot be enabled in Production.
- [ ] Unauthenticated, expired and unauthorized paths are verified.
- [ ] Representative privacy restrictions are verified.
- [ ] HUB and Store regressions pass.
- [ ] PR B is merged by a human.
- [ ] Pages deploy is allowed to run once from main.
- [ ] Published HUB card and Talent route are smoke-tested.

No DB, Supabase, JWT, RLS, migration or Production data action is part of this checklist.
