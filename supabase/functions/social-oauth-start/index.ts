import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json"}});
const redirectUrl=()=>Deno.env.get("SOCIAL_OAUTH_REDIRECT_URL")||((Deno.env.get("SUPABASE_URL")||"")+"/functions/v1/social-oauth-callback");

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  try{
    const token=(req.headers.get("Authorization")||"").replace("Bearer ","");
    if(!token)return json({error:"Unauthorized"},401);
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authUser=(await admin.auth.getUser(token)).data.user;
    if(!authUser)return json({error:"Unauthorized"},401);
    const me=(await admin.from("profiles").select("id,role,active").eq("id",authUser.id).single()).data;
    if(!me?.active||!["admin","strategist"].includes(me.role))return json({error:"Only Admin/Strategist can connect social accounts."},403);
    const body=await req.json();
    const clientId=String(body.client_id||"");
    const platform=String(body.platform||"");
    if(!clientId||!["meta","tiktok"].includes(platform))return json({error:"client_id and platform (meta|tiktok) are required."},400);
    const client=(await admin.from("clients").select("id,name").eq("id",clientId).single()).data;
    if(!client)return json({error:"Client not found"},404);
    const state=crypto.randomUUID().replaceAll("-","");
    await admin.from("social_oauth_states").insert({state,client_id:clientId,requester_id:authUser.id,platform,expires_at:new Date(Date.now()+10*60*1000).toISOString()});
    const redirect=redirectUrl();
    let url="";
    if(platform==="meta"){
      const appId=Deno.env.get("META_APP_ID");
      if(!appId)return json({error:"META_APP_ID belum diset di Supabase Edge Function Secrets."},503);
      const version=Deno.env.get("META_GRAPH_VERSION")||"v26.0";
      const scope=Deno.env.get("META_OAUTH_SCOPES")||"pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish";
      const p=new URLSearchParams({client_id:appId,redirect_uri:redirect,response_type:"code",scope,state});
      url="https://www.facebook.com/"+version+"/dialog/oauth?"+p.toString();
    }else{
      const key=Deno.env.get("TIKTOK_CLIENT_KEY");
      if(!key)return json({error:"TIKTOK_CLIENT_KEY belum diset di Supabase Edge Function Secrets."},503);
      const scope=Deno.env.get("TIKTOK_OAUTH_SCOPES")||"user.info.basic,video.list,video.publish";
      const p=new URLSearchParams({client_key:key,response_type:"code",scope,redirect_uri:redirect,state});
      url="https://www.tiktok.com/v2/auth/authorize/?"+p.toString();
    }
    return json({ok:true,url,platform,client_id:clientId});
  }catch(error){return json({error:error instanceof Error?error.message:"Unexpected error"},500)}
});