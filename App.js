/**
 * ═══════════════════════════════════════════════════════════════
 *  RAGHUVIR SWEETS AND BAKERS — app.js
 *
 *  ✅ Staff login: type Email OR Name + Password
 *  ✅ Session never expires — stays logged in until manual logout
 *  ✅ Page refresh / app reopen → stays logged in automatically
 *  ✅ Password changed in Sheet → auto syncs every 5 seconds
 *  ✅ All data from Google Sheets, syncs every 5 seconds
 *  ✅ Excel export (5 types)
 *  ✅ PWA install support
 *
 *  Admin → admin@raghuvir.com / Admin@123 (hidden link on login)
 *  Staff → Register → then login with Name + Password
 * ═══════════════════════════════════════════════════════════════
 */
"use strict";

/* ══════════════════════════════════════════════════════════════
   🔗 STEP 1: PASTE YOUR APPS SCRIPT URL HERE
══════════════════════════════════════════════════════════════ */
const API_URL = "https://script.google.com/macros/s/AKfycbywfjsKdUhdnh1ul7j6m5hGK96m1oFvpo6N9BVHIGp1U02vNodWiPN9cSFoFtSiwlh8/exec";

/* ══════════════════════════════════════════════════════════════
   🖼️  STEP 2: BRAND LOGO URL
   To change the logo, update the URL below.

   For Google Drive:
   1. Upload logo to Google Drive
   2. Right-click → Share → "Anyone with the link" → Copy link
   3. Get the file ID from the link (the long code between /d/ and /view)
   4. Use this format: https://drive.google.com/thumbnail?id=FILE_ID&sz=w400

   For Imgur:
   Upload to imgur.com → right-click image → Copy image address
══════════════════════════════════════════════════════════════ */
const BRAND_LOGO_URL = "https://drive.google.com/thumbnail?id=18aiuiSN9uj-mJtOkGB1rNt4GP6yUbvuO&sz=w400";

/* ══ ADMIN ══ */
const ADMIN = {
  id:"admin_rsb", name:"Admin",
  email:"admin@raghuvir.com", password:"Admin@123", role:"admin"
};

/* ══════════════════════════════════════════════════════════════
   API LAYER
══════════════════════════════════════════════════════════════ */
async function api(action, params={}) {
  if(API_URL==="YOUR_APPS_SCRIPT_WEB_APP_URL") throw new Error("API_URL not configured");
  const url=new URL(API_URL);
  url.searchParams.set("action",action);
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,typeof v==="object"?JSON.stringify(v):v));
  const res=await fetch(url.toString(),{method:"GET"});
  const json=await res.json();
  if(!json.ok) throw new Error(json.error||"API error");
  return json.data;
}

const API={
  getUsers:      ()       => api("getUsers"),
  getUserByName: (name)   => api("getUserByName",  {name}),
  getUserByEmail:(email)  => api("getUserByEmail", {email}),
  getUserById:   (id)     => api("getUserById",    {id}),
  addUser:       (user)   => api("addUser",        {user}),
  removeUser:    (id)     => api("removeUser",     {id}),
  getTasks:      ()       => api("getTasks"),
  addTask:       (task)   => api("addTask",        {task}),
  updateTask:    (id,ch)  => api("updateTask",     {id,changes:ch}),
  removeTask:    (id)     => api("removeTask",     {id}),
};

/* ══ CACHE ══ */
let _allDoers=[], _allTasks=[];

/* ══════════════════════════════════════════════════════════════
   SESSION — Persistent localStorage
   Never auto-clears. Only doLogout() clears it.
══════════════════════════════════════════════════════════════ */
const KS="rsb_sess_v2";
const Session={
  get()   { try{return JSON.parse(localStorage.getItem(KS))}catch{return null} },
  save(u) { localStorage.setItem(KS,JSON.stringify(u)) },
  clear() { localStorage.removeItem(KS) },
};

/* ══ UTILITIES ══ */
const uid =(p="x")=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const ini =(n="")=>n.trim().split(/\s+/).map(w=>w[0]||"").join("").toUpperCase().slice(0,2)||"?";
const esc =(s="")=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const $   =id=>document.getElementById(id);
const $$  =s=>document.querySelectorAll(s);

function fmtDT(iso){if(!iso)return"—";return new Date(iso).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true})}
function fmtD(iso){if(!iso)return"—";return new Date(iso).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
function fmtT(iso){if(!iso)return"—";return new Date(iso).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true})}
function fmtDur(s,e){if(!s||!e)return"—";const ms=new Date(e)-new Date(s);if(ms<0)return"—";const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000);return h>0?`${h}h ${m}m`:`${m}m`}

function dlInfo(iso){
  if(!iso)return{text:"—",cls:""};
  const diff=new Date(iso)-new Date(),text=fmtDT(iso);
  if(diff<0)return{text,cls:"ov",tag:"Overdue"};
  if(diff<3_600_000)return{text,cls:"soon",tag:"Due soon"};
  return{text,cls:"",tag:""};
}
function sPill(s){return({pending:`<span class="sp pending"><i class="fas fa-circle" style="font-size:.4rem"></i> Pending</span>`,inprogress:`<span class="sp inprogress"><i class="fas fa-spinner fa-spin" style="font-size:.55rem"></i> In Progress</span>`,done:`<span class="sp done"><i class="fas fa-check" style="font-size:.5rem"></i> Done</span>`}[s]||`<span class="sp pending">Pending</span>`)}
function pPill(p){return({urgent:`<span class="pp urgent"><i class="fas fa-fire"></i> Urgent</span>`,high:`<span class="pp high"><i class="fas fa-arrow-up"></i> High</span>`,normal:`<span class="pp normal">Normal</span>`}[p]||`<span class="pp normal">Normal</span>`)}

function showScreen(id){$$(".screen").forEach(s=>s.classList.remove("active"));$(id).classList.add("active")}

/* Toast */
const TICO={ok:"fas fa-circle-check",err:"fas fa-circle-xmark",info:"fas fa-circle-info",warn:"fas fa-triangle-exclamation"};
function toast(msg,type="info",ms=3200){
  const el=document.createElement("div");el.className=`toast ${type}`;
  el.innerHTML=`<i class="${TICO[type]||TICO.info}"></i><span>${msg}</span>`;
  $("toasts").appendChild(el);
  setTimeout(()=>{el.classList.add("out");setTimeout(()=>el.remove(),250)},ms);
}

/* Loading */
function showLoading(msg="Loading…"){
  let el=$("rsb-loading");
  if(!el){
    el=document.createElement("div");el.id="rsb-loading";
    el.style.cssText="position:fixed;inset:0;background:rgba(245,240,234,.93);backdrop-filter:blur(4px);z-index:8888;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:'DM Sans',sans-serif;color:#7a5c4a;font-size:.9rem";
    el.innerHTML=`<div style="width:36px;height:36px;border:3px solid #e8ddd4;border-top-color:#c0392b;border-radius:50%;animation:spin .7s linear infinite"></div><span>${msg}</span>`;
    document.body.appendChild(el);
    if(!document.getElementById("rsb-spin-k")){const st=document.createElement("style");st.id="rsb-spin-k";st.textContent="@keyframes spin{to{transform:rotate(360deg)}}";document.head.appendChild(st);}
  }else{el.querySelector("span").textContent=msg;el.style.display="flex";}
}
function hideLoading(){const el=$("rsb-loading");if(el)el.style.display="none";}

/* ══════════════════════════════════════════════════════════════
   LOGO — apply brand logo everywhere in the UI
══════════════════════════════════════════════════════════════ */
function applyLogo(){
  const url = BRAND_LOGO_URL.trim();

  // Helper — set element to show logo image or fallback icon
  function setLogo(id, opts={}){
    const el=$(id); if(!el)return;
    if(url){
      el.style.background = opts.bg || "transparent";
      el.style.borderRadius = opts.r || "0";
      el.innerHTML = `<img src="${url}" alt="Raghuvir"
        style="width:100%;height:100%;object-fit:${opts.fit||"contain"};
        border-radius:${opts.r||"0"};padding:${opts.pad||"0"}"
        onerror="this.parentElement.innerHTML='<i class=\\'fas fa-store-alt\\'></i>'"
      />`;
    }
    // If no URL — leave the default icon already in HTML
  }

  // Left login panel logo
  const ll=$("ll-logo");
  if(ll && url){
    ll.classList.add("has-logo");
    ll.innerHTML=`<img src="${url}" alt="Raghuvir Sweets"
      style="max-width:240px;max-height:120px;object-fit:contain;display:block"
      onerror="this.parentElement.innerHTML='<i class=\'fas fa-store-alt\'></i>'"
    />`;
    // Hide text brand name — logo replaces it
    const bt=$("ll-brand-text");
    if(bt) bt.style.display="none";
  }
  // Sidebar title — update if logo shown
  const sbTitle=document.querySelector(".sb-name");
  if(sbTitle && url) sbTitle.textContent="Raghuvir";

  // Mobile top logo
  const ml=$("mob-logo");
  if(ml && url){
    ml.classList.add("has-logo");
    ml.style.cssText="background:transparent;border-radius:0;width:110px;height:50px;overflow:visible;flex-shrink:0;display:flex;align-items:center";
    ml.innerHTML=`<img src="${url}" alt="Raghuvir" style="width:100%;height:100%;object-fit:contain"
      onerror="this.parentElement.innerHTML='<i class=\'fas fa-store-alt\'></i>'"
    />`;
    const mn=$("mob-brand-name");
    if(mn) mn.style.display="none";
  }

  // Sidebar logo
  setLogo("sb-logo-el",{bg:"#fff8f0",r:"8px",fit:"contain",pad:"3px"});

  // Splash / install screen logo
  setLogo("splash-logo",{bg:"#fff8f0",r:"50%",fit:"contain",pad:"8px"});

  // Admin topbar install PWA icon
  const pwa=$("pwa-logo-el");
  if(pwa && url){
    pwa.style.background="#fff8f0";
    pwa.innerHTML=`<img src="${url}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;padding:3px"/>`;
  }

  // Doer header brand
  const db=$("d-hdr-brand-logo");
  if(db && url){
    db.style.cssText="display:flex;align-items:center";
    db.innerHTML=`<img src="${url}" style="height:34px;max-width:120px;object-fit:contain"
      onerror="this.parentElement.innerHTML='<i class=\'fas fa-store-alt\'></i> Raghuvir'"
    />`;
  }
}

/* ══════════════════════════════════════════════════════════════
   AUTH — Login by Email OR Name
══════════════════════════════════════════════════════════════ */

let _adminLoginMode = false;

function toggleEye(id,btn){
  const inp=$(id),ico=btn.querySelector("i");
  inp.type=inp.type==="password"?"text":"password";
  ico.className=inp.type==="password"?"fas fa-eye":"fas fa-eye-slash";
}

function switchTab(tab){
  $("ftab-in").classList.toggle("active",  tab==="in");
  $("ftab-reg").classList.toggle("active", tab==="reg");
  $("f-in").style.display  =tab==="in" ?"block":"none";
  $("f-reg").style.display =tab==="reg"?"block":"none";
  $("l-err").style.display=$("r-err").style.display="none";
}

function toggleAdminLogin(){
  _adminLoginMode=!_adminLoginMode;
  const adminRow=$("admin-login-row");
  const staffRow=$("staff-login-row");
  const link=$("admin-toggle-link");
  if(_adminLoginMode){
    adminRow.style.display="block";
    staffRow.style.display="none";
    link.innerHTML=`<i class="fas fa-user"></i> Staff Login`;
    $("l-pass").placeholder="Admin password";
  } else {
    adminRow.style.display="none";
    staffRow.style.display="block";
    link.innerHTML=`<i class="fas fa-shield-halved"></i> Admin Login`;
    $("l-pass").placeholder="Enter your password";
  }
  $("l-err").style.display="none";
}

function showErr(id,msg){const e=$(id);e.textContent=msg;e.style.display="flex"}

function doLogin(){
  const pass=$("l-pass").value.trim();
  if(!pass) return showErr("l-err","Please enter your password.");

  const btn=$("l-btn");btn.disabled=true;
  btn.innerHTML=`<i class="fas fa-spinner fa-spin"></i> Signing in…`;

  const reset=()=>{btn.disabled=false;btn.innerHTML=`Sign In <i class="fas fa-arrow-right"></i>`;};

  /* ── Admin login ── */
  if(_adminLoginMode){
    const email=$("l-email")?.value.trim().toLowerCase()||"";
    if(!email){reset();return showErr("l-err","Please enter admin email.");}
    if(email===ADMIN.email.toLowerCase()){
      if(pass!==ADMIN.password){reset();return showErr("l-err","Incorrect admin password.");}
      Session.save(ADMIN);toast("Welcome back, Admin! 👑","ok");launchAdmin(ADMIN);
      reset();return;
    }
    reset();return showErr("l-err","Admin email not recognised.");
  }

  /* ── Staff login by Email OR Name ── */
  const identifier=$("l-identifier").value.trim();
  if(!identifier){reset();return showErr("l-err","Please enter your name or email.");}

  if(API_URL==="YOUR_APPS_SCRIPT_WEB_APP_URL"){reset();return showErr("l-err","App not configured. Paste your Apps Script URL in app.js");}

  showLoading("Signing in…");

  // Decide: is it an email or a name?
  const isEmail = identifier.includes("@");

  const lookup = isEmail
    ? API.getUserByEmail(identifier.toLowerCase())
    : API.getUserByName(identifier);

  lookup.then(doer=>{
    hideLoading();reset();
    if(!doer||doer.found===false||!doer.id){
      if(isEmail){
        return showErr("l-err","No account found with this email. Please register first.");
      } else {
        return showErr("l-err","Name not found. Please type your exact name as registered, or enter your email address instead.");
      }
    }
    if(String(doer.password).trim()!==String(pass).trim()){
      return showErr("l-err","Incorrect password. Please try again.");
    }
    Session.save(doer);
    toast(`Welcome, ${doer.name.split(" ")[0]}! 👋`,"ok");
    launchDoer(doer);
  }).catch(e=>{
    hideLoading();reset();
    showErr("l-err","Connection error. Please check internet and try again.");
    console.error("Login error:",e);
  });
}

function doRegister(){
  const name=$("r-name").value.trim(),email=$("r-email").value.trim().toLowerCase();
  const phone=$("r-phone").value.trim(),pass=$("r-pass").value,conf=$("r-conf").value;
  if(!name) return showErr("r-err","Please enter your full name.");
  if(pass.length<6) return showErr("r-err","Password must be at least 6 characters.");
  if(pass!==conf)   return showErr("r-err","Passwords do not match.");
  if(API_URL==="YOUR_APPS_SCRIPT_WEB_APP_URL") return showErr("r-err","App not configured. Paste your Apps Script URL in app.js");

  const btn=$("r-btn");btn.disabled=true;
  btn.innerHTML=`<i class="fas fa-spinner fa-spin"></i> Creating…`;

  showLoading("Creating your account…");
  API.getUserByName(name).then(existing=>{
    if(existing&&existing.found!==false&&existing.id){
      hideLoading();btn.disabled=false;btn.innerHTML=`Create Account <i class="fas fa-arrow-right"></i>`;
      return showErr("r-err","A staff member with this name already exists.");
    }
    const doer={id:uid("doer"),name,email,phone,role:"doer",password:pass,joinedAt:new Date().toISOString()};
    return API.addUser(doer).then(()=>{
      hideLoading();btn.disabled=false;btn.innerHTML=`Create Account <i class="fas fa-arrow-right"></i>`;
      Session.save(doer);toast(`Welcome, ${name.split(" ")[0]}! 🎉`,"ok");launchDoer(doer);
    });
  }).catch(e=>{
    hideLoading();btn.disabled=false;btn.innerHTML=`Create Account <i class="fas fa-arrow-right"></i>`;
    showErr("r-err","Error: "+e.message);
  });
}

function doLogout(){
  Session.clear();
  stopPolling();
  if($("l-identifier")) $("l-identifier").value="";
  if($("l-pass"))       $("l-pass").value="";
  if($("l-email"))      $("l-email").value="";
  $("l-err").style.display="none";
  // Reset to staff mode
  if(_adminLoginMode) toggleAdminLogin();
  switchTab("in");
  showScreen("screen-login");
  toast("Signed out successfully.","info");
}

/* ══════════════════════════════════════════════════════════════
   POLLING
══════════════════════════════════════════════════════════════ */
let _pollTimer=null;
function startPolling(onUpdate){stopPolling();onUpdate();_pollTimer=setInterval(onUpdate,5000);}
function stopPolling(){if(_pollTimer){clearInterval(_pollTimer);_pollTimer=null;}}

async function refreshAllData(){
  try{
    const [doers,tasks]=await Promise.all([API.getUsers(),API.getTasks()]);
    _allDoers=doers||[];
    _allTasks=(tasks||[]).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    return true;
  }catch(e){console.warn("Poll failed:",e.message);return false;}
}

/* ══════════════════════════════════════════════════════════════
   ADMIN DASHBOARD
══════════════════════════════════════════════════════════════ */
function launchAdmin(user){
  showScreen("screen-admin");
  $("sb-av").textContent=ini(user.name);
  $("sb-un").textContent=user.name;
  $("sb-ue").textContent=user.email;
  $("a-date").textContent=new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  startPolling(async()=>{
    const ok=await refreshAllData();
    if(ok){renderOverview();renderTasks();renderStaff();populateDDs();updateNums();}
  });
  gTab("overview",$$(".sl")[0]);
}

function gTab(tab,el){
  $$(".sl").forEach(a=>a.classList.remove("active"));if(el)el.classList.add("active");
  $$(".atab").forEach(t=>t.classList.remove("active"));$(`atab-${tab}`).classList.add("active");
  closeSB();
}

function updateNums(){$("sn-tasks").textContent=_allTasks.length;$("sn-staff").textContent=_allDoers.length;}

function renderOverview(){
  $("st-total").textContent=_allTasks.length;
  $("st-pend").textContent =_allTasks.filter(x=>x.status==="pending").length;
  $("st-prog").textContent =_allTasks.filter(x=>x.status==="inprogress").length;
  $("st-done").textContent =_allTasks.filter(x=>x.status==="done").length;
  const recent=[..._allTasks].slice(0,6);
  const tb=$("recent-body");
  if(!recent.length){tb.innerHTML=`<tr><td colspan="5"><div class="empty-state"><i class="fas fa-inbox"></i><p>No tasks yet</p></div></td></tr>`;return;}
  tb.innerHTML=recent.map(t=>`<tr>
    <td><strong>${esc(t.staffName)}</strong></td>
    <td><div class="td-desc" title="${esc(t.taskDesc)}">${esc(t.taskDesc)}</div></td>
    <td>${sPill(t.status)}</td>
    <td class="td-mono">${fmtDT(t.createdAt)}</td>
    <td class="td-done-t">${t.completedTime?fmtDT(t.completedTime):"—"}</td>
  </tr>`).join("");
}

let fState="all";
function setF(f,btn){fState=f;$$(".fchip").forEach(c=>c.classList.remove("active"));btn.classList.add("active");renderTasks();}

function renderTasks(){
  let tasks=[..._allTasks];
  const q=($("tsearch")?.value||"").toLowerCase();
  if(fState!=="all")tasks=tasks.filter(t=>t.status===fState);
  if(q)tasks=tasks.filter(t=>t.staffName?.toLowerCase().includes(q)||t.taskDesc?.toLowerCase().includes(q));
  const tb=$("tasks-body");
  if(!tasks.length){tb.innerHTML=`<tr><td colspan="9"><div class="empty-state"><i class="fas fa-inbox"></i><p>No tasks found</p></div></td></tr>`;return;}
  tb.innerHTML=tasks.map(t=>`<tr>
    <td><strong>${esc(t.staffName)}</strong></td>
    <td><div class="td-desc" title="${esc(t.taskDesc)}">${esc(t.taskDesc)}</div></td>
    <td>${pPill(t.priority||"normal")}</td>
    <td>${sPill(t.status)}</td>
    <td class="td-mono">${fmtDT(t.createdAt)}</td>
    <td class="td-mono" style="color:var(--prog)">${t.startedTime?fmtDT(t.startedTime):"—"}</td>
    <td class="td-done-t">${t.completedTime?fmtDT(t.completedTime):"—"}</td>
    <td class="td-mono" style="color:var(--gold)">${fmtDur(t.startedTime,t.completedTime)}</td>
    <td><div class="t-acts">
      <button class="t-btn edit" onclick="openEdit('${t.id}')" title="Edit"><i class="fas fa-pen"></i></button>
      <button class="t-btn del"  onclick="openDel('${t.id}')"  title="Delete"><i class="fas fa-trash"></i></button>
    </div></td>
  </tr>`).join("");
}

function renderStaff(){
  const grid=$("staff-grid");
  if(!_allDoers.length){grid.innerHTML=`<div class="empty-state full-col"><i class="fas fa-users-slash"></i><p>No staff registered yet</p></div>`;return;}
  grid.innerHTML=_allDoers.map(u=>{
    const mine=_allTasks.filter(t=>t.staffName===u.name),total=mine.length,done=mine.filter(t=>t.status==="done").length,pend=mine.filter(t=>t.status==="pending").length;
    return`<div class="staff-card">
      <div class="sc-av2">${ini(u.name)}</div>
      <div class="sc-info">
        <div class="sc-name">${esc(u.name)}</div>
        <div class="sc-email">${u.email?esc(u.email):"—"}</div>
        <div class="sc-tasks">${total} task${total!==1?"s":""} &nbsp;·&nbsp;
          <span style="color:var(--done)">${done} done</span> &nbsp;·&nbsp;
          <span style="color:var(--pend)">${pend} pending</span></div>
      </div>
      <button class="t-btn del" onclick="openRmS('${u.id}','${esc(u.name)}')" title="Remove"><i class="fas fa-user-minus"></i></button>
    </div>`;
  }).join("");
}

function populateDDs(){
  const opts=`<option value="">— Select a staff member —</option>`+
    _allDoers.map(u=>`<option value="${esc(u.name)}">${esc(u.name)}</option>`).join("");
  [$("a-staff"),$("e-staff")].forEach(el=>{if(!el)return;const v=el.value;el.innerHTML=opts;el.value=v;});
}

function submitTask(){
  const sn=$("a-staff").value,td=$("a-desc").value.trim(),pr=$("a-prio").value;
  const err=$("a-err");err.style.display="none";
  if(!sn){err.textContent="Please select a staff member.";err.style.display="flex";return;}
  if(!td){err.textContent="Please enter a task description.";err.style.display="flex";return;}
  const task={id:uid("task"),staffName:sn,taskDesc:td,priority:pr||"normal",
    status:"pending",createdAt:new Date().toISOString(),startedTime:"",completedTime:""};
  showLoading("Assigning task…");
  API.addTask(task).then(()=>{
    hideLoading();clearForm();toast(`Task assigned to ${sn} ✅`,"ok");
    refreshAllData().then(()=>{renderOverview();renderTasks();updateNums();});
  }).catch(e=>{hideLoading();toast("Failed: "+e.message,"err");});
}

function clearForm(){
  ["a-staff","a-prio"].forEach(id=>{const e=$(id);if(e)e.value=e.options[0]?.value||"";});
  const d=$("a-desc");if(d)d.value="";
  $("a-err").style.display="none";
}

function openEdit(id){
  const t=_allTasks.find(x=>x.id===id);if(!t)return;
  populateDDs();
  $("e-id").value=id;$("e-staff").value=t.staffName;$("e-desc").value=t.taskDesc;
  $("e-prio").value=t.priority||"normal";$("e-status").value=t.status;
  openM("m-edit");
}
function saveEdit(){
  const id=$("e-id").value,sn=$("e-staff").value,td=$("e-desc").value.trim();
  if(!sn||!td){toast("Fill required fields.","err");return;}
  const t=_allTasks.find(x=>x.id===id),ns=$("e-status").value;
  const ch={staffName:sn,taskDesc:td,priority:$("e-prio").value,status:ns,
    startedTime:ns==="inprogress"&&!t?.startedTime?new Date().toISOString():t?.startedTime||"",
    completedTime:ns==="done"&&!t?.completedTime?new Date().toISOString():t?.completedTime||""};
  showLoading("Saving…");
  API.updateTask(id,ch).then(()=>{
    hideLoading();closeM("m-edit");toast("Task updated.","ok");
    refreshAllData().then(()=>{renderOverview();renderTasks();});
  }).catch(e=>{hideLoading();toast("Failed: "+e.message,"err");});
}

function openDel(id){$("del-id").value=id;openM("m-del");}
function confirmDel(){
  showLoading("Deleting…");
  API.removeTask($("del-id").value).then(()=>{
    hideLoading();closeM("m-del");toast("Task deleted.","info");
    refreshAllData().then(()=>{renderOverview();renderTasks();updateNums();});
  }).catch(e=>{hideLoading();toast("Failed: "+e.message,"err");});
}
function openRmS(id,name){$("rms-id").value=id;$("rms-msg").textContent=`Remove "${name}"? Their task history remains.`;openM("m-rmstaff");}
function confirmRmS(){
  const u=_allDoers.find(x=>x.id===$("rms-id").value);
  showLoading("Removing…");
  API.removeUser($("rms-id").value).then(()=>{
    hideLoading();closeM("m-rmstaff");toast(`${u?.name||"Staff"} removed.`,"warn");
    refreshAllData().then(()=>{renderStaff();updateNums();});
  }).catch(e=>{hideLoading();toast("Failed: "+e.message,"err");});
}

function openM(id){$(id).classList.add("open");}
function closeM(id){$(id).classList.remove("open");}
function openSB(){$("sidebar").classList.add("open");$("sb-veil").classList.add("show");}
function closeSB(){$("sidebar").classList.remove("open");$("sb-veil").classList.remove("show");}
document.addEventListener("click",e=>{if(e.target.classList.contains("modal-bg"))$$(".modal-bg.open").forEach(m=>m.classList.remove("open"));});
document.addEventListener("keydown",e=>{if(e.key==="Escape")$$(".modal-bg.open").forEach(m=>m.classList.remove("open"));});

/* ══════════════════════════════════════════════════════════════
   EXCEL EXPORT
══════════════════════════════════════════════════════════════ */
function exportExcel(type){
  const tasks=_allTasks,doers=_allDoers,now=fmtDT(new Date().toISOString());
  function tbl(title,headers,rows){
    let h=`<table><tr><td colspan="${headers.length}" style="font-family:Georgia,serif;font-size:14pt;font-weight:bold;background:#c0392b;color:#fff;padding:8px">${title}</td></tr>`;
    h+=`<tr><td colspan="${headers.length}" style="font-size:9pt;color:#888;padding:4px 8px">Raghuvir Sweets And Bakers &nbsp;·&nbsp; Exported: ${now}</td></tr>`;
    h+=`<tr>${headers.map(h=>`<th style="background:#f5f0ea;color:#2c1810;font-weight:bold;border:1px solid #d4c9be;padding:7px 10px;font-size:9pt">${h}</th>`).join("")}</tr>`;
    rows.forEach((row,i)=>{const bg=i%2===0?"#fff":"#fdf6f0";h+=`<tr>${row.map(c=>`<td style="border:1px solid #e8ddd4;padding:5px 10px;background:${bg};font-size:9pt;color:#2c1810">${c??""}</td>`).join("")}</tr>`;});
    return h+`</table>`;
  }
  const TH=["#","Staff","Task","Priority","Status","Assigned At","Started At","Completed At","Duration"];
  const TR=list=>list.map((t,i)=>[i+1,t.staffName,t.taskDesc,(t.priority||"normal").charAt(0).toUpperCase()+(t.priority||"normal").slice(1),t.status==="inprogress"?"In Progress":t.status.charAt(0).toUpperCase()+t.status.slice(1),t.createdAt?fmtDT(t.createdAt):"—",t.startedTime?fmtDT(t.startedTime):"—",t.completedTime?fmtDT(t.completedTime):"—",fmtDur(t.startedTime,t.completedTime)]);
  const SR=()=>doers.map((u,i)=>{const mine=tasks.filter(t=>t.staffName===u.name),total=mine.length,done=mine.filter(t=>t.status==="done").length,pend=mine.filter(t=>t.status==="pending").length,prog=mine.filter(t=>t.status==="inprogress").length;return[i+1,u.name,u.email||"—",u.phone||"—",u.joinedAt?fmtD(u.joinedAt):"—",total,pend,prog,done,total>0?Math.round(done/total*100)+"%":"—"];});
  let content="",filename="";
  if(type==="tasks"){content=tbl("All Tasks",TH,TR(tasks));filename="All_Tasks";}
  else if(type==="done"){content=tbl("Completed",TH,TR(tasks.filter(t=>t.status==="done")));filename="Completed";}
  else if(type==="pending"){content=tbl("Pending",TH,TR(tasks.filter(t=>t.status!=="done")));filename="Pending";}
  else if(type==="staff"){content=tbl("Staff Performance",["#","Name","Email","Phone","Joined","Total","Pending","In Progress","Completed","Rate"],SR());filename="Staff";}
  else{content=[tbl("All Tasks",TH,TR(tasks)),"<br/><br/>",tbl("Completed",TH,TR(tasks.filter(t=>t.status==="done"))),"<br/><br/>",tbl("Pending",TH,TR(tasks.filter(t=>t.status!=="done"))),"<br/><br/>",tbl("Staff",["#","Name","Email","Phone","Joined","Total","Pending","In Progress","Completed","Rate"],SR())].join("");filename="Full_Export";}
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>body{font-family:Calibri,Arial,sans-serif;padding:20px;background:#f5f0ea}h1{font-family:Georgia,serif;color:#c0392b}p{color:#7a5c4a;font-size:.85rem;margin-bottom:18px}table{border-collapse:collapse;width:100%;margin-bottom:16px}</style></head><body><h1>🍬 Raghuvir Sweets And Bakers</h1><p>Exported: ${now}</p>${content}</body></html>`;
  const blob=new Blob([html],{type:"application/vnd.ms-excel;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=`RSB_${filename}_${new Date().toISOString().slice(0,10)}.xls`;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1000);
  toast(`Downloaded: RSB_${filename}.xls ✅`,"ok",4000);
}

/* ══════════════════════════════════════════════════════════════
   DOER DASHBOARD
══════════════════════════════════════════════════════════════ */
let doerTabState="my";
let _currentDoer=null;

function launchDoer(user){
  _currentDoer=user;
  showScreen("screen-doer");
  const av=ini(user.name);
  $("d-av").textContent=$("gc-av").textContent=av;
  $("d-nm").textContent=user.name.split(" ")[0];
  $("gc-nm").textContent=`Hey, ${user.name.split(" ")[0]}! 👋`;
  $("gc-dt").textContent=new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  doerTabState="my";
  $("dt-my").classList.add("active");$("dt-done").classList.remove("active");
  $("d-panel-my").style.display="block";$("d-panel-done").style.display="none";
  if(window._pwaInstallReady)showInstallUI();

  startPolling(async()=>{
    const ok=await refreshAllData();
    if(!ok)return;
    /* Silently sync latest user data (picks up password changes from sheet) */
    const fresh=_allDoers.find(d=>d.id===_currentDoer.id);
    if(fresh&&fresh.id){_currentDoer={..._currentDoer,...fresh};Session.save(_currentDoer);}
    renderDoer(_currentDoer);
  });
}

function renderDoer(user=_currentDoer||Session.get()){
  if(!user)return;
  const mine=_allTasks.filter(t=>t.staffName===user.name);
  const active=mine.filter(t=>t.status!=="done").sort((a,b)=>({inprogress:0,pending:1}[a.status]??2)-({inprogress:0,pending:1}[b.status]??2));
  const done  =mine.filter(t=>t.status==="done").sort((a,b)=>new Date(b.completedTime||0)-new Date(a.completedTime||0));

  $("gc-pend").textContent=mine.filter(t=>t.status==="pending").length;
  $("gc-prog").textContent=mine.filter(t=>t.status==="inprogress").length;
  $("gc-done").textContent=done.length;
  $("dbn-my").textContent=active.length;
  $("dbn-done").textContent=done.length;

  $("d-cards").innerHTML=active.length?active.map(buildCard).join(""):`<div class="empty-state"><i class="fas fa-mug-hot"></i><p>No pending tasks — all caught up! ☕</p></div>`;
  $("d-done").innerHTML=done.length?done.map(t=>`
    <div class="done-row">
      <div class="done-ck"><i class="fas fa-check"></i></div>
      <div class="done-info">
        <div class="done-txt">${esc(t.taskDesc)}</div>
        <div class="done-chips">
          ${t.createdAt?`<span class="done-chip"><i class="fas fa-calendar-plus"></i> ${fmtD(t.createdAt)}</span>`:""}
          ${t.startedTime?`<span class="done-chip start-chip"><i class="fas fa-play"></i> ${fmtT(t.startedTime)}</span>`:""}
          ${t.completedTime?`<span class="done-chip"><i class="fas fa-flag-checkered"></i> ${fmtT(t.completedTime)}</span>`:""}
          ${fmtDur(t.startedTime,t.completedTime)!=="—"?`<span class="done-chip dur-chip"><i class="fas fa-stopwatch"></i> ${fmtDur(t.startedTime,t.completedTime)}</span>`:""}
        </div>
      </div>
    </div>`).join(""):`<div class="empty-state"><i class="fas fa-medal"></i><p>Completed tasks will appear here</p></div>`;
}

function buildCard(t){
  const dl=dlInfo(t.deadline);
  const ov=dl.cls==="ov"?`<span class="sp" style="background:#fef2f2;color:#dc2626;border-color:#fca5a5"><i class="fas fa-fire" style="font-size:.4rem"></i> Overdue</span>`:"";
  const urg=t.priority==="urgent"?`<span class="sp" style="background:#fef2f2;color:#dc2626;border-color:#fca5a5"><i class="fas fa-bolt" style="font-size:.4rem"></i> Urgent</span>`:"";
  const startBtn=t.status==="pending"?`<button class="tc-btn start" onclick="dStart('${t.id}')"><i class="fas fa-play"></i> Start Task</button>`:"";
  const doneBtn=`<button class="tc-btn done-btn" onclick="dDone('${t.id}')"><i class="fas fa-circle-check"></i> Mark as Done</button>`;
  return`<div class="task-card ${t.status}">
    <div class="tc-hd">${sPill(t.status)} ${ov} ${urg}</div>
    <div class="tc-body">${esc(t.taskDesc)}</div>
    <div class="tc-meta">
      <div class="tc-mi"><i class="fas fa-calendar-plus"></i> ${fmtD(t.createdAt)}</div>
      ${t.priority!=="normal"?`<div class="tc-mi"><i class="fas fa-fire"></i> ${t.priority.charAt(0).toUpperCase()+t.priority.slice(1)} priority</div>`:""}
      ${t.startedTime?`<div class="tc-mi prog"><i class="fas fa-play"></i> Started ${fmtT(t.startedTime)}</div>`:""}
    </div>
    <div class="tc-acts">${startBtn}${doneBtn}</div>
  </div>`;
}

function dStart(id){
  API.updateTask(id,{status:"inprogress",startedTime:new Date().toISOString()})
    .then(()=>{toast("Task started! 💪","info");refreshAllData().then(()=>renderDoer());})
    .catch(()=>toast("Update failed.","err"));
}
function dDone(id){
  const t=_allTasks.find(x=>x.id===id);
  API.updateTask(id,{status:"done",completedTime:new Date().toISOString(),
    startedTime:t?.startedTime||new Date().toISOString()})
    .then(()=>{toast("Task completed! ✅","ok");refreshAllData().then(()=>renderDoer());})
    .catch(()=>toast("Update failed.","err"));
}
function dTab(tab,btn){
  doerTabState=tab;$$(".d-tab").forEach(b=>b.classList.remove("active"));btn.classList.add("active");
  $("d-panel-my").style.display=tab==="my"?"block":"none";
  $("d-panel-done").style.display=tab==="done"?"block":"none";
}

/* ══════════════════════════════════════════════════════════════
   PAGE BOOT
══════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded",async()=>{

  // Apply logo first (instant, no network needed)
  applyLogo();

  if(API_URL==="YOUR_APPS_SCRIPT_WEB_APP_URL"){
    showScreen("screen-login");
    setTimeout(()=>toast("⚠️ Paste your Apps Script URL in app.js","warn",10000),500);
    initSW();
    return;
  }

  // Install banner is shown automatically by beforeinstallprompt event
  // (fires on Android Chrome on HTTPS — no manual trigger needed)

  // Check persistent session
  const sess=Session.get();
  if(sess){
    if(sess.role==="admin"&&sess.email===ADMIN.email){
      launchAdmin(sess);
    } else if(sess.id){
      showLoading("Loading…");
      API.getUserById(sess.id).then(fresh=>{
        hideLoading();
        if(fresh&&fresh.found!==false&&fresh.id){
          const merged={...sess,...fresh};
          _currentDoer=merged;Session.save(merged);launchDoer(merged);
        } else {
          Session.clear();showScreen("screen-login");
        }
      }).catch(()=>{
        hideLoading();
        // Offline — restore from cache
        _currentDoer=sess;launchDoer(sess);
      });
    } else {
      Session.clear();showScreen("screen-login");
    }
  } else {
    showScreen("screen-login");
  }

  initSW();
});

/* ══════════════════════════════════════════════════════════════
   PWA — Service Worker + Install Banner
   Banner shows on login page on Android Chrome automatically.
   No separate splash — install option is part of login screen.
══════════════════════════════════════════════════════════════ */
const _SW=`const CV="rsb-v7",RV="rsb-rt-v4";const SHELL=["./","./Index.html","./Style.css","./App.js"];const CDN=["fonts.googleapis.com","fonts.gstatic.com","cdn.jsdelivr.net","cdnjs.cloudflare.com","script.google.com"];self.addEventListener("install",e=>{e.waitUntil(caches.open(CV).then(c=>c.addAll(SHELL).catch(()=>{})).then(()=>self.skipWaiting()))});self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CV&&k!==RV).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});self.addEventListener("fetch",e=>{const req=e.request,url=new URL(req.url);if(req.method!=="GET"||url.protocol==="chrome-extension:")return;if(CDN.some(h=>url.hostname.includes(h))||url.hostname.includes("google")){e.respondWith(fetch(req).catch(()=>caches.match(req)||new Response("",{status:408})));return}if(url.origin===self.location.origin){e.respondWith(caches.match(req).then(cached=>{const nw=fetch(req).then(r=>{if(r.ok)caches.open(CV).then(c=>c.put(req,r.clone()));return r}).catch(()=>null);return cached||nw||new Response("Offline",{status:503})}))}});self.addEventListener("message",e=>{if(e.data?.type==="SKIP_WAITING")self.skipWaiting()});`;

let _installPrompt=null;
window._pwaInstallReady=false;

/* ── Service Worker ── */
async function initSW(){
  if(!("serviceWorker" in navigator))return;
  try{
    const blob=new Blob([_SW],{type:"application/javascript"});
    const reg=await navigator.serviceWorker.register(URL.createObjectURL(blob),{scope:"./"});
    setInterval(()=>reg.update(),60000);
  }catch(e){console.warn("[SW]",e.message);}
}

/* ── beforeinstallprompt — fires on Android Chrome on HTTPS ──
   This is the key event. Chrome holds the install prompt until
   criteria are met (SW registered, HTTPS, not already installed).
   We capture it and show our banner immediately. */
window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();
  _installPrompt=e;
  window._pwaInstallReady=true;

  // Show install banner on login page
  showInstallBanner();

  // Also show install buttons in sidebar/header (for logged-in users)
  showInstallUI();

  // Apply logo to banner icon
  if(BRAND_LOGO_URL.trim()){
    const ic=$("inst-banner-icon");
    if(ic) ic.innerHTML=`<img src="${BRAND_LOGO_URL.trim()}" style="width:100%;height:100%;object-fit:contain;border-radius:8px"/>`;
  }
});

/* ── App installed event ── */
window.addEventListener("appinstalled",()=>{
  _installPrompt=null;window._pwaInstallReady=false;
  hideInstallBanner();
  hideInstallUI();
  localStorage.setItem("rsb_installed","1");
  toast("App installed! 🎉 Home screen se open karein","ok",6000);
});

/* ── Show / hide banner ── */
function showInstallBanner(){
  if(isStandalone())return; // Already running as app
  if(localStorage.getItem("rsb_installed"))return; // Already installed
  const b=$("install-banner");
  if(b) b.style.display="block";
}
function hideInstallBanner(){
  const b=$("install-banner");
  if(b) b.style.display="none";
}

/* ── Banner Install button tapped ── */
async function bannerInstall(){
  const btn=$("inst-install-btn");
  if(!_installPrompt){
    // Prompt not ready yet — show manual instructions
    const isAndroid=/android/i.test(navigator.userAgent);
    if(isAndroid){
      toast("Chrome menu (⋮) → 'Add to Home Screen' tap karein","info",7000);
    } else {
      toast("Browser menu → 'Install App' ya 'Add to Home Screen' tap karein","info",7000);
    }
    return;
  }
  if(btn){btn.innerHTML=`<i class="fas fa-spinner fa-spin"></i> Installing…`;btn.disabled=true;}
  _installPrompt.prompt();
  const{outcome}=await _installPrompt.userChoice;
  if(outcome==="accepted"){
    _installPrompt=null;window._pwaInstallReady=false;
    hideInstallBanner();
    hideInstallUI();
  } else {
    // User cancelled — restore button
    if(btn){btn.innerHTML=`<i class="fas fa-download"></i> Install`;btn.disabled=false;}
  }
}

/* ── Banner dismiss (X button) ── */
function bannerDismiss(){
  hideInstallBanner();
  // Remember for this session only (not permanently — show again next visit)
  sessionStorage.setItem("banner_dismissed","1");
}

/* ── Install from sidebar/topbar button ── */
async function installPWA(){
  if(_installPrompt){
    _installPrompt.prompt();
    const{outcome}=await _installPrompt.userChoice;
    if(outcome==="accepted"){
      _installPrompt=null;window._pwaInstallReady=false;
      hideInstallBanner();hideInstallUI();
    }
  } else if(isStandalone()){
    toast("App already installed! ✅","ok");
  } else {
    const isAndroid=/android/i.test(navigator.userAgent);
    if(isAndroid){
      toast("Chrome menu (⋮) → 'Add to Home Screen' tap karein","info",7000);
    } else {
      toast("Browser menu → 'Install App' tap karein","info",7000);
    }
  }
}

/* ── Splash screen buttons (kept for backward compat) ── */
async function chooseApp(){ await bannerInstall(); }
function chooseWeb(){
  const s=$("app-choice-splash");
  if(s)s.style.display="none";
  hideInstallBanner();
}

/* ── Sidebar/header install buttons ── */
function showInstallUI(){
  [$("sb-install-row")].forEach(e=>{if(e)e.style.display="block";});
  [$("mob-install-btn"),$("d-install-btn")].forEach(e=>{if(e)e.style.display="flex";});
}
function hideInstallUI(){
  [$("sb-install-row")].forEach(e=>{if(e)e.style.display="none";});
  [$("mob-install-btn"),$("d-install-btn")].forEach(e=>{if(e)e.style.display="none";});
}

function isStandalone(){
  return window.matchMedia("(display-mode:standalone)").matches||navigator.standalone===true;
}

Object.assign(window,{
  switchTab,doLogin,doRegister,doLogout,toggleEye,toggleAdminLogin,
  gTab,setF,renderTasks,openEdit,saveEdit,openDel,confirmDel,openRmS,confirmRmS,
  submitTask,clearForm,openSB,closeSB,openM,closeM,
  dTab,dStart,dDone,
  exportExcel,
  installPWA,chooseApp,chooseWeb,
  bannerInstall,bannerDismiss,
});
console.log("%c 🍬 Raghuvir Sweets And Bakers ","background:#c0392b;color:#fff;font-size:13px;font-weight:bold;padding:4px 10px;border-radius:6px");
