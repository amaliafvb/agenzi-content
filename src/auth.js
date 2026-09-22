import{supabase,isConfigured,usernameToEmail}from './supabase.js';
export const state={user:null,profile:null};
export async function signIn(username,password){if(!isConfigured)throw new Error('Supabase belum dikonfigurasi. Isi config.js.');const{data,error}=await supabase.auth.signInWithPassword({email:usernameToEmail(username),password});if(error)throw error;state.user=data.user;await loadProfile();return state;}
export async function loadSession(){if(!supabase)return state;const{data}=await supabase.auth.getSession();state.user=data.session?.user||null;if(state.user)await loadProfile();return state;}
export async function loadProfile(){const{data,error}=await supabase.from('profiles').select('id,username,full_name,role,active').eq('id',state.user.id).single();if(error)throw error;if(!data.active){await signOut();throw new Error('Akun ini tidak aktif.');}state.profile=data;return data;}
export async function signOut(){if(supabase)await supabase.auth.signOut();state.user=null;state.profile=null;}
export const isAdmin=()=>state.profile?.role==='admin';
export const isStrategist=()=>state.profile?.role==='strategist';
export const canManageClients=()=>['admin','strategist'].includes(state.profile?.role);
export const canManageTeam=()=>isAdmin();