# Supabase setup for AGENZI

1. Create a Supabase project.
2. In SQL Editor, run `supabase_schema.sql`.
3. Deploy all Edge Functions under `supabase/functions/`.
4. Set Edge Function secrets:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - INTERNAL_EMAIL_DOMAIN=internal.agenzi.local
5. Enable Realtime for:
   - clients
   - content_items
   - performance_metrics
   - tasks
   - team_client_assignments
   - activity_logs
6. Create the first Auth user manually in Supabase with email:
   `amalia@internal.agenzi.local`
   and user metadata:
   `username=amalia`
   `full_name=Amalia`
   `role=admin`
   The database trigger creates the profile automatically.
7. Put only the Project URL and Publishable Key in `config.js`.
8. Never put the service-role key or Docker Hub token in `config.js`, GitHub source files, or chat.
