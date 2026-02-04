Keep it simple, functional, and realistic.

Use the tools you need (like Supabase), but never add complexity unless the problem truly requires it. Everything should be:

Direct – logic flows clearly from input to output.

Easy to understand – a developer or panel can explain it in 5 minutes.

Easy to debug – minimal layers, no hidden steps.

Secure enough – rely on built-in security (e.g., Supabase Auth), don’t reinvent it.

Realistic for the environment – match real-world constraints (e.g., some users have no email, SMS costs).

Practical applications:

Client-side login → just call Supabase Auth.

Database fetch → query the table directly.

Password reset → use the minimal flow the platform supports.

Extra optimizations → only add if the project actually needs them.

Mental shortcut:

“If it feels like XAMPP — call the table, get the result — it’s probably correct.
If it feels like 10 extra layers of logic, stop and simplify.”

Add a note:
