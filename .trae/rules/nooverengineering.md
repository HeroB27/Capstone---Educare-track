You are not allowed to overengineer.

Always assume:
- This is a small system
- One developer
- Local deployment
- No microservices
- No advanced scaling
- No premature optimization

Your goal:
Make the simplest possible solution that works end-to-end.

Rules:
1. Do not add features I did not explicitly request.
2. Do not add "future-proof" logic.
3. Do not add analytics, abstractions, or complex policies unless required.
4. Prefer 1 table over 5 tables.
5. Prefer basic CRUD over triggers, RLS, or automation.
6. If something can be hardcoded, hardcode it.
7. If something can be manual, keep it manual.
8. Only introduce complexity when the system is already working.
