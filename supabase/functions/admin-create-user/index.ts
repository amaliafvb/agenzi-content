import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const ALLOWED_ROLES = [
  "admin", "strategist", "pic", "smm", "editor", "video_editor",
  "content_creator", "wfh_designer", "copywriter", "designer"
] as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const user = (await admin.auth.getUser(token)).data.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const me = (await admin.from("profiles").select("role,active").eq("id", user.id).single()).data;
    if (!me?.active || me.role !== "admin") return json({ error: "Admin access required" }, 403);

    const body = await req.json();
    const full_name = String(body.full_name || "").trim();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "");
    if (!full_name || !/^[a-z0-9._-]{3,40}$/.test(username) || password.length < 8 || !ALLOWED_ROLES.includes(role as typeof ALLOWED_ROLES[number])) {
      return json({ error: "Invalid account data" }, 400);
    }

    const email = username + "@" + (Deno.env.get("INTERNAL_EMAIL_DOMAIN") || "internal.agenzi.local");
    const created = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { username, full_name }
    });
    if (created.error) return json({ error: created.error.message }, 400);

    const profileUpdate = await admin.from("profiles")
      .update({ username, full_name, role })
      .eq("id", created.data.user.id);
    if (profileUpdate.error) {
      await admin.auth.admin.deleteUser(created.data.user.id);
      return json({ error: profileUpdate.error.message }, 400);
    }

    // Only PIC/SMM receive client-level assignments. Production roles remain task-scoped.
    const names = (Array.isArray(body.assigned_client_names) ? body.assigned_client_names : [])
      .map((x: unknown) => String(x).trim()).filter(Boolean);
    if (["pic", "smm"].includes(role) && names.length) {
      const clients = (await admin.from("clients").select("id,name").in("name", names)).data || [];
      if (clients.length) {
        const assignments = await admin.from("team_client_assignments").upsert(
          clients.map((client: { id: string }) => ({
            profile_id: created.data.user.id,
            client_id: client.id,
            can_view: true,
            can_edit: true
          })),
          { onConflict: "profile_id,client_id" }
        );
        if (assignments.error) {
          await admin.auth.admin.deleteUser(created.data.user.id);
          return json({ error: assignments.error.message }, 400);
        }
      }
    }

    return json({ ok: true, profile_id: created.data.user.id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
