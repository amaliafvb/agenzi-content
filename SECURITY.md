# Security checklist

## Never commit
- Supabase service-role key
- Docker Hub access token
- real team passwords
- private customer exports
- .env files

## Application controls
- Internal-only authentication via Supabase Auth
- RLS for all application tables
- Admin-only account management Edge Functions
- Copywriter/Designer task visibility limited to assigned tasks
- Client access limited by assignment
- Admin-only client deletion
- Realtime is supplemental; authorization remains in RLS

## Before production
- Replace example config with the real Supabase URL/publishable key.
- Create the first Admin user.
- Deploy Edge Functions and set secrets.
- Create Docker Hub repository and GitHub Actions credentials.
- Protect the main branch.
- Turn on repository 2FA for administrators.
