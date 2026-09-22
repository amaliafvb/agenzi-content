# AGENZI Studio — Internal Content OS

Internal-only workspace for AGENZI Digital Mandiri.

## Architecture
- Frontend: modular vanilla ES modules
- Auth: Supabase Auth using internal username-to-email mapping
- Database: Supabase Postgres
- Authorization: Row Level Security (role + client assignment)
- Realtime: Supabase Realtime subscriptions
- Reports: jsPDF + AutoTable client calendar / analytics exports
- Admin functions: Supabase Edge Functions for create, activate/deactivate, delete and password reset
- Container: Nginx + Docker
- CI/CD: GitHub Actions → Docker Hub

## Roles
- Admin: all clients, team, access and delete permissions
- Strategist: planning, approvals, analytics, client management
- Copywriter: assigned clients, caption/copy and assigned tasks
- Designer: assigned clients, assets and assigned tasks
- Client login is intentionally not supported.

## Security
Real passwords, Supabase service-role keys and Docker Hub tokens are not stored in the frontend or repository. The browser only uses the Supabase publishable key.

## Supabase setup
1. Create a Supabase project.
2. Run `supabase_schema.sql` in SQL Editor.
3. Deploy the four functions in `supabase/functions/`.
4. Set function secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_EMAIL_DOMAIN`.
5. Enable Realtime for: `clients`, `content_items`, `performance_metrics`, `tasks`, `team_client_assignments`, `activity_logs`.
6. Create the first Admin Auth user with user metadata `username`, `full_name`, `role=admin`. The database trigger creates the profile.

## Runtime config
Copy `config.example.js` to `config.js` and set your Supabase Project URL + Publishable Key.

## Docker
```bash
docker build -t agenzi-content .
docker run --rm -p 8080:80 agenzi-content
```

Open http://localhost:8080.

## Docker Hub
The GitHub Actions workflow publishes `amaliafvb/agenzi-content` on pushes to `main` once the repository has:
- Actions variable `DOCKERHUB_USERNAME`
- Actions secret `DOCKERHUB_TOKEN`

## Development notes
The repo is intentionally kept framework-free so the internal tool stays easy to operate. The next environment-specific step is wiring your Supabase project credentials and deploying the edge functions.