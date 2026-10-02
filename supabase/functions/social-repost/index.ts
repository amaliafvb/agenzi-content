import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json"}});
async function tokenFor(admin:any,id:string){const x=(await admin.rpc("get_social_tokens",{p_social_account_id:id})).data?.[0];return x?.access_token||null}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 try{
  const token=(req.headers.get("Authorization")||"").replace("Bearer ","");if(!token)return json({error:"Unauthorized"},401);
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const authUser=(await admin.auth.getUser(token)).data.user;if(!authUser)return json({error:"Unauthorized"},401);
  const me=(await admin.from("profiles").select("id,role,active").eq("id",authUser.id).single()).data;
  if(!me?.active||!["admin","strategist"].includes(me.role))return json({error:"Only Admin/Strategist can publish repost jobs."},403);
  const body=await req.json();const jobId=String(body.repost_job_id||"");if(!jobId)return json({error:"repost_job_id is required"},400);
  const job=(await admin.from("repost_jobs").select("*,social_post_imports(*),social_accounts:target_social_account_id(id,client_id,platform,account_name,external_account_id,status,metadata)").eq("id",jobId).single()).data;
  if(!job)return json({error:"Repost job not found"},404);
  if(!job.rights_confirmed)return json({error:"Konfirmasi hak/izin penggunaan konten sebelum repost."},400);
  if(!job.target_social_account_id||job.social_accounts?.status!=="connected")return json({error:"Target social account belum terhubung."},400);
  const access=await tokenFor(admin,job.target_social_account_id);if(!access)return json({error:"Token target tidak tersedia."},400);
  const source=job.social_post_imports||{};const asset=job.source_asset_url||source.media_url;
  if(!asset)return json({error:"Media asset URL belum tersedia. Upload asset terlebih dahulu untuk repost."},400);
  await admin.from("repost_jobs").update({status:"publishing",error_message:null,updated_at:new Date().toISOString()}).eq("id",jobId);
  let publish:any=null;let externalId=null;let publishedUrl=null;
  if(job.target_platform==="instagram"){
    const version=Deno.env.get("META_GRAPH_VERSION")||"v26.0";const igId=job.social_accounts.external_account_id;const isVideo=(source.media_type||"").toLowerCase().includes("video")||source.media_type==="REELS";
    const params:any={caption:job.caption||source.caption||"",access_token:access};
    if(isVideo){params.media_type="REELS";params.video_url=asset}else{params.image_url=asset}
    const createUrl="https://graph.facebook.com/"+version+"/"+igId+"/media";
    const createRes=await fetch(createUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(params)});const createBody=await createRes.json();
    if(!createRes.ok||!createBody.id)throw new Error("Instagram media container gagal: "+JSON.stringify(createBody));
    const pubRes=await fetch("https://graph.facebook.com/"+version+"/"+igId+"/media_publish?creation_id="+encodeURIComponent(createBody.id)+"&access_token="+encodeURIComponent(access),{method:"POST"});
    publish=await pubRes.json();if(!pubRes.ok||!publish.id)throw new Error("Instagram publish gagal: "+JSON.stringify(publish));
    externalId=publish.id;
  }else if(job.target_platform==="facebook"){
    const version=Deno.env.get("META_GRAPH_VERSION")||"v26.0";const pageId=job.social_accounts.external_account_id;const isVideo=(source.media_type||"").toLowerCase().includes("video");
    if(isVideo){
      const r=await fetch("https://graph.facebook.com/"+version+"/"+pageId+"/videos",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({file_url:asset,description:job.caption||source.caption||"",access_token:access})});
      publish=await r.json();if(!r.ok||!publish.id)throw new Error("Facebook video publish gagal: "+JSON.stringify(publish));
    }else{
      const r=await fetch("https://graph.facebook.com/"+version+"/"+pageId+"/photos",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({url:asset,caption:job.caption||source.caption||"",access_token:access})});
      publish=await r.json();if(!r.ok||!publish.id)throw new Error("Facebook photo publish gagal: "+JSON.stringify(publish));
    }
    externalId=publish.id;
  }else{
    if(!/^https:\/\//i.test(asset))return json({error:"TikTok membutuhkan HTTPS asset URL."},400);
    const creator=await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/",{method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json"}});
    const creatorBody=await creator.json();if(!creator.ok)throw new Error("TikTok creator info gagal: "+JSON.stringify(creatorBody));
    const privacy=creatorBody.data?.privacy_level_options?.includes("PUBLIC_TO_EVERYONE")?"PUBLIC_TO_EVERYONE":"SELF_ONLY";
    const initBody={post_info:{title:job.caption||source.caption||"",privacy_level:privacy},source_info:{source:"PULL_FROM_URL",video_url:asset}};
    const init=await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/",{method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json;charset=UTF-8"},body:JSON.stringify(initBody)});
    publish=await init.json();if(!init.ok||!publish.data?.publish_id)throw new Error("TikTok direct post gagal: "+JSON.stringify(publish));
    externalId=publish.data.publish_id;
    return json({ok:true,status:"published",external_publish_id:externalId,note:"TikTok may require app audit and user-facing publish flow depending on app status."});
  }
  await admin.from("repost_jobs").update({status:"published",external_publish_id:externalId,published_url:publishedUrl,error_message:null,updated_at:new Date().toISOString()}).eq("id",jobId);
  return json({ok:true,status:"published",external_publish_id:externalId,published_url:publishedUrl});
 }catch(error){
  const msg=error instanceof Error?error.message:"Unexpected error";
  try{const body=await new Request(req).json();if(body?.repost_job_id){const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);await admin.from("repost_jobs").update({status:"error",error_message:msg,updated_at:new Date().toISOString()}).eq("id",body.repost_job_id)}}catch{}
  return json({error:msg},500);
 }
});