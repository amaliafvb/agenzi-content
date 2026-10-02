import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json"}});
function extractText(body:any){if(typeof body?.output_text==="string")return body.output_text;const out=Array.isArray(body?.output)?body.output:[];const chunks:string[]=[];for(const item of out)for(const c of item?.content||[])if(typeof c?.text==="string")chunks.push(c.text);return chunks.join("\n").trim()}
Deno.serve(async(req)=>{
if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
try{
const token=(req.headers.get("Authorization")||"").replace("Bearer ","");
if(!token)return json({error:"Unauthorized"},401);
const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const authUser=(await supabase.auth.getUser(token)).data.user;
if(!authUser)return json({error:"Unauthorized"},401);
const me=(await supabase.from("profiles").select("id,role,active").eq("id",authUser.id).single()).data;
if(!me?.active||!["admin","strategist"].includes(me.role))return json({error:"Only Admin/Strategist can use the AI Agent."},403);
const body=await req.json();
const clientId=String(body.client_id||"");
if(!clientId)return json({error:"client_id is required"},400);
const client=(await supabase.from("clients").select("id,name").eq("id",clientId).single()).data;
if(!client)return json({error:"Client not found"},404);
const mode=String(body.mode||"agent");
const message=String(body.message||"");
const history=Array.isArray(body.history)?body.history.slice(-12):[];
const content=Array.isArray(body.content)?body.content.slice(0,80):[];
const metrics=body.metrics||{};
const image=typeof body.image==="string"?body.image:null;
const modeGuide={agent:"Act as an agency AI strategist: diagnose the request, use data, and return practical next steps.",ideas:"Generate content ideas, hooks, angles, formats, and scripts based on evidence from the account.",strategy:"Build a practical monthly social strategy from observed patterns, audience signals, and performance data.",metrics:"Extract visible social-media metrics from the uploaded screenshot when present; do not invent missing numbers. Return a clean metric table and note uncertain readings."}[mode]||"Act as an agency AI strategist.";
const context=JSON.stringify({client:client.name,mode,metrics,content});
const system="You are AGENZI AI, an internal AI agent for a social media agency. Respond in Indonesian unless the user writes in English. Be practical and concise. Never invent metrics. Separate observed data from recommendations. Use headings and bullets when helpful. "+modeGuide+"\\n\\nWorkspace data:\\n"+context;
const input:any[]=[{role:"system",content:system},...history.map((m:any)=>({role:m.role==="assistant"?"assistant":"user",content:String(m.content||"")}))];
if(image){input.push({role:"user",content:[{type:"input_text",text:message||"Baca screenshot ini dan ekstrak metrics yang terlihat."},{type:"input_image",image_url:image}]})}else{input.push({role:"user",content:message||"Tolong analisis data client ini."})}
const apiKey=Deno.env.get("OPENAI_API_KEY");
if(!apiKey)return json({error:"OPENAI_API_KEY belum diset di Supabase Edge Function Secrets."},503);
const model=Deno.env.get("OPENAI_MODEL")||"gpt-5";
const openaiRes=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({model,store:false,input})});
const openaiBody=await openaiRes.json();
if(!openaiRes.ok)return json({error:"OpenAI request failed",details:openaiBody},502);
const answer=extractText(openaiBody);
if(!answer)return json({error:"AI returned an empty response."},502);
return json({ok:true,answer,mode,client:client.name});
}catch(error){return json({error:error instanceof Error?error.message:"Unexpected error"},500)}});