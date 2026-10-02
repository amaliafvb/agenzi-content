import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json"}});
function hostPlatform(url:string){try{const h=new URL(url).hostname.toLowerCase();if(h.includes("instagram.com"))return"instagram";if(h.includes("facebook.com")||h==="fb.com")return"facebook";if(h.includes("tiktok.com"))return"tiktok";return null}catch{return null}}
function norm(url:string){try{const u=new URL(url);u.hash="";u.search="";return u.toString().replace(/\/$/,"")}catch{return url}}
function metric(v:any){const n=Number(v||0);return Number.isFinite(n)&&n>0?n:0}
async function aiAnalyze(text:string,data:any){
 const key=Deno.env.get("OPENAI_API_KEY"); if(!key)return"";
 const prompt="You are AGENZI AI. Analyze this imported social post using only supplied facts. Return: 1) concise performance read, 2) what likely worked, 3) what to test next, 4) 3 repost/edit recommendations. Do not invent missing metrics. Respond in Indonesian.\n\n"+JSON.stringify({post:data,url:text});
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:Deno.env.get("OPENAI_MODEL")||"gpt-5",store:false,input:prompt})});
 const b=await r.json(); if(!r.ok)return""; return typeof b.output_text==="string"?b.output_text:"";
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 try{
  const token=(req.headers.get("Authorization")||"").replace("Bearer ",""); if(!token)return json({error:"Unauthorized"},401);
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const authUser=(await admin.auth.getUser(token)).data.user;if(!authUser)return json({error:"Unauthorized"},401);
  const me=(await admin.from("profiles").select("id,role,active").eq("id",authUser.id).single()).data;
  if(!me?.active||!["admin","strategist"].includes(me.role))return json({error:"Only Admin/Strategist can import social posts."},403);
  const body=await req.json();const clientId=String(body.client_id||"");const postUrl=String(body.post_url||"").trim();
  if(!clientId||!postUrl)return json({error:"client_id and post_url are required"},400);
  const platform=hostPlatform(postUrl);if(!platform)return json({error:"Link harus Instagram, Facebook, atau TikTok."},400);
  const account=(await admin.from("social_accounts").select("id,client_id,platform,account_name,external_account_id,status,metadata").eq("client_id",clientId).eq("platform",platform).eq("status","connected").limit(1).maybeSingle()).data;
  const base={client_id:clientId,platform,post_url:postUrl,created_by:authUser.id};
  if(!account){
    const inserted=await admin.from("social_post_imports").insert({...base,import_status:"needs_connection",source:"api"}).select("*").single();
    return json({ok:true,status:"needs_connection",import:inserted.data,message:"Hubungkan akun "+platform+" dengan OAuth terlebih dahulu."});
  }
  const tok=(await admin.rpc("get_social_tokens",{p_social_account_id:account.id})).data?.[0]?.access_token;
  if(!tok)throw new Error("Token akun social tidak tersedia. Hubungkan ulang akun.");
  let data:any=null;
  if(platform==="instagram"){
    const apiVersion=Deno.env.get("META_GRAPH_VERSION")||"v26.0";const igId=account.external_account_id;
    const res=await fetch("https://graph.facebook.com/"+apiVersion+"/"+igId+"/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=100&access_token="+encodeURIComponent(tok));
    const b=await res.json();if(!res.ok)throw new Error("Instagram API gagal: "+JSON.stringify(b));
    const target=norm(postUrl);data=(b.data||[]).find((x:any)=>norm(x.permalink||"")===target);
    if(!data)return json({error:"Post Instagram tidak ditemukan di akun yang terhubung. Untuk link milik akun sendiri, pastikan post sudah terbit dan URL sesuai."},404);
  }else if(platform==="facebook"){
    const apiVersion=Deno.env.get("META_GRAPH_VERSION")||"v26.0";const pageId=account.external_account_id;
    const m=postUrl.match(/(?:story_fbid=|posts\/)(\d+)/i);const directId=m?m[1]:null;
    const fields="id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true),comments.summary(true)";
    const targetId=directId?((postUrl.match(/facebook\.com\/(\d+)/i)||[])[1]+"_"+directId):null;
    let endpoint=targetId?"https://graph.facebook.com/"+apiVersion+"/"+targetId:"https://graph.facebook.com/"+apiVersion+"/"+pageId+"/posts?fields="+encodeURIComponent(fields)+"&limit=100&access_token="+encodeURIComponent(tok);
    if(directId&&pageId)endpoint+="&access_token="+encodeURIComponent(tok)+"&fields="+encodeURIComponent(fields);
    const res=await fetch(endpoint);const b=await res.json();if(!res.ok)throw new Error("Facebook API gagal: "+JSON.stringify(b));
    data=directId?b:(b.data||[]).find((x:any)=>norm(x.permalink_url||"")===norm(postUrl));
    if(!data)return json({error:"Post Facebook tidak ditemukan di Page yang terhubung."},404);
  }else{
    const fields="id,title,video_description,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time";
    const res=await fetch("https://open.tiktokapis.com/v2/video/list/?fields="+encodeURIComponent(fields),{method:"POST",headers:{Authorization:"Bearer "+tok,"Content-Type":"application/json"},body:JSON.stringify({max_count:20})});
    const b=await res.json();if(!res.ok)throw new Error("TikTok API gagal: "+JSON.stringify(b));
    data=(b.data?.videos||[]).find((x:any)=>norm(x.share_url||"")===norm(postUrl));
    if(!data)return json({error:"Video TikTok tidak ditemukan pada video terbaru akun terhubung. Coba refresh/import lagi setelah posting terbit."},404);
  }
  const record={
   ...base,social_account_id:account.id,external_post_id:data.id,title:data.title||data.video_description||data.message||null,caption:data.caption||data.video_description||data.message||null,
   published_at:data.timestamp||data.create_time?new Date(Number(data.create_time)*1000).toISOString():data.created_time||null,
   media_type:data.media_type||"video",media_url:data.media_url||data.full_picture||null,thumbnail_url:data.thumbnail_url||data.cover_image_url||null,
   views:metric(data.view_count||data.views),likes:metric(data.like_count||data.reactions?.summary?.total_count),comments:metric(data.comment_count||data.comments_count||data.comments?.summary?.total_count),shares:metric(data.share_count||data.shares?.count),source:"api",import_status:"imported",raw_data:data
  };
  record.analysis_text=await aiAnalyze(postUrl,record);
  record.analysis_status=record.analysis_text?"done":"pending";
  const inserted=await admin.from("social_post_imports").insert(record).select("*").single();if(inserted.error)throw inserted.error;
  await admin.from("social_accounts").update({last_sync_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",account.id);
  return json({ok:true,status:"imported",import:inserted.data});
 }catch(error){return json({error:error instanceof Error?error.message:"Unexpected error"},500)}
});