const byId = id => document.getElementById(id);
const key = window.TRUSTLEDGER_CLERK_PUBLISHABLE_KEY || '';
const signedArea = byId('staff-area');
const signCard = byId('login-card');
const status = byId('status');
let clerk = null;
let facilities = [];
let active = '';
let signInMounted = false;

const setStatus = message => {status.textContent = message;};
function script(src) {
  return new Promise((resolve,reject)=>{
    const element=document.createElement('script');
    element.src=src;element.async=true;element.crossOrigin='anonymous';
    element.onload=resolve;element.onerror=()=>reject(new Error('Authentication services could not load'));
    document.head.appendChild(element);
  });
}
async function clerkSetup() {
  if(!/^pk_(test|live)_[A-Za-z0-9_-]+$/.test(key)){
    setStatus('Staff authentication is not connected yet. The application administrator must configure its Clerk publishable key.');
    return;
  }
  let host;
  try {
    const encoded=key.replace(/^pk_(?:test|live)_/,'');
    host=atob(encoded).replace(/\$$/,'');
    if(!/^[a-z0-9.-]+$/i.test(host)||!host.includes('.')||host==='localhost')throw Error();
  }catch{
    setStatus('Authentication key is invalid. Please contact the administrator.');
    return;
  }
  try {
    await script('https://'+host+'/npm/@clerk/ui@1/dist/ui.browser.js');
    await script('https://'+host+'/npm/@clerk/clerk-js@6/dist/clerk.browser.js');
    clerk=window.Clerk;
    if(!clerk)throw Error('Clerk failed to start');
    await clerk.load({ui:{ClerkUI:window.__internal_ClerkUICtor}});
    clerk.addListener(()=>renderAuth());
    await renderAuth();
  }catch {
    setStatus('Unable to initialize staff sign-in. Try again or contact the administrator.');
  }
}
let lastUserId=null;
async function renderAuth() {
  if(!clerk)return;
  if(!clerk.session||!clerk.user) {
    lastUserId=null;
    signedArea.hidden=true;
    signCard.hidden=false;
    setStatus('Sign in to your authorized TrustLedger staff account.');
    const mount=byId('sign-in');
    if(!signInMounted){mount.replaceChildren();clerk.mountSignIn(mount);signInMounted=true;}
    return;
  }
  signCard.hidden=true;
  if(signInMounted) { try {clerk.unmountSignIn(byId('sign-in'));} catch {} signInMounted=false; }
  signedArea.hidden=false;
  byId('staff-name').textContent=clerk.user.fullName||clerk.user.firstName||'Staff member';
  if(lastUserId!==clerk.user.id) {
    lastUserId=clerk.user.id;
    await loadSession();
  }
}
async function apiRequest(path,method='GET',body=null) {
  const token=await clerk?.session?.getToken();
  if(!token)throw Error('Session expired. Sign in again.');
  const response=await fetch(path,{
    method,
    headers:{'Authorization':'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Request failed');
  return data;
}
async function loadSession() {
  try {
    const session=await apiRequest('/api/session');
    facilities=session.facilities||[];
    byId('staff-description').textContent='Secure session • Facility permissions verified by server';
    byId('staff-id').textContent=session.user_id||'';
    byId('no-access').hidden=facilities.length>0;
    byId('authorized').hidden=!facilities.length;
    if(!facilities.length)return;
    const select=byId('facility');
    select.replaceChildren();
    facilities.forEach(item=>{
      const option=document.createElement('option');
      option.value=item.id;
      option.textContent=item.display_name+' · '+item.role;
      select.appendChild(option);
    });
    active=facilities.some(f=>f.id===active)?active:facilities[0].id;
    select.value=active;
    const role=facilities.find(f=>f.id===active)?.role;
    byId('report-form').hidden=role==='reviewer';
    byId('report-status').textContent=role==='reviewer'?'Reviewers cannot submit worker reports in this workspace.':'';
    await loadIncidents();
  }catch(e){
    byId('no-access').hidden=false;
    byId('authorized').hidden=true;
    byId('staff-description').textContent=e.message;
    byId('staff-id').textContent=clerk?.user?.id||'';
  }
}
async function loadIncidents() {
  byId('queue-status').textContent='Loading incidents…';
  const list=byId('incidents-list');list.replaceChildren();
  try {
    const {incidents}=await apiRequest('/api/incidents?facility='+encodeURIComponent(active));
    byId('queue-status').textContent=incidents.length?incidents.length+' incident(s) in this facility.':'No incidents yet. New staff reports and detected records will appear here.';
    for(const incident of incidents) {
      const item=document.createElement('article');
      item.className='incident';
      const h=document.createElement('h3');h.textContent=incident.title;
      const detail=document.createElement('p');detail.textContent=incident.category.replaceAll('_',' ')+' · '+incident.status+' · '+incident.origin;
      const when=document.createElement('small');when.textContent=new Date(incident.created_at).toLocaleString();
      item.append(h,detail,when);list.appendChild(item);
    }
  }catch(e){byId('queue-status').textContent=e.message;}
}
byId('facility').addEventListener('change',event=>{active=event.target.value;loadSession();});
byId('refresh-access').addEventListener('click',loadSession);
byId('refresh-incidents').addEventListener('click',loadIncidents);
byId('sign-out').addEventListener('click',async()=>{await clerk?.signOut();location.reload();});
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
  const tab=button.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===button));
  byId('incidents-panel').hidden=tab!=='incidents';
  byId('report-panel').hidden=tab!=='report';
}));
byId('report-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const report={
    category:form.elements.namedItem('category').value,
    title:form.elements.namedItem('title').value,
    description:form.elements.namedItem('description').value
  };
  const button=form.querySelector('button[type="submit"]');
  button.disabled=true;
  try {
    await apiRequest('/api/incidents?facility='+encodeURIComponent(active),'POST',report);
    form.reset();
    byId('report-status').textContent='Report saved to the shared facility database.';
    document.querySelector('[data-tab="incidents"]').click();
    await loadIncidents();
  }catch(e){byId('report-status').textContent=e.message;}
  finally{button.disabled=false;}
});
clerkSetup();
