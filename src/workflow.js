import { supabase } from './supabase.js';
import { state } from './auth.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmt = v => Number(v || 0).toLocaleString('id-ID');
const role = () => state.profile?.role || '';
const manager = () => ['admin','strategist'].includes(role());
const clientEditor = () => ['admin','strategist','pic','smm'].includes(role());
const el = (root, selector) => root.querySelector(selector);
const statusBadge = value => '<span class="badge '+(['approved','completed','won'].includes(value)?'ok':['submitted','running','proposal'].includes(value)?'wait':'neutral')+'">'+esc(value)+'</span>';
const date = value => value ? new Date(value+'T00:00:00').toLocaleDateString('id-ID') : '-';
const toast = (message, type='success') => { const node=document.createElement('div'); node.className='toast '+type; node.textContent=message; document.querySelector('#toastRoot')?.append(node); setTimeout(()=>node.remove(),3000); };

async function getClients() {
  const { data, error } = await supabase.from('clients').select('id,name').eq('active',true).order('name');
  if (error) throw error;
  return data || [];
}
function clientOptions(clients, selected='') {
  return clients.map(c=>'<option value="'+c.id+'" '+(c.id===selected?'selected':'')+'>'+esc(c.name)+'</option>').join('');
}
function empty(message) { return '<div class="card"><div class="empty">'+esc(message)+'</div></div>'; }

async function projectsPage(root) {
  const [{data:projects,error:pErr}, clientsResult, {data:contents,error:cErr}] = await Promise.all([
    supabase.from('projects').select('id,client_id,name,description,status,start_date,end_date,budget,created_at,clients(name)').order('created_at',{ascending:false}),
    getClients(),
    supabase.from('content_items').select('id,title,client_id,project_id,content_date,clients(name)').order('content_date',{ascending:false}).limit(80)
  ]);
  if (pErr) throw pErr;
  if (cErr) throw cErr;
  const clients=clientsResult||[], rows=projects||[], content=contents||[];
  root.innerHTML = '<h1>Projects</h1><p class="subtitle">Kelola project per klien dan hubungkan content planner ke project yang tepat.</p>'+
    (clientEditor()?'<div class="card"><h3>Tambah Project</h3><div class="grid g4"><div class="field"><label>Client</label><select class="control" id="prClient">'+clientOptions(clients)+'</select></div><div class="field"><label>Nama Project</label><input class="control" id="prName" placeholder="Contoh: Social Media Management"></div><div class="field"><label>Mulai</label><input class="control" type="date" id="prStart"></div><div class="field"><label>Selesai</label><input class="control" type="date" id="prEnd"></div></div><div class="field"><label>Deskripsi</label><input class="control" id="prDesc" placeholder="Scope atau catatan project"></div><button class="button button-primary" id="prCreate">Simpan Project</button></div>':'')+
    '<div class="card" style="margin-top:14px"><div class="card-header"><h3>Daftar Project</h3><span class="pill">'+rows.length+' project</span></div><div class="tablewrap"><table class="table"><thead><tr><th>Project</th><th>Client</th><th>Periode</th><th>Status</th><th>Budget</th></tr></thead><tbody>'+
    (rows.map(p=>'<tr><td><b>'+esc(p.name)+'</b><div class="small muted">'+esc(p.description||'')+'</div></td><td>'+esc(p.clients?.name||'-')+'</td><td>'+date(p.start_date)+' – '+date(p.end_date)+'</td><td>'+statusBadge(p.status)+'</td><td>Rp '+fmt(p.budget)+'</td></tr>').join('')||'<tr><td colspan="5" class="empty">Belum ada project.</td></tr>')+
    '</tbody></table></div></div>'+
    (clientEditor()?'<div class="card" style="margin-top:14px"><div class="card-header"><h3>Hubungkan Content ke Project</h3><span class="small muted">Pilih project sesuai klien untuk membuka pencatatan WFH</span></div><div class="tablewrap"><table class="table"><thead><tr><th>Content</th><th>Client</th><th>Project</th></tr></thead><tbody>'+
    (content.map(c=>{const opts=rows.filter(p=>p.client_id===c.client_id).map(p=>'<option value="'+p.id+'" '+(p.id===c.project_id?'selected':'')+'>'+esc(p.name)+'</option>').join('');return '<tr><td>'+esc(c.title)+'</td><td>'+esc(c.clients?.name||'-')+'</td><td><select class="control" data-link-content="'+c.id+'"><option value="">Belum ditautkan</option>'+opts+'</select></td></tr>'}).join('')||'<tr><td colspan="3" class="empty">Belum ada content.</td></tr>')+
    '</tbody></table></div></div>':'');
  if (el(root,'#prCreate')) el(root,'#prCreate').onclick=async()=>{
    const name=el(root,'#prName').value.trim(), client_id=el(root,'#prClient').value;
    if(!name||!client_id)return toast('Client dan nama project wajib diisi.','error');
    try{const {error}=await supabase.from('projects').insert({client_id,name,description:el(root,'#prDesc').value,start_date:el(root,'#prStart').value||null,end_date:el(root,'#prEnd').value||null,created_by:state.profile.id});if(error)throw error;toast('Project berhasil dibuat.');await projectsPage(root)}catch(e){toast(e.message,'error')}
  };
  root.querySelectorAll('[data-link-content]').forEach(select=>select.onchange=async()=>{
    try{const {error}=await supabase.from('content_items').update({project_id:select.value||null,updated_by:state.profile.id}).eq('id',select.dataset.linkContent);if(error)throw error;toast('Content berhasil ditautkan ke project.')}catch(e){toast(e.message,'error')}
  });
}

async function experimentsPage(root) {
  const [{data,error}, clients]=await Promise.all([
    supabase.from('experiments').select('id,title,client_id,hypothesis,success_metric,target_value,result_value,status,start_date,end_date,conclusion,clients(name)').order('created_at',{ascending:false}),
    getClients()
  ]);
  if(error)throw error;
  const rows=data||[];
  root.innerHTML='<h1>Experiment Tracker</h1><p class="subtitle">Catat hipotesis, variabel, target, dan hasil eksperimen konten per klien.</p>'+
    (clientEditor()?'<div class="card"><h3>Eksperimen Baru</h3><div class="grid g3"><div class="field"><label>Client</label><select class="control" id="exClient">'+clientOptions(clients)+'</select></div><div class="field"><label>Nama eksperimen</label><input class="control" id="exTitle" placeholder="Contoh: Hook edukasi vs storytelling"></div><div class="field"><label>Success metric</label><input class="control" id="exMetric" placeholder="Reach, saves, CTR..."></div><div class="field"><label>Hipotesis</label><input class="control" id="exHypothesis"></div><div class="field"><label>Target</label><input class="control" type="number" id="exTarget"></div><div class="field"><label>Mulai</label><input class="control" type="date" id="exStart"></div></div><button class="button button-primary" id="exCreate">Simpan Eksperimen</button></div>':'')+
    '<div class="card" style="margin-top:14px"><div class="tablewrap"><table class="table"><thead><tr><th>Eksperimen</th><th>Client</th><th>Metric</th><th>Target / Hasil</th><th>Status</th></tr></thead><tbody>'+
    (rows.map(x=>'<tr><td><b>'+esc(x.title)+'</b><div class="small muted">'+esc(x.hypothesis||'')+'</div></td><td>'+esc(x.clients?.name||'-')+'</td><td>'+esc(x.success_metric||'-')+'</td><td>'+fmt(x.target_value)+' / '+fmt(x.result_value)+'</td><td>'+statusBadge(x.status)+'</td></tr>').join('')||'<tr><td colspan="5" class="empty">Belum ada eksperimen.</td></tr>')+
    '</tbody></table></div></div>';
  if(el(root,'#exCreate'))el(root,'#exCreate').onclick=async()=>{
    const title=el(root,'#exTitle').value.trim(),client_id=el(root,'#exClient').value;
    if(!title||!client_id)return toast('Client dan nama eksperimen wajib diisi.','error');
    try{const {error}=await supabase.from('experiments').insert({client_id,title,hypothesis:el(root,'#exHypothesis').value,success_metric:el(root,'#exMetric').value,target_value:Number(el(root,'#exTarget').value)||null,start_date:el(root,'#exStart').value||null,created_by:state.profile.id});if(error)throw error;toast('Eksperimen berhasil dibuat.');await experimentsPage(root)}catch(e){toast(e.message,'error')}
  };
}

async function leadsPage(root) {
  const [{data,error}, clients]=await Promise.all([
    supabase.from('leads').select('id,name,client_id,contact,source,status,estimated_value,owner_id,created_at,clients(name)').order('created_at',{ascending:false}),
    getClients()
  ]);
  if(error)throw error;
  const rows=data||[];
  root.innerHTML='<h1>Lead Tracker</h1><p class="subtitle">Pantau prospek, sumber lead, tahapan follow-up, dan estimasi nilai.</p>'+
    (clientEditor()?'<div class="card"><h3>Tambah Lead</h3><div class="grid g4"><div class="field"><label>Client</label><select class="control" id="ldClient">'+clientOptions(clients)+'</select></div><div class="field"><label>Nama lead</label><input class="control" id="ldName"></div><div class="field"><label>Kontak</label><input class="control" id="ldContact"></div><div class="field"><label>Sumber</label><input class="control" id="ldSource" placeholder="Instagram, Ads, WhatsApp"></div><div class="field"><label>Status</label><select class="control" id="ldStatus"><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="proposal">Proposal</option><option value="won">Won</option><option value="lost">Lost</option></select></div><div class="field"><label>Estimasi nilai (Rp)</label><input class="control" type="number" id="ldValue" min="0"></div></div><button class="button button-primary" id="ldCreate">Simpan Lead</button></div>':'')+
    '<div class="card" style="margin-top:14px"><div class="tablewrap"><table class="table"><thead><tr><th>Lead</th><th>Client</th><th>Kontak</th><th>Sumber</th><th>Status</th><th>Estimasi</th></tr></thead><tbody>'+
    (rows.map(x=>'<tr><td><b>'+esc(x.name)+'</b></td><td>'+esc(x.clients?.name||'-')+'</td><td>'+esc(x.contact||'-')+'</td><td>'+esc(x.source||'-')+'</td><td>'+statusBadge(x.status)+'</td><td>Rp '+fmt(x.estimated_value)+'</td></tr>').join('')||'<tr><td colspan="6" class="empty">Belum ada lead.</td></tr>')+
    '</tbody></table></div></div>';
  if(el(root,'#ldCreate'))el(root,'#ldCreate').onclick=async()=>{
    const name=el(root,'#ldName').value.trim(),client_id=el(root,'#ldClient').value;
    if(!name||!client_id)return toast('Client dan nama lead wajib diisi.','error');
    try{const {error}=await supabase.from('leads').insert({client_id,name,contact:el(root,'#ldContact').value,source:el(root,'#ldSource').value,status:el(root,'#ldStatus').value,estimated_value:Number(el(root,'#ldValue').value)||0,created_by:state.profile.id});if(error)throw error;toast('Lead berhasil ditambahkan.');await leadsPage(root)}catch(e){toast(e.message,'error')}
  };
}

async function competitorsPage(root) {
  const [{data,error}, clients]=await Promise.all([
    supabase.from('competitor_references').select('id,competitor_name,client_id,platform,account_url,notes,last_checked_at,clients(name)').order('created_at',{ascending:false}),
    getClients()
  ]);
  if(error)throw error;
  const rows=data||[];
  root.innerHTML='<h1>Competitor Monitoring</h1><p class="subtitle">Simpan referensi kompetitor dan catatan pemantauan untuk setiap klien.</p>'+
    (clientEditor()?'<div class="card"><h3>Tambah Kompetitor</h3><div class="grid g4"><div class="field"><label>Client</label><select class="control" id="cpClient">'+clientOptions(clients)+'</select></div><div class="field"><label>Nama kompetitor</label><input class="control" id="cpName"></div><div class="field"><label>Platform</label><select class="control" id="cpPlatform"><option>Instagram</option><option>TikTok</option><option>Facebook</option><option>YouTube</option><option>Website</option></select></div><div class="field"><label>Link akun</label><input class="control" id="cpUrl" placeholder="https://..."></div></div><div class="field"><label>Catatan</label><input class="control" id="cpNotes"></div><button class="button button-primary" id="cpCreate">Simpan Kompetitor</button></div>':'')+
    '<div class="card" style="margin-top:14px"><div class="tablewrap"><table class="table"><thead><tr><th>Kompetitor</th><th>Client</th><th>Platform</th><th>Link</th><th>Catatan</th></tr></thead><tbody>'+
    (rows.map(x=>'<tr><td><b>'+esc(x.competitor_name)+'</b></td><td>'+esc(x.clients?.name||'-')+'</td><td>'+esc(x.platform||'-')+'</td><td>'+(x.account_url?'<a href="'+esc(x.account_url)+'" target="_blank" rel="noopener">Open</a>':'-')+'</td><td>'+esc(x.notes||'-')+'</td></tr>').join('')||'<tr><td colspan="5" class="empty">Belum ada kompetitor.</td></tr>')+
    '</tbody></table></div></div>';
  if(el(root,'#cpCreate'))el(root,'#cpCreate').onclick=async()=>{
    const competitor_name=el(root,'#cpName').value.trim(),client_id=el(root,'#cpClient').value;
    if(!competitor_name||!client_id)return toast('Client dan nama kompetitor wajib diisi.','error');
    try{const {error}=await supabase.from('competitor_references').insert({client_id,competitor_name,platform:el(root,'#cpPlatform').value,account_url:el(root,'#cpUrl').value,notes:el(root,'#cpNotes').value,created_by:state.profile.id});if(error)throw error;toast('Kompetitor berhasil ditambahkan.');await competitorsPage(root)}catch(e){toast(e.message,'error')}
  };
}

async function wfhPage(root) {
  const [{data:logs,error:lErr},{data:tasks,error:tErr},{data:rules,error:rErr}] = await Promise.all([
    supabase.from('wfh_work_logs').select('id,user_id,project_id,task_id,work_date,work_type,output_type,units,description,status,fee_amount,approved_at,projects(name,clients(name)),tasks(content_items(title)),profiles:user_id(full_name,username,role)').order('created_at',{ascending:false}),
    supabase.from('tasks').select('id,assigned_to,division,status,due_date,content_items(id,title,project_id,clients(name))').order('due_date'),
    manager()?supabase.from('wfh_fee_rules').select('id,role,output_type,project_id,per_output_rate,project_fee,active,valid_from,valid_until').eq('active',true).order('role'):Promise.resolve({data:[],error:null})
  ]);
  if(lErr)throw lErr;if(tErr)throw tErr;if(rErr)throw rErr;
  const worklogs=logs||[], myTasks=(tasks||[]).filter(t=>t.assigned_to===state.profile.id&&t.content_items?.project_id);
  const total=worklogs.filter(x=>x.status==='approved').reduce((n,x)=>n+Number(x.fee_amount||0),0);
  root.innerHTML='<h1>WFH Productivity & Fees</h1><p class="subtitle">Freelancer mencatat output atau komponen project. Fee dihitung otomatis setelah disetujui.</p>'+
    '<div class="kpis"><div class="kpi"><span>Approved Fee</span><b>Rp '+fmt(total)+'</b></div><div class="kpi"><span>Submitted</span><b>'+worklogs.filter(x=>x.status==='submitted').length+'</b></div><div class="kpi"><span>Approved Logs</span><b>'+worklogs.filter(x=>x.status==='approved').length+'</b></div></div>'+
    '<div class="card" style="margin-top:14px"><h3>Submit Work Log</h3>'+(myTasks.length?'<div class="grid g4"><div class="field"><label>Assigned task</label><select class="control" id="wfTask">'+myTasks.map(t=>'<option value="'+t.id+'">'+esc(t.content_items?.title||'Task')+' · '+esc(t.content_items?.clients?.name||'')+'</option>').join('')+'</select></div><div class="field"><label>Jenis fee</label><select class="control" id="wfType"><option value="output">Per Output</option><option value="project">Komponen Project</option></select></div><div class="field"><label>Output type</label><input class="control" id="wfOutput" placeholder="Feed, Carousel, Reels, Design..."></div><div class="field"><label>Jumlah unit</label><input class="control" id="wfUnits" type="number" min="0.01" step="0.01" value="1"></div></div><div class="field"><label>Deskripsi pekerjaan</label><input class="control" id="wfDescription" placeholder="Catatan hasil kerja atau link hasil"></div><button class="button button-primary" id="wfSubmit">Kirim Work Log</button>':'<div class="empty">Belum ada task yang terhubung ke project. Minta PIC/Admin menghubungkan content ke project terlebih dahulu.</div>')+'</div>'+
    (manager()?'<div class="card" style="margin-top:14px"><h3>Atur Fee Rule</h3><div class="grid g4"><div class="field"><label>Role</label><select class="control" id="wfRuleRole">'+['editor','video_editor','pic','smm','content_creator','wfh_designer','strategist','copywriter','designer'].map(r=>'<option value="'+r+'">'+r.replaceAll('_',' ')+'</option>').join('')+'</select></div><div class="field"><label>Output type</label><input class="control" id="wfRuleOutput" placeholder="Feed / Reels / Project"></div><div class="field"><label>Rate per output (Rp)</label><input class="control" id="wfRuleRate" type="number" min="0" value="0"></div><div class="field"><label>Fee project (Rp)</label><input class="control" id="wfRuleProject" type="number" min="0" value="0"></div></div><div class="field"><label>Project khusus (opsional)</label><select class="control" id="wfRuleProjectId"><option value="">Semua project</option></select></div><button class="button" id="wfRuleSave">Simpan Fee Rule</button><div class="small muted" style="margin-top:8px">'+(rules||[]).length+' aturan fee aktif</div></div>':'')+
    '<div class="card" style="margin-top:14px"><div class="card-header"><h3>Riwayat Work Log</h3><span class="pill">'+worklogs.length+' log</span></div><div class="tablewrap"><table class="table"><thead><tr><th>Tanggal</th><th>Freelancer</th><th>Project / Task</th><th>Jenis</th><th>Unit</th><th>Status</th><th>Fee</th>'+(manager()?'<th>Review</th>':'')+'</tr></thead><tbody>'+
    (worklogs.map(x=>'<tr><td>'+date(x.work_date)+'</td><td>'+esc(x.profiles?.full_name||x.profiles?.username||'You')+'</td><td><b>'+esc(x.projects?.name||'-')+'</b><div class="small muted">'+esc(x.tasks?.content_items?.title||'')+'</div></td><td>'+esc(x.work_type)+' · '+esc(x.output_type)+'</td><td>'+fmt(x.units)+'</td><td>'+statusBadge(x.status)+'</td><td>Rp '+fmt(x.fee_amount)+'</td>'+(manager()?'<td>'+(x.status==='submitted'?'<button class="button" data-wf-approve="'+x.id+'">Approve</button> <button class="button button-ghost" data-wf-reject="'+x.id+'">Reject</button>':'-')+'</td>':'')+'</tr>').join('')||'<tr><td colspan="'+(manager()?8:7)+'" class="empty">Belum ada work log.</td></tr>')+
    '</tbody></table></div></div>';
  if(manager()) {
    const projectSelect=el(root,'#wfRuleProjectId');
    const {data:projects}=await supabase.from('projects').select('id,name').order('name');
    if(projectSelect)projectSelect.innerHTML='<option value="">Semua project</option>'+(projects||[]).map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');
  }
  if(el(root,'#wfSubmit'))el(root,'#wfSubmit').onclick=async()=>{
    const task=myTasks.find(t=>t.id===el(root,'#wfTask').value);
    const output_type=el(root,'#wfOutput').value.trim();
    if(!task||!output_type)return toast('Pilih task dan isi output type.','error');
    try{const {error}=await supabase.from('wfh_work_logs').insert({user_id:state.profile.id,project_id:task.content_items.project_id,task_id:task.id,work_date:new Date().toISOString().slice(0,10),work_type:el(root,'#wfType').value,output_type,units:Number(el(root,'#wfUnits').value)||1,description:el(root,'#wfDescription').value,status:'submitted'});if(error)throw error;toast('Work log dikirim untuk approval.');await wfhPage(root)}catch(e){toast(e.message,'error')}
  };
  if(el(root,'#wfRuleSave'))el(root,'#wfRuleSave').onclick=async()=>{
    const output_type=el(root,'#wfRuleOutput').value.trim();if(!output_type)return toast('Output type wajib diisi.','error');
    try{const {error}=await supabase.from('wfh_fee_rules').insert({role:el(root,'#wfRuleRole').value,output_type,per_output_rate:Number(el(root,'#wfRuleRate').value)||0,project_fee:Number(el(root,'#wfRuleProject').value)||0,project_id:el(root,'#wfRuleProjectId').value||null});if(error)throw error;toast('Fee rule tersimpan.');await wfhPage(root)}catch(e){toast(e.message,'error')}
  };
  root.querySelectorAll('[data-wf-approve]').forEach(b=>b.onclick=async()=>{try{const {error}=await supabase.from('wfh_work_logs').update({status:'approved'}).eq('id',b.dataset.wfApprove);if(error)throw error;toast('Work log disetujui dan fee dihitung.');await wfhPage(root)}catch(e){toast(e.message,'error')}});
  root.querySelectorAll('[data-wf-reject]').forEach(b=>b.onclick=async()=>{try{const {error}=await supabase.from('wfh_work_logs').update({status:'rejected'}).eq('id',b.dataset.wfReject);if(error)throw error;toast('Work log ditolak.');await wfhPage(root)}catch(e){toast(e.message,'error')}});
}

export async function renderWorkflow(view, root) {
  if(!supabase||!root)return;
  if(view==='projects')return projectsPage(root);
  if(view==='experiments')return experimentsPage(root);
  if(view==='leads')return leadsPage(root);
  if(view==='competitors')return competitorsPage(root);
  if(view==='wfh')return wfhPage(root);
}
