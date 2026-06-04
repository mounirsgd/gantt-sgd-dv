import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword,
signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, get,
onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDi9y4PmgvUHvnxDNu4kwpRvB9b-h7Dquk",
  authDomain: "gantt-sgd.firebaseapp.com",
  databaseURL: "https://gantt-sgd-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gantt-sgd",
  storageBucket: "gantt-sgd.firebasestorage.app",
  messagingSenderId: "363250513679",
  appId: "1:363250513679:web:bdf947bd2800614d7a307a",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getDatabase(firebaseApp);

// Couleurs des taches
const TASK_COLORS = [
  "#3b82f6","#8b5cf6","#06b6d4","#22c55e","#f97316",
  "#ec4899","#14b8a6","#a855f7","#0ea5e9","#84cc16",
  "#6366f1","#10b981","#eab308","#64748b","#d946ef"
];

// Taches fixes par type
const TASKS_RONDELLE = [
  {id:"ron_1", machine:"Nettoyage machine", qui:"Production"},
  {id:"ron_2", machine:"Changement cuvette", qui:"Alimenteurs"},
  {id:"ron_3", machine:"Cote finisseur", qui:"Atelier IS"},
  {id:"ron_4", machine:"Cote ebauche", qui:"Atelier IS"},
  {id:"ron_5", machine:"Entonnoir sous verre", qui:"Alimenteurs"},
  {id:"ron_6", machine:"Distributeur sous verre", qui:"Alimenteurs"},
  {id:"ron_7", machine:"Demarrage section sans flacon", qui:"Chef de section"},
  {id:"ron_8", machine:"Demarrage section avec flacon", qui:"Chef de section"},
  {id:"ron_9", machine:"Machine complete avec flacon", qui:"Chef de section"},
  {id:"ron_10", machine:"Mise a l arche", qui:"Chef de section"},
];

// Etat local
let allSessions = {};
let ganttData = { targets:{grand_t1:{},petit_t1:{},rondelle:{}}, tasks:{}, extraTasks:[] };
let selectedIds = [];
let allTasks = {};
let historyPage = 0;
let ganttQuiOverrides = {};
let ganttGlobalMin = 0;
let ganttSpan = 1;
let justifications = [];
let appReady = false;
const HISTORY_PAGE_SIZE = 5;

// DOM
const loginScreen = document.getElementById("login-screen");
const appDiv = document.getElementById("app");
const loginEmail = document.getElementById("login-email");
const loginPass = document.getElementById("login-pass");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const userLabel = document.getElementById("user-label");

// AUTH
loginBtn.addEventListener("click", async function() {
  var email = loginEmail.value.trim(), password = loginPass.value.trim();
  if (!email || !password) { showLoginError("Veuillez remplir les deux champs."); return; }
  loginBtn.textContent = "Connexion..."; loginBtn.disabled = true;
  try {
    var result = await signInWithEmailAndPassword(auth, email, password);
    afficherApp(result.user);
  } catch (err) {
    loginBtn.textContent = "Se connecter"; loginBtn.disabled = false;
    showLoginError(translateAuthError(err.code));
  }
});

[loginEmail, loginPass].forEach(function(el) { el.addEventListener("keydown", function(e) { if (e.key === "Enter") loginBtn.click(); }); });

logoutBtn.addEventListener("click", function() {
  signOut(auth); appReady = false;
  appDiv.style.display = "none"; loginScreen.style.display = "flex";
  loginBtn.textContent = "Se connecter"; loginBtn.disabled = false; loginError.style.display = "none";
});

onAuthStateChanged(auth, function(user) {
  if (user && appDiv.style.display !== "block") afficherApp(user);
  else if (!user) { loginScreen.style.display = "flex"; appDiv.style.display = "none"; }
});

function afficherApp(user) {
  loginScreen.style.display = "none"; appDiv.style.display = "block";
  userLabel.textContent = user.email;
  if (!appReady) { appReady = true; initApp(); }
}

function showLoginError(msg) { loginError.textContent = msg; loginError.style.display = "block"; }

function translateAuthError(code) {
  var m = {
    "auth/invalid-email": "Identifiant invalide.",
    "auth/user-not-found": "Identifiant introuvable.",
    "auth/wrong-password": "Mot de passe incorrect.",
    "auth/invalid-credential": "Identifiant ou mot de passe incorrect.",
    "auth/too-many-requests": "Trop de tentatives.",
    "auth/network-request-failed": "Erreur reseau.",
  };
  return m[code] || "Erreur : " + code;
}

// INIT
function initApp() {
  ganttData = { targets:{grand_t1:{},petit_t1:{},rondelle:{}}, tasks:{}, extraTasks:[] };
  selectedIds = []; ganttQuiOverrides = {}; justifications = [];

  function refreshDate() { var d = document.getElementById("f-date"); if (d && !d.value) d.value = new Date().toISOString().slice(0,10); }
  refreshDate(); setInterval(refreshDate, 60000);

  document.getElementById("f-machine-name").value = "";
document.getElementById("f-date").value = new Date().toISOString().slice(0,10);
ganttData = { targets:{grand_t1:{},petit_t1:{},rondelle:{}}, tasks:{}, extraTasks:[] };
buildForm();

  onValue(ref(db, "global"), function(snap) { document.getElementById("sync-status").textContent = "Connecte"; });

  onValue(ref(db, "sessions"), function(snap) {
    allSessions = snap.val() || {};
    renderHistory(allSessions);
    var gs = document.getElementById("gantt-section");
    if (gs && gs.style.display !== "none") {
      var date = document.getElementById("f-date").value;
      var machine = document.getElementById("f-machine-name").value.trim();
      var current = Object.values(allSessions).find(function(s) { return s.date === date && s.machine === machine; });
      if (current) renderGantt(date, machine, current.ganttData || {});
    }
  });

  document.getElementById("save-btn").addEventListener("click", saveSession);
  document.getElementById("new-session-btn").addEventListener("click", newSession);
  document.getElementById("del-all-btn").addEventListener("click", deleteAllHistory);
  document.getElementById("do-compare-btn").addEventListener("click", doCompare);
  document.getElementById("close-compare-btn").addEventListener("click", closeCompare);
  document.getElementById("do-justif-btn").addEventListener("click", openJustifDialog);
  initExportButtons();

  var TT = document.getElementById("tooltip");
  document.addEventListener("mousemove", function(e) {
    if (!TT.classList.contains("visible")) return;
    var x = e.clientX+16, y = e.clientY+16;
    if (x+310 > window.innerWidth) x = e.clientX-310;
    if (y+230 > window.innerHeight) y = e.clientY-230;
    TT.style.left = x+"px"; TT.style.top = y+"px";
  });
}

// CONSTRUCTION FORMULAIRE
function buildForm() {
  var container = document.getElementById("form-sections");
  container.innerHTML = "";

  container.appendChild(buildTargetSection("grand_t1", "TARGET (Grand T1)", "#c0392b", ganttData.targets.grand_t1));
  container.appendChild(buildTargetSection("petit_t1", "TARGET (Petit t1)", "#e07b54", ganttData.targets.petit_t1));
  container.appendChild(buildTargetSection("rondelle", "TARGET (Rondelle)", "#7d3c98", ganttData.targets.rondelle));

  var tasksSec = document.createElement("div"); tasksSec.className = "tasks-sec"; tasksSec.style.borderColor = "#1a3a6b";
  var tasksHd = document.createElement("div"); tasksHd.className = "tasks-sec-hd"; tasksHd.style.background = "#1a3a6b";
  tasksHd.textContent = "Taches detaillees"; tasksSec.appendChild(tasksHd);

  tasksSec._taskFields = {};
  tasksSec._extraFields = [];

  TASKS_RONDELLE.forEach(function(task, idx) {
    var tv = ganttData.tasks[task.id] || {};
    var color = TASK_COLORS[idx % TASK_COLORS.length];
    appendTaskRow(tasksSec, task.id, task.machine, task.qui, tv, color, false);
  });

  (ganttData.extraTasks || []).forEach(function(et, idx) {
    var color = TASK_COLORS[(TASKS_RONDELLE.length + idx) % TASK_COLORS.length];
    appendExtraTaskRow(tasksSec, et, idx, color);
  });

  var addBtn = document.createElement("button"); addBtn.className = "btn-add-task"; addBtn.textContent = "+ Ajouter une tache";
  addBtn.addEventListener("click", function() {
    var idx = tasksSec._extraFields.length;
    var color = TASK_COLORS[(TASKS_RONDELLE.length + idx) % TASK_COLORS.length];
    appendExtraTaskRow(tasksSec, {}, idx, color);
  });
  tasksSec.appendChild(addBtn);
  container.appendChild(tasksSec);
  container._tasksSec = tasksSec;
}

function buildTargetSection(key, label, color, saved) {
  saved = saved || {};
  var sec = document.createElement("div"); sec.className = "tasks-sec"; sec.style.borderColor = color;
  var hd = document.createElement("div"); hd.className = "tasks-sec-hd"; hd.style.background = color;
  hd.textContent = label; sec.appendChild(hd);

  var body = document.createElement("div"); body.style.cssText = "padding:10px 12px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;";
  var sLbl = document.createElement("label"); sLbl.textContent = "Debut"; sLbl.style.cssText = "font-size:13px;color:#6c6c70;";
  var sF = makeTimeField(saved.sh||"", saved.sm||"");
  var eLbl = document.createElement("label"); eLbl.textContent = "Fin"; eLbl.style.cssText = "font-size:13px;color:#6c6c70;";
  var eF = makeTimeField(saved.eh||"", saved.em||"");
  var prev = document.createElement("span"); prev.className = "time-preview";
  function updPrev() { var s=getTV(sF._getH(),sF._getM()),e=getTV(eF._getH(),eF._getM()); prev.textContent=s&&e?s+" -> "+e:s?s+" -> ?":""; }
  sF.addEventListener("input",updPrev); eF.addEventListener("input",updPrev); updPrev();
  body.appendChild(sLbl); body.appendChild(sF); body.appendChild(eLbl); body.appendChild(eF); body.appendChild(prev);

  var cmtTA = document.createElement("textarea");
  cmtTA.placeholder = "Commentaire..."; cmtTA.value = saved.comment||""; cmtTA.rows = 1;
  cmtTA.style.cssText = "width:100%;border:1px solid #e0e0e5;border-radius:8px;background:#f7f7f8;font-size:13px;padding:6px 10px;outline:none;font-family:Arial,sans-serif;resize:none;margin-top:6px;";
  function resize() { cmtTA.style.height="auto"; cmtTA.style.height=cmtTA.scrollHeight+"px"; }
  cmtTA.addEventListener("input",resize); setTimeout(resize,0);

  var cmtWrap = document.createElement("div"); cmtWrap.style.cssText = "padding:0 12px 10px;";
  cmtWrap.appendChild(cmtTA);
  sec.appendChild(body); sec.appendChild(cmtWrap);
  sec._sF = sF; sec._eF = eF; sec._cmt = cmtTA;
  sec.dataset.targetKey = key;
  return sec;
}

function appendTaskRow(sec, taskId, machineName, quiDefault, tv, color, isDynamic) {
  var row = document.createElement("div"); row.className = "task-row";
  var top = document.createElement("div"); top.className = "task-row-top";
  var bar = document.createElement("div"); bar.className = "task-color-bar"; bar.style.background = color;
  var lbl = document.createElement("span"); lbl.className = "task-row-label"; lbl.textContent = machineName;
  var who = document.createElement("span"); who.className = "task-row-who"; who.textContent = quiDefault;
  top.appendChild(bar); top.appendChild(lbl); top.appendChild(who);
  row.appendChild(top);

  var slotsContainer = document.createElement("div"); slotsContainer.className = "task-row-times";
  var slot1 = makeSlotRow(tv.sh||"", tv.sm||"", tv.eh||"", tv.em||"");
  slotsContainer.appendChild(slot1); row._slot1 = slot1; row._slot2 = null;

  if (tv.sh2 || tv.eh2) {
    var sep = document.createElement("span"); sep.style.cssText = "font-size:11px;color:#6c6c70;margin:0 4px;"; sep.textContent = "puis";
    var s2 = makeSlotRow(tv.sh2||"", tv.sm2||"", tv.eh2||"", tv.em2||"");
    slotsContainer.appendChild(sep); slotsContainer.appendChild(s2); row._slot2 = s2;
  }

  var addSlotBtn = document.createElement("button"); addSlotBtn.className = "btn-add-slot"; addSlotBtn.textContent = "+";
  addSlotBtn.title = "Ajouter un 2eme creneau";
  if (tv.sh2 || tv.eh2) addSlotBtn.style.display = "none";
  addSlotBtn.addEventListener("click", function() {
    if (row._slot2) return;
    var sep = document.createElement("span"); sep.style.cssText = "font-size:11px;color:#6c6c70;margin:0 4px;"; sep.textContent = "puis";
    var s2 = makeSlotRow("","","","");
    slotsContainer.appendChild(sep); slotsContainer.appendChild(s2);
    row._slot2 = s2; addSlotBtn.style.display = "none";
  });
  slotsContainer.appendChild(addSlotBtn);
  row.appendChild(slotsContainer);

  var cmtWrap = document.createElement("div"); cmtWrap.className = "task-comment-wrap";
  var cmtTA = makeTextarea("Commentaire...", tv.comment||"");
  cmtWrap.appendChild(cmtTA); row.appendChild(cmtWrap);

  // Commentaire slot 2
  var cmt2Wrap = document.createElement("div"); cmt2Wrap.className = "task-comment-wrap";
  var cmt2TA = makeTextarea("Commentaire 2eme creneau...", tv.comment2||"");
  cmt2Wrap.appendChild(cmt2TA); row.appendChild(cmt2Wrap);
  if (!tv.sh2 && !tv.eh2) cmt2Wrap.style.display = "none";

  addSlotBtn.addEventListener("click", function() {
    cmt2Wrap.style.display = "block";
  });

  sec._taskFields[taskId] = { sF: slot1._sF, eF: slot1._eF, cmtTA: cmtTA, cmt2TA: cmt2TA, color: color, row: row };
  sec.appendChild(row);
}

function appendExtraTaskRow(sec, et, idx, color) {
  var row = document.createElement("div"); row.className = "task-row";
  var top = document.createElement("div"); top.className = "task-row-top";
  var bar = document.createElement("div"); bar.className = "task-color-bar"; bar.style.background = color;
  var nameInp = document.createElement("input"); nameInp.type = "text"; nameInp.value = et.machine||"";
  nameInp.style.cssText = "flex:1;border:none;background:transparent;font-size:13px;font-weight:700;color:#1c1c1e;font-family:Arial,sans-serif;outline:none;";
  nameInp.placeholder = "Nom de la tache";
  var whoInp = document.createElement("input"); whoInp.type = "text"; whoInp.value = et.qui||"";
  whoInp.style.cssText = "font-size:11px;color:#6c6c70;background:#f7f7f8;padding:2px 8px;border-radius:6px;border:1px solid #e0e0e5;width:100px;outline:none;font-family:Arial,sans-serif;";
  whoInp.placeholder = "Qui";
  var delBtn = document.createElement("button"); delBtn.className = "btn-del-task"; delBtn.textContent = "Supprimer";
  delBtn.addEventListener("click", function() {
    row.remove();
    sec._extraFields = sec._extraFields.filter(function(f) { return f.row !== row; });
    var date = document.getElementById("f-date").value;
    var machine = document.getElementById("f-machine-name").value.trim();
    if (date && machine) {
      var data = collectData();
      var existing = Object.entries(allSessions).find(function(e) { return e[1].date===date && e[1].machine===machine; });
      if (existing) {
        set(ref(db, "sessions/"+existing[0]+"/ganttData/extraTasks"), data.extraTasks || []);
        showToast("Tache supprimee !", "#e74c3c");
      }
    }
  });
  top.appendChild(bar); top.appendChild(nameInp); top.appendChild(whoInp); top.appendChild(delBtn);
  row.appendChild(top);

  var slotsContainer = document.createElement("div"); slotsContainer.className = "task-row-times";
  var slot1 = makeSlotRow(et.sh||"", et.sm||"", et.eh||"", et.em||"");
  slotsContainer.appendChild(slot1); row._slot1 = slot1; row._slot2 = null;

  if (et.sh2 || et.eh2) {
    var sep = document.createElement("span"); sep.style.cssText = "font-size:11px;color:#6c6c70;margin:0 4px;"; sep.textContent = "puis";
    var s2 = makeSlotRow(et.sh2||"", et.sm2||"", et.eh2||"", et.em2||"");
    slotsContainer.appendChild(sep); slotsContainer.appendChild(s2); row._slot2 = s2;
  }

  var addSlotBtn = document.createElement("button"); addSlotBtn.className = "btn-add-slot"; addSlotBtn.textContent = "+";
  if (et.sh2 || et.eh2) addSlotBtn.style.display = "none";
  addSlotBtn.addEventListener("click", function() {
    if (row._slot2) return;
    var sep = document.createElement("span"); sep.style.cssText = "font-size:11px;color:#6c6c70;margin:0 4px;"; sep.textContent = "puis";
    var s2 = makeSlotRow("","","","");
    slotsContainer.appendChild(sep); slotsContainer.appendChild(s2);
    row._slot2 = s2; addSlotBtn.style.display = "none";
    cmt2Wrap.style.display = "block";
  });
  slotsContainer.appendChild(addSlotBtn);
  row.appendChild(slotsContainer);

  var cmtWrap = document.createElement("div"); cmtWrap.className = "task-comment-wrap";
  var cmtTA = makeTextarea("Commentaire...", et.comment||"");
  cmtWrap.appendChild(cmtTA); row.appendChild(cmtWrap);

  // Commentaire slot 2
  var cmt2Wrap = document.createElement("div"); cmt2Wrap.className = "task-comment-wrap";
  var cmt2TA = makeTextarea("Commentaire 2eme creneau...", et.comment2||"");
  cmt2Wrap.appendChild(cmt2TA); row.appendChild(cmt2Wrap);
  if (!et.sh2 && !et.eh2) cmt2Wrap.style.display = "none";

  row._nameInp = nameInp; row._whoInp = whoInp;
  sec._extraFields.push({ sF: slot1._sF, eF: slot1._eF, cmtTA: cmtTA, cmt2TA: cmt2TA, color: color, row: row });
  sec.appendChild(row);
}

function makeSlotRow(sh, sm, eh, em) {
  var wrap = document.createElement("div"); wrap.style.cssText = "display:flex;align-items:center;gap:6px;flex-wrap:wrap;";
  var sGrp = document.createElement("div"); sGrp.className = "time-group";
  var sLbl = document.createElement("label"); sLbl.textContent = "Debut";
  var sF = makeTimeField(sh, sm);
  sGrp.appendChild(sLbl); sGrp.appendChild(sF);
  var eGrp = document.createElement("div"); eGrp.className = "time-group";
  var eLbl = document.createElement("label"); eLbl.textContent = "Fin";
  var eF = makeTimeField(eh, em);
  eGrp.appendChild(eLbl); eGrp.appendChild(eF);
  var prev = document.createElement("span"); prev.className = "time-preview";
  function updPrev() { var s=getTV(sF._getH(),sF._getM()),e=getTV(eF._getH(),eF._getM()); prev.textContent=s&&e?s+" -> "+e:s?s+" -> ?":""; }
  sF.addEventListener("input",updPrev); eF.addEventListener("input",updPrev); updPrev();
  wrap.appendChild(sGrp); wrap.appendChild(eGrp); wrap.appendChild(prev);
  wrap._sF = sF; wrap._eF = eF;
  return wrap;
}

// CHAMP HEURE
function makeTimeField(hVal, mVal) {
  var wrap = document.createElement("div"); wrap.className = "time-field";
  var hInp = document.createElement("input"); hInp.className = "h-inp"; hInp.inputMode = "numeric"; hInp.maxLength = 2; hInp.placeholder = "H"; hInp.value = hVal||"";
  var sep = document.createElement("span"); sep.className = "time-field-sep"; sep.textContent = ":";
  var mInp = document.createElement("input"); mInp.className = "m-inp"; mInp.inputMode = "numeric"; mInp.maxLength = 2; mInp.placeholder = "mm"; mInp.value = mVal||"";
  function validate() {
    hInp.classList.toggle("invalid", hInp.value!==""&&(isNaN(parseInt(hInp.value))||parseInt(hInp.value)>23));
    mInp.classList.toggle("invalid", mInp.value!==""&&(isNaN(parseInt(mInp.value))||parseInt(mInp.value)>59));
  }
  hInp.addEventListener("input", function() { this.value=this.value.replace(/\D/g,"").slice(0,2); if(this.value.length===2){if(parseInt(this.value)>23)this.value="23"; mInp.focus();} validate(); });
  hInp.addEventListener("blur", function() { if(this.value!==""){var v=parseInt(this.value);if(v>23)this.value="23";if(v<0)this.value="0";} validate(); });
  mInp.addEventListener("input", function() { this.value=this.value.replace(/\D/g,"").slice(0,2); if(this.value.length===2&&parseInt(this.value)>59)this.value="59"; validate(); });
  mInp.addEventListener("blur", function() { if(this.value!==""){var v=parseInt(this.value);if(v>59)this.value="59";if(v<0)this.value="0";} validate(); });
  wrap.appendChild(hInp); wrap.appendChild(sep); wrap.appendChild(mInp);
  wrap._getH = function() { return hInp.value; };
  wrap._getM = function() { return mInp.value; };
  return wrap;
}

function getTV(h, m) {
  if (!h) return "";
  var hv = parseInt(h), mv = parseInt(m)||0;
  if (isNaN(hv)||hv<0||hv>23||mv<0||mv>59) return "";
  return hv + ":" + (mv < 10 ? "0"+mv : mv);
}

function makeTextarea(placeholder, value) {
  var ta = document.createElement("textarea");
  ta.placeholder = placeholder; ta.value = value||""; ta.rows = 1;
  function resize() { ta.style.height="auto"; ta.style.height=ta.scrollHeight+"px"; }
  ta.addEventListener("input", resize); setTimeout(resize, 0);
  return ta;
}

// COLLECTE DONNEES
function collectData() {
  var container = document.getElementById("form-sections");
  var out = { targets:{}, tasks:{}, extraTasks:[] };

  ["grand_t1","petit_t1","rondelle"].forEach(function(key) {
    var sec = container.querySelector('[data-target-key="'+key+'"]');
    if (!sec) return;
    out.targets[key] = {
      sh: sec._sF._getH(), sm: sec._sF._getM(),
      eh: sec._eF._getH(), em: sec._eF._getM(),
      comment: sec._cmt.value
    };
  });

  var tasksSec = container._tasksSec;
  if (tasksSec) {
    TASKS_RONDELLE.forEach(function(task) {
      var f = tasksSec._taskFields[task.id]; if (!f) return;
      var d = { sh:f.sF._getH(), sm:f.sF._getM(), eh:f.eF._getH(), em:f.eF._getM(), comment:f.cmtTA.value };
      if (f.row._slot2) {
        d.sh2=f.row._slot2._sF._getH(); d.sm2=f.row._slot2._sF._getM();
        d.eh2=f.row._slot2._eF._getH(); d.em2=f.row._slot2._eF._getM();
        d.comment2 = f.cmt2TA ? f.cmt2TA.value : "";
      }
      out.tasks[task.id] = d;
    });

    tasksSec._extraFields.forEach(function(et) {
      var name = et.row._nameInp ? et.row._nameInp.value.trim() : "";
      var qui = et.row._whoInp ? et.row._whoInp.value.trim() : "";
      if (!name) return;
      var d = { machine:name, qui:qui, sh:et.sF._getH(), sm:et.sF._getM(), eh:et.eF._getH(), em:et.eF._getM(), comment:et.cmtTA.value };
      if (et.row._slot2) {
        d.sh2=et.row._slot2._sF._getH(); d.sm2=et.row._slot2._sF._getM();
        d.eh2=et.row._slot2._eF._getH(); d.em2=et.row._slot2._eF._getM();
        d.comment2 = et.cmt2TA ? et.cmt2TA.value : "";
      }
      out.extraTasks.push(d);
    });
  }
  return out;
}

// SAUVEGARDE
async function saveSession() {
  var data = collectData();
  var date = document.getElementById("f-date").value;
  var machine = document.getElementById("f-machine-name").value.trim();
  if (!date || !machine) { alert("Veuillez remplir la date et la machine."); return; }

  await set(ref(db, "global"), { date:date, machine:machine, savedAt:Date.now() });
  var dl = date ? new Date(date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}) : "";

  var existingId = window._editingSessionId;
  if (!existingId) {
    var existing = Object.entries(allSessions).find(function(e) { return e[1].date===date && e[1].machine===machine; });
    if (existing) existingId = existing[0];
  }

  var sessId = existingId || "sess_"+Date.now();
  await set(ref(db, "sessions/"+sessId), { date:date, machine:machine, ganttData:data, title:machine+" - "+dl, savedAt:Date.now() });
  window._editingSessionId = null;

  document.getElementById("sync-status").textContent = "Enregistre";
  setTimeout(function() { document.getElementById("sync-status").textContent = "Connecte"; }, 2000);
  showToast("Seance enregistree !", "#34c759");
  renderGantt(date, machine, data);
  setTimeout(function() { document.getElementById("gantt-section").scrollIntoView({behavior:"smooth"}); }, 100);

  document.getElementById("f-machine-name").value = "";
  document.getElementById("f-date").value = new Date().toISOString().slice(0,10);
  ganttData = { targets:{grand_t1:{},petit_t1:{},rondelle:{}}, tasks:{}, extraTasks:[] };
  buildForm();
}

async function newSession() {
  if (!confirm("Repartir a zero ?")) return;
  await remove(ref(db, "global"));
  justifications = [];
  document.getElementById("f-date").value = new Date().toISOString().slice(0,10);
  document.getElementById("f-machine-name").value = "";
  ganttData = { targets:{grand_t1:{},petit_t1:{},rondelle:{}}, tasks:{}, extraTasks:[] };
  buildForm();
  document.getElementById("gantt-container").innerHTML = '<div class="empty-gantt">Remplissez le formulaire et enregistrez pour afficher le Gantt</div>';
}

// HISTORIQUE
function renderHistory(sessions) {
  var list = document.getElementById("history-list");
  var arr = Object.entries(sessions).sort(function(a,b) { return (b[1].savedAt||0)-(a[1].savedAt||0); });
  document.getElementById("history-count").textContent = arr.length ? arr.length+" seance(s)" : "";
  if (!arr.length) { list.innerHTML = '<div class="history-empty">Aucune seance enregistree</div>'; return; }

  var totalPages = Math.ceil(arr.length/HISTORY_PAGE_SIZE);
  if (historyPage >= totalPages) historyPage = totalPages-1;
  if (historyPage < 0) historyPage = 0;

  var pageArr = arr.slice(historyPage*HISTORY_PAGE_SIZE, (historyPage+1)*HISTORY_PAGE_SIZE);
  var html = pageArr.map(function(entry) {
    var id=entry[0], s=entry[1];
    var dl = s.date ? new Date(s.date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}) : "";
    return '<div class="history-item">'+
      '<div class="history-item-left" data-load="'+id+'">'+
      '<div class="history-item-title">'+( s.machine||"Seance")+'</div>'+
      '<div class="history-item-sub">'+dl+'</div>'+
      '</div>'+
      '<div class="history-item-actions">'+
      '<span class="history-load-btn" data-load="'+id+'">Charger</span>'+
      '<span class="history-edit-btn" data-edit="'+id+'">Modifier</span>'+
      '<span class="history-del-btn" data-del="'+id+'">Supprimer</span>'+
      '</div>'+
      '</div>';
  }).join("");

  if (totalPages > 1) {
    html += '<div class="history-pagination">'+
      '<button class="history-page-btn" id="hist-prev" '+(historyPage===0?'disabled':'')+'>Precedent</button>'+
      '<span class="history-page-info">'+(historyPage+1)+' / '+totalPages+'</span>'+
      '<button class="history-page-btn" id="hist-next" '+(historyPage>=totalPages-1?'disabled':'')+'>Suivant</button>'+
      '</div>';
  }

  list.innerHTML = html;
  list.querySelectorAll("[data-load]").forEach(function(el) { el.addEventListener("click", function() { loadHistorySession(el.dataset.load); }); });
  list.querySelectorAll("[data-edit]").forEach(function(el) { el.addEventListener("click", function() { editHistorySession(el.dataset.edit); }); });
  list.querySelectorAll("[data-del]").forEach(function(el) { el.addEventListener("click", function() { deleteSession(el.dataset.del); }); });

  var pb = document.getElementById("hist-prev"), nb = document.getElementById("hist-next");
  if (pb) pb.addEventListener("click", function() { historyPage--; renderHistory(allSessions); });
  if (nb) nb.addEventListener("click", function() { historyPage++; renderHistory(allSessions); });
}

async function loadHistorySession(id) {
  var snap = await get(ref(db, "sessions/"+id));
  var d = snap.val(); if (!d) return;
  document.getElementById("f-date").value = d.date || "";
  document.getElementById("f-machine-name").value = d.machine || "";
  ganttData = d.ganttData || { targets:{grand_t1:{},petit_t1:{},rondelle:{}}, tasks:{}, extraTasks:[] };
  buildForm();
  renderGantt(d.date, d.machine, d.ganttData || {});
  setTimeout(function() { document.getElementById("gantt-section").scrollIntoView({behavior:"smooth"}); }, 200);
}

async function editHistorySession(id) {
  var snap = await get(ref(db, "sessions/"+id));
  var d = snap.val(); if (!d) return;
  document.getElementById("f-date").value = d.date || "";
  document.getElementById("f-machine-name").value = d.machine || "";
  ganttData = d.ganttData || { targets:{grand_t1:{},petit_t1:{},rondelle:{}}, tasks:{}, extraTasks:[] };
  buildForm();
  window._editingSessionId = id;
  document.querySelector(".info-sec").scrollIntoView({behavior:"smooth"});
  showToast("Seance chargee - modifiez puis enregistrez", "#1a3a6b");
}

async function deleteSession(id) { if (!confirm("Supprimer ?")) return; await remove(ref(db, "sessions/"+id)); }
async function deleteAllHistory() { if (!confirm("Supprimer tout ?")) return; await remove(ref(db, "sessions")); }

// GANTT
var toMin = function(s) { if(!s||!s.includes(":"))return null; var p=s.split(":").map(Number); return p[0]*60+(p[1]||0); };
var fmtDur = function(s,e) { var d=e-s; if(d<=0)return "--"; var h=Math.floor(d/60),m=d%60; return h&&m?h+"h "+m+"min":h?h+"h":m+"min"; };

function renderGantt(date, machine, data) {
  var container = document.getElementById("gantt-container");
  var targets = data.targets || {};
  var tasks = data.tasks || {};
  var extras = data.extraTasks || [];

  // REMARQUE 3 — tri chronologique des taches dynamiques
  extras = extras.slice().sort(function(a, b) {
    var ha = parseInt(a.sh||"") , ma = parseInt(a.sm||"0")||0;
    var hb = parseInt(b.sh||"") , mb = parseInt(b.sm||"0")||0;
    var sa = isNaN(ha) ? null : ha*60+ma;
    var sb = isNaN(hb) ? null : hb*60+mb;
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sa - sb;
  });

  allTasks = {};
  var minT = Infinity, maxT = -Infinity;

  function regT(h,m,h2,m2) {
    var s=toMin(getTV(h,m)), e=toMin(getTV(h2,m2));
    if(s!==null&&s>0) minT=Math.min(minT,s);
    if(e!==null&&e>0) maxT=Math.max(maxT,e);
  }

  ["grand_t1","petit_t1","rondelle"].forEach(function(key) {
    var t = targets[key]||{};
    regT(t.sh||"",t.sm||"",t.eh||"",t.em||"");
  });

  TASKS_RONDELLE.forEach(function(task) {
    var t = tasks[task.id]||{};
    regT(t.sh||"",t.sm||"",t.eh||"",t.em||"");
    if(t.sh2||t.eh2) regT(t.sh2||"",t.sm2||"",t.eh2||"",t.em2||"");
  });

  extras.forEach(function(et) {
    regT(et.sh||"",et.sm||"",et.eh||"",et.em||"");
    if(et.sh2||et.eh2) regT(et.sh2||"",et.sm2||"",et.eh2||"",et.em2||"");
  });

  if (!isFinite(minT)) minT=360; if (!isFinite(maxT)) maxT=minT+120;
  minT = Math.max(0, minT-10); maxT = maxT+10;
  minT = Math.floor(minT/60)*60; maxT = Math.ceil(maxT/60)*60;

  var total=maxT-minT, slotMin=10, slots=total/slotMin;
  var slotW = Math.max(35, Math.min(90, 900/slots));

  ganttGlobalMin = minT; ganttSpan = total;

  var dateStr = date ? new Date(date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}) : "";
  document.getElementById("gantt-machine-title").textContent = machine || "Changement - Temp/Machine";
  document.getElementById("gantt-subtitle").textContent = "SGD Pharma - Sucy-en-Brie" + (dateStr ? " - "+dateStr : "");

  // REMARQUE 1 — couleurs TARGET toutes en nuances de rouge
  var targetDefs = [
    { key:"grand_t1", label:"TARGET (Grand T1)", color:"#c0392b" },
    { key:"petit_t1", label:"TARGET (Petit t1)", color:"#e74c3c" },
    { key:"rondelle", label:"TARGET (Rondelle)", color:"#e8534a" },
  ];

  var h = '<table class="gantt">';

  h += '<tr><th colspan="5"></th>';
  for (var m=minT; m<maxT; m+=60) h += '<th colspan="'+(60/slotMin)+'" style="background:#1a3a6b;color:#fff">60 min</th>';
  h += '</tr><tr><th class="chk-cell"></th><th style="width:150px;text-align:left;padding-left:8px">MACHINE / SECTEUR</th><th style="width:80px">WHO</th><th style="width:52px">START</th><th style="width:48px">FINAL</th>';

  for (var m=minT; m<maxT; m+=slotMin) {
    var hh=Math.floor(m/60).toString().padStart(2,"0"), mm=(m%60).toString().padStart(2,"0");
    h += '<th style="width:'+slotW+'px;font-size:10px;color:#555;font-weight:400">'+(mm==="00"?hh+"h":mm)+'</th>';
  }
  h += '</tr>';

  h += '<tr><td colspan="'+(5+slots)+'" style="background:#1a3a6b;color:#fff;font-weight:700;font-size:13px;padding:7px 10px;text-align:center;">'+machine+(dateStr?" - "+dateStr:"")+'</td></tr>';

  targetDefs.forEach(function(td) {
    var t = targets[td.key] || {};
    var start = getTV(t.sh||"",t.sm||""), end = getTV(t.eh||"",t.em||"");
    var s = toMin(start), e = toMin(end);
    var uid = "target_"+td.key;
    allTasks[uid] = {machine:td.label, qui:"--", start:start, end:end, color:td.color};

    var bar = "";
    if (s!==null&&e!==null&&e>s) {
      var lp=((s-minT)/total)*100, wp=((e-s)/total)*100;
      bar = '<div class="gantt-bar" style="left:'+lp+'%;width:'+wp+'%;background:'+td.color+'" data-uid="'+uid+'" data-label="'+td.label+'" data-qui="--" data-start="'+start+'" data-end="'+end+'" data-color="'+td.color+'" data-cmt="'+encCmt(t.comment||"")+'">'+td.label.replace("TARGET ","")+'</div>';
    }

    var isSelA=selectedIds[0]===uid, isSelB=selectedIds[1]===uid;
    h += '<tr class="target-section'+(isSelA?" sel-a":isSelB?" sel-b":"")+'" data-uid="'+uid+'" style="background:'+td.color+'22;">'+
      '<td class="chk-cell info"><input type="checkbox" '+(selectedIds.includes(uid)?"checked":"")+' data-uid="'+uid+'"></td>'+
      '<td class="info machine-name" style="color:'+td.color+';font-weight:700;">'+td.label+'</td>'+
      '<td class="info who-cell">--</td>'+
      '<td class="info time-cell">'+(start||"--")+'</td>'+
      '<td class="info time-cell">'+(end||"--")+'</td>'+
      '<td colspan="'+slots+'" class="bar-cell"><div class="bar-inner">'+bar+'</div></td>'+
      '</tr>';
  });

  h += '<tr><td colspan="'+(5+slots)+'" style="background:#e8edf5;height:4px;"></td></tr>';

  // Fusionner taches fixes + extras en une seule liste triee chronologiquement
  var allTaskRows = [];
  TASKS_RONDELLE.forEach(function(task, idx) {
    var t = tasks[task.id] || {};
    var start = getTV(t.sh||"",t.sm||"");
    allTaskRows.push({ type:"fixed", task:task, t:t, idx:idx, start:start, sMin:toMin(start) });
  });
  extras.forEach(function(et, idx) {
    var start = getTV(et.sh||"",et.sm||"");
    allTaskRows.push({ type:"extra", et:et, idx:idx, start:start, sMin:toMin(start) });
  });
  allTaskRows.sort(function(a, b) {
    if (a.sMin===null) return 1;
    if (b.sMin===null) return -1;
    return a.sMin - b.sMin;
  });

  allTaskRows.forEach(function(row, rowIdx) {
    if (row.type === "fixed") {
      var task=row.task, t=row.t, idx=row.idx;
      var start = getTV(t.sh||"",t.sm||""), end = getTV(t.eh||"",t.em||"");
      var s = toMin(start), e = toMin(end);
      var color = TASK_COLORS[idx % TASK_COLORS.length];
      var uid = "task_"+task.id;
      var quiDisplay = ganttQuiOverrides[uid] || t.qui || task.qui;
      allTasks[uid] = {machine:task.machine, qui:quiDisplay, start:start, end:end, color:color};

      var bar = "";
      if (s!==null&&e!==null&&e>s) {
        var lp=((s-minT)/total)*100, wp=((e-s)/total)*100;
        bar = '<div class="gantt-bar" style="left:'+lp+'%;width:'+wp+'%;background:'+color+'" data-uid="'+uid+'" data-label="'+task.machine+'" data-qui="'+quiDisplay+'" data-start="'+start+'" data-end="'+end+'" data-color="'+color+'" data-cmt="'+encCmt(t.comment||"")+'">'+( t.comment?'<div class="gantt-comment-dot"></div>':"")+'</div>';
      }
      if (t.sh2 || t.eh2) {
        var start2=getTV(t.sh2||"",t.sm2||""), end2=getTV(t.eh2||"",t.em2||"");
        var s2=toMin(start2), e2=toMin(end2);
        if (s!==null&&e!==null&&s2!==null&&s2>e) {
          var gapL=((e-minT)/total)*100, gapW=((s2-e)/total)*100;
          bar += '<div style="position:absolute;top:8px;bottom:8px;left:'+gapL+'%;width:'+gapW+'%;background:'+color+';opacity:.25;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;border-radius:3px;">&#x2192;</div>';
        }
        if (s2!==null&&e2!==null&&e2>s2) {
          var lp2=((s2-minT)/total)*100, wp2=((e2-s2)/total)*100;
          bar += '<div class="gantt-bar" style="left:'+lp2+'%;width:'+wp2+'%;background:'+color+';opacity:.75;" data-uid="'+uid+'_2" data-label="'+task.machine+' (2)" data-qui="'+quiDisplay+'" data-start="'+start2+'" data-end="'+end2+'" data-color="'+color+'" data-cmt="'+encCmt(t.comment2||"")+'"></div>';
        }
      }
      var isSelA=selectedIds[0]===uid, isSelB=selectedIds[1]===uid;
      var rowCls=isSelA?"sel-a":isSelB?"sel-b":rowIdx%2===0?"odd":"even";
      h += '<tr class="'+rowCls+'" data-uid="'+uid+'">'+
        '<td class="chk-cell info"><input type="checkbox" '+(selectedIds.includes(uid)?"checked":"")+' data-uid="'+uid+'"></td>'+
        '<td class="info machine-name"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+color+';margin-right:5px;vertical-align:middle"></span>'+task.machine+'</td>'+
        '<td class="info who-cell who-editable" data-uid="'+uid+'" title="Cliquer pour modifier">'+quiDisplay+' [mod]</td>'+
        '<td class="info time-cell">'+(start||"--")+'</td>'+
        '<td class="info time-cell">'+(end||"--")+'</td>'+
        '<td colspan="'+slots+'" class="bar-cell"><div class="bar-inner">'+bar+'</div></td>'+
        '</tr>';

    } else {
      var et=row.et, idx=row.idx;
      var color = TASK_COLORS[(TASKS_RONDELLE.length + idx) % TASK_COLORS.length];
      var uid = "task_extra_"+idx;
      var start = getTV(et.sh||"",et.sm||""), end = getTV(et.eh||"",et.em||"");
      var s = toMin(start), e = toMin(end);
      allTasks[uid] = {machine:et.machine||"Extra", qui:et.qui||"", start:start, end:end, color:color};

      var bar = "";
      if (s!==null&&e!==null&&e>s) {
        var lp=((s-minT)/total)*100, wp=((e-s)/total)*100;
        bar = '<div class="gantt-bar" style="left:'+lp+'%;width:'+wp+'%;background:'+color+'" data-uid="'+uid+'" data-label="'+(et.machine||"Extra")+'" data-qui="'+(et.qui||"")+'" data-start="'+start+'" data-end="'+end+'" data-color="'+color+'" data-cmt="'+encCmt(et.comment||"")+'">'+( et.comment?'<div class="gantt-comment-dot"></div>':"")+'</div>';
      }
      if (et.sh2 || et.eh2) {
        var start2=getTV(et.sh2||"",et.sm2||""), end2=getTV(et.eh2||"",et.em2||"");
        var s2=toMin(start2), e2=toMin(end2);
        if (s!==null&&e!==null&&s2!==null&&s2>e) {
          var gapL=((e-minT)/total)*100, gapW=((s2-e)/total)*100;
          bar += '<div style="position:absolute;top:8px;bottom:8px;left:'+gapL+'%;width:'+gapW+'%;background:'+color+';opacity:.25;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;border-radius:3px;">&#x2192;</div>';
        }
        if (s2!==null&&e2!==null&&e2>s2) {
          var lp2=((s2-minT)/total)*100, wp2=((e2-s2)/total)*100;
          bar += '<div class="gantt-bar" style="left:'+lp2+'%;width:'+wp2+'%;background:'+color+';opacity:.75;" data-uid="'+uid+'_2" data-label="'+(et.machine||"Extra")+' (2)" data-qui="'+(et.qui||"")+'" data-start="'+start2+'" data-end="'+end2+'" data-color="'+color+'" data-cmt="'+encCmt(et.comment2||"")+'"></div>';
        }
      }
      var isSelA=selectedIds[0]===uid, isSelB=selectedIds[1]===uid;
      var rowCls=isSelA?"sel-a":isSelB?"sel-b":rowIdx%2===0?"odd":"even";
      h += '<tr class="'+rowCls+'" data-uid="'+uid+'">'+
        '<td class="chk-cell info"><input type="checkbox" '+(selectedIds.includes(uid)?"checked":"")+' data-uid="'+uid+'"></td>'+
        '<td class="info machine-name"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+color+';margin-right:5px;vertical-align:middle"></span>'+(et.machine||"Extra")+'</td>'+
        '<td class="info who-cell">'+(et.qui||"")+'</td>'+
      '<td class="info time-cell">'+(start||"--")+'</td>'+
      '<td class="info time-cell">'+(end||"--")+'</td>'+
      '<td colspan="'+slots+'" class="bar-cell"><div class="bar-inner">'+bar+'</div></td>'+
      '</tr>';
    }
  });

  h += '</table>';
  container.innerHTML = h;

  container.querySelectorAll(".gantt-bar").forEach(function(el) {
    el.addEventListener("mouseenter", function(e) { showTT(e, el.dataset.label, el.dataset.qui, el.dataset.start, el.dataset.end, el.dataset.color, el.dataset.cmt); });
    el.addEventListener("mouseleave", hideTT);
  });

  container.querySelectorAll("input[type=checkbox][data-uid]").forEach(function(chk) {
    chk.addEventListener("change", function() { toggleSelect(chk.dataset.uid); });
  });

  container.addEventListener("click", function(e) {
    var cell = e.target.closest(".who-editable");
    if (!cell) return;
    showQuiEditor(cell, cell.dataset.uid, cell.textContent.replace(" [mod]","").trim());
  });

  document.getElementById("gantt-section").style.display = "block";
  updateCmpBar();
  renderJustifications();
}

// TOOLTIP
function showTT(e, label, qui, start, end, color, comment) {
  var TT = document.getElementById("tooltip");
  document.getElementById("tt-dot").style.background = color||"#3b82f6";
  document.getElementById("tt-title").textContent = label||"--";
  document.getElementById("tt-qui").textContent = qui||"--";
  document.getElementById("tt-start").textContent = start||"--";
  document.getElementById("tt-end").textContent = end||"--";
  var s=toMin(start), en=toMin(end);
  document.getElementById("tt-dur").textContent = (s!==null&&en!==null) ? "⏱ "+fmtDur(s,en) : "";
  var cb = document.getElementById("tt-comment-box");
  var decoded = comment ? comment.replace(/\\n/g,"\n") : "";
  document.getElementById("tt-comment").textContent = decoded;
  cb.style.display = decoded ? "block" : "none";
  TT.classList.add("visible");

  var ttH=TT.offsetHeight||250, ttW=TT.offsetWidth||310;
  if (window.innerWidth < 600) {
    TT.style.left="50%"; TT.style.transform="translateX(-50%)"; TT.style.top="auto"; TT.style.bottom="10px"; TT.style.width="90vw"; TT.style.maxWidth="90vw";
  } else {
    TT.style.transform=""; TT.style.bottom="auto"; TT.style.width=""; TT.style.maxWidth="300px";
    var x=e.clientX+16, y=e.clientY+16;
    if(x+ttW>window.innerWidth) x=e.clientX-ttW-8;
    if(y+ttH>window.innerHeight) y=e.clientY-ttH-8;
    if(y<0) y=8;
    TT.style.left=x+"px"; TT.style.top=y+"px";
  }
}

function hideTT() { document.getElementById("tooltip").classList.remove("visible"); }

// SELECTION
function toggleSelect(id) {
  var idx = selectedIds.indexOf(id);
  if (idx>-1) selectedIds.splice(idx,1);
  else { if(selectedIds.length>=2) selectedIds.shift(); selectedIds.push(id); }
  updateCmpBar();
  document.querySelectorAll("[data-uid]").forEach(function(tr) {
    var uid=tr.dataset.uid, chk=tr.querySelector("input[type=checkbox]");
    if(chk){chk.checked=selectedIds.includes(uid); tr.classList.toggle("sel-a",selectedIds[0]===uid); tr.classList.toggle("sel-b",selectedIds[1]===uid);}
  });
}

function updateCmpBar() {
  var bar = document.getElementById("cmp-bar");
  var justifContainer = document.getElementById("justif-btn-container");
  if (selectedIds.length >= 1) {
    bar.classList.add("visible");
    document.getElementById("cmp-bar-names").textContent = selectedIds.map(function(id){return allTasks[id]?allTasks[id].machine||"--":"--";}).join(" vs ");
    if (justifContainer) justifContainer.style.display = "block";
  } else {
    bar.classList.remove("visible");
    if (justifContainer) justifContainer.style.display = "none";
    var d = document.getElementById("justif-dialog"); if(d) d.remove();
  }
}

function doCompare() {
  if (selectedIds.length!==2) return;
  var idA=selectedIds[0], idB=selectedIds[1], A=allTasks[idA], B=allTasks[idB]; if(!A||!B) return;
  var sA=toMin(A.start),sB=toMin(B.start);
  document.getElementById("cmp-result-title").textContent = A.machine+" vs "+B.machine;
  document.getElementById("cmp-cards").innerHTML =
    '<div class="cmp-card a"><div class="cmp-card-badge a">A</div><div class="cmp-card-name">'+A.machine+'</div><div class="cmp-card-time">'+(A.start||"?")+" -> "+(A.end||"?")+'</div></div>'+
    '<div class="cmp-card b"><div class="cmp-card-badge b">B</div><div class="cmp-card-name">'+B.machine+'</div><div class="cmp-card-time">'+(B.start||"?")+" -> "+(B.end||"?")+'</div></div>';
  var diffText="--", diffSub="Donnees insuffisantes";
  if (sA!==null&&sB!==null) {
    var d=Math.abs(sB-sA),hh=Math.floor(d/60),mm=d%60;
    diffText=hh&&mm?hh+"h "+mm+"min":hh?hh+"h":mm+"min";
    diffSub=sB>sA?"B demarre "+diffText+" apres A":sB<sA?"B demarre "+diffText+" avant A":"Meme heure";
  }
  document.getElementById("cmp-diff-box").innerHTML = '<div class="cmp-diff-label">Ecart</div><div class="cmp-diff-value">'+diffText+'</div><div class="cmp-diff-sub">'+diffSub+'</div>';
  document.getElementById("cmp-result").classList.add("visible");
  document.getElementById("cmp-result").scrollIntoView({behavior:"smooth",block:"nearest"});
}

function closeCompare() { document.getElementById("cmp-result").classList.remove("visible"); }

// JUSTIFICATION
function openJustifDialog() {
  if (selectedIds.length < 1) return;
  var existing = document.getElementById("justif-dialog"); if(existing){existing.remove();return;}
  var idA=selectedIds[0], idB=selectedIds[1]||null;
  var taskA=allTasks[idA], taskB=idB?allTasks[idB]:null;
  if (!taskA) return;

  var ecartMin = "";
  if (taskB) {
    var endA=toMin(taskA.end), startB=toMin(taskB.start), endB=toMin(taskB.end), startA=toMin(taskA.start);
    if (endA!==null&&startB!==null&&startB>endA) ecartMin=startB-endA;
    else if (endB!==null&&startA!==null&&startA>endB) ecartMin=startA-endB;
  }

  var dialog = document.createElement("div"); dialog.id="justif-dialog"; dialog.className="justif-dialog";
  dialog.innerHTML =
    '<div class="justif-dialog-title">Justification'+(ecartMin?" - "+ecartMin+" min":"")+'</div>'+
    '<div class="justif-dialog-sub">'+taskA.machine+(taskB?" -> "+taskB.machine:"")+'</div>'+
    '<textarea id="justif-input" class="justif-input" placeholder="Ex: Attente piece, pause..." rows="3"></textarea>'+
    '<div class="justif-dialog-actions">'+
    '<button id="justif-confirm" class="justif-confirm-btn">Enregistrer</button>'+
    '<button id="justif-cancel" class="justif-cancel-btn">Annuler</button>'+
    '</div>';

  document.getElementById("justif-btn-container").insertAdjacentElement("afterend", dialog);
  document.getElementById("justif-input").focus();
  document.getElementById("justif-cancel").addEventListener("click", function(){dialog.remove();});
  document.getElementById("justif-confirm").addEventListener("click", function(){
    var text=document.getElementById("justif-input").value.trim();
    if(!text){alert("Veuillez saisir un commentaire.");return;}
    justifications.push({taskA:taskA, taskB:taskB, ecartMin:ecartMin, text:text});
    dialog.remove(); renderJustifications();
    showToast("Justification enregistree !", "#f59e0b");
  });
}

function renderJustifications() {
  var container = document.getElementById("justif-container"); if(!container) return;
  container.innerHTML = "";
  if (!justifications.length) return;

  var title=document.createElement("div"); title.style.cssText="font-size:11px;font-weight:700;color:#6c6c70;text-transform:uppercase;margin-bottom:8px;padding:0 4px;"; title.textContent="Justifications"; container.appendChild(title);

  justifications.forEach(function(j, idx) {
    var card=document.createElement("div"); card.className="justif-timeline-card";
    var row=document.createElement("div"); row.className="justif-timeline-row";
    var boxA=document.createElement("div"); boxA.className="justif-task-box"; boxA.style.background=j.taskA.color||"#3b82f6";
    boxA.innerHTML='<div class="justif-task-name">'+j.taskA.machine+'</div><div class="justif-task-time">'+(j.taskA.end||"?")+'</div>'; row.appendChild(boxA);
    var arrow=document.createElement("div"); arrow.className="justif-arrow";
    arrow.innerHTML='<div class="justif-arrow-line"></div>'+(j.ecartMin?'<div class="justif-arrow-label">'+j.ecartMin+' min</div>':'')+'<div class="justif-arrow-head">&#x25B6;</div>'; row.appendChild(arrow);
    if(j.taskB){var boxB=document.createElement("div"); boxB.className="justif-task-box"; boxB.style.background=j.taskB.color||"#22c55e"; boxB.innerHTML='<div class="justif-task-name">'+j.taskB.machine+'</div><div class="justif-task-time">'+(j.taskB.start||"?")+'</div>'; row.appendChild(boxB);}
    var delBtn=document.createElement("button"); delBtn.className="justif-del-btn"; delBtn.textContent="✕";
    delBtn.addEventListener("click",function(){justifications.splice(idx,1);renderJustifications();}); row.appendChild(delBtn);
    var comment=document.createElement("div"); comment.className="justif-comment"; comment.textContent=j.text;
    card.appendChild(row); card.appendChild(comment); container.appendChild(card);
  });
}

// QUI EDITABLE
function showQuiEditor(cell, uid, current) {
  var existing=document.getElementById("qui-editor"); if(existing) existing.remove();
  var editor=document.createElement("div"); editor.id="qui-editor"; editor.className="qui-editor";
  var input=document.createElement("input"); input.type="text"; input.value=current; input.className="qui-editor-input"; input.placeholder="Nom du responsable";
  var saveBtn=document.createElement("button"); saveBtn.textContent="✓"; saveBtn.className="qui-editor-save";
  var cancelBtn=document.createElement("button"); cancelBtn.textContent="✕"; cancelBtn.className="qui-editor-cancel";
  editor.appendChild(input); editor.appendChild(saveBtn); editor.appendChild(cancelBtn);
  cell.style.position="relative"; cell.appendChild(editor); input.focus(); input.select();

  function applyEdit() {
    var val=input.value.trim();
    if(val){
      ganttQuiOverrides[uid]=val; cell.textContent=val+" [mod]"; cell.dataset.uid=uid;
      var date=document.getElementById("f-date").value, machine=document.getElementById("f-machine-name").value.trim();
      var ex=Object.entries(allSessions).find(function(e){return e[1].date===date&&e[1].machine===machine;});
      if(!ex) ex=Object.entries(allSessions).find(function(e){return true;});
      if(ex){
        var sessId=ex[0], session=JSON.parse(JSON.stringify(ex[1]));
        var taskId=uid.replace("task_","");
        if(!session.ganttData) session.ganttData={};
        if(!session.ganttData.tasks) session.ganttData.tasks={};
        if(!session.ganttData.tasks[taskId]) session.ganttData.tasks[taskId]={};
        session.ganttData.tasks[taskId].qui=val;
        set(ref(db,"sessions/"+sessId),session);
        showToast("Responsable mis a jour !", "#1a3a6b");
      }
    }
    editor.remove();
  }

  saveBtn.addEventListener("click",applyEdit);
  input.addEventListener("keydown",function(e){if(e.key==="Enter")applyEdit(); if(e.key==="Escape")editor.remove();});
  cancelBtn.addEventListener("click",function(){editor.remove();});
}

// EXPORT EXCEL
function initExportButtons() {
  document.getElementById("export-toggle-btn").addEventListener("click",function(e){
    e.stopPropagation(); e.preventDefault();
    var menu=document.getElementById("export-menu");
    menu.style.display=menu.style.display==="none"?"block":"none";
  });

  document.addEventListener("click",function(e){
    var dd=document.getElementById("export-dropdown");
    if(dd&&!dd.contains(e.target)) document.getElementById("export-menu").style.display="none";
  });

  document.getElementById("export-all").addEventListener("click",function(e){e.stopPropagation();exportToExcel(null,null);document.getElementById("export-menu").style.display="none";});
  document.getElementById("export-month").addEventListener("click",function(e){
    e.stopPropagation();
    var now=new Date(), from=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10), to=new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().slice(0,10);
    exportToExcel(from,to); document.getElementById("export-menu").style.display="none";
  });
  document.getElementById("export-custom").addEventListener("click",function(e){
    e.stopPropagation();
    var r=document.getElementById("export-date-range"); r.style.display=r.style.display==="none"?"flex":"none";
  });
  document.getElementById("export-confirm-btn").addEventListener("click",function(e){
    e.stopPropagation();
    var from=document.getElementById("export-date-from").value, to=document.getElementById("export-date-to").value;
    if(!from||!to){alert("Veuillez choisir les deux dates.");return;}
    exportToExcel(from,to); document.getElementById("export-menu").style.display="none"; document.getElementById("export-date-range").style.display="none";
  });
}

function exportToExcel(dateFrom, dateTo) {
  var sessions=Object.values(allSessions);
  var filtered=sessions;
  if(dateFrom&&dateTo) filtered=sessions.filter(function(s){return s.date>=dateFrom&&s.date<=dateTo;});
  if(!filtered.length){alert("Aucune seance trouvee.");return;}

  filtered.sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  var rows=[["Date","Jour","Machine","Section","Tache","Qui","Debut","Fin","Duree (min)","Commentaire"]];

  filtered.forEach(function(session) {
    var dateStr=session.date||"", jourStr=dateStr?new Date(dateStr+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long"}):"", machine=session.machine||"";
    var data=session.ganttData||{}, targets=data.targets||{}, tasks=data.tasks||{}, extras=data.extraTasks||[];

    [["grand_t1","TARGET (Grand T1)"],["petit_t1","TARGET (Petit t1)"],["rondelle","TARGET (Rondelle)"]].forEach(function(td){
      var t=targets[td[0]]||{};
      var start=getTV(t.sh||"",t.sm||""), end=getTV(t.eh||"",t.em||"");
      var dur=(toMin(start)!==null&&toMin(end)!==null)?toMin(end)-toMin(start):"";
      rows.push([dateStr,jourStr,machine,td[1],"Target","--",start,end,dur,(t.comment||"").replace(/\n/g," | ")]);
    });

    TASKS_RONDELLE.forEach(function(task){
      var t=tasks[task.id]||{};
      var start=getTV(t.sh||"",t.sm||""), end=getTV(t.eh||"",t.em||"");
      var dur=(toMin(start)!==null&&toMin(end)!==null)?toMin(end)-toMin(start):"";
      rows.push([dateStr,jourStr,machine,"Taches",task.machine,t.qui||task.qui,start,end,dur,(t.comment||"").replace(/\n/g," | ")]);
    });

    extras.forEach(function(et){
      var start=getTV(et.sh||"",et.sm||""), end=getTV(et.eh||"",et.em||"");
      var dur=(toMin(start)!==null&&toMin(end)!==null)?toMin(end)-toMin(start):"";
      rows.push([dateStr,jourStr,machine,"Taches",et.machine||"Extra",et.qui||"",start,end,dur,(et.comment||"").replace(/\n/g," | ")]);
    });

    rows.push(["","","","","","","","","",""]);
  });

  var csv=rows.map(function(row){return row.map(function(cell){var str=String(cell!==null&&cell!==undefined?cell:""); str=str.replace(/\n/g," | ").replace(/\r/g,""); return(str.indexOf(";")>-1||str.indexOf('"')>-1)?'"'+str.replace(/"/g,'""')+'"':str;}).join(";");}).join("\n");
  var blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  var url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download="SGD_Pharma_Gantt_"+new Date().toLocaleDateString("fr-FR").replace(/\//g,"-")+".csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// TOAST
function showToast(message, color) {
  var ex=document.getElementById("toast-notif"); if(ex) ex.remove();
  var toast=document.createElement("div"); toast.id="toast-notif"; toast.textContent=message;
  toast.style.cssText="position:fixed;top:70px;left:50%;transform:translateX(-50%);background:"+color+";color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);transition:opacity .3s;font-family:Arial,sans-serif;";
  document.body.appendChild(toast);
  setTimeout(function(){toast.style.opacity="0";setTimeout(function(){toast.remove();},300);},2500);
}

function encCmt(str) {
  if(!str) return "";
  return str.replace(/\\/g,"\\\\").replace(/'/g,"&#39;").replace(/"/g,"&quot;").replace(/\n/g,"\\n");
}
