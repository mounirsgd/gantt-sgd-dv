import { initializeApp }                  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, get,
         onValue, remove }               from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
    {id:"st1_1", machine:"Echange bague orifice",         qui:"Alimenteurs"},
    {id:"st1_2", machine:"Cote moule",                    qui:"IS"},
    {id:"st1_3", machine:"Cote ebauche",                  qui:"IS"},
    {id:"st1_4", machine:"Entonnoir entree",              qui:"Alimenteurs"},
    {id:"st1_5", machine:"Paraison entree",               qui:"Alimenteurs"},
    {id:"st1_6", machine:"Demarrage sections sans verre", qui:"Chef de section"},
    {id:"st1_7", machine:"Demarrage sections avec verre", qui:"Chef de section"},
    {id:"st1_8", machine:"Toutes machines avec verre",    qui:"Chef de section"},
    {id:"st1_9", machine:"Verre vers le Lehr",            qui:"Chef de section"},
  ]},
  grand_t1: { label:"OBJECTIF (Grand T1)", color:"#c0392b", tasks:[
    {id:"gt1_1", machine:"Fin production precedente bout froid", qui:"A definir"},
    {id:"gt1_2", machine:"Vidage de ligne bout froid",           qui:"A definir"},
    {id:"gt1_3", machine:"Arrivee flacons bout froid",           qui:"A definir"},
    {id:"gt1_4", machine:"Reglage ligne et machines inspection",  qui:"A definir"},
    {id:"gt1_5", machine:"Qualite validee approuvee",            qui:"A definir"},
    {id:"gt1_6", machine:"Emballage valide palettise",           qui:"A definir"},
  ]},
  rondelle: { label:"OBJECTIF (Rondelle)", color:"#7d3c98", tasks:[
    {id:"ron_1",  machine:"Nettoyage machine",               qui:"Production"},
    {id:"ron_2",  machine:"Changement cuvette",              qui:"Alimenteurs"},
    {id:"ron_3",  machine:"Cote finisseur",                  qui:"Atelier IS"},
    {id:"ron_4",  machine:"Cote ebauche",                    qui:"Atelier IS"},
    {id:"ron_5",  machine:"Entonnoir sous verre",            qui:"Alimenteurs"},
    {id:"ron_6",  machine:"Distributeur sous verre",         qui:"Alimenteurs"},
    {id:"ron_7",  machine:"Demarrage section sans flacon",   qui:"Chef de section"},
    {id:"ron_8",  machine:"Demarrage section avec flacon",   qui:"Chef de section"},
    {id:"ron_9",  machine:"Machine complete avec flacon",    qui:"Chef de section"},
    {id:"ron_10", machine:"Mise a l arche",                  qui:"Chef de section"},
  ]}
};

// ── Etat local ───────────────────────────────────────────────
let allSessions      = {};
let activeType       = null;
let typeStates       = { small_t1:{}, grand_t1:{}, rondelle:{} };
let selectedIds      = [];
let allTasks         = {};
let historyPage      = 0;
let ganttQuiOverrides= {};
let ganttCurrentDef  = null;
let ganttGlobalMin   = 0;
let ganttSpan        = 1;
let justifications   = [];
let appReady         = false;

const HISTORY_PAGE_SIZE = 5;

// ── Selecteurs DOM ───────────────────────────────────────────
const loginScreen = document.getElementById("login-screen");
const appDiv      = document.getElementById("app");
const loginEmail  = document.getElementById("login-email");
const loginPass   = document.getElementById("login-pass");
const loginBtn    = document.getElementById("login-btn");
const loginError  = document.getElementById("login-error");
const logoutBtn   = document.getElementById("logout-btn");
const userLabel   = document.getElementById("user-label");

// ── AUTH login ───────────────────────────────────────────────
loginBtn.addEventListener("click", async function() {
  var email    = loginEmail.value.trim();
  var password = loginPass.value.trim();
  if (!email || !password) { showLoginError("Veuillez remplir les deux champs."); return; }
  loginBtn.textContent = "Connexion...";
  loginBtn.disabled    = true;
  try {
    var result = await signInWithEmailAndPassword(auth, email, password);
    afficherApp(result.user);
  } catch (err) {
    loginBtn.textContent = "Se connecter";
    loginBtn.disabled    = false;
    showLoginError(translateAuthError(err.code));
  }
});

[loginEmail, loginPass].forEach(function(el) {
  el.addEventListener("keydown", function(e) { if (e.key === "Enter") loginBtn.click(); });
});

logoutBtn.addEventListener("click", function() {
  signOut(auth);
  appReady = false;
  appDiv.style.display      = "none";
  loginScreen.style.display = "flex";
  loginBtn.textContent      = "Se connecter";
  loginBtn.disabled         = false;
  loginError.style.display  = "none";
});

onAuthStateChanged(auth, function(user) {
  if (user && appDiv.style.display !== "block") {
    afficherApp(user);
  } else if (!user) {
    loginScreen.style.display = "flex";
    appDiv.style.display      = "none";
  }
});

function afficherApp(user) {
  loginScreen.style.display = "none";
  appDiv.style.display      = "block";
  userLabel.textContent     = user.email;
  if (!appReady) {
    appReady = true;
    initApp();
  }
}

function showLoginError(msg) {
  loginError.textContent   = msg;
  loginError.style.display = "block";
}

function translateAuthError(code) {
  var m = {
    "auth/invalid-email":          "Identifiant invalide.",
    "auth/user-not-found":         "Identifiant introuvable.",
    "auth/wrong-password":         "Mot de passe incorrect.",
    "auth/invalid-credential":     "Identifiant ou mot de passe incorrect.",
    "auth/too-many-requests":      "Trop de tentatives. Reessayez plus tard.",
    "auth/network-request-failed": "Erreur reseau.",
  };
  return m[code] || "Erreur : " + code;
}

// ── INIT APP ─────────────────────────────────────────────────
function initApp() {
  activeType = null;
  typeStates = { small_t1:{}, grand_t1:{}, rondelle:{} };
  selectedIds = [];
  ganttQuiOverrides = {};
  justifications = [];

  // Date auto
  function refreshDate() {
    var d = document.getElementById("f-date");
    if (d && !d.value) d.value = new Date().toISOString().slice(0,10);
  }
  refreshDate();
  setInterval(refreshDate, 60000);

  document.getElementById("f-machine-name").value  = "";
  document.getElementById("dynamic-sections").innerHTML = "";
  document.getElementById("gantt-container").innerHTML  = '<div class="empty-gantt">Selectionnez un type et enregistrez pour afficher le Gantt</div>';
  document.querySelectorAll(".type-btn").forEach(function(b) { b.classList.remove("active"); });

  // Boutons type
  ["small_t1","grand_t1","rondelle"].forEach(function(type) {
    var btn = document.getElementById("btn-"+type);
    var clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    document.getElementById("btn-"+type).addEventListener("click", function() { selectType(type); });
  });

  // Firebase listeners
  onValue(ref(db, "global"), function(snap) {
    document.getElementById("sync-status").textContent = "Connecte";
  });

  onValue(ref(db, "sessions"), function(snap) {
    allSessions = snap.val() || {};
    renderHistory(allSessions);
    // Sync Gantt si affiché
    var gs = document.getElementById("gantt-section");
    if (gs && gs.style.display !== "none" && activeType) {
      var date    = document.getElementById("f-date").value;
      var machine = document.getElementById("f-machine-name").value.trim();
      var current = Object.values(allSessions).find(function(s) {
        return s.date === date && s.machine === machine && s.activeType === activeType;
      });
      if (current) renderGantt(current.date, current.machine, current.typeData || {});
    }
  });

  // Boutons principaux
  document.getElementById("save-btn").addEventListener("click", saveSession);
  document.getElementById("new-session-btn").addEventListener("click", newSession);
  document.getElementById("del-all-btn").addEventListener("click", deleteAllHistory);
  document.getElementById("do-compare-btn").addEventListener("click", doCompare);
  document.getElementById("close-compare-btn").addEventListener("click", closeCompare);
  document.getElementById("do-justif-btn").addEventListener("click", openJustifDialog);
  initExportButtons();

  // Tooltip mousemove
  var TT = document.getElementById("tooltip");
  document.addEventListener("mousemove", function(e) {
    if (!TT.classList.contains("visible")) return;
    var x = e.clientX+16, y = e.clientY+16;
    if (x+310 > window.innerWidth)  x = e.clientX-310;
    if (y+230 > window.innerHeight) y = e.clientY-230;
    TT.style.left = x+"px"; TT.style.top = y+"px";
  });
}

// ── SELECTION TYPE ───────────────────────────────────────────
function selectType(type) {
  if (activeType) typeStates[activeType] = {};
  if (activeType === type) {
    activeType = null;
    document.getElementById("btn-"+type).classList.remove("active");
  } else {
    activeType = type;
    document.querySelectorAll(".type-btn").forEach(function(b) { b.classList.remove("active"); });
    document.getElementById("btn-"+type).classList.add("active");
    typeStates[type] = {};
  }
  renderDynamicSections();
  document.getElementById("gantt-container").innerHTML = '<div class="empty-gantt">Selectionnez un type et enregistrez pour afficher le Gantt</div>';
  selectedIds = []; updateCmpBar();
}

// ── CHAMP HEURE ──────────────────────────────────────────────
function makeTimeField(hVal, mVal) {
  var wrap = document.createElement("div"); wrap.className = "time-field";
  var hInp = document.createElement("input"); hInp.className = "h-inp"; hInp.inputMode = "numeric"; hInp.maxLength = 2; hInp.placeholder = "H"; hInp.value = hVal||"";
  var sep  = document.createElement("span");  sep.className = "time-field-sep"; sep.textContent = ":";
  var mInp = document.createElement("input"); mInp.className = "m-inp"; mInp.inputMode = "numeric"; mInp.maxLength = 2; mInp.placeholder = "mm"; mInp.value = mVal||"";
  function validate() {
    hInp.classList.toggle("invalid", hInp.value!==""&&(isNaN(parseInt(hInp.value))||parseInt(hInp.value)>23));
    mInp.classList.toggle("invalid", mInp.value!==""&&(isNaN(parseInt(mInp.value))||parseInt(mInp.value)>59));
  }
  hInp.addEventListener("input", function() {
    this.value = this.value.replace(/\D/g,"").slice(0,2);
    if (this.value.length===2) { if(parseInt(this.value)>23) this.value="23"; mInp.focus(); }
    validate();
  });
  hInp.addEventListener("blur", function() { if(this.value!==""){var v=parseInt(this.value);if(v>23)this.value="23";if(v<0)this.value="0";} validate(); });
  mInp.addEventListener("input", function() {
    this.value = this.value.replace(/\D/g,"").slice(0,2);
    if(this.value.length===2&&parseInt(this.value)>59) this.value="59";
    validate();
  });
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
  function resize() { ta.style.height = "auto"; ta.style.height = ta.scrollHeight+"px"; }
  ta.addEventListener("input", resize);
  setTimeout(resize, 0);
  return ta;
}

// ── RENDU SECTIONS ───────────────────────────────────────────
function renderDynamicSections() {
  var container = document.getElementById("dynamic-sections");
  container.innerHTML = "";
  if (!activeType) return;
  var def = TYPE_DATA[activeType]; if (!def) return;
  var saved = typeStates[activeType] || {};
  var savedTasks = saved.tasks || {}, savedTarget = saved.target || {};
  var savedExtra = saved.extraTasks || [];

  var sec = document.createElement("div"); sec.className = "tasks-sec"; sec.style.borderColor = def.color;
  var hd  = document.createElement("div"); hd.className = "tasks-sec-hd"; hd.style.background = def.color;
  hd.textContent = def.label; sec.appendChild(hd);

  // Objectif target
  var tWrap = document.createElement("div"); tWrap.className = "target-wrap"; tWrap.style.borderColor = def.color;
  tWrap.innerHTML = '<div class="target-hd" style="background:'+def.color+'20;color:'+def.color+'">Objectif <span style="font-size:11px;opacity:.7">Plage horaire visee</span></div>';
  var tBody = document.createElement("div"); tBody.className = "target-body";
  var tTimesRow = document.createElement("div"); tTimesRow.className = "target-times";
  var tSlbl = document.createElement("label"); tSlbl.style.cssText = "font-size:13px;color:#6c6c70"; tSlbl.textContent = "Debut";
  var tSF = makeTimeField(savedTarget.sh||"", savedTarget.sm||"");
  var tElbl = document.createElement("label"); tElbl.style.cssText = "font-size:13px;color:#6c6c70;margin-left:8px"; tElbl.textContent = "Fin";
  var tEF = makeTimeField(savedTarget.eh||"", savedTarget.em||"");
  var tPrev = document.createElement("span"); tPrev.className = "time-preview";
  function updTgtPrev() { var s=getTV(tSF._getH(),tSF._getM()),e=getTV(tEF._getH(),tEF._getM()); tPrev.textContent=s&&e?s+" -> "+e:s?s+" -> ?":""; }
  tSF.addEventListener("input",updTgtPrev); tEF.addEventListener("input",updTgtPrev); updTgtPrev();
  tTimesRow.appendChild(tSlbl); tTimesRow.appendChild(tSF); tTimesRow.appendChild(tElbl); tTimesRow.appendChild(tEF); tTimesRow.appendChild(tPrev);
  tBody.appendChild(tTimesRow);
  var tCmtWrap = document.createElement("div"); tCmtWrap.className = "target-comment";
  var tCmtTA = makeTextarea("Commentaire sur l objectif...", savedTarget.comment||"");
  tCmtWrap.appendChild(tCmtTA); tBody.appendChild(tCmtWrap);
  tWrap.appendChild(tBody); sec.appendChild(tWrap);
  sec._tSF = tSF; sec._tEF = tEF; sec._tCmt = tCmtTA;

  // Taches fixes
  sec._taskFields = {};
  def.tasks.forEach(function(task, idx) {
    var tv    = savedTasks[task.id] || {};
    var color = TASK_COLORS[idx % TASK_COLORS.length];
    appendTaskRow(sec, task.id, task.machine, task.qui, tv, color, false);
  });

  // Taches dynamiques
  sec._extraTaskFields = [];
  if (savedExtra && savedExtra.length) {
    savedExtra.forEach(function(et, idx) {
      var color = TASK_COLORS[(def.tasks.length + idx) % TASK_COLORS.length];
      appendTaskRow(sec, "extra_"+idx, et.machine||"Tache "+( idx+1), et.qui||"", et, color, true);
    });
  }

  // Bouton ajouter tache
  var addTaskBtn = document.createElement("button");
  addTaskBtn.className = "btn-add-task";
  addTaskBtn.textContent = "+ Ajouter une tache";
  addTaskBtn.addEventListener("click", function() { addExtraTaskRow(sec, def); });
  sec.appendChild(addTaskBtn);

  container.appendChild(sec);
}

function appendTaskRow(sec, taskId, machineName, quiDefault, tv, color, isDynamic) {
  var row = document.createElement("div"); row.className = "task-row";
  var top = document.createElement("div"); top.className = "task-row-top";
  var bar = document.createElement("div"); bar.className = "task-color-bar"; bar.style.background = color;

  if (isDynamic) {
    // Nom editable pour taches dynamiques
    var nameInp = document.createElement("input");
    nameInp.type = "text"; nameInp.value = machineName;
    nameInp.style.cssText = "flex:1;border:none;background:transparent;font-size:13px;font-weight:700;color:#1c1c1e;font-family:Arial,sans-serif;outline:none;";
    nameInp.placeholder = "Nom de la tache";
    var whoInp = document.createElement("input");
    whoInp.type = "text"; whoInp.value = quiDefault||"";
    whoInp.style.cssText = "font-size:11px;color:#6c6c70;background:#f7f7f8;padding:2px 8px;border-radius:6px;border:1px solid #e0e0e5;width:100px;outline:none;font-family:Arial,sans-serif;";
    whoInp.placeholder = "Qui";
    var delBtn = document.createElement("button"); delBtn.className = "btn-del-task"; delBtn.textContent = "Supprimer";
    delBtn.addEventListener("click", function() { row.remove(); });
    top.appendChild(bar); top.appendChild(nameInp); top.appendChild(whoInp); top.appendChild(delBtn);
    row._nameInp = nameInp; row._whoInp = whoInp;
  } else {
    var lbl = document.createElement("span"); lbl.className = "task-row-label"; lbl.textContent = machineName;
    var who = document.createElement("span"); who.className = "task-row-who"; who.textContent = quiDefault;
    top.appendChild(bar); top.appendChild(lbl); top.appendChild(who);
  }
  row.appendChild(top);

  // Creneaux horaires (slot1 + slot2 optionnel)
  var slotsContainer = document.createElement("div"); slotsContainer.className = "task-row-times";

  function makeSlot(sh, sm, eh, em) {
    var wrap = document.createElement("div"); wrap.style.cssText = "display:flex;align-items:center;gap:6px;flex-wrap:wrap;";
    var sGrp = document.createElement("div"); sGrp.className = "time-group";
    var sLbl = document.createElement("label"); sLbl.textContent = "Debut";
    var sF   = makeTimeField(sh||"", sm||"");
    sGrp.appendChild(sLbl); sGrp.appendChild(sF);
    var eGrp = document.createElement("div"); eGrp.className = "time-group";
    var eLbl = document.createElement("label"); eLbl.textContent = "Fin";
    var eF   = makeTimeField(eh||"", em||"");
    eGrp.appendChild(eLbl); eGrp.appendChild(eF);
    var prev = document.createElement("span"); prev.className = "time-preview";
    function updPrev() { var s=getTV(sF._getH(),sF._getM()),e=getTV(eF._getH(),eF._getM()); prev.textContent=s&&e?s+" -> "+e:s?s+" -> ?":""; }
    sF.addEventListener("input",updPrev); eF.addEventListener("input",updPrev); updPrev();
    wrap.appendChild(sGrp); wrap.appendChild(eGrp); wrap.appendChild(prev);
    wrap._sF = sF; wrap._eF = eF;
    return wrap;
  }

  var slot1 = makeSlot(tv.sh||"", tv.sm||"", tv.eh||"", tv.em||"");
  slotsContainer.appendChild(slot1);
  row._slot1 = slot1;
  row._slot2 = null;

  // Bouton + pour ajouter 2eme creneau
  var addSlotBtn = document.createElement("button"); addSlotBtn.className = "btn-add-slot"; addSlotBtn.textContent = "+";
  addSlotBtn.title = "Ajouter un 2eme creneau";
  addSlotBtn.addEventListener("click", function() {
    if (row._slot2) return;
    var s2 = makeSlot(tv.sh2||"", tv.sm2||"", tv.eh2||"", tv.em2||"");
    var sep = document.createElement("span"); sep.style.cssText = "font-size:11px;color:#6c6c70;margin:0 4px;"; sep.textContent = "puis";
    slotsContainer.appendChild(sep);
    slotsContainer.appendChild(s2);
    row._slot2 = s2;
    addSlotBtn.style.display = "none";
  });

  // Si slot2 deja sauvegarde
  if (tv.sh2 || tv.sm2 || tv.eh2 || tv.em2) {
    var s2 = makeSlot(tv.sh2||"", tv.sm2||"", tv.eh2||"", tv.em2||"");
    var sep2 = document.createElement("span"); sep2.style.cssText = "font-size:11px;color:#6c6c70;margin:0 4px;"; sep2.textContent = "puis";
    slotsContainer.appendChild(sep2);
    slotsContainer.appendChild(s2);
    row._slot2 = s2;
    addSlotBtn.style.display = "none";
  }

  slotsContainer.appendChild(addSlotBtn);
  row.appendChild(slotsContainer);

  // Commentaire
  var cmtWrap = document.createElement("div"); cmtWrap.className = "task-comment-wrap";
  var cmtTA   = makeTextarea("Commentaire...", tv.comment||"");
  cmtWrap.appendChild(cmtTA); row.appendChild(cmtWrap);

  // Stocker les champs
  var fields = { sF: slot1._sF, eF: slot1._eF, cmtTA: cmtTA, color: color, row: row };
  if (isDynamic) {
    sec._extraTaskFields.push({ fields: fields, row: row });
  } else {
    if (!sec._taskFields) sec._taskFields = {};
    sec._taskFields[taskId] = fields;
  }

  sec.appendChild(row);
}

function addExtraTaskRow(sec, def) {
  var idx   = sec._extraTaskFields.length;
  var color = TASK_COLORS[(def.tasks.length + idx) % TASK_COLORS.length];
  appendTaskRow(sec, "extra_"+idx, "Tache "+(idx+1), "", {}, color, true);
}

// ── COLLECTE DONNEES ─────────────────────────────────────────
function collectTypeData() {
  var sec = document.querySelector("#dynamic-sections .tasks-sec");
  if (!sec || !activeType) return {};
  var def = TYPE_DATA[activeType]; if (!def) return {};
  var out = { target:{}, tasks:{}, extraTasks:[] };

  out.target = {
    sh: sec._tSF ? sec._tSF._getH() : "", sm: sec._tSF ? sec._tSF._getM() : "",
    eh: sec._tEF ? sec._tEF._getH() : "", em: sec._tEF ? sec._tEF._getM() : "",
    comment: sec._tCmt ? sec._tCmt.value : ""
  };

  def.tasks.forEach(function(task) {
    var f = sec._taskFields && sec._taskFields[task.id]; if (!f) return;
    var d = { sh:f.sF._getH(), sm:f.sF._getM(), eh:f.eF._getH(), em:f.eF._getM(), comment:f.cmtTA.value };
    if (f.row && f.row._slot2) {
      d.sh2 = f.row._slot2._sF._getH(); d.sm2 = f.row._slot2._sF._getM();
      d.eh2 = f.row._slot2._eF._getH(); d.em2 = f.row._slot2._eF._getM();
    }
    out.tasks[task.id] = d;
  });

  if (sec._extraTaskFields) {
    sec._extraTaskFields.forEach(function(et) {
      var f = et.fields;
      var name = et.row._nameInp ? et.row._nameInp.value.trim() : "";
      var qui  = et.row._whoInp  ? et.row._whoInp.value.trim()  : "";
      if (!name) return;
      var d = { machine: name, qui: qui, sh:f.sF._getH(), sm:f.sF._getM(), eh:f.eF._getH(), em:f.eF._getM(), comment:f.cmtTA.value };
      if (f.row && f.row._slot2) {
        d.sh2 = f.row._slot2._sF._getH(); d.sm2 = f.row._slot2._sF._getM();
        d.eh2 = f.row._slot2._eF._getH(); d.em2 = f.row._slot2._eF._getM();
      }
      out.extraTasks.push(d);
    });
  }

  return out;
}

// ── SAUVEGARDE ───────────────────────────────────────────────
async function saveSession() {
  var typeData = collectTypeData();
  var date     = document.getElementById("f-date").value;
  var machine  = document.getElementById("f-machine-name").value.trim();

  if (!date || !machine || !activeType) {
    alert("Veuillez remplir la date, la machine et le type de changement.");
    return;
  }

  // Anti-doublon strict
  var newTasks  = JSON.stringify(typeData.tasks  || {});
  var newTarget = JSON.stringify(typeData.target || {});
  var doublon = Object.values(allSessions).find(function(s) {
    if (s.date !== date || s.machine !== machine || s.activeType !== activeType) return false;
    var sTasks  = JSON.stringify((s.typeData && s.typeData.tasks)  || {});
    var sTarget = JSON.stringify((s.typeData && s.typeData.target) || {});
    return sTasks === newTasks && sTarget === newTarget;
  });
  if (doublon) { alert("Cette seance est identique a une seance deja enregistree."); return; }

  if (activeType) await set(ref(db, "types/"+activeType), typeData);
  await set(ref(db, "global"), { date: date, machine: machine, activeType: activeType, savedAt: Date.now() });
  if (activeType) typeStates[activeType] = typeData;

  if (activeType) {
    var def = TYPE_DATA[activeType];
    var dl  = date ? new Date(date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}) : "";
    var existingId = window._editingSessionId;
    if (!existingId) {
      var existing = Object.entries(allSessions).find(function(entry) {
        var s = entry[1];
        return s.date === date && s.machine === machine && s.activeType === activeType;
      });
      if (existing) existingId = existing[0];
    }
    var sessId = existingId || "sess_"+activeType+"_"+Date.now();
    await set(ref(db, "sessions/"+sessId), {
      date: date, machine: machine, activeType: activeType, typeData: typeData,
      title: [(machine||"Seance"), def?def.label:"", dl].filter(Boolean).join(" - "),
      savedAt: Date.now()
    });
    window._editingSessionId = null;
  }

  document.getElementById("sync-status").textContent = "Enregistre";
  setTimeout(function() { document.getElementById("sync-status").textContent = "Connecte"; }, 2000);
  showToast("Seance enregistree avec succes !", "#34c759");
  renderGantt(date, machine, typeData);
  setTimeout(function() { document.getElementById("gantt-section").scrollIntoView({behavior:"smooth"}); }, 100);

  // Vider formulaire
  document.getElementById("f-machine-name").value = "";
  document.getElementById("f-date").value = new Date().toISOString().slice(0,10);
  activeType = null;
  typeStates = { small_t1:{}, grand_t1:{}, rondelle:{} };
  ganttQuiOverrides = {};
  document.querySelectorAll(".type-btn").forEach(function(b) { b.classList.remove("active"); });
  document.getElementById("dynamic-sections").innerHTML = "";
}

async function newSession() {
  if (!confirm("Repartir a zero ? La seance en cours reste dans l historique.")) return;
  await remove(ref(db, "global"));
  for (var t of ["small_t1","grand_t1","rondelle"]) await remove(ref(db, "types/"+t));
  activeType  = null;
  typeStates  = { small_t1:{}, grand_t1:{}, rondelle:{} };
  justifications = [];
  document.getElementById("f-date").value         = new Date().toISOString().slice(0,10);
  document.getElementById("f-machine-name").value = "";
  document.querySelectorAll(".type-btn").forEach(function(b) { b.classList.remove("active"); });
  document.getElementById("dynamic-sections").innerHTML = "";
  document.getElementById("gantt-container").innerHTML  = '<div class="empty-gantt">Selectionnez un type et enregistrez pour afficher le Gantt</div>';
}

// ── HISTORIQUE ───────────────────────────────────────────────
function renderHistory(sessions) {
  var list = document.getElementById("history-list");
  var arr  = Object.entries(sessions).sort(function(a,b) { return (b[1].savedAt||0)-(a[1].savedAt||0); });
  document.getElementById("history-count").textContent = arr.length ? arr.length+" seance(s)" : "";
  if (!arr.length) { list.innerHTML = '<div class="history-empty">Aucune seance enregistree</div>'; return; }

  var totalPages = Math.ceil(arr.length / HISTORY_PAGE_SIZE);
  if (historyPage >= totalPages) historyPage = totalPages - 1;
  if (historyPage < 0) historyPage = 0;
  var pageArr = arr.slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE);

  var html = pageArr.map(function(entry) {
    var id = entry[0], s = entry[1];
    var def    = s.activeType && TYPE_DATA[s.activeType] ? TYPE_DATA[s.activeType] : null;
    var color  = def ? def.color : "#6c6c70";
    var typeLbl= def ? def.label : "";
    var dl     = s.date ? new Date(s.date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}) : "";
    var title  = [(s.machine||"Seance"), dl].filter(Boolean).join(" - ");
    return '<div class="history-item">' +
      '<div class="history-item-left" data-load="'+id+'">' +
        '<div class="history-item-title"><span class="history-badge" style="background:'+color+'">'+typeLbl+'</span>'+title+'</div>' +
        '<div class="history-item-sub">'+dl+'</div>' +
      '</div>' +
      '<div class="history-item-actions">' +
        '<span class="history-load-btn" data-load="'+id+'">Charger</span>' +
        '<span class="history-edit-btn" data-edit="'+id+'">Modifier</span>' +
        '<span class="history-del-btn"  data-del="'+id+'">Supprimer</span>' +
      '</div>' +
    '</div>';
  }).join("");

  if (totalPages > 1) {
    html += '<div class="history-pagination">' +
      '<button class="history-page-btn" id="hist-prev" '+(historyPage===0?'disabled':'')+'>← Precedent</button>' +
      '<span class="history-page-info">'+(historyPage+1)+' / '+totalPages+'</span>' +
      '<button class="history-page-btn" id="hist-next" '+(historyPage>=totalPages-1?'disabled':'')+'>Suivant →</button>' +
    '</div>';
  }

  list.innerHTML = html;
  list.querySelectorAll("[data-load]").forEach(function(el) { el.addEventListener("click", function() { loadHistorySession(el.dataset.load); }); });
  list.querySelectorAll("[data-edit]").forEach(function(el) { el.addEventListener("click", function() { editHistorySession(el.dataset.edit); }); });
  list.querySelectorAll("[data-del]").forEach(function(el)  { el.addEventListener("click", function() { deleteSession(el.dataset.del); }); });
  var prevBtn = document.getElementById("hist-prev");
  var nextBtn = document.getElementById("hist-next");
  if (prevBtn) prevBtn.addEventListener("click", function() { historyPage--; renderHistory(allSessions); });
  if (nextBtn) nextBtn.addEventListener("click", function() { historyPage++; renderHistory(allSessions); });
}

async function loadHistorySession(id) {
  var snap = await get(ref(db, "sessions/"+id));
  var d = snap.val(); if (!d) return;
  if (d.activeType && d.typeData) { await set(ref(db, "types/"+d.activeType), d.typeData); typeStates[d.activeType] = d.typeData; }
  await set(ref(db, "global"), { date:d.date, machine:d.machine, activeType:d.activeType, savedAt:Date.now() });
  activeType = d.activeType;
  document.getElementById("f-date").value         = d.date    || "";
  document.getElementById("f-machine-name").value = d.machine || "";
  document.querySelectorAll(".type-btn").forEach(function(b) { b.classList.toggle("active", b.dataset.type === activeType); });
  renderDynamicSections();
  renderGantt(d.date, d.machine, d.typeData || {});
  setTimeout(function() { document.getElementById("gantt-section").scrollIntoView({behavior:"smooth"}); }, 200);
}

async function editHistorySession(id) {
  var snap = await get(ref(db, "sessions/"+id));
  var d = snap.val(); if (!d) return;
  activeType = d.activeType;
  if (d.typeData) typeStates[d.activeType] = d.typeData;
  document.getElementById("f-date").value         = d.date    || "";
  document.getElementById("f-machine-name").value = d.machine || "";
  document.querySelectorAll(".type-btn").forEach(function(b) { b.classList.toggle("active", b.dataset.type === activeType); });
  renderDynamicSections();
  window._editingSessionId = id;
  document.querySelector(".info-sec").scrollIntoView({behavior:"smooth"});
  showToast("Seance chargee - modifiez puis enregistrez", "#1a3a6b");
}

async function deleteSession(id) {
  if (!confirm("Supprimer cette seance ?")) return;
  await remove(ref(db, "sessions/"+id));
}

async function deleteAllHistory() {
  if (!confirm("Supprimer TOUT l historique ?")) return;
  await remove(ref(db, "sessions"));
}

// ── GANTT ────────────────────────────────────────────────────
var toMin  = function(s) { if(!s||!s.includes(":"))return null; var p=s.split(":").map(Number); return p[0]*60+(p[1]||0); };
var fmtDur = function(s,e) { var d=e-s; if(d<=0)return "--"; var h=Math.floor(d/60),m=d%60; return h&&m?h+"h "+m+"min":h?h+"h":m+"min"; };

function renderGantt(date, machine, typeData) {
  var container = document.getElementById("gantt-container");
  if (!activeType || !TYPE_DATA[activeType]) {
    container.innerHTML = '<div class="empty-gantt">Selectionnez un type et enregistrez pour afficher le Gantt</div>';
    return;
  }
  var def        = TYPE_DATA[activeType];
  var tv         = typeData || typeStates[activeType] || {};
  var savedTasks = tv.tasks  || {};
  var savedTarget= tv.target || {};
  var extraTasks = tv.extraTasks || [];

  allTasks = {};
  var minT = Infinity, maxT = -Infinity;
  function regT(h,m,h2,m2) {
    var s=toMin(getTV(h,m)), e=toMin(getTV(h2,m2));
    if(s!==null && s>0) minT=Math.min(minT,s);
    if(e!==null && e>0) maxT=Math.max(maxT,e);
  }
  regT(savedTarget.sh||"",savedTarget.sm||"",savedTarget.eh||"",savedTarget.em||"");
  def.tasks.forEach(function(task) { var t=savedTasks[task.id]||{}; regT(t.sh||"",t.sm||"",t.eh||"",t.em||""); if(t.sh2||t.eh2) regT(t.sh2||"",t.sm2||"",t.eh2||"",t.em2||""); });
  extraTasks.forEach(function(et) { regT(et.sh||"",et.sm||"",et.eh||"",et.em||""); if(et.sh2||et.eh2) regT(et.sh2||"",et.sm2||"",et.eh2||"",et.em2||""); });

  if (!isFinite(minT)) minT=360; if (!isFinite(maxT)) maxT=minT+120;
  minT = Math.max(0, minT - 10);
  maxT = maxT + 10;
  minT = Math.floor(minT/60)*60;
  maxT = Math.ceil(maxT/60)*60;
  var total=maxT-minT, slotMin=10, slots=total/slotMin;
  var slotW = Math.max(35, Math.min(90, 900/slots));

  ganttCurrentDef = def;
  ganttGlobalMin  = minT;
  ganttSpan       = total;

  var dateStr = date ? new Date(date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}) : "";
  document.getElementById("gantt-machine-title").textContent = machine || "Changement - Temp/Machine";
  document.getElementById("gantt-subtitle").textContent      = def.label + (dateStr ? " - "+dateStr : "");

  var h = '<table class="gantt">';
  h += '<tr><th colspan="5"></th>';
  for (var m=minT; m<maxT; m+=60) h += '<th colspan="'+(60/slotMin)+'" style="background:#1a3a6b;color:#fff">60 min</th>';
  h += '</tr><tr><th class="chk-cell"></th><th style="width:150px;text-align:left;padding-left:8px">MACHINE / SECTEUR</th><th style="width:80px">QUI</th><th style="width:52px">DEBUT</th><th style="width:48px">FIN</th>';
  for (var m=minT; m<maxT; m+=slotMin) {
    var hh=Math.floor(m/60).toString().padStart(2,"0"), mm=(m%60).toString().padStart(2,"0");
    h += '<th style="width:'+slotW+'px;font-size:10px;color:#555;font-weight:400">'+(mm==="00"?hh+"h":mm)+'</th>';
  }
  h += '</tr>';
  h += '<tr><td colspan="'+(5+slots)+'" style="background:'+def.color+';color:#fff;font-weight:700;font-size:13px;padding:7px 10px;border:1px solid '+def.color+'">'+def.label+'</td></tr>';

  // Ligne objectif
  var tStart=getTV(savedTarget.sh||"",savedTarget.sm||""), tEnd=getTV(savedTarget.eh||"",savedTarget.em||"");
  var tS=toMin(tStart), tE=toMin(tEnd), tCmt=savedTarget.comment||"";
  var tUid="target";
  allTasks[tUid] = {machine:"Objectif", qui:"--", start:tStart, end:tEnd, color:"#f59e0b"};
  var tBar="";
  if (tS!==null&&tE!==null&&tE>tS) {
    var lp=((tS-minT)/total)*100, wp=((tE-tS)/total)*100;
    tBar = '<div class="gantt-bar-target" style="left:'+lp+'%;width:'+wp+'%" data-uid="'+tUid+'" data-label="Objectif" data-qui="--" data-start="'+tStart+'" data-end="'+tEnd+'" data-color="#f59e0b" data-cmt="'+encCmt(tCmt)+'">'+(tCmt?'<div class="gantt-comment-dot"></div>':"")+'</div>';
  }
  var tSelA=selectedIds[0]===tUid, tSelB=selectedIds[1]===tUid;
  h += '<tr class="target-row'+(tSelA?" sel-a":tSelB?" sel-b":"")+'" data-uid="'+tUid+'"><td class="chk-cell info"><input type="checkbox" '+(selectedIds.includes(tUid)?"checked":"")+'  data-uid="'+tUid+'"></td><td class="info machine-name" style="color:#b45309;font-style:italic">Objectif</td><td class="info who-cell">--</td><td class="info time-cell">'+(tStart||"--")+'</td><td class="info time-cell">'+(tEnd||"--")+'</td><td colspan="'+slots+'" class="bar-cell"><div class="bar-inner">'+tBar+'</div></td></tr>';

  // Taches fixes
  def.tasks.forEach(function(task, idx) {
    var t     = savedTasks[task.id] || {};
    var start = getTV(t.sh||"",t.sm||""), end=getTV(t.eh||"",t.em||"");
    var start2= getTV(t.sh2||"",t.sm2||""), end2=getTV(t.eh2||"",t.em2||"");
    var s=toMin(start), e=toMin(end);
    var color = TASK_COLORS[idx % TASK_COLORS.length];
    var uid   = activeType+"_"+task.id;
    var quiFromDb = t.qui || null;
    var quiDisplay = ganttQuiOverrides[uid] || quiFromDb || task.qui;
    allTasks[uid] = {machine:task.machine, qui:quiDisplay, start:start, end:end, color:color};
    var bar="";
    if (s!==null&&e!==null&&e>s) {
      var lp=((s-minT)/total)*100, wp=((e-s)/total)*100;
      bar = '<div class="gantt-bar" style="left:'+lp+'%;width:'+wp+'%;background:'+color+'" data-uid="'+uid+'" data-label="'+task.machine+'" data-qui="'+quiDisplay+'" data-start="'+start+'" data-end="'+end+'" data-color="'+color+'" data-cmt="'+encCmt(t.comment||"")+'">'+( t.comment?'<div class="gantt-comment-dot"></div>':"")+'</div>';
    }
    // Slot 2
    if (start2 && end2 && toMin(start2) && toMin(end2) && toMin(end2)>toMin(start2)) {
      var lp2=((toMin(start2)-minT)/total)*100, wp2=((toMin(end2)-toMin(start2))/total)*100;
      // Fleche dans l espace vide entre slot1 et slot2
      if (s!==null&&e!==null&&toMin(start2)>e) {
        var gapLeft=((e-minT)/total)*100, gapW=((toMin(start2)-e)/total)*100;
        bar += '<div class="gantt-arrow" style="left:'+gapLeft+'%;width:'+gapW+'%"><div class="gantt-arrow-body" style="background:'+color+';opacity:.5;">→</div></div>';
      }
      bar += '<div class="gantt-bar" style="left:'+lp2+'%;width:'+wp2+'%;background:'+color+';opacity:.7;" data-uid="'+uid+'_2" data-label="'+task.machine+' (2)" data-qui="'+quiDisplay+'" data-start="'+start2+'" data-end="'+end2+'" data-color="'+color+'" data-cmt="'+encCmt(t.comment||"")+'"></div>';
    }
    var isSelA=selectedIds[0]===uid, isSelB=selectedIds[1]===uid;
    var rowCls=isSelA?"sel-a":isSelB?"sel-b":idx%2===0?"odd":"even";
    h += '<tr class="'+rowCls+'" data-uid="'+uid+'"><td class="chk-cell info"><input type="checkbox" '+(selectedIds.includes(uid)?"checked":"")+'  data-uid="'+uid+'"></td><td class="info machine-name"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+color+';margin-right:5px;vertical-align:middle"></span>'+task.machine+'</td><td class="info who-cell who-editable" data-uid="'+uid+'" title="Cliquer pour modifier">'+quiDisplay+' ✏️</td><td class="info time-cell">'+(start||"--")+'</td><td class="info time-cell">'+(end||"--")+'</td><td colspan="'+slots+'" class="bar-cell"><div class="bar-inner">'+bar+'</div></td></tr>';
  });

  // Taches extras
  extraTasks.forEach(function(et, idx) {
    var color = TASK_COLORS[(def.tasks.length + idx) % TASK_COLORS.length];
    var uid   = activeType+"_extra_"+idx;
    var start = getTV(et.sh||"",et.sm||""), end=getTV(et.eh||"",et.em||"");
    var s=toMin(start), e=toMin(end);
    allTasks[uid] = {machine:et.machine||"Extra", qui:et.qui||"", start:start, end:end, color:color};
    var bar="";
    if (s!==null&&e!==null&&e>s) {
      var lp=((s-minT)/total)*100, wp=((e-s)/total)*100;
      bar = '<div class="gantt-bar" style="left:'+lp+'%;width:'+wp+'%;background:'+color+'" data-uid="'+uid+'" data-label="'+(et.machine||"Extra")+'" data-qui="'+(et.qui||"")+'" data-start="'+start+'" data-end="'+end+'" data-color="'+color+'" data-cmt="'+encCmt(et.comment||"")+'">'+( et.comment?'<div class="gantt-comment-dot"></div>':"")+'</div>';
    }
    var rowCls = idx%2===0?"odd":"even";
    h += '<tr class="'+rowCls+'" data-uid="'+uid+'"><td class="chk-cell info"><input type="checkbox" '+(selectedIds.includes(uid)?"checked":"")+'  data-uid="'+uid+'"></td><td class="info machine-name"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+color+';margin-right:5px;vertical-align:middle"></span>'+(et.machine||"Extra")+'</td><td class="info who-cell">'+(et.qui||"")+'</td><td class="info time-cell">'+(start||"--")+'</td><td class="info time-cell">'+(end||"--")+'</td><td colspan="'+slots+'" class="bar-cell"><div class="bar-inner">'+bar+'</div></td></tr>';
  });

  h += '</table>';
  container.innerHTML = h;

  // Events Gantt
  container.querySelectorAll(".gantt-bar, .gantt-bar-target").forEach(function(el) {
    el.addEventListener("mouseenter", function(e) { showTT(e, el.dataset.label, el.dataset.qui, el.dataset.start, el.dataset.end, el.dataset.color, el.dataset.cmt); });
    el.addEventListener("mouseleave", hideTT);
    // Clic sur barre pour ajouter commentaire
    el.addEventListener("click", function(e) {
      e.stopPropagation();
      openBarCommentEditor(el, el.dataset.uid, el.dataset.cmt||"");
    });
  });
  container.querySelectorAll("input[type=checkbox][data-uid]").forEach(function(chk) {
    chk.addEventListener("change", function() { toggleSelect(chk.dataset.uid); });
  });
  container.addEventListener("click", function(e) {
    var cell = e.target.closest(".who-editable");
    if (!cell) return;
    var uid = cell.dataset.uid;
    var current = ganttQuiOverrides[uid] || cell.textContent.replace(" ✏️","").trim();
    showQuiEditor(cell, uid, current);
  });

  updateCmpBar();
  renderJustifications();
  document.getElementById("gantt-section").style.display = "block";
}

// ── EDITEUR COMMENTAIRE SUR BARRE ────────────────────────────
function openBarCommentEditor(barEl, uid, currentCmt) {
  var existing = document.getElementById("bar-comment-editor");
  if (existing) existing.remove();

  var editor = document.createElement("div");
  editor.id = "bar-comment-editor";
  editor.className = "bar-comment-editor";

  var ta = document.createElement("textarea");
  ta.rows = 2; ta.value = currentCmt ? currentCmt.replace(/\\n/g,"\n") : "";
  ta.placeholder = "Ajouter un commentaire...";

  var actions = document.createElement("div"); actions.className = "bar-comment-editor-actions";
  var saveBtn = document.createElement("button"); saveBtn.className = "bar-comment-editor-save"; saveBtn.textContent = "OK";
  var cancelBtn = document.createElement("button"); cancelBtn.className = "bar-comment-editor-cancel"; cancelBtn.textContent = "Annuler";

  actions.appendChild(saveBtn); actions.appendChild(cancelBtn);
  editor.appendChild(ta); editor.appendChild(actions);

  barEl.style.position = "relative";
  barEl.appendChild(editor);
  ta.focus();

  cancelBtn.addEventListener("click", function() { editor.remove(); });
  saveBtn.addEventListener("click", function() {
    var newCmt = ta.value.trim();
    barEl.dataset.cmt = encCmt(newCmt);
    if (newCmt) {
      var dot = barEl.querySelector(".gantt-comment-dot");
      if (!dot) { dot = document.createElement("div"); dot.className = "gantt-comment-dot"; barEl.appendChild(dot); }
    }
    // Sauvegarder dans Firebase
    saveBarComment(uid, newCmt);
    editor.remove();
  });
}

function saveBarComment(uid, comment) {
  var date    = document.getElementById("f-date").value;
  var machine = document.getElementById("f-machine-name").value.trim();
  if (!date && !machine) {
    // Chercher dans allSessions
    var existing = Object.entries(allSessions).find(function(entry) {
      return entry[1].activeType === activeType;
    });
    if (existing) {
      var sessId  = existing[0];
      var session = JSON.parse(JSON.stringify(existing[1]));
      var taskId  = uid.replace(activeType + "_", "");
      if (!session.typeData) session.typeData = {};
      if (!session.typeData.tasks) session.typeData.tasks = {};
      if (!session.typeData.tasks[taskId]) session.typeData.tasks[taskId] = {};
      session.typeData.tasks[taskId].comment = comment;
      set(ref(db, "sessions/" + sessId), session);
    }
    return;
  }
  var existing = Object.entries(allSessions).find(function(entry) {
    var s = entry[1];
    return s.activeType === activeType && (s.date === date || s.machine === machine);
  });
  if (existing) {
    var sessId  = existing[0];
    var session = JSON.parse(JSON.stringify(existing[1]));
    var taskId  = uid.replace(activeType + "_", "");
    if (!session.typeData) session.typeData = {};
    if (!session.typeData.tasks) session.typeData.tasks = {};
    if (!session.typeData.tasks[taskId]) session.typeData.tasks[taskId] = {};
    session.typeData.tasks[taskId].comment = comment;
    set(ref(db, "sessions/" + sessId), session);
    showToast("Commentaire sauvegarde !", "#34c759");
  }
}

// ── TOOLTIP ──────────────────────────────────────────────────
function showTT(e, label, qui, start, end, color, comment) {
  var TT = document.getElementById("tooltip");
  document.getElementById("tt-dot").style.background   = color||"#3b82f6";
  document.getElementById("tt-title").textContent      = label||"--";
  document.getElementById("tt-qui").textContent        = qui||"--";
  document.getElementById("tt-start").textContent      = start||"--";
  document.getElementById("tt-end").textContent        = end||"--";
  var s=toMin(start), en=toMin(end);
  document.getElementById("tt-dur").textContent = (s!==null&&en!==null) ? "⏱ "+fmtDur(s,en) : "";
  var cb      = document.getElementById("tt-comment-box");
  var decoded = comment ? comment.replace(/\\n/g,"\n") : "";
  document.getElementById("tt-comment").textContent = decoded;
  cb.style.display = decoded ? "block" : "none";
  TT.classList.add("visible");
  var ttH = TT.offsetHeight || 250;
  var ttW = TT.offsetWidth  || 310;
  var isMobile = window.innerWidth < 600;
  if (isMobile) {
    TT.style.left = "50%"; TT.style.transform = "translateX(-50%)";
    TT.style.top = "auto"; TT.style.bottom = "10px";
    TT.style.width = "90vw"; TT.style.maxWidth = "90vw";
  } else {
    TT.style.transform = ""; TT.style.bottom = "auto"; TT.style.width = ""; TT.style.maxWidth = "300px";
    var x = e.clientX + 16, y = e.clientY + 16;
    if (x + ttW > window.innerWidth)  x = e.clientX - ttW - 8;
    if (y + ttH > window.innerHeight) y = e.clientY - ttH - 8;
    if (y < 0) y = 8;
    TT.style.left = x + "px"; TT.style.top = y + "px";
  }
}
function hideTT() { document.getElementById("tooltip").classList.remove("visible"); }

// ── COMPARAISON ──────────────────────────────────────────────
function toggleSelect(id) {
  var idx = selectedIds.indexOf(id);
  if (idx>-1) selectedIds.splice(idx,1);
  else { if(selectedIds.length>=2) selectedIds.shift(); selectedIds.push(id); }
  updateCmpBar();
  document.querySelectorAll("[data-uid]").forEach(function(tr) {
    var uid = tr.dataset.uid;
    var chk = tr.querySelector("input[type=checkbox]");
    if (chk) { chk.checked = selectedIds.includes(uid); tr.classList.toggle("sel-a",selectedIds[0]===uid); tr.classList.toggle("sel-b",selectedIds[1]===uid); }
  });
}

function updateCmpBar() {
  var bar = document.getElementById("cmp-bar");
  var justifBtnContainer = document.getElementById("justif-btn-container");
  if (selectedIds.length >= 1) {
    bar.classList.add("visible");
    document.getElementById("cmp-bar-names").textContent = selectedIds.map(function(id) { return allTasks[id]?allTasks[id].machine||"--":"--"; }).join(" vs ");
    if (justifBtnContainer) justifBtnContainer.style.display = "block";
  } else {
    bar.classList.remove("visible");
    if (justifBtnContainer) justifBtnContainer.style.display = "none";
    var dialog = document.getElementById("justif-dialog");
    if (dialog) dialog.remove();
  }
}

function doCompare() {
  if (selectedIds.length!==2) return;
  var idA=selectedIds[0], idB=selectedIds[1], A=allTasks[idA], B=allTasks[idB]; if(!A||!B) return;
  var sA=toMin(A.start),sB=toMin(B.start),eA=toMin(A.end),eB=toMin(B.end);
  document.getElementById("cmp-result-title").textContent = (A.machine||"--")+" vs "+(B.machine||"--");
  document.getElementById("cmp-cards").innerHTML =
    '<div class="cmp-card a"><div class="cmp-card-badge a">A</div><div class="cmp-card-name">'+A.machine+'</div><div class="cmp-card-time">'+(A.start||"?")+" -> "+(A.end||"?")+'</div></div>'+
    '<div class="cmp-card b"><div class="cmp-card-badge b">B</div><div class="cmp-card-name">'+B.machine+'</div><div class="cmp-card-time">'+(B.start||"?")+" -> "+(B.end||"?")+'</div></div>';
  var diffText="--", diffSub="Donnees insuffisantes";
  if (sA!==null&&sB!==null) {
    var d=Math.abs(sB-sA),hh=Math.floor(d/60),mm=d%60;
    diffText=hh&&mm?hh+"h "+mm+"min":hh?hh+"h":mm+"min";
    diffSub=sB>sA?"B demarre "+diffText+" apres A":sB<sA?"B demarre "+diffText+" avant A":"Meme heure de demarrage";
  }
  document.getElementById("cmp-diff-box").innerHTML =
    '<div class="cmp-diff-label">Ecart entre les deux taches</div><div class="cmp-diff-value">'+diffText+'</div><div class="cmp-diff-sub">'+diffSub+'</div>';
  document.getElementById("cmp-result").classList.add("visible");
  document.getElementById("cmp-result").scrollIntoView({behavior:"smooth",block:"nearest"});
}

function closeCompare() { document.getElementById("cmp-result").classList.remove("visible"); }

// ── JUSTIFICATION ECART ──────────────────────────────────────
function openJustifDialog() {
  if (selectedIds.length < 1) return;
  var idA = selectedIds[0];
  var idB = selectedIds[1] || null;
  var taskA = allTasks[idA];
  var taskB = idB ? allTasks[idB] : null;
  if (!taskA) return;

  var existing = document.getElementById("justif-dialog");
  if (existing) { existing.remove(); return; }

  var ecartMin = "";
  var nameA = taskA.machine, nameB = taskB ? taskB.machine : "";

  if (taskB) {
    var endA = toMin(taskA.end), startB = toMin(taskB.start);
    var endB = toMin(taskB.end), startA = toMin(taskA.start);
    if (endA !== null && startB !== null && startB > endA) ecartMin = startB - endA;
    else if (endB !== null && startA !== null && startA > endB) ecartMin = startA - endB;
  }

  var dialog = document.createElement("div");
  dialog.id = "justif-dialog";
  dialog.className = "justif-dialog";
  dialog.innerHTML =
    '<div class="justif-dialog-title">Justification' + (ecartMin ? " - " + ecartMin + " min" : "") + '</div>' +
    '<div class="justif-dialog-sub">' + nameA + (nameB ? " -> " + nameB : "") + '</div>' +
    '<textarea id="justif-input" class="justif-input" placeholder="Ex: Attente piece, pause, probleme technique..." rows="3"></textarea>' +
    '<div class="justif-dialog-actions">' +
      '<button id="justif-confirm" class="justif-confirm-btn">Enregistrer</button>' +
      '<button id="justif-cancel" class="justif-cancel-btn">Annuler</button>' +
    '</div>';

  var justifBtnContainer = document.getElementById("justif-btn-container");
  justifBtnContainer.insertAdjacentElement("afterend", dialog);
  document.getElementById("justif-input").focus();

  document.getElementById("justif-cancel").addEventListener("click", function() { dialog.remove(); });
  document.getElementById("justif-confirm").addEventListener("click", function() {
    var text = document.getElementById("justif-input").value.trim();
    if (!text) { alert("Veuillez saisir un commentaire."); return; }
    justifications.push({ taskA: taskA, taskB: taskB, ecartMin: ecartMin, text: text });
    dialog.remove();
    renderJustifications();
    showToast("Justification enregistree !", "#f59e0b");
  });
}

function renderJustifications() {
  var container = document.getElementById("justif-container");
  if (!container) return;
  container.innerHTML = "";
  if (justifications.length === 0) return;

  var title = document.createElement("div");
  title.style.cssText = "font-size:11px;font-weight:700;color:#6c6c70;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;padding:0 4px;";
  title.textContent = "Justifications";
  container.appendChild(title);

  justifications.forEach(function(j, idx) {
    var card = document.createElement("div");
    card.className = "justif-timeline-card";

    var row = document.createElement("div"); row.className = "justif-timeline-row";

    var boxA = document.createElement("div"); boxA.className = "justif-task-box";
    boxA.style.background = j.taskA.color || "#3b82f6";
    boxA.innerHTML = '<div class="justif-task-name">'+j.taskA.machine+'</div><div class="justif-task-time">'+(j.taskA.end||"?")+'</div>';
    row.appendChild(boxA);

    var arrow = document.createElement("div"); arrow.className = "justif-arrow";
    arrow.innerHTML = '<div class="justif-arrow-line"></div>' + (j.ecartMin ? '<div class="justif-arrow-label">'+j.ecartMin+' min</div>' : '') + '<div class="justif-arrow-head">▶</div>';
    row.appendChild(arrow);

    if (j.taskB) {
      var boxB = document.createElement("div"); boxB.className = "justif-task-box";
      boxB.style.background = j.taskB.color || "#22c55e";
      boxB.innerHTML = '<div class="justif-task-name">'+j.taskB.machine+'</div><div class="justif-task-time">'+(j.taskB.start||"?")+'</div>';
      row.appendChild(boxB);
    }

    var delBtn = document.createElement("button"); delBtn.className = "justif-del-btn"; delBtn.textContent = "✕";
    delBtn.addEventListener("click", function() { justifications.splice(idx, 1); renderJustifications(); });
    row.appendChild(delBtn);

    var comment = document.createElement("div"); comment.className = "justif-comment";
    comment.textContent = j.text;

    card.appendChild(row); card.appendChild(comment);
    container.appendChild(card);
  });
}

// ── QUI EDITABLE ─────────────────────────────────────────────
function showQuiEditor(cell, uid, current) {
  var existing = document.getElementById("qui-editor");
  if (existing) existing.remove();

  var editor = document.createElement("div"); editor.id = "qui-editor"; editor.className = "qui-editor";
  var input  = document.createElement("input"); input.type = "text"; input.value = current; input.className = "qui-editor-input"; input.placeholder = "Nom du responsable";
  var saveBtn   = document.createElement("button"); saveBtn.textContent = "✓"; saveBtn.className = "qui-editor-save";
  var cancelBtn = document.createElement("button"); cancelBtn.textContent = "✕"; cancelBtn.className = "qui-editor-cancel";

  editor.appendChild(input); editor.appendChild(saveBtn); editor.appendChild(cancelBtn);
  cell.style.position = "relative";
  cell.appendChild(editor);
  input.focus(); input.select();

  function applyEdit() {
    var val = input.value.trim();
    if (val) {
      ganttQuiOverrides[uid] = val;
      cell.textContent = val + " ✏️";
      cell.dataset.uid = uid;
      // Sauvegarder dans Firebase
      var date    = document.getElementById("f-date").value;
      var machine = document.getElementById("f-machine-name").value.trim();
      if (activeType) {
        var existing = Object.entries(allSessions).find(function(entry) {
          var s = entry[1];
          return s.activeType === activeType && (s.date === date || s.machine === machine || (!date && !machine));
        });
        if (!existing) {
          existing = Object.entries(allSessions).find(function(entry) {
            return entry[1].activeType === activeType;
          });
        }
        if (existing) {
          var sessId  = existing[0];
          var session = JSON.parse(JSON.stringify(existing[1]));
          var taskId  = uid.replace(activeType + "_", "");
          if (!session.typeData) session.typeData = {};
          if (!session.typeData.tasks) session.typeData.tasks = {};
          if (!session.typeData.tasks[taskId]) session.typeData.tasks[taskId] = {};
          session.typeData.tasks[taskId].qui = val;
          if (typeStates[activeType] && typeStates[activeType].tasks) {
            if (!typeStates[activeType].tasks[taskId]) typeStates[activeType].tasks[taskId] = {};
            typeStates[activeType].tasks[taskId].qui = val;
          }
          set(ref(db, "sessions/" + sessId), session);
          showToast("Responsable mis a jour !", "#1a3a6b");
        }
      }
    }
    editor.remove();
  }

  saveBtn.addEventListener("click", applyEdit);
  input.addEventListener("keydown", function(e) { if (e.key === "Enter") applyEdit(); if (e.key === "Escape") editor.remove(); });
  cancelBtn.addEventListener("click", function() { editor.remove(); });
}

// ── EXPORT EXCEL ─────────────────────────────────────────────
function initExportButtons() {
  document.getElementById("export-toggle-btn").addEventListener("click", function(e) {
    e.stopPropagation(); e.preventDefault();
    var menu = document.getElementById("export-menu");
    menu.style.display = menu.style.display === "none" ? "block" : "none";
  });
  document.addEventListener("click", function(e) {
    var dropdown = document.getElementById("export-dropdown");
    if (dropdown && !dropdown.contains(e.target)) document.getElementById("export-menu").style.display = "none";
  });
  document.getElementById("export-all").addEventListener("click", function(e) { e.stopPropagation(); exportToExcel(null, null); document.getElementById("export-menu").style.display = "none"; });
  document.getElementById("export-month").addEventListener("click", function(e) {
    e.stopPropagation();
    var now = new Date();
    var from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    var to   = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
    exportToExcel(from, to); document.getElementById("export-menu").style.display = "none";
  });
  document.getElementById("export-custom").addEventListener("click", function(e) {
    e.stopPropagation();
    var range = document.getElementById("export-date-range");
    range.style.display = range.style.display === "none" ? "flex" : "none";
  });
  document.getElementById("export-confirm-btn").addEventListener("click", function(e) {
    e.stopPropagation();
    var from = document.getElementById("export-date-from").value;
    var to   = document.getElementById("export-date-to").value;
    if (!from || !to) { alert("Veuillez choisir les deux dates."); return; }
    exportToExcel(from, to);
    document.getElementById("export-menu").style.display = "none";
    document.getElementById("export-date-range").style.display = "none";
  });
}

function exportToExcel(dateFrom, dateTo) {
  var sessions = Object.values(allSessions);
  var filtered = sessions;
  if (dateFrom && dateTo) filtered = sessions.filter(function(s) { return s.date >= dateFrom && s.date <= dateTo; });
  if (filtered.length === 0) { alert("Aucune seance trouvee pour cette periode."); return; }
  filtered.sort(function(a, b) { return new Date(a.date) - new Date(b.date); });

  var rows = [["Date","Jour","Machine","Type","Tache","Qui","Debut","Fin","Duree (min)","Commentaire"]];
  filtered.forEach(function(session) {
    var def       = session.activeType && TYPE_DATA[session.activeType] ? TYPE_DATA[session.activeType] : null;
    var typeLabel = def ? def.label : (session.type || "");
    var dateStr   = session.date || "";
    var jourStr   = dateStr ? new Date(dateStr+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long"}) : "";
    var machine   = session.machine || "";
    var tasks     = session.typeData ? (session.typeData.tasks || {}) : {};
    var target    = session.typeData ? (session.typeData.target || {}) : {};
    var extras    = session.typeData ? (session.typeData.extraTasks || []) : [];

    var tStart = getTV(target.sh||"",target.sm||""), tEnd = getTV(target.eh||"",target.em||"");
    var tDur   = (toMin(tStart) !== null && toMin(tEnd) !== null) ? toMin(tEnd) - toMin(tStart) : "";
    rows.push([dateStr, jourStr, machine, typeLabel, "Objectif", "--", tStart, tEnd, tDur, (target.comment||"").replace(/\n/g," | ")]);

    if (def) {
      def.tasks.forEach(function(task) {
        var t = tasks[task.id] || {};
        var start = getTV(t.sh||"",t.sm||""), end = getTV(t.eh||"",t.em||"");
        var dur   = (toMin(start) !== null && toMin(end) !== null) ? toMin(end) - toMin(start) : "";
        rows.push([dateStr, jourStr, machine, typeLabel, task.machine, t.qui||task.qui, start, end, dur, (t.comment||"").replace(/\n/g," | ")]);
      });
    }

    extras.forEach(function(et) {
      var start = getTV(et.sh||"",et.sm||""), end = getTV(et.eh||"",et.em||"");
      var dur   = (toMin(start) !== null && toMin(end) !== null) ? toMin(end) - toMin(start) : "";
      rows.push([dateStr, jourStr, machine, typeLabel, et.machine||"Extra", et.qui||"", start, end, dur, (et.comment||"").replace(/\n/g," | ")]);
    });

    rows.push(["","","","","","","","","",""]);
  });

  var csv = rows.map(function(row) {
    return row.map(function(cell) {
      var str = String(cell !== null && cell !== undefined ? cell : "");
      str = str.replace(/\n/g," | ").replace(/\r/g,"");
      return (str.indexOf(";") > -1 || str.indexOf('"') > -1) ? '"' + str.replace(/"/g,'""') + '"' : str;
    }).join(";");
  }).join("\n");

  var BOM  = "\uFEFF";
  var blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  var now  = new Date().toLocaleDateString("fr-FR").replace(/\//g,"-");
  a.href = url; a.download = "SGD_Pharma_Gantt_" + now + ".csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── TOAST ────────────────────────────────────────────────────
function showToast(message, color) {
  var existing = document.getElementById("toast-notif");
  if (existing) existing.remove();
  var toast = document.createElement("div");
  toast.id = "toast-notif";
  toast.textContent = message;
  toast.style.cssText = "position:fixed;top:70px;left:50%;transform:translateX(-50%);background:"+color+";color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);transition:opacity .3s;font-family:Arial,sans-serif;";
  document.body.appendChild(toast);
  setTimeout(function() { toast.style.opacity = "0"; setTimeout(function() { toast.remove(); }, 300); }, 2500);
}

// ── UTILITAIRE ───────────────────────────────────────────────
function encCmt(str) {
  if (!str) return "";
  return str.replace(/\\/g,"\\\\").replace(/'/g,"&#39;").replace(/"/g,"&quot;").replace(/\n/g,"\\n");
}
