# AGENZI Content OS — Architecture

## Runtime
Browser → Nginx/Docker → Supabase Auth/Postgres/Realtime.

## Roles
Admin — full internal access.
Strategist — all assigned/workspace clients, planning, approvals, analytics.
Copywriter — only assigned client data and tasks assigned to the signed-in user.
Designer — only assigned client data and tasks assigned to the signed-in user.
Client login is intentionally disabled.

## Data model
clients
profiles
team_client_assignments
content_items
performance_metrics
tasks
activity_logs

Content owns performance and tasks. Deleting a client cascades to its content, performance and tasks.

## Realtime
The browser subscribes to database changes for clients, content, performance, tasks, assignments and activity logs. RLS still controls what each authenticated user can access.

## Security
- No plaintext passwords in frontend.
- Supabase publishable key only in browser.
- Service-role key only in Edge Function secrets.
- Role and client boundaries are enforced with PostgreSQL RLS.
- Admin operations on Auth users run only inside Edge Functions.

## Reporting
Client calendar PDF and analytics PDF are generated in the browser with jsPDF and AutoTable.
