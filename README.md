# AGENZI Studio — Internal Content OS

Internal workspace for AGENZI Digital Mandiri to run client content operations across 20+ brands.

## Product
- Premium light UI: ivory, white and orange
- Internal-only login; no client login
- Roles: Admin, Strategist, Copywriter, Designer
- Per-client assignment
- Content calendar: month / client / platform / status
- Client-only calendar PDF export
- Content database: caption/copy, Canva, Drive, publish link, approval, PIC and due date
- Division tasks: PIC, status, priority, due date and notes
- Performance: views, reach, likes, comments, shares, saves, clicks, leads
- Work / Not Work learning
- Realtime cross-device synchronization
- Activity log
- Admin user lifecycle: create, activate/deactivate, reset password, delete
- Supabase Auth + Postgres + RLS + Realtime
- Supabase Edge Functions for privileged admin operations
- Docker + Nginx
- GitHub Actions → Docker Hub

## Security
Passwords are handled by Supabase Auth. There are no demo passwords or localStorage authentication in the production architecture. The browser uses only a Supabase publishable key. The service-role key exists only inside Supabase Edge Function execution and must never be committed.

RLS enforces access at the database layer:
- Admin: all internal data
- Strategist: workspace/client management and analytics
- Copywriter: assigned client content + own assigned tasks
- Designer: assigned client content + own assigned tasks

Client master data can be edited by Admin/Strategist; client deletion is Admin-only.

## Supabase setup
See SUPABASE_SETUP.md.

High-level:
1. Create a Supabase project.
2. Run supabase_schema.sql in SQL Editor.
3. Deploy the four Edge Functions in supabase/functions/.
4. Create the first Admin Auth user using the internal username email mapping.
5. Enable Realtime for clients, content_items, performance_metrics, tasks, team_client_assignments and activity_logs.
6. Put Project URL + Publishable Key into config.js for direct/static hosting.

## Local
Because the app uses ES modules, serve it through HTTP:
```
python -m http.server 8080
```
Then open http://localhost:8080.

## Docker
The container writes config.js at startup from environment variables, so Supabase credentials are not baked into the image.

```
docker build -t agenzi-content .
docker run --rm -p 8080:80 \
  -e SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  -e SUPABASE_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY" \
  -e INTERNAL_EMAIL_DOMAIN="internal.agenzi.local" \
  agenzi-content
```

## Docker Hub
GitHub Actions is configured to publish:
`amaliafvb/agenzi-content:latest`

Configure GitHub repository Actions:
- Variable: DOCKERHUB_USERNAME
- Secret: DOCKERHUB_TOKEN

The image does not contain passwords or service-role secrets.

## GitHub
Repository: https://github.com/amaliafvb/agenzi-content
Branch: main

## Important
Environment-specific credentials are intentionally not included in GitHub source.
