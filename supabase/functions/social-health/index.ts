import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
function cleanToken(value:string){return String(value||"").trim().replace(/^["']|["']$/g,"").replace(/^Bearer\s+/i,"").trim()}
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 try{
  const token=(req.headers.get("Authorization")||"").replace("Bearer ","");if(!token)return json({error:"Unauthorized"},401);
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const user=(await admin.auth.getUser(token)).data.user;if(!user)return json({error:"Unauthorized"},401);
  const profile=(await admin.from("profiles").select("role,active").eq("id",user.id).single()).data;
  if(!profile?.active||!["admin","strategist"].includes(profile.role))return json({error:"Only Admin/Strategist can test social API."},403);
  const key=cleanToken(Deno.env.get("APIFY_API_TOKEN")||"");if(!key)return json({configured:false,status:"missing_secret",message:"APIFY_API_TOKEN belum dipasang di Supabase Edge Function Secrets."});
  const res=await fetch("https://api.apify.com/v2/users/me",{headers:{Authorization:"Bearer "+key}});
  const body=await res.json();
  if(!res.ok)return json({configured:true,status:"invalid_secret",message:"APIFY_API_TOKEN tersimpan di Supabase tetapi ditolak Apify. Buat/copy token baru dari Apify → Settings → API & Integrations.",details:{status:res.status}},200);
  return json({configured:true,status:"ready",username:body?.username||body?.user?.username||""});
 }catch(error){return json({configured:false,status:"error",message:error instanceof Error?error.message:"Unexpected error"})}
});