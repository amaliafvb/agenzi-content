const cfg=window.AGENZI_CONFIG||{};
export const isConfigured=Boolean(cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY&&!cfg.SUPABASE_URL.includes('YOUR_')&&!cfg.SUPABASE_PUBLISHABLE_KEY.includes('YOUR_'));
export const supabase=isConfigured&&window.supabase?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null;
export const INTERNAL_EMAIL_DOMAIN=cfg.INTERNAL_EMAIL_DOMAIN||'internal.agenzi.local';
export function usernameToEmail(username){const value=String(username||'').trim().toLowerCase();return value.includes('@')?value:`${value}@${INTERNAL_EMAIL_DOMAIN}`;}