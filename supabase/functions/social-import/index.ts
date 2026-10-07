import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
function cleanToken(value:string){return String(value||"").trim().replace(/^["']|["']$/g,"").replace(/^Bearer\s+/i,"").trim()}\nconst CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json"}});
function hostPlatform(url:string){try{const h=new URL(url).hostname.toLowerCase();if(h.includes("instagram.com"))return"instagram";if(h.includes("facebook.com")||h==="fb.com")return"facebook";if(h.includes("tiktok.com"))return"tiktok";return null}catch{return null}}
function metric(...vals:any[]){for(const v of vals){const n=Number(v);if(Number.isFinite(n)&&n>=0)return n}return 0}
function first(...vals:any[]){return vals.find(v=>v!==undefined&&v!==null&&v!=="")??null}
function engagementRate(m:any,followers:number,views:number){const total=metric(m.likes,m.like_count)+metric(m.comments,m.comment_count,m.comment_count)+metric(m.shares,m.share_count)+metric(m.saves,m.save_count,m.favorite_count,m.favorites_count)+metric(m.reposts,m.repost_count);const base=followers>0?followers:(views>0?views:0);return base?Number((total/base*100).toFixed(4)):0}
async function aiAnalyze(text:string,data:any,imageUrl:string|null){
 const key=Deno.env.get("OPENAI_API_KEY");if(!key)return"";
 const basePrompt="You are AGENZI AI, a senior social media strategist. Analyze this post using only supplied facts. Return: Executive Insight, What Worked, What to Improve, and 3 concrete content ideas based on the post. Mention the exact metrics and explain engagement patterns. Never invent numbers. Respond in Indonesian.";
 const input:any[]=[{role:"system",content:basePrompt},{role:"user",content:messageBlock(text,data)}];
 if(imageUrl) input[1].content=[{type:"input_text",text:messageBlock(text,data)},{type:"input_image",image_url:imageUrl}];
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:Deno.env.get("OPENAI_MODEL")||"gpt-5",store:false,input})});
 const b=await r.json();if(!r.ok)return"";return typeof b.output_text==="string"?b.output_text:"";
}
function messageBlock(url:string,data:any){return "Post URL: "+url+"\n\nStructured data:\n"+JSON.stringify(data);}
async function runApify(actor:string,input:any){
 const token=cleanToken(Deno.env.get("APIFY_API_TOKEN")||"");if(!token)return null;
 const endpoint="https://api.apify.com/v2/acts/"+actor+"/run-sync-get-dataset-items?token="+encodeURIComponent(token);
 const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(input)});
 const b=await r.json();
 if(!r.ok)throw new Error("Apify gagal: "+JSON.stringify(b));
 return Array.isArray(b)?b:(Array.isArray(b?.data)?b.data:[]);
}
function apifyActor(platform:string){
 return platform==="instagram"?(Deno.env.get("APIFY_INSTAGRAM_ACTOR")||"data-slayer~instagram-post-details"):
 platform==="tiktok"?(Deno.env.get("APIFY_TIKTOK_ACTOR")||"a.actors~tiktok-post-data"):
 (Deno.env.get("APIFY_FACEBOOK_ACTOR")||"parsebird~facebook-user-posts-scraper");
}
function normalizeApify(platform:string,item:any,url:string){
 const e=item?.engagement||{};
 const followers=metric(item?.author?.followers,item?.followers,item?.creator?.followers);
 const views=metric(item?.views,item?.view_count,item?.play_count,e.viewCount,e.views);
 const likes=metric(item?.likes,item?.like_count,e.likeCount,e.likes,item?.reactionsCount,item?.reaction_count,e.reactionCount);
 const comments=metric(item?.comments,item?.comment_count,item?.commentsCount,e.commentCount,e.comments);
 const shares=metric(item?.shares,item?.share_count,item?.sharesCount,e.shareCount,e.shares);
 const saves=metric(item?.saves,item?.save_count,item?.favorite_count,item?.favorites_count);
 const reposts=metric(item?.reposts,item?.repost_count,item?.repostCount);
 const createdAt=first(item?.postedAt,item?.posted_at,item?.createdAt,item?.timestamp,item?.createTime,item?.create_time);
 return {
   external_post_id:first(item?.id,item?.postId,item?.videoId,item?.itemId,item?.shortcode),
   author_handle:first(item?.ownerUsername,item?.author?.username,item?.author?.name,item?.authorName,item?.username),
   title:first(item?.title,item?.caption,item?.text,item?.postText,item?.video_description),
   caption:first(item?.caption,item?.text,item?.postText,item?.video_description,item?.description),
   published_at:createdAt,
   media_type:first(item?.type,item?.postType,item?.media_type,item?.mediaType),
   media_url:first(item?.videoUrl,item?.video_url,item?.mediaUrl,item?.displayUrl,item?.media?.[0]?.url,item?.attachments?.[0]?.url,item?.full_picture),
   thumbnail_url:first(item?.thumbnailUrl,item?.thumbnail_url,item?.cover_image_url,item?.coverUrl,item?.displayUrl,item?.media?.[0]?.thumbnailUrl),
   views,reach:metric(item?.reach,e.reach),likes,comments,shares,saves,reposts,followers
 };
}
async function persistImported(admin:any,record:any,contentId:string|null){
 const inserted=await admin.from("social_post_imports").insert(record).select("*").single();
 if(inserted.error)throw inserted.error;
 if(contentId){
   const m=record;
   const perf={content_id:contentId,views:metric(m.views),reach:metric(m.reach),likes:metric(m.likes),comments:metric(m.comments),shares:metric(m.shares),saves:metric(m.saves),clicks:metric(m.clicks),leads:0,updated_at:new Date().toISOString()};
   const pr=await admin.from("performance_metrics").upsert(perf,{onConflict:"content_id"});
   if(pr.error)throw pr.error;
 }
 return inserted.data;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 try{
  const token=(req.headers.get("Authorization")||"").replace("Bearer ","");if(!token)return json({error:"Unauthorized"},401);
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const authUser=(await admin.auth.getUser(token)).data.user;if(!authUser)return json({error:"Unauthorized"},401);
  const me=(await admin.from("profiles").select("id,role,active").eq("id",authUser.id).single()).data;
  if(!me?.active||!["admin","strategist"].includes(me.role))return json({error:"Only Admin/Strategist can import social posts."},403);

  const body=await req.json();const clientId=String(body.client_id||"");const contentId=String(body.content_id||"")||null;const postUrl=String(body.post_url||"").trim();
  if(!clientId||!postUrl)return json({error:"client_id and post_url are required"},400);
  const platform=hostPlatform(postUrl);if(!platform)return json({error:"Link harus Instagram, Facebook, atau TikTok."},400);
  const base={client_id:clientId,content_id:contentId,platform,post_url:postUrl,created_by:authUser.id};

  // Primary source: Apify public-post extraction from the exact URL.
  if(!Deno.env.get("APIFY_API_TOKEN"))return json({error:"APIFY_API_TOKEN belum dipasang di Supabase → Edge Functions → Secrets. Tambahkan token Apify untuk mengaktifkan Pull Metrics dari link.",code:"APIFY_NOT_CONFIGURED"},503);
  if(Deno.env.get("APIFY_API_TOKEN")){
    const actor=apifyActor(platform);
    const input=platform==="facebook"?{findPostsBy:"postUrls",postUrls:[postUrl]}:{postUrls:[postUrl]};
    const items=await runApify(actor,input);
    const item=items[0];
    if(item){
      const n=normalizeApify(platform,item);
      const er=engagementRate(n,n.followers,n.views);
      const record:any={...base,social_account_id:null,...n,engagement_rate:er,source:"apify",import_status:"imported",raw_data:item};
      record.analysis_text=await aiAnalyze(postUrl,{platform,...n,engagement_rate:er},n.thumbnail_url);
      record.analysis_status=record.analysis_text?"done":"pending";
      const inserted=await admin.from("social_post_imports").insert(record).select("*").single();if(inserted.error)throw inserted.error;
      return json({ok:true,status:"imported",source:"apify",import:inserted.data});
    }
  }

  // Fallback: official OAuth API for connected accounts.
  const account=(await admin.from("social_accounts").select("id,client_id,platform,account_name,external_account_id,status,metadata").eq("client_id",clientId).eq("platform",platform).eq("status","connected").limit(1).maybeSingle()).data;
  if(!account)return json({error:"Link belum menghasilkan data. Pastikan postingan publik dan URL tepat. Bila platform membatasi data publik, hubungkan akun resmi melalui OAuth.",code:"POST_NOT_READABLE"},404);
  const tok=(await admin.rpc("get_social_tokens",{p_social_account_id:account.id})).data?.[0]?.access_token;if(!tok)throw new Error("Token akun social tidak tersedia. Hubungkan ulang akun.");
  let data:any=null;
  if(platform==="instagram"){
    const apiVersion=Deno.env.get("META_GRAPH_VERSION")||"v26.0";const igId=account.external_account_id;
    const res=await fetch("https://graph.facebook.com/"+apiVersion+"/"+igId+"/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=100&access_token="+encodeURIComponent(tok));
    const b=await res.json();if(!res.ok)throw new Error("Instagram API gagal: "+JSON.stringify(b));data=(b.data||[]).find((x:any)=>new URL(x.permalink).toString().replace(/\/$/,"")===new URL(postUrl).toString().replace(/\/$/,""));
  }else if(platform==="facebook"){
    const apiVersion=Deno.env.get("META_GRAPH_VERSION")||"v26.0";const pageId=account.external_account_id;const fields="id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true),comments.summary(true)";
    const res=await fetch("https://graph.facebook.com/"+apiVersion+"/"+pageId+"/posts?fields="+encodeURIComponent(fields)+"&limit=100&access_token="+encodeURIComponent(tok));const b=await res.json();if(!res.ok)throw new Error("Facebook API gagal: "+JSON.stringify(b));data=(b.data||[]).find((x:any)=>x.permalink_url===postUrl);
  }else{
    const fields="id,title,video_description,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time";
    const res=await fetch("https://open.tiktokapis.com/v2/video/list/?fields="+encodeURIComponent(fields),{method:"POST",headers:{Authorization:"Bearer "+tok,"Content-Type":"application/json"},body:JSON.stringify({max_count:20})});const b=await res.json();if(!res.ok)throw new Error("TikTok API gagal: "+JSON.stringify(b));data=(b.data?.videos||[]).find((x:any)=>x.share_url===postUrl);
  }
  if(!data)return json({error:"Post tidak ditemukan pada akun terhubung."},404);
  const n=normalizeApify(platform,data,postUrl);const er=engagementRate(n,n.followers,n.views);
  const record:any={...base,social_account_id:account.id,...n,engagement_rate:er,source:"official_api",import_status:"imported",raw_data:data};
  record.analysis_text=await aiAnalyze(postUrl,{platform,...n,engagement_rate:er},n.thumbnail_url||n.media_url);record.analysis_status=record.analysis_text?"done":"pending";
  const inserted=await admin.from("social_post_imports").insert(record).select("*").single();if(inserted.error)throw inserted.error;
  await admin.from("social_accounts").update({last_sync_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",account.id);
  return json({ok:true,status:"imported",source:"official_api",import:inserted.data});
 }catch(error){return json({error:error instanceof Error?error.message:"Unexpected error"},500)}
});