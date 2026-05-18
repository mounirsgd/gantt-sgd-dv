import { initializeApp }                       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }         from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, get,
         onValue, remove }                     from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ── Configuration Firebase ───────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDi9y4PmgvUHvnxDNu4kwpRvB9b-h7Dquk",
  authDomain:        "gantt-sgd.firebaseapp.com",
  databaseURL:       "https://gantt-sgd-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "gantt-sgd",
  storageBucket:     "gantt-sgd.firebasestorage.app",
  messagingSenderId: "363250513679",
  appId:             "1:363250513679:web:bdf947bd2800614d7a307a",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth        = getAuth(firebaseApp);
const db          = getDatabase(firebaseApp);

// ── Données métier ───────────────────────────────────────────
const TASK_COLORS = [
  "#3b82f6","#8b5cf6","#06b6d4","#22c55e","#f97316",
  "#ec4899","#14b8a6","#a855f7","#0ea5e9","#84cc16",
  "#6366f1","#10b981","#eab308","#64748b","#d946ef"
];

const TYPE_DATA = {
  small_t1: { label:"OBJECTIF (Petit t1)", color:"#e07b54", tasks:[
    {id:"st1_1", machine:"Échange bague orifice",         qui:"Alimenteurs"},
    {id:"st1_2", machine:"Côté moule",                    qui:"IS"},
    {id:"st1_3", machine:"Côté ébauche",                  qui:"IS"},
    {id:"st1_4", machine:"Entonnoir entrée",              qui:"Alimenteurs"},
    {id:"st1_5", machine:"Paraison entrée",               qui:"Alimenteurs"},
    {id:"st1_6", machine:"Démarrage sections sans verre", qui:"Chef de section"},
    {id:"st1_7", machine:"Démarrage sections avec verre", qui:"Chef de section"},
    {id:"st1_8", machine:"Toutes machines avec verre",    qui:"Chef de section"},
    {id:"st1_9", machine:"Verre vers le Lehr",            qui:"Chef de section"},
  ]},
  grand_t1: { label:"OBJECTIF (Grand T1)", color:"#c0392b", tasks:[
    {id:"gt1_1", machine:"Fin production précédente bout froid", qui:"À définir"},
    {id:"gt1_2", machine:"Vidage de ligne bout froid",           qui:"À définir"},
    {id:"gt1_3", machine:"Arrivée flacons bout froid",           qui:"À définir"},
    {id:"gt1_4", machine:"Réglage ligne et machines inspection",  qui:"À définir"},
    {id:"gt1_5", machine:"Qualité validée – approuvée",          qui:"À définir"},
    {id:"gt1_6", machine:"Emballage validé – palettisé",         qui:"À définir"},
  ]},
  rondelle: { label:"OBJECTIF (Rondelle)", color:"#7d3c98", tasks:[
    {id:"ron_1",  machine:"Nettoyage machine",               qui:"Production"},
    {id:"ron_2",  machine:"Changement cuvette",              qui:"Alimenteurs"},
    {id:"ron_3",  machine:"Côté finisseur",                  qui:"Atelier IS"},
    {id:"ron_4",  machine:"Côté ébauche",                    qui:"Atelier IS"},
    {id:"ron_5",  machine:"Entonnoir sous verre",            qui:"Alimenteurs"},
    {id:"ron_6",  machine:"Distributeur sous verre",         qui:"Alimenteurs"},
    {id:"ron_7",  machine:"Démarrage section sans flacon",   qui:"Chef de section"},
    {id:"ron_8",  machine:"Démarrage section avec flacon",   qui:"Chef de section"},
    {id:"ron_9",  machine:"Machine complète avec flacon",    qui:"Chef de section"},
    {id:"ron_10", machine:"Mise à l'arche",                  qui:"Chef de section"},
  ]}
};

// ── État local ───────────────────────────────────────────────
let allSessions = {};
let activeType  = null;
let typeStates  = { small_t1:{}, grand_t1:{}, rondelle:{} };
let selectedIds = [];
let allTasks    = {};

// ── Sélecteurs DOM ───────────────────────────────────────────
const loginScreen = document.getElementById("login-screen");
const appDiv      = document.getElementById("app");
const loginEmail  = document.getElementById("login-email");
const loginPass   = document.getElementById("login-pass");
const loginBtn    = document.getElementById("login-btn");
const loginError  = document.getElementById("login-error");
const logoutBtn   = document.getElementById("logout-btn");
const userLabel   = document.getElementById("user-label");

// ── AUTH : login ─────────────────────────────────────────────
loginBtn.addEventListener("click", async () => {
  const email    = loginEmail.value.trim();
  const password = loginPass.value.trim();

  if (!email || !password) {
    showLoginError("Veuillez remplir les deux champs.");
    return;
  }

  loginBtn.textContent = "Connexion...";
  loginBtn.disabled    = true;

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    afficherApp(result.user);
  } catch (err) {
    loginBtn.textContent = "Se connecter";
    loginBtn.disabled    = false;
    showLoginError(translateAuthError(err.code));
  }
});

[loginEmail, loginPass].forEach(el =>
  el.addEventListener("keydown", e => { if (e.key === "Enter") loginBtn.click(); })
);

// ── AUTH : logout ────────────────────────────────────────────
logoutBtn.addEventListener("click", () => {
  signOut(auth);
  appDiv.style.display      = "none";
  loginScreen.style.display = "flex";
  loginBtn.textContent      = "Se connecter";
  loginBtn.disabled         = false;
  loginError.style.display  = "none";
});

// ── AUTH : observer (pour les rechargements de page) ─────────
onAuthStateChanged(auth, user => {
  if (user && appDiv.style.display === "none") {
    afficherApp(user);
  }
});

function afficherApp(user) {
  loginScreen.style.display = "none";
  appDiv.style.display      = "block";
  userLabel.textContent     = user.email;
  initApp();
}

function showLoginError(msg) {
  loginError.textContent   = msg;
  loginError.style.display = "block";
}

function translateAuthError(code) {
  const m = {
    "auth/invalid-email":          "Identifiant invalide.",
    "auth/user-not-found":         "Identifiant introuvable.",
    "auth/wrong-password":         "Mot de passe incorrect.",
    "auth/invalid-credential":     "Identifiant ou mot de passe incorrect.",
    "auth/too-many-requests":      "Trop de tentatives. Réessayez plus tard.",
    "auth/network-request-failed": "Erreur réseau.",
  };
  return m[code] || "Erreur : " + code;
}

// ── INIT APP ─────────────────────────────────────────────────
function initApp() {
  // Formulaire toujours vide à la connexion
  activeType = null;
  typeStates = { small_t1:{}, grand_t1:{}, rondelle:{} };
  selectedIds = [];
  document.getElementById("f-date").value         = new Date().toISOString().slice(0,10);
  document.getElementById("f-machine-name").value  = "";
  document.getElementById("dynamic-sections").innerHTML = "";
  document.getElementById("gantt-container").innerHTML  = '<div class="empty-gantt">Sélectionnez un type et enregistrez pour afficher le Gantt</div>';
  document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));

  // Boutons type — attachés après login pour éviter les conflits
  ["small_t1","grand_t1","rondelle"].forEach(type => {
    const btn = document.getElementById("btn-"+type);
    btn.replaceWith(btn.cloneNode(true)); // supprime anciens listeners
    document.getElementById("btn-"+type).addEventListener("click", () => selectType(type));
  });

  // Listeners Firebase — on écoute uniquement les sessions et le statut
  // Les données types/global ne sont PAS restaurées au démarrage
  // L'utilisateur repart toujours sur un formulaire vide
  onValue(ref(db, "global"), snap => {
    document.getElementById("sync-status").textContent = "Connecté";
  });

  onValue(ref(db, "sessions"), snap => { allSessions = snap.val() || {}; renderHistory(allSessions); });

  // Boutons
  document.getElementById("save-btn").addEventListener("click", saveSession);
  document.getElementById("new-session-btn").addEventListener("click", newSession);
  document.getElementById("del-all-btn").addEventListener("click", deleteAllHistory);
  document.getElementById("do-compare-btn").addEventListener("click", doCompare);
  document.getElementById("close-compare-btn").addEventListener("click", closeCompare);
  initExportButtons();

  // Tooltip
  const TT = document.getElementById("tooltip");
  document.addEventListener("mousemove", e => {
    if (!TT.classList.contains("visible")) return;
    let x = e.clientX+16, y = e.clientY+16;
    if (x+310 > window.innerWidth)  x = e.clientX-310;
    if (y+230 > window.innerHeight) y = e.clientY-230;
    TT.style.left = x+"px"; TT.style.top = y+"px";
  });
}

// ── SÉLECTION TYPE ───────────────────────────────────────────
function selectType(type) {
  if (activeType === type) {
    activeType = null;
    document.getElementById("btn-"+type).classList.remove("active");
  } else {
    activeType = type;
    document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
    document.getElementById("btn-"+type).classList.add("active");
  }
  renderDynamicSections();
  document.getElementById("gantt-container").innerHTML = '<div class="empty-gantt">Sélectionnez un type et enregistrez pour afficher le Gantt</div>';
  selectedIds = []; updateCmpBar();
}

// ── CHAMP HEURE ──────────────────────────────────────────────
function makeTimeField(hVal, mVal) {
  const wrap = document.createElement("div"); wrap.className = "time-field";
  const hInp = document.createElement("input"); hInp.className = "h-inp"; hInp.inputMode = "numeric"; hInp.maxLength = 2; hInp.placeholder = "H"; hInp.value = hVal||"";
  const sep  = document.createElement("span");  sep.className = "time-field-sep"; sep.textContent = ":";
  const mInp = document.createElement("input"); mInp.className = "m-inp"; mInp.inputMode = "numeric"; mInp.maxLength = 2; mInp.placeholder = "mm"; mInp.value = mVal||"";

  function validate() {
    hInp.classList.toggle("invalid", hInp.value!==""&&(isNaN(parseInt(hInp.value))||parseInt(hInp.value)>23));
    mInp.classList.toggle("invalid", mInp.value!==""&&(isNaN(parseInt(mInp.value))||parseInt(mInp.value)>59));
  }
  hInp.addEventListener("input", function() {
    this.value = this.value.replace(/\D/g,"").slice(0,2);
    if (this.value.length===2) { if(parseInt(this.value)>23) this.value="23"; mInp.focus(); }
    validate();
  });
  hInp.addEventListener("blur", function() { if(this.value!==""){const v=parseInt(this.value);if(v>23)this.value="23";if(v<0)this.value="0";} validate(); });
  mInp.addEventListener("input", function() {
    this.value = this.value.replace(/\D/g,"").slice(0,2);
    if(this.value.length===2&&parseInt(this.value)>59) this.value="59";
    validate();
  });
  mInp.addEventListener("blur", function() { if(this.value!==""){const v=parseInt(this.value);if(v>59)this.value="59";if(v<0)this.value="0";} validate(); });

  wrap.appendChild(hInp); wrap.appendChild(sep); wrap.appendChild(mInp);
  wrap._getH = () => hInp.value;
  wrap._getM = () => mInp.value;
  return wrap;
}

function getTV(h, m) {
  if (!h) return "";
  const hv = parseInt(h), mv = parseInt(m)||0;
  if (isNaN(hv)||hv<0||hv>23||mv<0||mv>59) return "";
  return hv + ":" + (mv < 10 ? "0"+mv : mv);
}

function makeTextarea(placeholder, value) {
  const ta = document.createElement("textarea");
  ta.placeholder = placeholder; ta.value = value||""; ta.rows = 1;
  function resize() { ta.style.height = "auto"; ta.style.height = ta.scrollHeight+"px"; }
  ta.addEventListener("input", resize);
  setTimeout(resize, 0);
  return ta;
}

// ── RENDU SECTIONS DYNAMIQUES ────────────────────────────────
function renderDynamicSections() {
  const container = document.getElementById("dynamic-sections");
  container.innerHTML = "";
  if (!activeType) return;
  const def = TYPE_DATA[activeType]; if (!def) return;
  const saved = typeStates[activeType] || {};
  const savedTasks = saved.tasks || {}, savedTarget = saved.target || {};

  const sec = document.createElement("div"); sec.className = "tasks-sec"; sec.style.borderColor = def.color;
  const hd  = document.createElement("div"); hd.className = "tasks-sec-hd"; hd.style.background = def.color;
  hd.textContent = def.label; sec.appendChild(hd);

  // Objectif (target)
  const tWrap = document.createElement("div"); tWrap.className = "target-wrap"; tWrap.style.borderColor = def.color;
  tWrap.innerHTML = '<div class="target-hd" style="background:'+def.color+'20;color:'+def.color+'">🎯 Objectif <span style="font-size:11px;opacity:.7">Plage horaire visée</span></div>';
  const tBody = document.createElement("div"); tBody.className = "target-body";
  const tTimesRow = document.createElement("div"); tTimesRow.className = "target-times";
  const tSlbl = document.createElement("label"); tSlbl.style.cssText = "font-size:13px;color:#6c6c70"; tSlbl.textContent = "Début";
  const tSF = makeTimeField(savedTarget.sh||"", savedTarget.sm||"");
  const tElbl = document.createElement("label"); tElbl.style.cssText = "font-size:13px;color:#6c6c70;margin-left:8px"; tElbl.textContent = "Fin";
  const tEF = makeTimeField(savedTarget.eh||"", savedTarget.em||"");
  const tPrev = document.createElement("span"); tPrev.className = "time-preview";
  function updTgtPrev() { const s=getTV(tSF._getH(),tSF._getM()),e=getTV(tEF._getH(),tEF._getM()); tPrev.textContent=s&&e?s+" → "+e:s?s+" → ?":""; }
  tSF.addEventListener("input",updTgtPrev); tEF.addEventListener("input",updTgtPrev); updTgtPrev();
  tTimesRow.appendChild(tSlbl); tTimesRow.appendChild(tSF); tTimesRow.appendChild(tElbl); tTimesRow.appendChild(tEF); tTimesRow.appendChild(tPrev);
  tBody.appendChild(tTimesRow);
  const tCmtWrap = document.createElement("div"); tCmtWrap.className = "target-comment";
  const tCmtTA = makeTextarea("Commentaire sur l'objectif…", savedTarget.comment||"");
  tCmtWrap.appendChild(tCmtTA); tBody.appendChild(tCmtWrap);
  tWrap.appendChild(tBody); sec.appendChild(tWrap);
  sec._tSF = tSF; sec._tEF = tEF; sec._tCmt = tCmtTA;

  // Tâches
  sec._taskFields = {};
  def.tasks.forEach((task, idx) => {
    const tv    = savedTasks[task.id] || {};
    const color = TASK_COLORS[idx % TASK_COLORS.length];
    const row   = document.createElement("div"); row.className = "task-row";
    const top   = document.createElement("div"); top.className = "task-row-top";
    const bar   = document.createElement("div"); bar.className = "task-color-bar"; bar.style.background = color;
    const lbl   = document.createElement("span"); lbl.className = "task-row-label"; lbl.textContent = task.machine;
    const who   = document.createElement("span"); who.className = "task-row-who"; who.textContent = task.qui;
    top.appendChild(bar); top.appendChild(lbl); top.appendChild(who); row.appendChild(top);

    const timesRow = document.createElement("div"); timesRow.className = "task-row-times";
    const sGrp = document.createElement("div"); sGrp.className = "time-group";
    const sLbl = document.createElement("label"); sLbl.textContent = "Début";
    const sF   = makeTimeField(tv.sh||"", tv.sm||"");
    sGrp.appendChild(sLbl); sGrp.appendChild(sF);
    const eGrp = document.createElement("div"); eGrp.className = "time-group";
    const eLbl = document.createElement("label"); eLbl.textContent = "Fin";
    const eF   = makeTimeField(tv.eh||"", tv.em||"");
    eGrp.appendChild(eLbl); eGrp.appendChild(eF);
    const prev = document.createElement("span"); prev.className = "time-preview";
    function updPrev() { const s=getTV(sF._getH(),sF._getM()),e=getTV(eF._getH(),eF._getM()); prev.textContent=s&&e?s+" → "+e:s?s+" → ?":""; }
    sF.addEventListener("input",updPrev); eF.addEventListener("input",updPrev); updPrev();
    timesRow.appendChild(sGrp); timesRow.appendChild(eGrp); timesRow.appendChild(prev);
    row.appendChild(timesRow);

    const cmtWrap = document.createElement("div"); cmtWrap.className = "task-comment-wrap";
    const cmtTA   = makeTextarea("Commentaire… (plusieurs lignes possibles)", tv.comment||"");
    cmtWrap.appendChild(cmtTA); row.appendChild(cmtWrap);

    sec._taskFields[task.id] = {sF, eF, cmtTA, color};
    sec.appendChild(row);
  });
  container.appendChild(sec);
}

// ── COLLECTE DONNÉES ─────────────────────────────────────────
function collectTypeData() {
  const sec = document.querySelector("#dynamic-sections .tasks-sec");
  if (!sec || !activeType) return {};
  const def = TYPE_DATA[activeType]; if (!def) return {};
  const out = { target:{}, tasks:{} };
  out.target = {
    sh: sec._tSF ? sec._tSF._getH() : "", sm: sec._tSF ? sec._tSF._getM() : "",
    eh: sec._tEF ? sec._tEF._getH() : "", em: sec._tEF ? sec._tEF._getM() : "",
    comment: sec._tCmt ? sec._tCmt.value : ""
  };
  def.tasks.forEach(task => {
    const f = sec._taskFields && sec._taskFields[task.id]; if (!f) return;
    out.tasks[task.id] = { sh:f.sF._getH(), sm:f.sF._getM(), eh:f.eF._getH(), em:f.eF._getM(), comment:f.cmtTA.value };
  });
  return out;
}

// ── SAUVEGARDE ───────────────────────────────────────────────
async function saveSession() {
  const typeData = collectTypeData();
  const date     = document.getElementById("f-date").value;
  const machine  = document.getElementById("f-machine-name").value.trim();

  if (!date || !machine || !activeType) {
    alert("Veuillez remplir la date, la machine et le type de changement.");
    return;
  }

  // Vérifier si une séance strictement identique existe déjà
  // Bloqué uniquement si date + machine + type + toutes les heures sont identiques
  const newTasks  = JSON.stringify(typeData.tasks  || {});
  const newTarget = JSON.stringify(typeData.target || {});
  const doublon = Object.values(allSessions).find(function(s) {
    if (s.date !== date || s.machine !== machine || s.activeType !== activeType) return false;
    const sTasks  = JSON.stringify((s.typeData && s.typeData.tasks)  || {});
    const sTarget = JSON.stringify((s.typeData && s.typeData.target) || {});
    return sTasks === newTasks && sTarget === newTarget;
  });
  if (doublon) {
    alert("Cette séance est identique à une séance déjà enregistrée. Aucune modification détectée.");
    return;
  }

  if (activeType) await set(ref(db, "types/"+activeType), typeData);
  await set(ref(db, "global"), { date, machine, activeType, savedAt: Date.now() });
  if (activeType) typeStates[activeType] = typeData;

  if (activeType) {
    const def    = TYPE_DATA[activeType];
    const dl     = date ? new Date(date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}) : "";
    const sessId = "sess_"+activeType+"_"+Date.now();
    await set(ref(db, "sessions/"+sessId), {
      date, machine, activeType, typeData,
      title: [(machine||"Séance"), def?def.label:"", dl].filter(Boolean).join(" — "),
      savedAt: Date.now()
    });
  }

  document.getElementById("sync-status").textContent = "Enregistré ✓";
  setTimeout(() => document.getElementById("sync-status").textContent = "Connecté", 2000);
  renderGantt(date, machine, typeData);
  setTimeout(() => document.getElementById("gantt-section").scrollIntoView({behavior:"smooth"}), 100);
}

// ── NOUVELLE SÉANCE ──────────────────────────────────────────
async function newSession() {
  if (!confirm("Repartir à zéro ? La séance en cours reste dans l'historique.")) return;
  await remove(ref(db, "global"));
  for (const t of ["small_t1","grand_t1","rondelle"]) await remove(ref(db, "types/"+t));
  activeType  = null;
  typeStates  = { small_t1:{}, grand_t1:{}, rondelle:{} };
  document.getElementById("f-date").value         = new Date().toISOString().slice(0,10);
  document.getElementById("f-machine-name").value = "";
  document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("dynamic-sections").innerHTML = "";
  document.getElementById("gantt-container").innerHTML  = '<div class="empty-gantt">Sélectionnez un type et enregistrez pour afficher le Gantt</div>';
}

// ── HISTORIQUE ───────────────────────────────────────────────
function renderHistory(sessions) {
  const list = document.getElementById("history-list");
  const arr  = Object.entries(sessions).sort((a,b) => (b[1].savedAt||0)-(a[1].savedAt||0));
  document.getElementById("history-count").textContent = arr.length ? arr.length+" séance(s)" : "";
  if (!arr.length) { list.innerHTML = '<div class="history-empty">Aucune séance enregistrée</div>'; return; }

  list.innerHTML = arr.map(([id, s]) => {
    const def    = s.activeType && TYPE_DATA[s.activeType] ? TYPE_DATA[s.activeType] : null;
    const color  = def ? def.color : "#6c6c70";
    const typeLbl= def ? def.label : "";
    const dl     = s.date ? new Date(s.date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}) : "";
    const title  = [(s.machine||"Séance"), dl].filter(Boolean).join(" — ");
    return '<div class="history-item">' +
      '<div class="history-item-left" data-load="'+id+'">' +
        '<div class="history-item-title"><span class="history-badge" style="background:'+color+'">'+typeLbl+'</span>'+title+'</div>' +
        '<div class="history-item-sub">'+dl+'</div>' +
      '</div>' +
      '<div class="history-item-actions">' +
        '<span class="history-load-btn" data-load="'+id+'">Charger</span>' +
        '<span class="history-del-btn"  data-del="'+id+'">Supprimer</span>' +
      '</div>' +
    '</div>';
  }).join("");

  list.querySelectorAll("[data-load]").forEach(el =>
    el.addEventListener("click", () => loadHistorySession(el.dataset.load))
  );
  list.querySelectorAll("[data-del]").forEach(el =>
    el.addEventListener("click", () => deleteSession(el.dataset.del))
  );
}

async function loadHistorySession(id) {
  const snap = await get(ref(db, "sessions/"+id));
  const d = snap.val(); if (!d) return;

  if (d.activeType && d.typeData) {
    await set(ref(db, "types/"+d.activeType), d.typeData);
    typeStates[d.activeType] = d.typeData;
  }
  await set(ref(db, "global"), { date:d.date, machine:d.machine, activeType:d.activeType, savedAt:Date.now() });

  activeType = d.activeType;
  document.getElementById("f-date").value         = d.date    || "";
  document.getElementById("f-machine-name").value = d.machine || "";
  document.querySelectorAll(".type-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.type === activeType)
  );
  renderDynamicSections();
  renderGantt(d.date, d.machine, d.typeData || {});
  setTimeout(() => document.getElementById("gantt-section").scrollIntoView({behavior:"smooth"}), 200);
}

async function deleteSession(id) {
  if (!confirm("Supprimer cette séance ?")) return;
  await remove(ref(db, "sessions/"+id));
}

async function deleteAllHistory() {
  if (!confirm("Supprimer TOUT l'historique ?")) return;
  await remove(ref(db, "sessions"));
}

// ── GANTT ────────────────────────────────────────────────────
const toMin  = s => { if(!s||!s.includes(":"))return null; const[h,m]=s.split(":").map(Number); return h*60+(m||0); };
const fmtDur = (s,e) => { const d=e-s; if(d<=0)return "—"; const h=Math.floor(d/60),m=d%60; return h&&m?h+"h "+m+"min":h?h+"h":m+"min"; };

function renderGantt(date, machine, typeData) {
  const container = document.getElementById("gantt-container");
  if (!activeType || !TYPE_DATA[activeType]) {
    container.innerHTML = '<div class="empty-gantt">Sélectionnez un type et enregistrez pour afficher le Gantt</div>';
    return;
  }
  const def        = TYPE_DATA[activeType];
  const tv         = typeData || typeStates[activeType] || {};
  const savedTasks = tv.tasks  || {};
  const savedTarget= tv.target || {};

  allTasks = {};
  let minT = Infinity, maxT = -Infinity;
  function regT(h,m,h2,m2) { const s=toMin(getTV(h,m)),e=toMin(getTV(h2,m2)); if(s!==null)minT=Math.min(minT,s); if(e!==null)maxT=Math.max(maxT,e); }
  regT(savedTarget.sh||"",savedTarget.sm||"",savedTarget.eh||"",savedTarget.em||"");
  def.tasks.forEach(task => { const t=savedTasks[task.id]||{}; regT(t.sh||"",t.sm||"",t.eh||"",t.em||""); });

  if (!isFinite(minT)) minT=480; if (!isFinite(maxT)) maxT=minT+120;
  minT = Math.floor(minT/60)*60; maxT = Math.ceil(maxT/60)*60+60;
  const total=maxT-minT, slotMin=10, slots=total/slotMin, slotW=600/slots;

  const dateStr = date ? new Date(date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}) : "";
  document.getElementById("gantt-machine-title").textContent = machine || "Changement – Temp/Machine";
  document.getElementById("gantt-subtitle").textContent      = def.label + (dateStr ? " — "+dateStr : "");

  let h = '<table class="gantt">';
  h += '<tr><th colspan="5"></th>';
  for (let m=minT; m<maxT; m+=60) h += '<th colspan="'+(60/slotMin)+'" style="background:#1a3a6b;color:#fff">60 min</th>';
  h += '</tr><tr><th class="chk-cell"></th><th style="width:150px;text-align:left;padding-left:8px">MACHINE / SECTEUR</th><th style="width:80px">QUI</th><th style="width:52px">DÉBUT</th><th style="width:48px">FIN</th>';
  for (let m=minT; m<maxT; m+=slotMin) {
    const hh=Math.floor(m/60).toString().padStart(2,"0"), mm=(m%60).toString().padStart(2,"0");
    h += '<th style="width:'+slotW+'px;font-size:10px;color:#555;font-weight:400">'+(mm==="00"?hh+"h":mm)+'</th>';
  }
  h += '</tr>';
  h += '<tr><td colspan="'+(5+slots)+'" style="background:'+def.color+';color:#fff;font-weight:700;font-size:13px;padding:7px 10px;border:1px solid '+def.color+'">'+def.label+' ════════════════▶▶▶</td></tr>';

  // Ligne objectif
  const tStart=getTV(savedTarget.sh||"",savedTarget.sm||""), tEnd=getTV(savedTarget.eh||"",savedTarget.em||"");
  const tS=toMin(tStart), tE=toMin(tEnd), tCmt=savedTarget.comment||"";
  const tUid="target";
  allTasks[tUid] = {machine:"🎯 Objectif", qui:"—", start:tStart, end:tEnd, color:"#f59e0b"};
  let tBar="";
  if (tS!==null&&tE!==null&&tE>tS) {
    const lp=((tS-minT)/total)*100, wp=((tE-tS)/total)*100;
    tBar = '<div class="gantt-bar-target" style="left:'+lp+'%;width:'+wp+'%" data-uid="'+tUid+'" data-label="Objectif" data-qui="—" data-start="'+tStart+'" data-end="'+tEnd+'" data-color="#f59e0b" data-cmt="'+encCmt(tCmt)+'">'+(tCmt?'<div class="gantt-comment-dot"></div>':"")+'</div>';
  }
  const tSelA=selectedIds[0]===tUid, tSelB=selectedIds[1]===tUid;
  h += '<tr class="target-row'+(tSelA?" sel-a":tSelB?" sel-b":"")+'" data-uid="'+tUid+'"><td class="chk-cell info"><input type="checkbox" '+(selectedIds.includes(tUid)?"checked":"")+'  data-uid="'+tUid+'"></td><td class="info machine-name" style="color:#b45309;font-style:italic">🎯 Objectif</td><td class="info who-cell">—</td><td class="info time-cell">'+(tStart||"—")+'</td><td class="info time-cell">'+(tEnd||"—")+'</td><td colspan="'+slots+'" class="bar-cell"><div class="bar-inner">'+tBar+'</div></td></tr>';

  // Tâches
  def.tasks.forEach((task, idx) => {
    const t     = savedTasks[task.id] || {};
    const start = getTV(t.sh||"",t.sm||""), end=getTV(t.eh||"",t.em||"");
    const s     = toMin(start), e=toMin(end);
    const color = TASK_COLORS[idx % TASK_COLORS.length];
    const uid   = activeType+"_"+task.id;
    allTasks[uid] = {machine:task.machine, qui:task.qui, start, end, color};
    let bar="";
    if (s!==null&&e!==null&&e>s) {
      const lp=((s-minT)/total)*100, wp=((e-s)/total)*100;
      bar = '<div class="gantt-bar" style="left:'+lp+'%;width:'+wp+'%;background:'+color+'" data-uid="'+uid+'" data-label="'+task.machine.replace(/"/g,"&quot;")+'" data-qui="'+task.qui+'" data-start="'+start+'" data-end="'+end+'" data-color="'+color+'" data-cmt="'+encCmt(t.comment||"")+'">'+(t.comment?'<div class="gantt-comment-dot"></div>':"")+'</div>';
    }
    const isSelA=selectedIds[0]===uid, isSelB=selectedIds[1]===uid;
    const rowCls=isSelA?"sel-a":isSelB?"sel-b":idx%2===0?"odd":"even";
    h += '<tr class="'+rowCls+'" data-uid="'+uid+'"><td class="chk-cell info"><input type="checkbox" '+(selectedIds.includes(uid)?"checked":"")+'  data-uid="'+uid+'"></td><td class="info machine-name"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+color+';margin-right:5px;vertical-align:middle"></span>'+task.machine+'</td><td class="info who-cell">'+task.qui+'</td><td class="info time-cell">'+(start||"—")+'</td><td class="info time-cell">'+(end||"—")+'</td><td colspan="'+slots+'" class="bar-cell"><div class="bar-inner">'+bar+'</div></td></tr>';
  });

  h += '</table>';
  container.innerHTML = h;

  // Events Gantt
  container.querySelectorAll(".gantt-bar, .gantt-bar-target").forEach(el => {
    el.addEventListener("mouseenter", e => showTT(e, el.dataset.label, el.dataset.qui, el.dataset.start, el.dataset.end, el.dataset.color, el.dataset.cmt));
    el.addEventListener("mouseleave", hideTT);
  });
  container.querySelectorAll("input[type=checkbox][data-uid]").forEach(chk => {
    chk.addEventListener("change", () => toggleSelect(chk.dataset.uid));
  });

  updateCmpBar();
}

// ── TOOLTIP ──────────────────────────────────────────────────
function showTT(e, label, qui, start, end, color, comment) {
  const TT = document.getElementById("tooltip");
  document.getElementById("tt-dot").style.background   = color||"#3b82f6";
  document.getElementById("tt-title").textContent      = label||"—";
  document.getElementById("tt-qui").textContent        = qui||"—";
  document.getElementById("tt-start").textContent      = start||"—";
  document.getElementById("tt-end").textContent        = end||"—";
  const s=toMin(start), en=toMin(end);
  document.getElementById("tt-dur").textContent = (s!==null&&en!==null) ? "⏱ "+fmtDur(s,en) : "";
  const cb      = document.getElementById("tt-comment-box");
  const decoded = comment ? comment.replace(/\\n/g,"\n") : "";
  document.getElementById("tt-comment").textContent = decoded;
  cb.style.display = decoded ? "block" : "none";
  TT.classList.add("visible");
  // Calcul dynamique de la hauteur réelle du tooltip
  const ttH = TT.offsetHeight || 250;
  const ttW = TT.offsetWidth  || 310;
  let x = e.clientX + 16;
  let y = e.clientY + 16;
  if (x + ttW > window.innerWidth)  x = e.clientX - ttW - 8;
  if (y + ttH > window.innerHeight) y = e.clientY - ttH - 8;
  if (y < 0) y = 8;
  TT.style.left = x + "px";
  TT.style.top  = y + "px";
}
function hideTT() { document.getElementById("tooltip").classList.remove("visible"); }

// ── COMPARAISON ──────────────────────────────────────────────
function toggleSelect(id) {
  const idx = selectedIds.indexOf(id);
  if (idx>-1) selectedIds.splice(idx,1);
  else { if(selectedIds.length>=2) selectedIds.shift(); selectedIds.push(id); }
  updateCmpBar();
  document.querySelectorAll("[data-uid]").forEach(tr => {
    const uid = tr.dataset.uid;
    const chk = tr.querySelector("input[type=checkbox]");
    if (chk) { chk.checked = selectedIds.includes(uid); tr.classList.toggle("sel-a",selectedIds[0]===uid); tr.classList.toggle("sel-b",selectedIds[1]===uid); }
  });
}

function updateCmpBar() {
  const bar = document.getElementById("cmp-bar");
  if (selectedIds.length===2) {
    bar.classList.add("visible");
    document.getElementById("cmp-bar-names").textContent = selectedIds.map(id => allTasks[id]?allTasks[id].machine||"—":"—").join(" vs ");
  } else bar.classList.remove("visible");
}

function doCompare() {
  if (selectedIds.length!==2) return;
  const [idA,idB]=selectedIds, A=allTasks[idA], B=allTasks[idB]; if(!A||!B) return;
  const sA=toMin(A.start),sB=toMin(B.start),eA=toMin(A.end),eB=toMin(B.end);
  document.getElementById("cmp-result-title").textContent = (A.machine||"—")+" vs "+(B.machine||"—");
  document.getElementById("cmp-cards").innerHTML =
    '<div class="cmp-card a"><div class="cmp-card-badge a">🟡 A</div><div class="cmp-card-name">'+A.machine+'</div><div class="cmp-card-time">'+(A.start||"?")+" → "+(A.end||"?")+'</div></div>'+
    '<div class="cmp-card b"><div class="cmp-card-badge b">🟢 B</div><div class="cmp-card-name">'+B.machine+'</div><div class="cmp-card-time">'+(B.start||"?")+" → "+(B.end||"?")+'</div></div>';
  let diffText="—", diffSub="Données insuffisantes";
  if (sA!==null&&sB!==null) {
    const d=Math.abs(sB-sA),h=Math.floor(d/60),m=d%60;
    diffText=h&&m?h+"h "+m+"min":h?h+"h":m+"min";
    diffSub=sB>sA?"B démarre "+diffText+" après A":sB<sA?"B démarre "+diffText+" avant A":"Même heure de démarrage";
  }
  document.getElementById("cmp-diff-box").innerHTML =
    '<div class="cmp-diff-label">Écart entre les deux tâches</div><div class="cmp-diff-value">'+diffText+'</div><div class="cmp-diff-sub">'+diffSub+'</div>';
  document.getElementById("cmp-result").classList.add("visible");
  document.getElementById("cmp-result").scrollIntoView({behavior:"smooth",block:"nearest"});
}

function closeCompare() { document.getElementById("cmp-result").classList.remove("visible"); }


// ── EXPORT EXCEL ─────────────────────────────────────────────

function initExportButtons() {
  document.getElementById('export-toggle-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    var menu = document.getElementById('export-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });

  // Fermer le menu seulement si on clique en dehors
  document.addEventListener('click', function(e) {
    var dropdown = document.getElementById('export-dropdown');
    if (dropdown && !dropdown.contains(e.target)) {
      document.getElementById('export-menu').style.display = 'none';
    }
  });

  document.getElementById('export-all').addEventListener('click', function(e) {
    e.stopPropagation();
    exportToExcel(null, null);
    document.getElementById('export-menu').style.display = 'none';
  });

  document.getElementById('export-month').addEventListener('click', function(e) {
    e.stopPropagation();
    var now  = new Date();
    var from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    var to   = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
    exportToExcel(from, to);
    document.getElementById('export-menu').style.display = 'none';
  });

  document.getElementById('export-custom').addEventListener('click', function(e) {
    e.stopPropagation();
    var range = document.getElementById('export-date-range');
    range.style.display = range.style.display === 'none' ? 'flex' : 'none';
  });

  document.getElementById('export-confirm-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    var from = document.getElementById('export-date-from').value;
    var to   = document.getElementById('export-date-to').value;
    if (!from || !to) { alert('Veuillez choisir les deux dates.'); return; }
    exportToExcel(from, to);
    document.getElementById('export-menu').style.display = 'none';
    document.getElementById('export-date-range').style.display = 'none';
  });
}

function exportToExcel(dateFrom, dateTo) {
  var sessions = Object.values(allSessions);

  var filtered = sessions;
  if (dateFrom && dateTo) {
    filtered = sessions.filter(function(s) { return s.date >= dateFrom && s.date <= dateTo; });
  }

  if (filtered.length === 0) {
    alert('Aucune séance trouvée pour cette période.');
    return;
  }

  filtered.sort(function(a, b) { return new Date(a.date) - new Date(b.date); });

  var rows = [];
  rows.push(['Date', 'Jour', 'Machine', 'Type', 'Tâche', 'Qui', 'Début', 'Fin', 'Durée (min)', 'Commentaire']);

  filtered.forEach(function(session) {
    var def       = session.activeType && TYPE_DATA[session.activeType] ? TYPE_DATA[session.activeType] : null;
    var typeLabel = def ? def.label : (session.type || '');
    var dateStr   = session.date || '';
    var jourStr   = dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {weekday: 'long'}) : '';
    var machine   = session.machine || '';
    var tasks     = session.typeData ? (session.typeData.tasks  || {}) : {};
    var target    = session.typeData ? (session.typeData.target || {}) : {};

    // Ligne objectif
    var tStart = getTV(target.sh||'', target.sm||'');
    var tEnd   = getTV(target.eh||'', target.em||'');
    var tSMin  = toMin(tStart);
    var tEMin  = toMin(tEnd);
    var tDur   = (tSMin !== null && tEMin !== null) ? tEMin - tSMin : '';
    var tCmt   = (target.comment||'').replace(/\n/g, ' | ').replace(/\r/g, '');
    rows.push([dateStr, jourStr, machine, typeLabel, 'Objectif', '—', tStart, tEnd, tDur, tCmt]);

    // Lignes tâches
    if (def) {
      def.tasks.forEach(function(task) {
        var t     = tasks[task.id] || {};
        var start = getTV(t.sh||'', t.sm||'');
        var end   = getTV(t.eh||'', t.em||'');
        var sMin  = toMin(start);
        var eMin  = toMin(end);
        var dur   = (sMin !== null && eMin !== null) ? eMin - sMin : '';
        var cmt   = (t.comment||'').replace(/\n/g, ' | ').replace(/\r/g, '');
        rows.push([dateStr, jourStr, machine, typeLabel, task.machine, task.qui, start, end, dur, cmt]);
      });
    }

    // Ligne vide séparatrice entre séances
    rows.push(['', '', '', '', '', '', '', '', '', '']);
  });

  // Générer CSV compatible Excel français
  var csv = rows.map(function(row) {
    return row.map(function(cell) {
      var str = String(cell !== null && cell !== undefined ? cell : '');
      str = str.replace(/\n/g, ' | ').replace(/\r/g, '');
      return (str.indexOf(';') > -1 || str.indexOf('"') > -1)
        ? '"' + str.replace(/"/g, '""') + '"'
        : str;
    }).join(';');
  }).join('\n');

  var BOM  = '\uFEFF';
  var blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  var now  = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
  a.href     = url;
  a.download = 'SGD_Pharma_Gantt_' + now + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Utilitaire encodage commentaires ─────────────────────────
function encCmt(str) {
  if (!str) return "";
  return str.replace(/\\/g,"\\\\").replace(/'/g,"&#39;").replace(/"/g,"&quot;").replace(/\n/g,"\\n");
}
