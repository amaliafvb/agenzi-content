# AGENZI Studio — Internal Content OS

Internal-only workspace for AGENZI Digital Mandiri.

## Included
- Premium light UI: ivory + white + orange
- Internal login only: Admin, Strategist, Copywriter, Designer
- Supabase Auth username/password login via internal email mapping
- Client assignment per division
- Client CRUD with Admin delete
- Content calendar with client-only PDF export
- Content workflow: strategy → copy → design → approval → posted
- Canva / Google Drive / published links
- Division tasks with PIC, priority, due date and status
- Performance input and realtime analytics
- WORK / NOT WORK content learning
- Activity log
- Admin user management via secure Edge Functions
- Docker + Nginx + Docker Compose
- GitHub Actions → Docker Hub

## Security model
Passwords are handled by Supabase Auth and are not stored in frontend source code. Browser code uses only the Supabase publishable key. Service-role credentials belong only in Supabase Edge Function secrets and must never be committed to GitHub.

Client access and content access are enforced by PostgreSQL RLS using role and team_client_assignments.

## Supabase setup
1. Create a Supabase project.
2. Run supabase_schema.sql in SQL Editor.
3. Deploy the four Edge Functions:
   - admin-create-user
   - admin-set-user-active
   - admin-delete-user
   - admin-reset-password
4. Set Edge Function secrets:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - INTERNAL_EMAIL_DOMAIN (example: internal.agenzi.local)
5. Enable Realtime for clients, content_items, performance_metrics, tasks, team_client_assignments, and activity_logs.
6. Create the first Auth user as Admin and set metadata:
   - username
   - full_name
   - role=admin
7. Copy config.example.js to config.js and put only the Project URL + Publishable Key in config.js.

## Local
Serve the folder through a local web server because ES modules should not be opened directly with file://.
bash:
python -m http.server 8080

Open http://localhost:8080.

## Docker
bash:
docker build -t agenzi-content .
docker run --rm -p 8080:80 agenzi-content

## Docker Compose
bash:
docker compose up --build

## Docker Hub
The GitHub Actions workflow publishes amaliafvb/agenzi-content:latest from main.

Configure GitHub Actions:
- Variable: DOCKERHUB_USERNAME
- Secret: DOCKERHUB_TOKEN

## Production notes
Actual Supabase credentials, first-admin setup and Docker Hub credentials are environment-specific and intentionally not included in this repository.
