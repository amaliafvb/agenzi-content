import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const redirectUrl=()=>Deno.env.get("SOCIAL_OAUTH_REDIRECT_URL")||((Deno.env.get("SUPABASE_URL")||"")+"/functions/v1/social-oauth-callback");
const appUrl=()=>Deno.env.get("APP_PUBLIC_URL")||"https://amaliafvb.github.io/agenzi-content/";

function go(params:Record<string,string>){
  const u=new URL(appUrl());
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  return Response.redirect(u.toString(),302);
}
async function saveToken(admin:any,accountId:string,accessToken:string,refreshToken:string|null,expiresAt:string|null){
  const {error}=await admin.rpc("store_social_tokens",{p_social_account_id:accountId,p_access_token:accessToken,p_refresh_token:refreshToken||"",p_expires_at:expiresAt});
  if(error)throw error;
}
Deno.serve(async(req)=>{
  try{
    const u=new URL(req.url);
    if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
    const code=u.searchParams.get("code");
    const state=u.searchParams.get("state");
    const err=u.searchParams.get("error");
    if(err)return go({social:"error",message:err});
    if(!code||!state)return go({social:"error",message:"Missing OAuth code/state"});
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stateRow=(await admin.from("social_oauth_states").select("*").eq("state",state).gt("expires_at",new Date().toISOString()).single()).data;
    if(!stateRow)return go({social:"error",message:"OAuth state expired or invalid"});
    const platform=stateRow.platform;
    const redirect=redirectUrl();
    let connectedCount=0;
    if(platform==="meta"){
      const appId=Deno.env.get("META_APP_ID");
      const appSecret=Deno.env.get("META_APP_SECRET");
      if(!appId||!appSecret)throw new Error("META_APP_ID / META_APP_SECRET belum diset.");
      const version=Deno.env.get("META_GRAPH_VERSION")||"v26.0";
      const tokenUrl=new URL("https://graph.facebook.com/"+version+"/oauth/access_token");
      tokenUrl.searchParams.set("client_id",appId);
      tokenUrl.searchParams.set("client_secret",appSecret);
      tokenUrl.searchParams.set("redirect_uri",redirect);
      tokenUrl.searchParams.set("code",code);
      const tr=await fetch(tokenUrl);
      const tj=await tr.json();
      if(!tr.ok||!tj.access_token)throw new Error("Meta token exchange gagal: "+JSON.stringify(tj));
      const userToken=tj.access_token as string;
      const pagesRes=await fetch("https://graph.facebook.com/"+version+"/me/accounts?fields=id,name,access_token,instagram_business_account&access_token="+encodeURIComponent(userToken));
      const pagesBody=await pagesRes.json();
      if(!pagesRes.ok)throw new Error("Meta pages lookup gagal: "+JSON.stringify(pagesBody));
      for(const page of pagesBody.data||[]){
        const pageAccount=await admin.from("social_accounts").upsert({
          client_id:stateRow.client_id,platform:"facebook",account_name:page.name,external_account_id:page.id,status:"connected",
          scopes:(Deno.env.get("META_OAUTH_SCOPES")||"").split(",").filter(Boolean),
          metadata:{page_id:page.id,provider:"meta"}
        },{onConflict:"client_id,platform,external_account_id"}).select("id").single();
        if(pageAccount.error)throw pageAccount.error;
        const expires=new Date(Date.now()+60*24*3600*1000).toISOString();
        await saveToken(admin,pageAccount.data.id,page.access_token,null,expires);
        connectedCount++;
        if(page.instagram_business_account?.id){
          const igId=page.instagram_business_account.id;
          const igRes=await fetch("https://graph.facebook.com/"+version+"/"+igId+"?fields=id,username,name,profile_picture_url&access_token="+encodeURIComponent(page.access_token));
          const ig=await igRes.json();
          const igAccount=await admin.from("social_accounts").upsert({
            client_id:stateRow.client_id,platform:"instagram",account_name:ig.username||ig.name||igId,external_account_id:igId,status:"connected",
            scopes:(Deno.env.get("META_OAUTH_SCOPES")||"").split(",").filter(Boolean),
            metadata:{ig_user_id:igId,page_id:page.id,provider:"meta"}
          },{onConflict:"client_id,platform,external_account_id"}).select("id").single();
          if(igAccount.error)throw igAccount.error;
          await saveToken(admin,igAccount.data.id,page.access_token,null,expires);
          connectedCount++;
        }
      }
    }else{
      const key=Deno.env.get("TIKTOK_CLIENT_KEY");
      const secret=Deno.env.get("TIKTOK_CLIENT_SECRET");
      if(!key||!secret)throw new Error("TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET belum diset.");
      const form=new URLSearchParams({client_key:key,client_secret:secret,code,grant_type:"authorization_code",redirect_uri:redirect});
      const tr=await fetch("https://open.tiktokapis.com/v2/oauth/token/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form});
      const tj=await tr.json();
      if(!tr.ok||!tj.access_token)throw new Error("TikTok token exchange gagal: "+JSON.stringify(tj));
      const infoRes=await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",{headers:{Authorization:"Bearer "+tj.access_token}});
      const info=await infoRes.json();
      if(!infoRes.ok)throw new Error("TikTok user info gagal: "+JSON.stringify(info));
      const openId=info.data?.user?.open_id||tj.open_id;
      const account=await admin.from("social_accounts").upsert({
        client_id:stateRow.client_id,platform:"tiktok",account_name:info.data?.user?.display_name||openId,external_account_id:openId,status:"connected",
        scopes:String(tj.scope||"").split(",").filter(Boolean),metadata:{provider:"tiktok"}
      },{onConflict:"client_id,platform,external_account_id"}).select("id").single();
      if(account.error)throw account.error;
      const expires=new Date(Date.now()+Number(tj.expires_in||86400)*1000).toISOString();
      await saveToken(admin,account.data.id,tj.access_token,tj.refresh_token||null,expires);
      connectedCount=1;
    }
    await admin.from("social_oauth_states").delete().eq("state",state);
    return go({social:"connected",platform,client_id:stateRow.client_id,count:String(connectedCount)});
  }catch(error){
    return go({social:"error",message:error instanceof Error?error.message:"Unexpected error"});
  }
});