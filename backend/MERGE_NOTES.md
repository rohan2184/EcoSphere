# Social + Gamification Merge Notes

The following stubs and placeholders were created to allow the Social & Gamification module to be built and tested in isolation. Before this branch can be merged with the main development branch (Person A and Person C's work), the following items must be resolved:

- [ ] `app/core/deps.py` — `get_current_user()` returns a hardcoded fake user; replace with real JWT decode once Person A's auth lands.
- [ ] `app/core/deps.py` — `get_settings_stub()` returns hardcoded settings; replace with real DB-backed Settings lookup once Person A's Settings model lands.
- [ ] `app/seed_social_gamification.py` — call `seed_social_and_gamification(db)` from the team's main `seed.py` instead of running standalone, once A's seed backbone exists.
- [ ] `frontend/src/lib/api.ts` — swap for Person C's shared axios client.
- [ ] `frontend/src/lib/fakeAuth.ts` — delete entirely, replace `isAdmin` checks with real `user.role` from C's AuthContext.
- [ ] `frontend/src/components/Layout.tsx` — delete placeholder nav, move `NotificationBell.tsx` into Person C's Layout topbar.
- [ ] `frontend/src/pages/social/CSRActivityList.tsx` (line ~91) — ask backend team to add `?csr_activity_id=` query param to `GET /social/participations` for efficiency (currently filtering client-side).
- [ ] `frontend/src/pages/gamification/ChallengeList.tsx` (line ~112) — ask backend team to add `?challenge_id=` query param to `GET /gamification/challenge-participations` for efficiency.
