import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, get, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDi9y4PmgvUHvnxDNu4kwpRvB9b-h7Dquk",
  authDomain: "gantt-sgd.firebaseapp.com",
  databaseURL: "https://gantt-sgd-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gantt-sgd",
  storageBucket: "gantt-sgd.firebasestorage.app",
  messagingSenderId: "363250513679",
  appId: "1:363250513679:web:bdf947bd2800614d7a307a"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getDatabase(firebaseApp);

const TASK_COLORS = [
  "#3b82f6","#8b5cf6","#06b6d4","#22c55e","#f97316",
  "#ec4899","#14b8a6","#a855f7","#0ea5e9","#84cc16",
  "#6366f1","#10b981","#eab308","#64748b","#d946ef"
];

const TASKS_RONDELLE = [
  {id:"ron_1", machine:"Nettoyage de machine", qui:"Production"},
  {id:"ron_2", machine:"Changement rondelle (cuvette)", qui:"Feederman"},
  {id:"ron_3", machine:"Cote Finisseur", qui:"Atelier IS"},
  {id:"ron_4", machine:"Cote Ebaucheur", qui:"Atelier IS"},
  {id:"ron_5", machine:"Entonnoir sous verre", qui:"Feederman"},
  {id:"ron_6", machine:"Distributeur sous verre", qui:"Feederman"},
  {id:"ron_7", machine:"Demarrage section sans flacon", qui:"Chef de section"},
  {id:"ron_8", machine:"Debut section avec flacon", qui:"Chef de section"},
  {id:"ron_9", machine:"Machine complete avec flacon", qui:"Chef de section"},
  {id:"ron_10", machine:"Mise a l arche", qui:"Chef de section"},
  {id:"ron_11", machine:"Changement Traitement Surface", qui:"Production"},
  {id:"ron_12", machine:"Nettoyage SO3", qui:"Production"}
];

const TASKS_BOUT_FROID = [
  {id:"bf_1", machine:"Aligneur vide", qui:"Production", color:"#f1c40f", labelDebut:"Début", labelFin:"Fin"},
  {id:"bf_5", machine:"T0 : Nettoyage de ligne", qui:"Production", color:"#e67e22", labelDebut:"Début", labelFin:"Fin (validation vide de ligne)"},
  {id:"bf_2", machine:"T1 : Durée pré-réglage", qui:"Automation", color:"#64748b", labelDebut:"Début réglage automation", labelFin:"Fin réglage de base machines"},
  {id:"bf_4", machine:"Arrivée deux sections contrôlables", qui:"Automation", color:"#2e86ab", labelDebut:"Début", labelFin:"Fin"},
  {id:"bf_3", machine:"Arrivée de toutes sections", qui:"Automation", color:"#795548", labelDebut:"Début", labelFin:"Fin"},
  {id:"bf_6", machine:"Top qualité", qui:"Automation", color:"#9b59b6", labelDebut:"Début", labelFin:"Fin"},
  {id:"bf_9", machine:"Montée en régime", qui:"Automation", color:"#059669", labelDebut:"Début", labelFin:"Fin"},
  {id:"bf_7", machine:"Premier lot sorti", qui:"Automation", color:"#1abc9c", labelDebut:"Début", labelFin:"Fin"},
  {id:"bf_8", machine:"Validation de deux lots commercialisables", qui:"Automation", color:"#e74c3c", labelDebut:"Début", labelFin:"Fin"}
];

// Dictionnaire des causes par tâche (Bout Chaud)
const CAUSES_BOUT_CHAUD = {
  "Nettoyage de machine": ["Nettoyage non réalisé","Manque de personnel","Machine très sale"],
  "Changement rondelle (cuvette)": ["Poids non conforme","Paraison non conforme","T°FMS non conforme","Cuvette non conforme","Formation"],
  "Cote Finisseur": ["Moulerie non conforme","Equipement variable non conforme","Reprise réglages","Problème mécanique","Préparation incomplète","Problème Communication","Formation"],
  "Cote Ebaucheur": ["Moulerie non conforme","Equipement variable non conforme","Reprise réglages","Problème mécanique","Préparation incomplète","Problème Communication","Formation"],
  "Entonnoir sous verre": ["Paraison non conforme"],
  "Distributeur sous verre": ["Problème mécanique","Problème électrique","Problème Lubrification"],
  "Demarrage section sans flacon": ["Réglages section non conforme","Reprise réglages par atelier IS","Equipement non conforme","Problème Ventilation Machine","Problème mécanique","Problème électrique"],
  "Debut section avec flacon": ["Réglages section non conforme","Reprise réglages par atelier IS","Equipement non conforme","Problème Ventilation Machine","Problème mécanique","Problème électrique","Poids non conforme","Paraison non conforme","T°FMS non conforme"],
  "Machine complete avec flacon": ["Retard réglage section","Equipement non conforme","Problème Ventilation Machine","Problème mécanique","Problème électrique","Poids non conforme","Paraison non conforme","T°FMS non conforme"],
  "Mise a l arche": ["Retard réglage SO3","Retard réglage Clear & Safe","Retard réglage enfournement"],
  "Changement Traitement Surface": ["Retard changement équipement TDS","Equipement non conforme","Retard réglages","Réglages non conforme","Formation"],
  "Nettoyage SO3": ["Nettoyage non réalisé","Nettoyage long"]
};

// Dictionnaire des causes par tâche (Bout Froid)
const CAUSES_BOUT_FROID_DICT = {
  "Aligneur vide": ["Manque de personnel","Vide de l\'arche BF","Vide de la ligne entière"],
  "T0 : Nettoyage de ligne": ["Nettoyage non terminé","Manque de personnel"],
  "T1 : Durée pré-réglage": ["Manque de personnel","Témoins NOK","Chariot film NOK","Matériel NOK","Nettoyage (débris verre)","Intervention maintenance","Réglage non terminé","Création fiche","Formation"],
  "Arrivée deux sections contrôlables": ["Retard arrivée sections","Recuit NOK","Réglage équipement BF"],
  "Arrivée de toutes sections": ["Retard démarrage","Top Qualité retardé","Top Emballage retardé","Tombées sur arche","Réglage BF"],
  "Top qualité": ["Top Qualité retardé","Démarrage tardif","SAP"],
  "Premier lot sorti": ["Lot bloqué","Défaut qualité","Défaut palettisation","SAP - étiquette","Démarrage tardif"],
  "Validation de deux lots commercialisables": ["Lot bloqué","Validation retardée"]
};

const BOUT_FROID_COLOR = "#2e86ab";
const MAX_SLOTS = 4;
const HISTORY_PAGE_SIZE = 5;
const ALL_TASK_IDS = TASKS_RONDELLE.map(function(t){return t.id;}).concat(TASKS_BOUT_FROID.map(function(t){return t.id;}));

let allSessions = {};
let ganttData = { targets:{grand_t1:{},petit_t1:{},rondelle:{},nettoyage:{},anticipation_feeder:{},passage_so3:{}}, tasks:{}, extraTasks:[] };
let allTasks = {};
let historyPage = 0;
let ganttQuiOverrides = {};
let appReady = false;
let currentSessId = null;
let modifiedFields = new Set(); // Dirty tracking : IDs des champs modifiés par l'utilisateur

// ── AUTH ──────────────────────────────────────────────────────────────────────
document.getElementById("login-btn").addEventListener("click", async function() {
  var email = document.getElementById("login-email").value.trim();
  var password = document.getElementById("login-pass").value.trim();
  if (!email || !password) { showLoginError("Veuillez remplir les deux champs."); return; }
  var btn = document.getElementById("login-btn");
  btn.textContent = "Connexion..."; btn.disabled = true;
  try {
    var result = await signInWithEmailAndPassword(auth, email, password);
    afficherApp(result.user);
  } catch (err) {
    btn.textContent = "Se connecter"; btn.disabled = false;
    showLoginError(translateAuthError(err.code));
  }
});

["login-email","login-pass"].forEach(function(id) {
  document.getElementById(id).addEventListener("keydown", function(e) {
    if (e.key === "Enter") document.getElementById("login-btn").click();
  });
});

document.getElementById("logout-btn").addEventListener("click", function() {
  signOut(auth); appReady = false;
  document.getElementById("app").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("login-btn").textContent = "Se connecter";
  document.getElementById("login-btn").disabled = false;
  document.getElementById("login-error").style.display = "none";
});

onAuthStateChanged(auth, function(user) {
  if (user && document.getElementById("app").style.display !== "block") afficherApp(user);
  else if (!user) {
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("app").style.display = "none";
  }
});

function afficherApp(user) {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app").style.display = "block";
  document.getElementById("user-label").textContent = user.email;
  if (!appReady) { appReady = true; initApp(); }
}

function showLoginError(msg) {
  var el = document.getElementById("login-error");
  el.textContent = msg; el.style.display = "block";
}

function translateAuthError(code) {
  var m = {
    "auth/invalid-email":"Identifiant invalide.",
    "auth/user-not-found":"Identifiant introuvable.",
    "auth/wrong-password":"Mot de passe incorrect.",
    "auth/invalid-credential":"Identifiant ou mot de passe incorrect.",
    "auth/too-many-requests":"Trop de tentatives.",
    "auth/network-request-failed":"Erreur reseau."
  };
  return m[code] || "Erreur : " + code;
}

// ── INIT ──────────────────────────────────────────────────────────────────────
function initApp() {
  resetState();
  var dateField = document.getElementById("f-date");
  if (dateField && !dateField.value) dateField.value = new Date().toISOString().slice(0,10);
  setInterval(function() {
    var d = document.getElementById("f-date");
    if (d && !d.value) d.value = new Date().toISOString().slice(0,10);
  }, 60000);
  buildForm();

  onValue(ref(db, "sessions"), function(snap) {
    allSessions = snap.val() || {};
    renderHistory(allSessions);
    renderCorbeilleButton();
    document.getElementById("sync-status").textContent = "Connecte";
    // Mettre a jour le Gantt si une session est en cours d affichage
    var gs = document.getElementById("gantt-section");
    if (gs && gs.style.display !== "none" && currentSessId && allSessions[currentSessId]) {
      var s = allSessions[currentSessId];
      renderGantt(s.date, s.machine, s.ganttData || {});
    }
  });

  document.getElementById("save-btn").addEventListener("click", saveSession);

  // Écouter la corbeille pour afficher le badge
  onValue(ref(db, "corbeille"), function(snap) {
    var corbeille = snap.val() || {};
    var now = Date.now();
    // Filtrer les sessions encore dans les 24h
    var actives = Object.entries(corbeille).filter(function(e) {
      return now - (e[1]._deletedAt||0) < 86400000;
    });
    updateCorbeilleButton(actives.length);
    // Nettoyer les anciennes automatiquement
    cleanCorbeille();
  });
  document.getElementById("new-session-btn").addEventListener("click", newSession);
  document.getElementById("del-all-btn").addEventListener("click", deleteAllHistory);
  initExportButtons();
  var ghBtn = document.getElementById("send-github-btn");
  if (ghBtn) ghBtn.addEventListener("click", sendToGitHub);

  var TT = document.getElementById("tooltip");
  document.addEventListener("mousemove", function(e) {
    if (!TT.classList.contains("visible")) return;
    var x = e.clientX+16, y = e.clientY+16;
    if (x+310 > window.innerWidth) x = e.clientX-310;
    if (y+230 > window.innerHeight) y = e.clientY-230;
    TT.style.left = x+"px"; TT.style.top = y+"px";
  });
}

function resetState() {
  ganttData = { targets:{grand_t1:{},petit_t1:{},rondelle:{},nettoyage:{},anticipation_feeder:{},passage_so3:{}}, tasks:{}, extraTasks:[] };
  ganttQuiOverrides = {};
  modifiedFields = new Set();
  currentSessId = null;
  document.getElementById("f-machine-name").value = "";
  var refField = document.getElementById("f-reference"); if (refField) refField.value = "";
  document.getElementById("f-date").value = new Date().toISOString().slice(0,10);
}

// ── FORMULAIRE ────────────────────────────────────────────────────────────────
function buildForm() {
  var container = document.getElementById("form-sections");
  container.innerHTML = "";

  var targetsGroup = document.createElement("div");
  targetsGroup.style.cssText = "background:#f0f2f5;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px;margin-bottom:4px;";
  targetsGroup.appendChild(buildTargetSection("grand_t1","TARGET (Grand T1)","#c0392b",ganttData.targets.grand_t1||{}));
  targetsGroup.appendChild(buildTargetSection("nettoyage","TARGET (Nettoyage)","#27ae60",ganttData.targets.nettoyage||{}));
  targetsGroup.appendChild(buildTargetSection("petit_t1","TARGET (Petit t1)","#e07b54",ganttData.targets.petit_t1||{}));
  targetsGroup.appendChild(buildTargetSection("rondelle","TARGET (Rondelle)","#7d3c98",ganttData.targets.rondelle||{}));
  targetsGroup.appendChild(buildTargetSection("anticipation_feeder","TARGET (Anticipation Feeder)","#2980b9",ganttData.targets.anticipation_feeder||{}));
  targetsGroup.appendChild(buildTargetSection("passage_so3","TARGET (Passage en SO3)","#e91e8c",ganttData.targets.passage_so3||{}));
  container.appendChild(targetsGroup);

  var tasksSec = document.createElement("div");
  tasksSec.className = "tasks-sec"; tasksSec.style.borderColor = "#1a3a6b";
  var tasksHd = document.createElement("div"); tasksHd.className = "tasks-sec-hd"; tasksHd.style.background = "#1a3a6b";
  tasksHd.textContent = "Taches detaillees"; tasksSec.appendChild(tasksHd);
  tasksSec._taskFields = {}; tasksSec._extraFields = [];

  TASKS_RONDELLE.forEach(function(task, idx) {
    var tv = ganttData.tasks[task.id] || {};
    appendTaskRow(tasksSec, task.id, task.machine, task.qui, tv, TASK_COLORS[idx % TASK_COLORS.length]);
  });

  // Extras Bout Chaud - juste apres les taches fixes Bout Chaud, avant le separateur
  (ganttData.extraTasks || []).filter(function(et){ return (et.group||"boutchaud")==="boutchaud"; }).forEach(function(et) {
    appendExtraTaskRow(tasksSec, et, et.color || TASK_COLORS[0]);
  });

  var bfSep = document.createElement("div");
  bfSep.style.cssText = "background:"+BOUT_FROID_COLOR+";color:#fff;font-size:12px;font-weight:700;padding:8px 12px;letter-spacing:.5px;";
  bfSep.textContent = "BOUT FROID"; tasksSec.appendChild(bfSep);

  TASKS_BOUT_FROID.forEach(function(task) {
    var tv = ganttData.tasks[task.id] || {};
    tv._labelDebut = task.labelDebut; tv._labelFin = task.labelFin;
    appendTaskRow(tasksSec, task.id, task.machine, task.qui, tv, task.color);
  });

  // Extras Bout Froid - juste apres les taches fixes Bout Froid, avant le bouton
  (ganttData.extraTasks || []).filter(function(et){ return et.group==="boutfroid"; }).forEach(function(et) {
    appendExtraTaskRow(tasksSec, et, et.color || TASK_COLORS[0]);
  });

  var addBtn = document.createElement("button");
  addBtn.className = "btn-add-task"; addBtn.textContent = "+ Ajouter une tache";
  addBtn.addEventListener("click", function() {
    var existing = document.getElementById("add-task-popup");
    if (existing) { existing.remove(); return; }
    var popup = document.createElement("div");
    popup.id = "add-task-popup";
    popup.style.cssText = "background:#fff;border:1.5px solid #1a3a6b;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:10px;margin:6px 0;display:flex;gap:10px;";
    var btnBC = document.createElement("button");
    btnBC.textContent = "Bout Chaud";
    btnBC.style.cssText = "flex:1;padding:10px;background:#f97316;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:Arial,sans-serif;";
    btnBC.addEventListener("click", function() {
      var color = TASK_COLORS[(TASKS_RONDELLE.length + tasksSec._extraFields.filter(function(f){return (f.group||"boutchaud")==="boutchaud";}).length) % TASK_COLORS.length];
      appendExtraTaskRow(tasksSec, {group:"boutchaud"}, color, bfSep); popup.remove();
    });
    var btnBF = document.createElement("button");
    btnBF.textContent = "Bout Froid";
    btnBF.style.cssText = "flex:1;padding:10px;background:"+BOUT_FROID_COLOR+";color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:Arial,sans-serif;";
    btnBF.addEventListener("click", function() {
      var bfColors = ["#f1c40f","#64748b","#795548","#2e86ab"];
      var idx = tasksSec._extraFields.filter(function(f){return f.group==="boutfroid";}).length;
      appendExtraTaskRow(tasksSec, {group:"boutfroid"}, bfColors[idx%4], addBtn); popup.remove();
    });
    popup.appendChild(btnBC); popup.appendChild(btnBF);
    tasksSec.insertBefore(popup, addBtn);
  });
  tasksSec.appendChild(addBtn);
  container.appendChild(tasksSec);
  container._tasksSec = tasksSec;
}

function buildTargetSection(key, label, color, saved) {
  var sec = document.createElement("div"); sec.className = "tasks-sec"; sec.style.borderColor = color;
  var hd = document.createElement("div"); hd.className = "tasks-sec-hd"; hd.style.background = color;
  hd.textContent = label; sec.appendChild(hd);
  var cmtContainer = document.createElement("div");
  var slotsWrap = buildSlotSystem(sec, cmtContainer, getSavedSlots(saved), null, null, "target_"+key, label);
  slotsWrap.style.padding = "10px 12px";
  sec.appendChild(slotsWrap); sec.appendChild(cmtContainer);
  sec.dataset.targetKey = key;
  return sec;
}

function appendTaskRow(sec, taskId, machineName, quiDefault, tv, color) {
  var row = document.createElement("div"); row.className = "task-row";
  var top = document.createElement("div"); top.className = "task-row-top";
  var colorBar = document.createElement("div"); colorBar.className = "task-color-bar"; colorBar.style.background = color;
  var lbl = document.createElement("span"); lbl.className = "task-row-label"; lbl.textContent = machineName;
  var who = document.createElement("span"); who.className = "task-row-who"; who.textContent = quiDefault;
  top.appendChild(colorBar); top.appendChild(lbl); top.appendChild(who);
  row.appendChild(top);
  var cmtContainer = document.createElement("div");
  var slotsWrap = buildSlotSystem(row, cmtContainer, getSavedSlots(tv), tv._labelDebut, tv._labelFin, "task_"+taskId, machineName);
  row.appendChild(slotsWrap); row.appendChild(cmtContainer);
  sec._taskFields[taskId] = {color:color, row:row};
  sec.appendChild(row);
}

function appendExtraTaskRow(sec, et, color, anchor) {
  var row = document.createElement("div"); row.className = "task-row";
  var top = document.createElement("div"); top.className = "task-row-top";
  var colorBar = document.createElement("div"); colorBar.className = "task-color-bar"; colorBar.style.background = color;
  var nameInp = document.createElement("input"); nameInp.type = "text"; nameInp.value = et.machine||"";
  nameInp.placeholder = "Nom de la tache";
  nameInp.style.cssText = "flex:1;border:none;background:transparent;font-size:13px;font-weight:700;color:#1c1c1e;font-family:Arial,sans-serif;outline:none;";
  var whoInp = document.createElement("input"); whoInp.type = "text"; whoInp.value = et.qui||"";
  whoInp.placeholder = "Qui";
  whoInp.style.cssText = "font-size:11px;color:#6c6c70;background:#f7f7f8;padding:2px 8px;border-radius:6px;border:1px solid #e0e0e5;width:100px;outline:none;font-family:Arial,sans-serif;";
  var delBtn = document.createElement("button"); delBtn.className = "btn-del-task"; delBtn.textContent = "Supprimer";
  delBtn.addEventListener("click", function() {
    row.remove();
    sec._extraFields = sec._extraFields.filter(function(f) { return f.row !== row; });
    autoSaveExtras();
  });
  top.appendChild(colorBar); top.appendChild(nameInp); top.appendChild(whoInp); top.appendChild(delBtn);
  row.appendChild(top);
  var cmtContainer = document.createElement("div");
  var slotsWrap = buildSlotSystem(row, cmtContainer, getSavedSlots(et), null, null, "extra_"+Date.now(), et.machine||"");
  row.appendChild(slotsWrap); row.appendChild(cmtContainer);
  row._nameInp = nameInp; row._whoInp = whoInp;
  // Tracker les modifications des extras
  nameInp.addEventListener("input", function() { modifiedFields.add("extras_modified"); });
  whoInp.addEventListener("input", function() { modifiedFields.add("extras_modified"); });
  sec._extraFields.push({color:color, row:row, group:et.group||"boutchaud"});
  if (anchor) sec.insertBefore(row, anchor); else sec.appendChild(row);
}

// ── SYSTEME DE CRENEAUX ───────────────────────────────────────────────────────
function buildSlotSystem(holder, container, savedSlots, labelDebut, labelFin, trackingId, taskMachineName) {
  holder._slots = [];
  var slotsWrap = document.createElement("div"); slotsWrap.className = "task-row-times";
  var addBtn = document.createElement("button"); addBtn.className = "btn-add-slot"; addBtn.textContent = "+";
  var removeBtn = document.createElement("button"); removeBtn.className = "btn-add-slot"; removeBtn.textContent = "-";
  removeBtn.style.background = "#e74c3c"; removeBtn.style.display = "none";

  function refreshBtns() {
    addBtn.style.display = holder._slots.length >= MAX_SLOTS ? "none" : "";
    removeBtn.style.display = holder._slots.length <= 1 ? "none" : "";
  }

  function addSlot(sh, sm, eh, em, comment) {
    var n = holder._slots.length;
    if (n > 0) {
      var sep = document.createElement("span"); sep.className = "slot-sep";
      sep.style.cssText = "font-size:11px;color:#6c6c70;margin:0 4px;"; sep.textContent = "puis";
      slotsWrap.insertBefore(sep, addBtn);
    }
    var slotEl = makeSlotRow(sh||"", sm||"", eh||"", em||"", n===0?labelDebut:null, n===0?labelFin:null, trackingId);
    slotsWrap.insertBefore(slotEl, addBtn);
    var cmtTA = makeTextarea("Commentaire creneau "+(n+1)+"...", comment||"", trackingId, taskMachineName);
    var cmtWrap = document.createElement("div"); cmtWrap.className = "task-comment-wrap"; cmtWrap.appendChild(cmtTA);
    container.appendChild(cmtWrap);
    holder._slots.push({slotEl:slotEl, cmtTA:cmtTA, cmtWrap:cmtWrap});
    refreshBtns();
  }

  addBtn.addEventListener("click", function() { addSlot("","","",""); });
  removeBtn.addEventListener("click", function() {
    if (holder._slots.length <= 1) return;
    var last = holder._slots.pop();
    last.slotEl.remove(); last.cmtWrap.remove();
    var seps = slotsWrap.querySelectorAll("span.slot-sep");
    if (seps.length > 0) seps[seps.length-1].remove();
    refreshBtns();
  });
  slotsWrap.appendChild(addBtn); slotsWrap.appendChild(removeBtn);

  if (savedSlots && savedSlots.length > 0) {
    savedSlots.forEach(function(s) { addSlot(s.sh, s.sm, s.eh, s.em, s.comment); });
  } else { addSlot("","","",""); }

  return slotsWrap;
}

function readSlots(holder) {
  var d = {}; if (!holder._slots) return d;
  var keys = [["sh","sm","eh","em","comment"],["sh2","sm2","eh2","em2","comment2"],["sh3","sm3","eh3","em3","comment3"],["sh4","sm4","eh4","em4","comment4"]];
  holder._slots.forEach(function(s, i) {
    if (i >= keys.length) return;
    var k = keys[i];
    d[k[0]]=s.slotEl._sF._getH(); d[k[1]]=s.slotEl._sF._getM();
    d[k[2]]=s.slotEl._eF._getH(); d[k[3]]=s.slotEl._eF._getM();
    d[k[4]]=s.cmtTA.value;
  });
  return d;
}

function getSavedSlots(obj) {
  var slots = [{sh:obj.sh, sm:obj.sm, eh:obj.eh, em:obj.em, comment:obj.comment||""}];
  if (obj.sh2||obj.eh2) slots.push({sh:obj.sh2, sm:obj.sm2, eh:obj.eh2, em:obj.em2, comment:obj.comment2||""});
  if (obj.sh3||obj.eh3) slots.push({sh:obj.sh3, sm:obj.sm3, eh:obj.eh3, em:obj.em3, comment:obj.comment3||""});
  if (obj.sh4||obj.eh4) slots.push({sh:obj.sh4, sm:obj.sm4, eh:obj.eh4, em:obj.em4, comment:obj.comment4||""});
  return slots;
}

// ── CHAMPS TEMPS ──────────────────────────────────────────────────────────────
function makeSlotRow(sh, sm, eh, em, labelDebut, labelFin, trackingId) {
  var wrap = document.createElement("div"); wrap.style.cssText = "display:flex;align-items:center;gap:6px;flex-wrap:wrap;";
  var sGrp = document.createElement("div"); sGrp.className = "time-group";
  var sLbl = document.createElement("label"); sLbl.textContent = labelDebut||"Debut";
  var sF = makeTimeField(sh, sm, trackingId); sGrp.appendChild(sLbl); sGrp.appendChild(sF);
  var eGrp = document.createElement("div"); eGrp.className = "time-group";
  var eLbl = document.createElement("label"); eLbl.textContent = labelFin||"Fin";
  var eF = makeTimeField(eh, em, trackingId); eGrp.appendChild(eLbl); eGrp.appendChild(eF);
  var prev = document.createElement("span"); prev.className = "time-preview";
  function updPrev() {
    var s=getTV(sF._getH(),sF._getM()), e=getTV(eF._getH(),eF._getM());
    prev.textContent = s&&e ? s+" -> "+e : s ? s+" -> ?" : "";
  }
  sF.addEventListener("input",updPrev); eF.addEventListener("input",updPrev); updPrev();
  wrap.appendChild(sGrp); wrap.appendChild(eGrp); wrap.appendChild(prev);
  wrap._sF = sF; wrap._eF = eF;
  return wrap;
}

function makeTimeField(hVal, mVal, trackingId) {
  var wrap = document.createElement("div"); wrap.className = "time-field";
  var hInp = document.createElement("input"); hInp.className = "h-inp"; hInp.inputMode = "numeric"; hInp.maxLength = 2; hInp.placeholder = "H"; hInp.value = hVal||"";
  var sep = document.createElement("span"); sep.className = "time-field-sep"; sep.textContent = ":";
  var mInp = document.createElement("input"); mInp.className = "m-inp"; mInp.inputMode = "numeric"; mInp.maxLength = 2; mInp.placeholder = "mm"; mInp.value = mVal||"";
  hInp.addEventListener("input", function() {
    if (trackingId) modifiedFields.add(trackingId);
    this.value = this.value.replace(/\D/g,"").slice(0,2);
    if (this.value.length===2) { if(parseInt(this.value)>23) this.value="23"; mInp.focus(); }
  });
  hInp.addEventListener("blur", function() { if (this.value !== "") { var v=parseInt(this.value); if(v>23)this.value="23"; if(v<0)this.value="0"; } });
  mInp.addEventListener("input", function() {
    if (trackingId) modifiedFields.add(trackingId);
    this.value = this.value.replace(/\D/g,"").slice(0,2);
    if (this.value.length===2 && parseInt(this.value)>59) this.value="59";
  });
  mInp.addEventListener("blur", function() { if (this.value !== "") { var v=parseInt(this.value); if(v>59)this.value="59"; if(v<0)this.value="0"; } });
  wrap.appendChild(hInp); wrap.appendChild(sep); wrap.appendChild(mInp);
  wrap._getH = function() { return hInp.value; };
  wrap._getM = function() { return mInp.value; };
  return wrap;
}

function makeTextarea(placeholder, value, trackingId, taskMachineName) {
  var wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;gap:4px;width:100%;";

  // Chercher les causes disponibles pour cette tâche
  var causes = null;
  if (taskMachineName) {
    causes = CAUSES_BOUT_CHAUD[taskMachineName] || CAUSES_BOUT_FROID_DICT[taskMachineName] || null;
  }

  // Décomposer la valeur existante en motifs sélectionnés et commentaire libre
  var existingParts = (value||"").split(" | ").filter(function(s){return s.trim();});
  var selectedMotifs = [];
  var freeText = "";
  if (causes && existingParts.length > 0) {
    existingParts.forEach(function(part) {
      if (causes.indexOf(part.trim()) > -1) selectedMotifs.push(part.trim());
      else if (part.trim()) freeText += (freeText ? " | " : "") + part.trim();
    });
  } else {
    freeText = value || "";
  }

  // Zone de résumé
  var resumeEl = document.createElement("div");
  resumeEl.style.cssText = "font-size:11px;color:#1a3a6b;padding:2px 4px;min-height:16px;font-style:italic;";
  function updateResume() {
    var parts = selectedMotifs.slice();
    var ft = ta.value.trim();
    if (ft) parts.push(ft);
    resumeEl.textContent = parts.length ? parts.join(" | ") : "";
    wrapper._getValue = function() { return parts.join(" | "); };
  }

  // Boutons motifs si causes disponibles
  if (causes) {
    var motifsWrap = document.createElement("div");
    motifsWrap.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;padding:2px 0;";
    causes.forEach(function(cause) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = cause;
      var isSelected = selectedMotifs.indexOf(cause) > -1;
      btn.style.cssText = "padding:4px 8px;border-radius:6px;font-size:11px;font-family:Arial,sans-serif;cursor:pointer;border:1.5px solid #d0d0d5;transition:all .15s;" +
        (isSelected ? "background:#34c759;color:#fff;border-color:#34c759;" : "background:#f7f7f8;color:#333;");
      btn.addEventListener("click", function() {
        var idx = selectedMotifs.indexOf(cause);
        if (idx > -1) {
          selectedMotifs.splice(idx, 1);
          btn.style.background = "#f7f7f8";
          btn.style.color = "#333";
          btn.style.borderColor = "#d0d0d5";
        } else {
          selectedMotifs.push(cause);
          btn.style.background = "#34c759";
          btn.style.color = "#fff";
          btn.style.borderColor = "#34c759";
        }
        if (trackingId) modifiedFields.add(trackingId);
        updateResume();
      });
      motifsWrap.appendChild(btn);
    });
    wrapper.appendChild(motifsWrap);
  }

  // Champ texte libre
  var ta = document.createElement("textarea");
  ta.placeholder = causes ? "Autre commentaire..." : placeholder;
  ta.value = freeText; ta.rows = 1;
  function resize() { ta.style.height="auto"; ta.style.height=ta.scrollHeight+"px"; }
  ta.addEventListener("input", function() { if (trackingId) modifiedFields.add(trackingId); resize(); updateResume(); });
  setTimeout(resize, 0);
  wrapper.appendChild(ta);
  wrapper.appendChild(resumeEl);

  // Exposer la valeur combinée
  wrapper._getValue = function() {
    var parts = selectedMotifs.slice();
    var ft = ta.value.trim();
    if (ft) parts.push(ft);
    return parts.join(" | ");
  };
  // Compatibilité : exposer .value comme un textarea
  Object.defineProperty(wrapper, "value", {
    get: function() { return wrapper._getValue(); },
    set: function(v) { ta.value = v; updateResume(); }
  });

  updateResume();
  return wrapper;
}

function getTV(h, m) {
  if (!h) return "";
  var hv=parseInt(h), mv=parseInt(m)||0;
  if (isNaN(hv)||hv<0||hv>23||mv<0||mv>59) return "";
  return hv+":"+(mv<10?"0"+mv:mv);
}

function toMin(s) { if(!s||!s.includes(":")) return null; var p=s.split(":").map(Number); return p[0]*60+(p[1]||0); }
function fmtDur(s,e) { var d=e-s; if(d<=0) return "--"; var h=Math.floor(d/60),m=d%60; return h&&m?h+"h "+m+"min":h?h+"h":m+"min"; }
function encCmt(str) { if(!str) return ""; return str.replace(/\\/g,"\\\\").replace(/'/g,"&#39;").replace(/"/g,"&quot;").replace(/\n/g,"\\n"); }

// ── COLLECTE ──────────────────────────────────────────────────────────────────
function collectData() {
  var container = document.getElementById("form-sections");
  var out = { targets:{}, tasks:{}, extraTasks:[] };
  ["grand_t1","nettoyage","petit_t1","rondelle","anticipation_feeder","passage_so3"].forEach(function(key) {
    var sec = container.querySelector('[data-target-key="'+key+'"]');
    if (sec) out.targets[key] = readSlots(sec);
  });
  var tasksSec = container._tasksSec;
  if (tasksSec) {
    TASKS_RONDELLE.forEach(function(task) {
      var f = tasksSec._taskFields[task.id]; if (!f) return;
      out.tasks[task.id] = readSlots(f.row);
    });
    TASKS_BOUT_FROID.forEach(function(task) {
      var f = tasksSec._taskFields[task.id]; if (!f) return;
      out.tasks[task.id] = readSlots(f.row);
    });
    tasksSec._extraFields.forEach(function(et) {
      var name = et.row._nameInp ? et.row._nameInp.value.trim() : "";
      if (!name) return;
      var d = readSlots(et.row);
      d.machine = name; d.qui = et.row._whoInp ? et.row._whoInp.value.trim() : "";
      d.group = et.group || "boutchaud"; d.color = et.color || "";
      out.extraTasks.push(d);
    });
  }
  return out;
}

// ── SAUVEGARDE ────────────────────────────────────────────────────────────────
async function ensureSession() {
  var date = document.getElementById("f-date").value;
  var machine = document.getElementById("f-machine-name").value.trim();
  if (!date || !machine) return null;
  if (currentSessId) return currentSessId;
  var existing = Object.entries(allSessions).find(function(e) { return e[1].date===date && e[1].machine===machine; });
  if (existing) { currentSessId = existing[0]; return currentSessId; }
  var sessId = "sess_"+Date.now();
  var dl = new Date(date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
  await set(ref(db,"sessions/"+sessId), {
    date:date, machine:machine,
    ganttData:{ targets:{grand_t1:{},nettoyage:{},petit_t1:{},rondelle:{},anticipation_feeder:{},passage_so3:{}}, tasks:{}, extraTasks:[] },
    title:machine+" - "+dl, savedAt:Date.now()
  });
  currentSessId = sessId;
  return sessId;
}

async function saveSession() {
  var date = document.getElementById("f-date").value;
  var machine = document.getElementById("f-machine-name").value.trim();
  if (!date || !machine) { alert("Veuillez remplir la date et la machine."); return; }

  var sessId = await ensureSession();
  if (!sessId) return;

  var data = collectData();
  var dl = new Date(date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});

  // DIRTY TRACKING : sauvegarder uniquement les champs modifiés par ce PC
  // Exception : si c'est le premier enregistrement (session vide), sauvegarder tout
  var snapCheck = await get(ref(db,"sessions/"+sessId+"/ganttData/tasks"));
  var isFirstSave = !snapCheck.val() || Object.keys(snapCheck.val()).length === 0;

  // Sauvegarder les targets
  for (var tkey of ["grand_t1","nettoyage","petit_t1","rondelle","anticipation_feeder","passage_so3"]) {
    if (isFirstSave || modifiedFields.has("target_"+tkey)) {
      await set(ref(db,"sessions/"+sessId+"/ganttData/targets/"+tkey), data.targets[tkey]||{});
    }
  }

  // Sauvegarder les tâches
  for (var taskId of ALL_TASK_IDS) {
    if (isFirstSave || modifiedFields.has("task_"+taskId)) {
      await set(ref(db,"sessions/"+sessId+"/ganttData/tasks/"+taskId), data.tasks[taskId]||{});
    }
  }

  // Sauvegarder les extras seulement si modifiés
  if (modifiedFields.has("extras_modified") && data.extraTasks && data.extraTasks.length > 0) {
    await set(ref(db,"sessions/"+sessId+"/ganttData/extraTasks"), data.extraTasks);
  }

  // Metadonnees
  await set(ref(db,"sessions/"+sessId+"/machine"), machine);
  await set(ref(db,"sessions/"+sessId+"/date"), date);
  await set(ref(db,"sessions/"+sessId+"/title"), machine+" - "+dl);
  await set(ref(db,"sessions/"+sessId+"/savedAt"), Date.now());

  modifiedFields = new Set(); // Réinitialiser le tracking après sauvegarde
  showToast("Séance enregistrée !", "#34c759");

  // Lire les donnees completes depuis Firebase pour afficher le Gantt
  var snap = await get(ref(db,"sessions/"+sessId));
  var s = snap.val();
  if (s && s.ganttData) {
    ganttData = s.ganttData;
    renderGantt(date, machine, s.ganttData);
  }
  setTimeout(function() { document.getElementById("gantt-section").scrollIntoView({behavior:"smooth"}); }, 100);
}

async function autoSaveExtras() {
  if (!currentSessId) return;
  var data = collectData();
  if (data.extraTasks && data.extraTasks.length >= 0) {
    await set(ref(db,"sessions/"+currentSessId+"/ganttData/extraTasks"), data.extraTasks);
  }
  showToast("Tache supprimee !", "#e74c3c");
}

async function newSession() {
  if (!confirm("Repartir a zero ?")) return;
 
  resetState();
  buildForm();
  document.getElementById("gantt-container").innerHTML = '<div class="empty-gantt">Remplissez le formulaire et enregistrez pour afficher le Gantt</div>';
  document.getElementById("gantt-section").style.display = "none";
}

// ── HISTORIQUE ────────────────────────────────────────────────────────────────
function renderHistory(sessions) {
  var list = document.getElementById("history-list");
  var arr = Object.entries(sessions).sort(function(a,b) {
    var da=a[1].date||"", db2=b[1].date||"";
    if (db2!==da) return db2>da?1:-1;
    return (b[1].savedAt||0)-(a[1].savedAt||0);
  });
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
      '<div class="history-item-left">'+
      '<div class="history-item-title">'+(s.machine||"Seance")+'</div>'+
      '<div class="history-item-sub">'+dl+'</div>'+
      '</div>'+
      '<div class="history-item-actions">'+
      '<span class="history-load-btn" data-load="'+id+'">Charger</span>'+
      '<span class="history-edit-btn" data-edit="'+id+'">Modifier</span>'+
      '<span class="history-del-btn" data-del="'+id+'">Supprimer</span>'+
      '</div></div>';
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
  var pb=document.getElementById("hist-prev"), nb=document.getElementById("hist-next");
  if (pb) pb.addEventListener("click", function() { historyPage--; renderHistory(allSessions); });
  if (nb) nb.addEventListener("click", function() { historyPage++; renderHistory(allSessions); });
}

function updateCorbeilleButton(count) {
  var btn = document.getElementById("corbeille-btn");
  if (!btn) return;
  if (count > 0) {
    btn.style.display = "inline-flex";
    btn.innerHTML = "🗑️ Corbeille <span style='background:#e74c3c;color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;margin-left:5px;'>"+count+"</span>";
  } else {
    btn.style.display = "none";
  }
}

function renderCorbeilleButton() {
  var hd = document.querySelector(".history-hd");
  if (!hd || document.getElementById("corbeille-btn")) return;
  var btn = document.createElement("span");
  btn.id = "corbeille-btn";
  btn.style.cssText = "cursor:pointer;color:#e67e22;font-size:12px;font-weight:600;margin-left:10px;display:none;align-items:center;gap:4px;";
  btn.addEventListener("click", openCorbeille);
  hd.insertBefore(btn, hd.querySelector(".history-del-all"));
}

async function openCorbeille() {
  var snap = await get(ref(db,"corbeille"));
  var corbeille = snap.val() || {};
  var now = Date.now();
  var actives = Object.entries(corbeille).filter(function(e) {
    return now - (e[1]._deletedAt||0) < 86400000;
  }).sort(function(a,b){ return (b[1]._deletedAt||0)-(a[1]._deletedAt||0); });

  var existing = document.getElementById("corbeille-panel");
  if (existing) { existing.remove(); return; }

  var panel = document.createElement("div");
  panel.id = "corbeille-panel";
  panel.style.cssText = "background:#fff8f0;border:2px solid #e67e22;border-radius:12px;padding:12px;margin:8px 0;";

  var title = document.createElement("div");
  title.style.cssText = "font-size:13px;font-weight:700;color:#e67e22;margin-bottom:10px;";
  title.textContent = "🗑️ Corbeille — Sessions supprimées (récupérables 24h)";
  panel.appendChild(title);

  if (actives.length === 0) {
    var empty = document.createElement("div");
    empty.style.cssText = "color:#999;font-size:12px;text-align:center;padding:10px;";
    empty.textContent = "Corbeille vide";
    panel.appendChild(empty);
  } else {
    actives.forEach(function(entry) {
      var id = entry[0], s = entry[1];
      var dl = s.date ? new Date(s.date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}) : "";
      var deletedAgo = Math.round((now - (s._deletedAt||0)) / 60000);
      var timeStr = deletedAgo < 60 ? deletedAgo+" min" : Math.round(deletedAgo/60)+"h";

      var item = document.createElement("div");
      item.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#fff;border-radius:8px;margin-bottom:6px;border:1px solid #f0d0b0;";
      item.innerHTML = '<div><div style="font-size:13px;font-weight:700;">'+( s.machine||"Séance")+'</div><div style="font-size:11px;color:#999;">'+dl+' · supprimée il y a '+timeStr+'</div></div>'+
        '<button style="background:#34c759;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:Arial,sans-serif;" data-restore="'+id+'">Restaurer</button>';
      panel.appendChild(item);
    });
  }

  var closeBtn = document.createElement("button");
  closeBtn.textContent = "Fermer";
  closeBtn.style.cssText = "margin-top:8px;background:#e67e22;color:#fff;border:none;border-radius:8px;padding:6px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:Arial,sans-serif;width:100%;";
  closeBtn.addEventListener("click", function() { panel.remove(); });
  panel.appendChild(closeBtn);

  panel.querySelectorAll("[data-restore]").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      await restoreSession(btn.dataset.restore);
      panel.remove();
    });
  });

  // Insérer après le bouton corbeille
  var histSec = document.querySelector(".history-sec");
  if (histSec) histSec.insertAdjacentElement("afterend", panel);
  else document.querySelector(".form-wrap").insertAdjacentElement("afterbegin", panel);
}

async function loadHistorySession(id) {
  var snap = await get(ref(db,"sessions/"+id));
  var d = snap.val(); if (!d) return;
  document.getElementById("f-date").value = d.date||"";
  document.getElementById("f-machine-name").value = d.machine||"";
  ganttData = d.ganttData || {};
  ganttData.targets = ganttData.targets || {grand_t1:{},petit_t1:{},rondelle:{}};
  ganttData.tasks = ganttData.tasks || {};
  ganttData.extraTasks = ganttData.extraTasks || [];
  currentSessId = id;
  buildForm();
  renderGantt(d.date, d.machine, ganttData);
  setTimeout(function() { document.getElementById("gantt-section").scrollIntoView({behavior:"smooth"}); }, 200);
}

async function editHistorySession(id) {
  var snap = await get(ref(db,"sessions/"+id));
  var d = snap.val(); if (!d) return;
  document.getElementById("f-date").value = d.date||"";
  document.getElementById("f-machine-name").value = d.machine||"";
  ganttData = d.ganttData || {};
  ganttData.targets = ganttData.targets || {grand_t1:{},petit_t1:{},rondelle:{}};
  ganttData.tasks = ganttData.tasks || {};
  ganttData.extraTasks = ganttData.extraTasks || [];
  currentSessId = id;
  buildForm();
  document.querySelector(".info-sec").scrollIntoView({behavior:"smooth"});
  showToast("Seance chargee - modifiez puis enregistrez", "#1a3a6b");
}

async function deleteSession(id) {
  if (!confirm("Supprimer cette séance ?")) return;
  var snap = await get(ref(db,"sessions/"+id));
  var d = snap.val(); if (!d) return;
  d._deletedAt = Date.now();
  await set(ref(db,"corbeille/"+id), d);
  await remove(ref(db,"sessions/"+id));
  if (currentSessId === id) { resetState(); buildForm(); }
  showToast("Séance déplacée dans la corbeille (récupérable 24h)", "#e67e22");
}

async function deleteAllHistory() {
  if (!confirm("Supprimer tout l'historique ?")) return;
  for (var id of Object.keys(allSessions)) {
    var d = JSON.parse(JSON.stringify(allSessions[id]));
    d._deletedAt = Date.now();
    await set(ref(db,"corbeille/"+id), d);
  }
  await remove(ref(db,"sessions"));
  resetState(); buildForm();
}

async function restoreSession(id) {
  var snap = await get(ref(db,"corbeille/"+id));
  var d = snap.val(); if (!d) return;
  delete d._deletedAt;
  await set(ref(db,"sessions/"+id), d);
  await remove(ref(db,"corbeille/"+id));
  showToast("Séance restaurée !", "#34c759");
}

async function cleanCorbeille() {
  var snap = await get(ref(db,"corbeille"));
  var corbeille = snap.val() || {};
  var now = Date.now();
  for (var cid of Object.keys(corbeille)) {
    if (now - (corbeille[cid]._deletedAt||0) > 86400000) {
      await remove(ref(db,"corbeille/"+cid));
    }
  }
}

// ── GANTT ─────────────────────────────────────────────────────────────────────
function fmtCmtCell(cmts, color) {
  var valid = cmts.filter(function(c){return c&&c.trim();});
  if (!valid.length) return '<td class="info cmt-col"></td>';
  var html = '<td class="info cmt-col" style="border-left:3px solid '+color+';">';
  valid.forEach(function(c, i) {
    if (i > 0) html += '<div class="cmt-col-sep"></div>';
    html += '<div class="cmt-col-text">'+c.replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\\n/g,"<br>")+'</div>';
  });
  return html + '</td>';
}

function renderGantt(date, machine, data) {
  var container = document.getElementById("gantt-container");
  var targets = data.targets || {};
  var tasks = data.tasks || {};
  var extras = (data.extraTasks||[]).slice();
  var extrasBoutChaud = extras.filter(function(et){ return (et.group||"boutchaud")==="boutchaud"; });
  var extrasBoutFroid = extras.filter(function(et){ return et.group==="boutfroid"; });

  allTasks = {};
  var minT=Infinity, maxT=-Infinity;

  function regT(sh, sm, eh, em) {
    var s=toMin(getTV(sh||"",sm||"")), e=toMin(getTV(eh||"",em||""));
    if(s!==null&&s>0) minT=Math.min(minT,s);
    if(e!==null&&e>0) maxT=Math.max(maxT,e);
  }
  function regObj(obj) {
    regT(obj.sh,obj.sm,obj.eh,obj.em);
    if(obj.sh2||obj.eh2) regT(obj.sh2,obj.sm2,obj.eh2,obj.em2);
    if(obj.sh3||obj.eh3) regT(obj.sh3,obj.sm3,obj.eh3,obj.em3);
    if(obj.sh4||obj.eh4) regT(obj.sh4,obj.sm4,obj.eh4,obj.em4);
  }

  ["grand_t1","nettoyage","petit_t1","rondelle","anticipation_feeder","passage_so3"].forEach(function(k){ regObj(targets[k]||{}); });
  TASKS_RONDELLE.forEach(function(t){ regObj(tasks[t.id]||{}); });
  TASKS_BOUT_FROID.forEach(function(t){ regObj(tasks[t.id]||{}); });
  extras.forEach(function(et){ regObj(et); });

  if (!isFinite(minT)) minT=360; if (!isFinite(maxT)) maxT=minT+120;
  minT=Math.max(280,minT-10); maxT=maxT+10;
  minT=Math.floor(minT/60)*60; maxT=Math.ceil(maxT/60)*60;

  var total=maxT-minT, slotMin=10, slots=total/slotMin;
  var slotW=Math.max(35,Math.min(90,900/slots));
  var dateStr=date?new Date(date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}):"";

  document.getElementById("gantt-machine-title").textContent = machine||"Changement - Temp/Machine";
  document.getElementById("gantt-subtitle").textContent = "SGD Pharma - Sucy-en-Brie"+(dateStr?" - "+dateStr:"");

  var targetDefs=[
    {key:"grand_t1",label:"TARGET (Grand T1)",color:"#c0392b"},
    {key:"nettoyage",label:"TARGET (Nettoyage)",color:"#27ae60"},
    {key:"petit_t1",label:"TARGET (Petit t1)",color:"#e07b54"},
    {key:"rondelle",label:"TARGET (Rondelle)",color:"#7d3c98"},
    {key:"anticipation_feeder",label:"TARGET (Anticipation Feeder)",color:"#2980b9"},
    {key:"passage_so3",label:"TARGET (Passage en SO3)",color:"#e91e8c"}
  ];

  var h='<table class="gantt"><tr><th colspan="4"></th>';
  for(var m=minT;m<maxT;m+=60) h+='<th colspan="'+(60/slotMin)+'" style="background:#1a3a6b;color:#fff">60 min</th>';
  h+='<th style="width:250px;background:#e8edf5;color:#1a3a6b;font-weight:700;font-size:11px;" rowspan="2">COMMENTAIRE</th>';
  h+='</tr><tr><th style="width:150px;text-align:left;padding-left:8px">MACHINE / SECTEUR<br><span style="font-weight:400;color:#1a5fa8;font-size:10px;">'+machine+'</span></th><th style="width:80px">WHO</th><th style="width:52px">START</th><th style="width:48px">FINAL</th>';
  for(var m=minT;m<maxT;m+=slotMin){
    var hh=Math.floor(m/60).toString().padStart(2,"0"),mm2=(m%60).toString().padStart(2,"0");
    h+='<th style="width:'+slotW+'px;font-size:10px;color:#555;font-weight:400">'+(mm2==="00"?hh+"h":mm2)+'</th>';
  }
  h+='</tr><tr><td colspan="'+(4+slots+1)+'" style="background:#1a3a6b;color:#fff;font-weight:700;font-size:13px;padding:7px 10px;text-align:center;">'+machine+(dateStr?" - "+dateStr:"")+'</td></tr>';

  // TARGET
  targetDefs.forEach(function(td) {
    var t=targets[td.key]||{};
    var start=getTV(t.sh||"",t.sm||""), end=getTV(t.eh||"",t.em||"");
    var uid="target_"+td.key;
    allTasks[uid]={machine:td.label,qui:"--",start:start,end:end,color:td.color};
    var bar="";
    var s=toMin(start), e=toMin(end);
    if(s!==null&&e!==null&&e>s){
      var lp=((s-minT)/total)*100, wp=((e-s)/total)*100;
      bar='<div class="gantt-bar" style="left:'+lp+'%;width:'+wp+'%;background:'+td.color+'" data-uid="'+uid+'" data-label="'+td.label+'" data-qui="--" data-start="'+start+'" data-end="'+end+'" data-color="'+td.color+'" data-cmt="'+encCmt(t.comment||"")+'">'+td.label.replace("TARGET ","")+'</div>';
    }
    [[t.sh2,t.sm2,t.eh2,t.em2,t.comment2,"_2",.8],[t.sh3,t.sm3,t.eh3,t.em3,t.comment3,"_3",.65],[t.sh4,t.sm4,t.eh4,t.em4,t.comment4,"_4",.5]].forEach(function(sl){
      if(sl[0]||sl[2]){
        var sx=toMin(getTV(sl[0]||"",sl[1]||"")), ex=toMin(getTV(sl[2]||"",sl[3]||""));
        if(sx!==null&&ex!==null&&ex>sx){
          var lpx=((sx-minT)/total)*100, wpx=((ex-sx)/total)*100;
          var slotColor = td.key==="grand_t1" ? "#fa8072" : td.color;
          bar+='<div class="gantt-bar" style="left:'+lpx+'%;width:'+wpx+'%;background:'+slotColor+';opacity:'+sl[6]+';" data-uid="'+uid+sl[5]+'" data-label="'+td.label+'" data-qui="--" data-start="'+getTV(sl[0]||"",sl[1]||"")+'" data-end="'+getTV(sl[2]||"",sl[3]||"")+'" data-color="'+slotColor+'" data-cmt="'+encCmt(sl[4]||"")+'"></div>';
        }
      }
    });
        h+='<tr class="target-section'+'" data-uid="'+uid+'" style="background:'+td.color+'22;">'+
      
      '<td class="info machine-name" style="color:'+td.color+';font-weight:700;">'+td.label+'</td>'+
      '<td class="info who-cell">--</td>'+
      '<td class="info time-cell">'+(start||"--")+'</td>'+
      '<td class="info time-cell">'+(end||"--")+'</td>'+
      '<td colspan="'+slots+'" class="bar-cell"><div class="bar-inner">'+bar+'</div></td>'+
      fmtCmtCell([t.comment,t.comment2,t.comment3,t.comment4],td.color)+
      '</tr>';
  });
  h+='<tr><td colspan="'+(4+slots+1)+'" style="background:#e8edf5;height:4px;"></td></tr>';

  function makeBar(t, uid, color, label, quiDisplay) {
    var bar = "";
    var start=getTV(t.sh||"",t.sm||""), end=getTV(t.eh||"",t.em||"");
    var s=toMin(start), e=toMin(end);
    if(s!==null&&e!==null&&e>s){
      var lp=((s-minT)/total)*100, wp=((e-s)/total)*100;
      bar='<div class="gantt-bar" style="left:'+lp+'%;width:'+wp+'%;background:'+color+'" data-uid="'+uid+'" data-label="'+label+'" data-qui="'+quiDisplay+'" data-start="'+start+'" data-end="'+end+'" data-color="'+color+'" data-cmt="'+encCmt(t.comment||"")+'"></div>';
    }
    [[t.sh2,t.sm2,t.eh2,t.em2,t.comment2,"_2",.75],[t.sh3,t.sm3,t.eh3,t.em3,t.comment3,"_3",.6],[t.sh4,t.sm4,t.eh4,t.em4,t.comment4,"_4",.5]].forEach(function(sl){
      if(sl[0]||sl[2]){
        var sx=toMin(getTV(sl[0]||"",sl[1]||"")), ex=toMin(getTV(sl[2]||"",sl[3]||""));
        if(sx!==null&&ex!==null&&ex>sx){
          var lpx=((sx-minT)/total)*100, wpx=((ex-sx)/total)*100;
          bar+='<div class="gantt-bar" style="left:'+lpx+'%;width:'+wpx+'%;background:'+color+';opacity:'+sl[6]+';" data-uid="'+uid+sl[5]+'" data-label="'+label+'" data-qui="'+quiDisplay+'" data-start="'+getTV(sl[0]||"",sl[1]||"")+'" data-end="'+getTV(sl[2]||"",sl[3]||"")+'" data-color="'+color+'" data-cmt="'+encCmt(sl[4]||"")+'"></div>';
        }
      }
    });
    return {bar:bar, start:start, end:end};
  }

  function renderTaskRow(task, t, idx, isBF, rowIdx) {
    var color = isBF ? task.color : TASK_COLORS[idx%TASK_COLORS.length];
    var uid = "task_"+task.id;
    var quiDisplay = ganttQuiOverrides[uid]||t.qui||task.qui;
    var res = makeBar(t, uid, color, task.machine, quiDisplay);
    allTasks[uid]={machine:task.machine,qui:quiDisplay,start:res.start,end:res.end,color:color};
        var rowCls=rowIdx%2===0?"odd":"even";
    if(isBF) rowCls+=" boutfroid-row";
    var machineName = task.machine;
    if (isBF && task.labelDebut) machineName += '<div style="font-size:10px;color:#6c6c70;font-weight:400;margin-top:2px;">'+task.labelDebut+' — '+task.labelFin+'</div>';
    h+='<tr class="'+rowCls+'" data-uid="'+uid+'">'+
      
      '<td class="info machine-name"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+color+';margin-right:5px;vertical-align:middle"></span>'+machineName+'</td>'+
      '<td class="info who-cell who-editable" data-uid="'+uid+'" title="Modifier">'+quiDisplay+' [mod]</td>'+
      '<td class="info time-cell">'+(res.start||"--")+'</td>'+
      '<td class="info time-cell">'+(res.end||"--")+'</td>'+
      '<td colspan="'+slots+'" class="bar-cell"><div class="bar-inner">'+res.bar+'</div></td>'+
      fmtCmtCell([t.comment,t.comment2,t.comment3,t.comment4],color)+
      '</tr>';
  }

  function renderExtraRow(et, idx, isBF, rowIdx) {
    var color = et.color || TASK_COLORS[(TASKS_RONDELLE.length+idx)%TASK_COLORS.length];
    var uid = "extra_"+(isBF?"bf":"bc")+"_"+idx;
    var res = makeBar(et, uid, color, et.machine||"Extra", et.qui||"");
    allTasks[uid]={machine:et.machine||"Extra",qui:et.qui||"",start:res.start,end:res.end,color:color};
        var rowCls=rowIdx%2===0?"odd":"even";
    if(isBF) rowCls+=" boutfroid-row";
    h+='<tr class="'+rowCls+'" data-uid="'+uid+'">'+
      
      '<td class="info machine-name"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+color+';margin-right:5px;vertical-align:middle"></span>'+(et.machine||"Extra")+'</td>'+
      '<td class="info who-cell">'+(et.qui||"")+'</td>'+
      '<td class="info time-cell">'+(res.start||"--")+'</td>'+
      '<td class="info time-cell">'+(res.end||"--")+'</td>'+
      '<td colspan="'+slots+'" class="bar-cell"><div class="bar-inner">'+res.bar+'</div></td>'+
      fmtCmtCell([et.comment,et.comment2,et.comment3,et.comment4],color)+
      '</tr>';
  }

  // Bout Chaud - ordre fixe
  TASKS_RONDELLE.forEach(function(task,idx){ renderTaskRow(task, tasks[task.id]||{}, idx, false, idx); });
  extrasBoutChaud.forEach(function(et,idx){ renderExtraRow(et, idx, false, TASKS_RONDELLE.length+idx); });

  // Bout Froid - ordre fixe
  h+='<tr><td colspan="'+(4+slots+1)+'" style="background:'+BOUT_FROID_COLOR+';color:#fff;font-weight:700;font-size:12px;padding:7px 12px;">BOUT FROID</td></tr>';
  TASKS_BOUT_FROID.forEach(function(task,idx){ renderTaskRow(task, tasks[task.id]||{}, idx, true, idx); });
  extrasBoutFroid.forEach(function(et,idx){ renderExtraRow(et, idx, true, TASKS_BOUT_FROID.length+idx); });

  h+='</table>';
  container.innerHTML=h;

  container.querySelectorAll(".gantt-bar").forEach(function(el){
    el.addEventListener("mouseenter",function(e){ showTT(e,el.dataset.label,el.dataset.qui,el.dataset.start,el.dataset.end,el.dataset.color,el.dataset.cmt); });
    el.addEventListener("mouseleave",hideTT);
  });

  container.addEventListener("click",function(e){
    var cell=e.target.closest(".who-editable"); if(!cell) return;
    showQuiEditor(cell,cell.dataset.uid,cell.textContent.replace(" [mod]","").trim());
  });

  document.getElementById("gantt-section").style.display="block";
}

// ── TOOLTIP ───────────────────────────────────────────────────────────────────
function showTT(e,label,qui,start,end,color,comment){
  var TT=document.getElementById("tooltip");
  document.getElementById("tt-dot").style.background=color||"#3b82f6";
  document.getElementById("tt-title").textContent=label||"--";
  document.getElementById("tt-qui").textContent=qui||"--";
  document.getElementById("tt-start").textContent=start||"--";
  document.getElementById("tt-end").textContent=end||"--";
  var s=toMin(start),en=toMin(end);
  document.getElementById("tt-dur").textContent=(s!==null&&en!==null)?"Duree: "+fmtDur(s,en):"";
  var cb=document.getElementById("tt-comment-box");
  var decoded=comment?comment.replace(/\\n/g,"\n"):"";
  document.getElementById("tt-comment").textContent=decoded;
  cb.style.display=decoded?"block":"none";
  TT.classList.add("visible");
  if(window.innerWidth<600){
    TT.style.left="50%"; TT.style.transform="translateX(-50%)"; TT.style.top="auto"; TT.style.bottom="10px"; TT.style.width="90vw"; TT.style.maxWidth="90vw";
  } else {
    TT.style.transform=""; TT.style.bottom="auto"; TT.style.width=""; TT.style.maxWidth="300px";
    var x=e.clientX+16,y=e.clientY+16;
    if(x+310>window.innerWidth) x=e.clientX-310;
    if(y+230>window.innerHeight) y=e.clientY-230;
    if(y<0) y=8;
    TT.style.left=x+"px"; TT.style.top=y+"px";
  }
}
function hideTT(){ document.getElementById("tooltip").classList.remove("visible"); }

// ── QUI EDITABLE ──────────────────────────────────────────────────────────────
function showQuiEditor(cell,uid,current){
  var existing=document.getElementById("qui-editor"); if(existing) existing.remove();
  var editor=document.createElement("div"); editor.id="qui-editor"; editor.className="qui-editor";
  var input=document.createElement("input"); input.type="text"; input.value=current; input.className="qui-editor-input"; input.placeholder="Nom du responsable";
  var saveBtn=document.createElement("button"); saveBtn.textContent="OK"; saveBtn.className="qui-editor-save";
  var cancelBtn=document.createElement("button"); cancelBtn.textContent="X"; cancelBtn.className="qui-editor-cancel";
  editor.appendChild(input); editor.appendChild(saveBtn); editor.appendChild(cancelBtn);
  cell.style.position="relative"; cell.appendChild(editor); input.focus(); input.select();
  function applyEdit(){
    var val=input.value.trim(); if(!val){editor.remove();return;}
    ganttQuiOverrides[uid]=val; cell.textContent=val+" [mod]"; cell.dataset.uid=uid;
    editor.remove(); showToast("Responsable mis a jour !","#1a3a6b");
  }
  saveBtn.addEventListener("click",applyEdit);
  input.addEventListener("keydown",function(e){if(e.key==="Enter")applyEdit();if(e.key==="Escape")editor.remove();});
  cancelBtn.addEventListener("click",function(){editor.remove();});
}

// ── EXPORT ────────────────────────────────────────────────────────────────────
function initExportButtons(){
  document.getElementById("export-toggle-btn").addEventListener("click",function(e){
    e.stopPropagation();
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
    var now=new Date(),from=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10),to=new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().slice(0,10);
    exportToExcel(from,to); document.getElementById("export-menu").style.display="none";
  });
  document.getElementById("export-custom").addEventListener("click",function(e){
    e.stopPropagation();
    var r=document.getElementById("export-date-range"); r.style.display=r.style.display==="none"?"flex":"none";
  });
  document.getElementById("export-confirm-btn").addEventListener("click",function(e){
    e.stopPropagation();
    var from=document.getElementById("export-date-from").value,to=document.getElementById("export-date-to").value;
    if(!from||!to){alert("Veuillez choisir les deux dates.");return;}
    exportToExcel(from,to); document.getElementById("export-menu").style.display="none"; document.getElementById("export-date-range").style.display="none";
  });
}

function exportToExcel(dateFrom,dateTo){
  var sessions=Object.values(allSessions);
  var filtered=dateFrom&&dateTo?sessions.filter(function(s){return s.date>=dateFrom&&s.date<=dateTo;}):sessions;
  if(!filtered.length){alert("Aucune seance trouvee.");return;}
  filtered.sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  var rows=[["ID_Changement","Date","Jour","Machine","Référence_Machine","Section","Type_Tâche","Tâche","Tâche_Référence","Qui","Début","Fin","Date_Heure_Début","Date_Heure_Fin","Durée (min)","Commentaires"]];

  // Correspondance tâche -> TARGET de référence
  // Les noms doivent correspondre EXACTEMENT à ceux dans TASKS_RONDELLE et TASKS_BOUT_FROID
  var TACHE_REF = {
    "Nettoyage de machine": "TARGET (Nettoyage)",
    "Changement rondelle (cuvette)": "TARGET (Rondelle)",
    "Cote Finisseur": "TARGET (Grand T1)",
    "Cote Ebaucheur": "TARGET (Grand T1)",
    "Entonnoir sous verre": "TARGET (Petit t1)",
    "Distributeur sous verre": "TARGET (Petit t1)",
    "Demarrage section sans flacon": "TARGET (Grand T1)",
    "Debut section avec flacon": "TARGET (Grand T1)",
    "Machine complete avec flacon": "TARGET (Grand T1)",
    "Mise a l arche": "TARGET (Grand T1)",
    "Changement Traitement Surface": "TARGET (Grand T1)",
    "Nettoyage SO3": "TARGET (Passage en SO3)",
    "Aligneur vide": "TARGET (Nettoyage)",
    "T0 : Nettoyage de ligne": "TARGET (Nettoyage)",
    "T1 : Durée pré-réglage": "TARGET (Anticipation Feeder)",
    "Arrivée deux sections contrôlables": "TARGET (Anticipation Feeder)",
    "Arrivée de toutes sections": "TARGET (Anticipation Feeder)",
    "Top qualité": "TARGET (Passage en SO3)",
    "Premier lot sorti": "TARGET (Passage en SO3)",
    "Validation de deux lots commercialisables": "TARGET (Passage en SO3)"
  };

  function makeDT(dateS, timeS, isEnd, startTimeS) {
    if (!dateS || !timeS || timeS === "--") return "";
    var finalDate = dateS;
    // Si c'est l'heure de fin et qu'elle est inferieure a l'heure de debut => passage minuit => +1 jour
    if (isEnd && startTimeS && startTimeS !== "--") {
      var sMin = toMin(startTimeS), eMin = toMin(timeS);
      if (sMin !== null && eMin !== null && eMin < sMin) {
        var d = new Date(dateS + "T00:00:00");
        d.setDate(d.getDate() + 1);
        finalDate = d.toISOString().slice(0,10);
      }
    }
    return finalDate + " " + timeS + ":00";
  }

  var exportRowIdx = 0;
  filtered.forEach(function(session){
    exportRowIdx = 0;
    var dateStr=session.date||"",jourStr=dateStr?new Date(dateStr+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long"}):"",machine=session.machine||"";
    var data=session.ganttData||{},targets=data.targets||{},tasks=data.tasks||{},extras=data.extraTasks||[];

    // Extraire nom court (avant " - ") et référence
    var machineParts = machine.indexOf(" - ") > -1 ? machine.split(" - ") : [machine, ""];
    var machineCourt = machineParts[0].trim();
    var machineRef = machineParts.slice(1).join(" - ").trim();
    // Si un champ référence dédié existe, l'utiliser en priorité
    var refField = document.getElementById("f-reference");
    if (refField && refField.value.trim()) machineRef = refField.value.trim();

    function addRow(section, type, tache, ref, qui, start, end, commentaire) {
      exportRowIdx++;
      var id = machineCourt.replace(/\s/g,"_")+"_"+dateStr+"_"+String(exportRowIdx).padStart(3,"0");
      var sMin = toMin(start), eMin = toMin(end);
      var dur = "";
      if (sMin !== null && eMin !== null) {
        dur = eMin - sMin;
        if (dur < 0) dur += 1440; // passage minuit : ajouter 24h en minutes
      }
      // Protéger contre les formules Excel : préfixer avec apostrophe si commence par = + - @
      var cmt = (commentaire||"").replace(/\n/g," | ");
      if (cmt && "=+-@".indexOf(cmt[0]) > -1) cmt = "'" + cmt;
      rows.push([id, dateStr, jourStr, machineCourt, machineRef, section, type, tache, ref, qui, start, end,
        makeDT(dateStr,start), makeDT(dateStr,end,true,start), dur, cmt]);
    }

    // Targets
    [["grand_t1","TARGET (Grand T1)"],["nettoyage","TARGET (Nettoyage)"],["petit_t1","TARGET (Petit t1)"],["rondelle","TARGET (Rondelle)"],["anticipation_feeder","TARGET (Anticipation Feeder)"],["passage_so3","TARGET (Passage en SO3)"]].forEach(function(td){
      var t=targets[td[0]]||{};
      var start=getTV(t.sh||"",t.sm||""), end=getTV(t.eh||"",t.em||"");
      addRow(td[1], "TARGET", td[1], "--", "--", start, end, t.comment||"");
    });

    // Bout Chaud
    TASKS_RONDELLE.forEach(function(task){
      var t=tasks[task.id]||{};
      var start=getTV(t.sh||"",t.sm||""), end=getTV(t.eh||"",t.em||"");
      addRow("Bout Chaud", "Tâche", task.machine, TACHE_REF[task.machine]||"--", t.qui||task.qui, start, end, t.comment||"");
    });

    // Bout Froid
    TASKS_BOUT_FROID.forEach(function(task){
      var t=tasks[task.id]||{};
      var start=getTV(t.sh||"",t.sm||""), end=getTV(t.eh||"",t.em||"");
      addRow("Bout Froid", "Tâche", task.machine, TACHE_REF[task.machine]||"--", t.qui||task.qui, start, end, t.comment||"");
    });

    // Extras
    extras.forEach(function(et){
      var start=getTV(et.sh||"",et.sm||""), end=getTV(et.eh||"",et.em||"");
      var section = et.group==="boutfroid" ? "Bout Froid" : "Bout Chaud";
      addRow(section, "Tâche", et.machine||"Extra", TACHE_REF[et.machine]||"--", et.qui||"", start, end, et.comment||"");
    });

    rows.push(Array(15).fill(""));
  });
  var csv=rows.map(function(row){return row.map(function(cell){var str=String(cell!==null&&cell!==undefined?cell:"").replace(/\n/g," | ").replace(/\r/g,""); return(str.indexOf(";")>-1||str.indexOf('"')>-1)?'"'+str.replace(/"/g,'""')+'"':str;}).join(";");}).join("\n");
  var blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  var url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url; a.download="SGD_Pharma_Gantt_"+new Date().toLocaleDateString("fr-FR").replace(/\//g,"-")+".csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── ENVOI GITHUB (pour Power BI) ──────────────────────────────────────────────
async function sendToGitHub() {
  // Demander le code secret (token GitHub) si pas encore stocké
  var token = localStorage.getItem("ghToken");
  if (!token) {
    token = prompt("Entrez le code d'accès pour envoyer les données :");
    if (!token) return;
    localStorage.setItem("ghToken", token);
  }

  // Générer le CSV complet (même logique que exportToExcel)
  var sessions = Object.values(allSessions);
  if (!sessions.length) { alert("Aucune séance à envoyer."); return; }
  sessions.sort(function(a,b){ return new Date(a.date) - new Date(b.date); });

  var rows = [["ID_Changement","Date","Jour","Machine","Référence_Machine","Section","Type_Tâche","Tâche","Tâche_Référence","Qui","Début","Fin","Date_Heure_Début","Date_Heure_Fin","Durée (min)","Commentaires"]];

  var TACHE_REF_GH = {
    "Nettoyage de machine": "TARGET (Nettoyage)",
    "Changement rondelle (cuvette)": "TARGET (Rondelle)",
    "Cote Finisseur": "TARGET (Grand T1)",
    "Cote Ebaucheur": "TARGET (Grand T1)",
    "Entonnoir sous verre": "TARGET (Petit t1)",
    "Distributeur sous verre": "TARGET (Petit t1)",
    "Demarrage section sans flacon": "TARGET (Grand T1)",
    "Debut section avec flacon": "TARGET (Grand T1)",
    "Machine complete avec flacon": "TARGET (Grand T1)",
    "Mise a l arche": "TARGET (Grand T1)",
    "Changement Traitement Surface": "TARGET (Grand T1)",
    "Nettoyage SO3": "TARGET (Passage en SO3)",
    "Aligneur vide": "TARGET (Nettoyage)",
    "T0 : Nettoyage de ligne": "TARGET (Nettoyage)",
    "T1 : Durée pré-réglage": "TARGET (Anticipation Feeder)",
    "Arrivée deux sections contrôlables": "TARGET (Anticipation Feeder)",
    "Arrivée de toutes sections": "TARGET (Anticipation Feeder)",
    "Top qualité": "TARGET (Passage en SO3)",
    "Premier lot sorti": "TARGET (Passage en SO3)",
    "Validation de deux lots commercialisables": "TARGET (Passage en SO3)"
  };

  function makeDTgh(dateS, timeS, isEnd, startTimeS) {
    if (!dateS || !timeS || timeS === "--") return "";
    var finalDate = dateS;
    if (isEnd && startTimeS && startTimeS !== "--") {
      var sMin = toMin(startTimeS), eMin = toMin(timeS);
      if (sMin !== null && eMin !== null && eMin < sMin) {
        var d = new Date(dateS + "T00:00:00");
        d.setDate(d.getDate() + 1);
        finalDate = d.toISOString().slice(0,10);
      }
    }
    return finalDate + " " + timeS + ":00";
  }

  sessions.forEach(function(session) {
    var dateStr = session.date||"";
    var jourStr = dateStr ? new Date(dateStr+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long"}) : "";
    var machine = session.machine||"";
    var machineParts = machine.indexOf(" - ") > -1 ? machine.split(" - ") : [machine, ""];
    var machineCourt = machineParts[0].trim();
    var machineRef = machineParts.slice(1).join(" - ").trim();
    var data = session.ganttData||{}, targets = data.targets||{}, tasks = data.tasks||{}, extras = data.extraTasks||[];
    var rowIdx = 0;

    function addRowGH(section, type, tache, ref, qui, start, end, commentaire) {
      rowIdx++;
      var id = machineCourt.replace(/\s/g,"_")+"_"+dateStr+"_"+String(rowIdx).padStart(3,"0");
      var sMin = toMin(start), eMin = toMin(end);
      var dur = "";
      if (sMin !== null && eMin !== null) {
        dur = eMin - sMin;
        if (dur < 0) dur += 1440;
      }
      var cmt = (commentaire||"").replace(/\n/g," | ");
      if (cmt && "=+-@".indexOf(cmt[0]) > -1) cmt = "'" + cmt;
      rows.push([id, dateStr, jourStr, machineCourt, machineRef, section, type, tache, ref, qui, start, end,
        makeDTgh(dateStr,start), makeDTgh(dateStr,end,true,start), dur, cmt]);
    }

    [["grand_t1","TARGET (Grand T1)"],["nettoyage","TARGET (Nettoyage)"],["petit_t1","TARGET (Petit t1)"],["rondelle","TARGET (Rondelle)"],["anticipation_feeder","TARGET (Anticipation Feeder)"],["passage_so3","TARGET (Passage en SO3)"]].forEach(function(td){
      var t = targets[td[0]]||{};
      addRowGH(td[1], "TARGET", td[1], "--", "--", getTV(t.sh||"",t.sm||""), getTV(t.eh||"",t.em||""), t.comment||"");
    });

    TASKS_RONDELLE.forEach(function(task){
      var t = tasks[task.id]||{};
      addRowGH("Bout Chaud", "Tâche", task.machine, TACHE_REF_GH[task.machine]||"--", t.qui||task.qui, getTV(t.sh||"",t.sm||""), getTV(t.eh||"",t.em||""), t.comment||"");
    });

    TASKS_BOUT_FROID.forEach(function(task){
      var t = tasks[task.id]||{};
      addRowGH("Bout Froid", "Tâche", task.machine, TACHE_REF_GH[task.machine]||"--", t.qui||task.qui, getTV(t.sh||"",t.sm||""), getTV(t.eh||"",t.em||""), t.comment||"");
    });

    extras.forEach(function(et){
      var section = et.group==="boutfroid" ? "Bout Froid" : "Bout Chaud";
      addRowGH(section, "Tâche", et.machine||"Extra", TACHE_REF_GH[et.machine]||"--", et.qui||"", getTV(et.sh||"",et.sm||""), getTV(et.eh||"",et.em||""), et.comment||"");
    });
  });

  var csv = rows.map(function(row){
    return row.map(function(cell){
      var str = String(cell!==null&&cell!==undefined?cell:"").replace(/\n/g," | ").replace(/\r/g,"");
      return (str.indexOf(";")>-1||str.indexOf('"')>-1) ? '"'+str.replace(/"/g,'""')+'"' : str;
    }).join(";");
  }).join("\n");

  // Envoyer vers GitHub
  var csvBase64 = btoa(unescape(encodeURIComponent("\uFEFF" + csv)));

  try {
    showToast("Envoi en cours...", "#1a3a6b");

    // Vérifier si le fichier existe déjà (pour récupérer le SHA)
    var checkResp = await fetch("https://api.github.com/repos/mounirsgd/gantt-sgd-dv/contents/export/Gantt_SGD.csv", {
      headers: { "Authorization": "token " + token }
    });
    var sha = "";
    if (checkResp.ok) {
      var checkData = await checkResp.json();
      sha = checkData.sha;
    }

    // Créer ou mettre à jour le fichier
    var body = {
      message: "Export Gantt " + new Date().toLocaleDateString("fr-FR"),
      content: csvBase64
    };
    if (sha) body.sha = sha;

    var resp = await fetch("https://api.github.com/repos/mounirsgd/gantt-sgd-dv/contents/export/Gantt_SGD.csv", {
      method: "PUT",
      headers: {
        "Authorization": "token " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (resp.ok) {
      showToast("Données envoyées avec succès !", "#34c759");
    } else {
      var err = await resp.json();
      if (resp.status === 401) {
        localStorage.removeItem("ghToken");
        alert("Code d'accès invalide. Veuillez réessayer.");
      } else {
        alert("Erreur d'envoi : " + (err.message||"inconnue"));
      }
    }
  } catch (e) {
    alert("Erreur réseau : " + e.message);
  }
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(message,color){
  var ex=document.getElementById("toast-notif"); if(ex) ex.remove();
  var toast=document.createElement("div"); toast.id="toast-notif"; toast.textContent=message;
  toast.style.cssText="position:fixed;top:70px;left:50%;transform:translateX(-50%);background:"+color+";color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);transition:opacity .3s;font-family:Arial,sans-serif;";
  document.body.appendChild(toast);
  setTimeout(function(){toast.style.opacity="0";setTimeout(function(){toast.remove();},300);},2500);
}
