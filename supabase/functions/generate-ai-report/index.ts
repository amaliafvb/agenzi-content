import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

function extractText(body: any): string {
  if (typeof body?.output_text === "string") return body.output_text;
  const out = Array.isArray(body?.output) ? body.output : [];
  const chunks: string[] = [];
  for (const item of out) {
    for (const c of item?.content || []) {
      if (typeof c?.text === "string") chunks.push(c.text);
    }
  }
  return chunks.join("\n").trim();
}

function period(value: string) {
  const m = /^\d{4}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 7);
  const start = new Date(m + "-01T00:00:00Z");
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return { month: m, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authUser = (await supabase.auth.getUser(token)).data.user;
    if (!authUser) return json({ error: "Unauthorized" }, 401);
    const me = (await supabase.from("profiles").select("id,role,active").eq("id", authUser.id).single()).data;
    if (!me?.active || !["admin", "strategist"].includes(me.role)) return json({ error: "Only Admin/Strategist can generate reports." }, 403);

    const body = await req.json();
    const clientId = String(body.client_id || "");
    const p = period(String(body.period || ""));
    if (!clientId) return json({ error: "client_id is required" }, 400);

    const client = (await supabase.from("clients").select("id,name").eq("id", clientId).single()).data;
    if (!client) return json({ error: "Client not found" }, 404);

    const [contentRes, socialRes] = await Promise.all([
      supabase.from("content_items")
        .select("id,title,platform,content_date,status,approval,pillar,goal,content_type,format,work_label,learning_reason,performance_metrics(views,reach,likes,comments,shares,saves,clicks,leads)")
        .eq("client_id", clientId).gte("content_date", p.start).lte("content_date", p.end).order("content_date"),
      supabase.from("social_metric_snapshots")
        .select("platform,metric_date,external_post_id,title,views,reach,likes,comments,shares,saves,clicks,followers,profile_visits,source")
        .eq("client_id", clientId).gte("metric_date", p.start).lte("metric_date", p.end).order("metric_date"),
    ]);
    if (contentRes.error) throw contentRes.error;
    if (socialRes.error) throw socialRes.error;

    const compactContent = (contentRes.data || []).map((c: any) => {
      const m = Array.isArray(c.performance_metrics) ? (c.performance_metrics[0] || {}) : (c.performance_metrics || {});
      return { title:c.title,date:c.content_date,platform:c.platform,pillar:c.pillar,goal:c.goal,type:c.content_type,format:c.format,status:c.status,work_label:c.work_label,learning_reason:c.learning_reason,metrics:{views:Number(m.views||0),reach:Number(m.reach||0),likes:Number(m.likes||0),comments:Number(m.comments||0),shares:Number(m.shares||0),saves:Number(m.saves||0),clicks:Number(m.clicks||0),leads:Number(m.leads||0)} };
    });

    const prompt = [
      "You are the senior social media strategist for AGENZI Digital Mandiri.",
      "Write a client-ready monthly social media performance report in Indonesian.",
      "Client: " + client.name, "Period: " + p.start + " to " + p.end, "",
      "Rules:", "- Use only supplied data; do not invent metrics.", "- Separate observed facts from interpretation.", "- Identify top-performing content.", "- Explain patterns from platform, format, pillar, and engagement.", "- Identify what did not work when evidence exists.", "- Give 5 concrete recommendations for next month.", "- Keep the tone professional and agency-ready.",
      "- Return markdown with sections: Executive Summary, Performance Highlights, What Worked, What Needs Improvement, Content Insights, Next Month Recommendations.",
      "", "Internal content data:", JSON.stringify(compactContent), "", "External social API data:", JSON.stringify(socialRes.data || []),
    ].join("\n");

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY belum diset di Supabase Edge Function Secrets.", setup: "Supabase → Project Settings → Edge Functions → Secrets → add OPENAI_API_KEY" }, 503);
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-5";
    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model, store: false, input: prompt }),
    });
    const openaiBody = await openaiRes.json();
    if (!openaiRes.ok) return json({ error: "OpenAI request failed", details: openaiBody }, 502);
    const markdown = extractText(openaiBody);
    if (!markdown) return json({ error: "AI returned an empty report." }, 502);

    const reportJson = { client: client.name, period:{start:p.start,end:p.end}, data_sources:{internal_content_records:compactContent.length,social_api_records:(socialRes.data||[]).length}, generated_at:new Date().toISOString() };
    const inserted = await supabase.from("ai_reports").insert({
      client_id:clientId,period_start:p.start,period_end:p.end,model,report_markdown:markdown,report_json:reportJson,
      source_summary:{content_records:compactContent.length,social_records:(socialRes.data||[]).length},created_by:authUser.id,
    }).select("id,created_at,model,report_markdown").single();
    if (inserted.error) throw inserted.error;
    return json({ ok:true, report:inserted.data, report_json:reportJson });
  } catch (error) {
    return json({ error:error instanceof Error?error.message:"Unexpected error" }, 500);
  }
});
