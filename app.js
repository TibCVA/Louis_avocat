// Prépa Déonto 98‑1 — App de révision iOS‑like (100% client, GitHub Pages friendly)
// Auteur : GPT‑5 Pro
// Améliorations : confetti, anti‑veille (Wake Lock), Web Speech, auto‑suivant, recherche avec surlignage, raccourcis clavier.

const VERSION = "1.1.0";
const Q_PATH = "questions.json";
const STORE_KEY = "deonto981_progress_v2";

/** @typedef {"new"|"review"|"mastered"} Status */

const state = {
  questions: /** @type {Array<{question:string,reponse:string,points_specifiques:string[]}>} */ ([]),
  order: /** @type {number[]} */ ([]),
  index: 0,
  revealed: false,
  filter: /** @type {"all"|"new"|"review"|"mastered"} */ ("all"),
  shuffle: true,
  autoNext: false,
  statuses: /** @type {Record<string, Status>} */ ({}),
  favs: /** @type {Record<string, boolean>} */ ({}),
  wakeLock: /** @type {any} */ (null)
};

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

async function loadData(){
  const res = await fetch(Q_PATH, {cache:"no-store"});
  if(!res.ok) throw new Error("Impossible de charger questions.json");
  state.questions = await res.json();
}

function loadStore(){
  const raw = localStorage.getItem(STORE_KEY);
  if(!raw) return;
  try{
    const obj = JSON.parse(raw);
    state.statuses = obj.statuses || {};
    state.favs = obj.favs || {};
    state.filter = obj.filter || "all";
    state.shuffle = obj.shuffle ?? true;
    state.autoNext = obj.autoNext ?? false;
  }catch{ /* ignore */ }
}

function saveStore(){
  const payload = {
    statuses: state.statuses,
    favs: state.favs,
    filter: state.filter,
    shuffle: state.shuffle,
    autoNext: state.autoNext
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(payload));
}

function fisherYates(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function getStatus(i){ return state.statuses[i] || "new"; }
function setStatus(i, s){ state.statuses[i] = s; saveStore(); updateKpis(); }
function isFav(i){ return !!state.favs[i]; }
function toggleFav(i){ state.favs[i] = !state.favs[i]; saveStore(); }

function recomputeOrder(){
  const eligible = [];
  for(let i=0;i<state.questions.length;i++){
    const st = getStatus(i);
    if(state.filter==="all" || st===state.filter) eligible.push(i);
  }
  state.order = state.shuffle ? fisherYates(eligible) : eligible;
  if(state.index >= state.order.length) state.index = 0;
  updateKpis();
}

function showToast(msg){
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"), 1100);
}

function renderCard(){
  const totalEligible = state.order.length || 1;
  const current = state.order[state.index] ?? 0;
  const q = state.questions[current];
  $("#badgeIndex").textContent = `${state.index+1} / ${totalEligible}`;

  $("#qText").textContent = q.question;
  $("#aText").textContent = q.reponse;

  const list = $("#pList"); list.innerHTML = "";
  for(const p of q.points_specifiques || []){
    const li = document.createElement("li");
    li.textContent = p;
    list.appendChild(li);
  }

  const favBtn = $("#btnFav");
  favBtn.setAttribute("aria-pressed", isFav(current) ? "true" : "false");

  // Réinitialiser l’état d’affichage
  state.revealed = false;
  $("#aBlock").classList.add("hidden");
  $("#rowCta").classList.add("hidden");
  $("#btnShow").classList.remove("hidden");
  updateRings();
}

function mark(status){
  const current = state.order[state.index] ?? 0;
  setStatus(current, status);

  if(status === "mastered"){
    burstConfetti(); // micro‑victoire
  }

  if(state.autoNext){ next(); }
  else { showToast(status === "mastered" ? "Marquée maîtrisée" : "À revoir"); }
}

function prev(){
  if(state.order.length===0) return;
  state.index = (state.index - 1 + state.order.length) % state.order.length;
  renderCard();
}

function next(){
  if(state.order.length===0) return;
  state.index = (state.index + 1) % state.order.length;
  renderCard();
}

function updateKpis(){
  let mastered=0, review=0, fresh=0;
  for(let i=0;i<state.questions.length;i++){
    const st = getStatus(i);
    if(st==="mastered") mastered++;
    else if(st==="review") review++;
    else fresh++;
  }
  $("#kpiMastered").textContent = mastered;
  $("#kpiReview").textContent = review;
  $("#kpiNew").textContent = fresh;

  $("#sMastered").textContent = mastered;
  $("#sReview").textContent = review;
  $("#sNew").textContent = fresh;
  $("#sTotal").textContent = state.questions.length.toString();
  updateRings();
}

function updateRings(){
  const mastered = parseInt($("#kpiMastered").textContent || "0", 10);
  const total = parseInt($("#sTotal").textContent || "1", 10);
  const pct = Math.round((mastered / Math.max(1,total)) * 100);
  const deg = `${(pct/100)*360}deg`;

  const ring = $("#progressRing");
  ring.style.setProperty("--deg", deg);
  ring.setAttribute("data-label", pct.toString());

  const ring2 = $("#statsRing");
  if(ring2){
    ring2.style.setProperty("--deg", deg);
    ring2.setAttribute("data-label", pct.toString());
  }
}

/* === Recherche avec surlignage ================================================= */
function escapeHTML(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function highlight(text, query){
  if(!query) return escapeHTML(text);
  const q = query.trim().toLowerCase();
  if(!q) return escapeHTML(text);
  const idx = text.toLowerCase().indexOf(q);
  if(idx === -1) return escapeHTML(text);
  const before = escapeHTML(text.slice(0, idx));
  const match = escapeHTML(text.slice(idx, idx+q.length));
  const after = escapeHTML(text.slice(idx+q.length));
  return `${before}<mark>${match}</mark>${after}`;
}

function applyListFilter(){
  const val = document.querySelector('input[name="lfilter"]:checked').value;
  const query = $("#search").value.trim();
  const qLower = query.toLowerCase();
  const ul = $("#list");
  ul.innerHTML = "";
  state.questions.forEach((item, i)=>{
    const st = getStatus(i);
    const fav = isFav(i);
    const textBlob = (item.question + " " + item.reponse + " " + (item.points_specifiques||[]).join(" ")).toLowerCase();

    let matchesFilter = true;
    if(val==="fav") matchesFilter = fav;
    else if(val==="review") matchesFilter = st==="review";
    else if(val==="mastered") matchesFilter = st==="mastered";
    const matchesQuery = qLower==="" || textBlob.includes(qLower);
    if(!(matchesFilter && matchesQuery)) return;

    const li = document.createElement("li");

    const title = document.createElement("div");
    title.className = "title";
    title.innerHTML = highlight(item.question, query);

    const small = document.createElement("div");
    small.className = "small";
    small.innerHTML = highlight(item.reponse, query);

    const meta = document.createElement("div");
    meta.className = "meta";
    const stDot = document.createElement("span");
    stDot.className = `dot ${st}`;
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = st === "new" ? "Non vue" : (st==="review" ? "À revoir" : "Maîtrisée");
    meta.append(stDot, tag);

    li.append(title, small, meta);
    li.addEventListener("click", ()=>{
      state.filter = "all";
      document.getElementById("f-all").checked = true;
      saveStore();
      recomputeOrder();
      const idx = state.order.indexOf(i);
      state.index = idx >= 0 ? idx : 0;
      switchTab("reviser"); renderCard(); showToast("Ouvert dans Réviser");
    });
    ul.append(li);
  });
}

/* === Confetti léger (canvas) =================================================== */
let confettiTimer = null;
function burstConfetti(){
  const canvas = /** @type {HTMLCanvasElement} */($("#fx"));
  const ctx = canvas.getContext("2d");
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const W = canvas.width = (canvas.offsetWidth || window.innerWidth) * DPR;
  const H = canvas.height = (canvas.offsetHeight || window.innerHeight) * DPR;
  const N = 40;
  const parts = Array.from({length:N}, ()=>({
    x: W/2, y: H/3, vx: (Math.random()*2-1)*4*DPR, vy: (Math.random()*-1)*6*DPR - 3*DPR,
    g: 0.25*DPR, a: Math.random()*Math.PI, va: (Math.random()*2-1)*0.2, size: (4+Math.random()*6)*DPR,
    color: Math.random()<.5 ? "#0A84FF" : (Math.random()<.5 ? "#34C759" : "#FF9F0A")
  }));
  const start = performance.now();
  cancelAnimationFrame(confettiTimer);
  (function loop(t){
    ctx.clearRect(0,0,W,H);
    parts.forEach(p=>{
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      ctx.restore();
    });
    confettiTimer = requestAnimationFrame(loop);
    if(t - start > 900) { ctx.clearRect(0,0,W,H); cancelAnimationFrame(confettiTimer); }
  })(start);
}

/* === Wake Lock (anti‑veille) =================================================== */
async function requestWakeLock(){
  try{
    if("wakeLock" in navigator && !state.wakeLock){
      state.wakeLock = await navigator.wakeLock.request("screen");
      state.wakeLock.addEventListener("release", ()=>{ state.wakeLock = null; });
    }
  }catch{ /* ignore */ }
}
function releaseWakeLock(){ try{ state.wakeLock?.release?.(); }catch{} state.wakeLock = null; }

/* === Web Speech (lecture de la réponse) ======================================= */
function speak(text){
  if(!("speechSynthesis" in window)) return showToast("Synthèse vocale indisponible");
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR"; u.rate = 1.0; u.pitch = 1.0;
  speechSynthesis.speak(u);
}

/* === Navigation & UI ========================================================== */
function switchTab(name){
  const ids = ["reviser","liste","stats"];
  ids.forEach(id=>{
    const tab = document.getElementById(`tab-${id}`);
    const view = document.getElementById(`view-${id}`);
    const active = id===name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true":"false");
    view.hidden = !active;
  });
}

function exportProgress(){
  const payload = {
    app: "prepa-deonto-98-1", version: VERSION,
    exportedAt: new Date().toISOString(),
    total: state.questions.length,
    statuses: state.statuses,
    favs: state.favs,
    filter: state.filter,
    shuffle: state.shuffle,
    autoNext: state.autoNext
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const fileName = "progression-deonto-98-1.json";
  // Partage si possible
  if(navigator.canShare && navigator.canShare({files:[new File([blob], fileName, {type: "application/json"})]})){
    const file = new File([blob], fileName, {type:"application/json"});
    navigator.share({files:[file], title:"Progression Prépa Déonto 98‑1"});
  }else{
    const a = document.createElement("a"); a.href = url; a.download = fileName; a.click();
  }
  setTimeout(()=> URL.revokeObjectURL(url), 2000);
  showToast("Export créé");
}

function importProgress(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const obj = JSON.parse(String(reader.result));
      state.statuses = obj.statuses || {};
      state.favs = obj.favs || {};
      state.filter = obj.filter || "all";
      state.shuffle = obj.shuffle ?? true;
      state.autoNext = obj.autoNext ?? false;
      saveStore();
      // UI
      $("#toggleShuffle").checked = state.shuffle;
      $("#toggleAutoNext").checked = state.autoNext;
      document.getElementById(`f-${state.filter}`).checked = true;
      recomputeOrder(); renderCard(); applyListFilter(); showToast("Import réussi");
    }catch(e){ alert("Fichier invalide"); }
  };
  reader.readAsText(file);
}

function resetAll(){
  if(confirm("Supprimer toute la progression enregistrée sur cet appareil ?")){
    localStorage.removeItem(STORE_KEY);
    state.statuses = {}; state.favs = {}; state.filter = "all"; state.shuffle = true; state.autoNext = false;
    $("#toggleShuffle").checked = true; $("#toggleAutoNext").checked = false; $("#f-all").checked = true;
    releaseWakeLock(); $("#toggleNoSleep").checked = false;
    recomputeOrder(); renderCard(); applyListFilter(); showToast("Réinitialisé");
  }
}

/* === Initialisation =========================================================== */
async function init(){
  // Petites astuces clavier (bannière)
  $("#btnTipsClose").addEventListener("click", ()=> $("#tips").style.display = "none");

  loadStore();
  await loadData();

  // Controls init
  document.getElementById(`f-${state.filter}`).checked = true;
  $("#toggleShuffle").checked = state.shuffle;
  $("#toggleAutoNext").checked = state.autoNext;

  recomputeOrder(); renderCard(); applyListFilter();

  // Événements — Réviser
  $all('input[name="filter"]').forEach(el=> el.addEventListener("change", ()=>{
    state.filter = document.querySelector('input[name="filter"]:checked').value;
    saveStore(); recomputeOrder(); state.index = 0; renderCard();
  }));
  $("#toggleShuffle").addEventListener("change", (e)=>{
    state.shuffle = e.target.checked; saveStore(); recomputeOrder(); renderCard();
  });
  $("#toggleAutoNext").addEventListener("change", (e)=>{
    state.autoNext = e.target.checked; saveStore();
  });
  $("#toggleNoSleep").addEventListener("change", (e)=>{
    if(e.target.checked) requestWakeLock(); else releaseWakeLock();
  });

  $("#btnShow").addEventListener("click", ()=>{
    state.revealed = true;
    $("#aBlock").classList.remove("hidden");
    $("#rowCta").classList.remove("hidden");
    $("#btnShow").classList.add("hidden");
  });
  $("#btnGood").addEventListener("click", ()=>mark("mastered"));
  $("#btnAgain").addEventListener("click", ()=>mark("review"));
  $("#btnPrev").addEventListener("click", prev);
  $("#btnNext").addEventListener("click", next);
  $("#btnFav").addEventListener("click", ()=>{
    const current = state.order[state.index] ?? 0;
    toggleFav(current);
    $("#btnFav").setAttribute("aria-pressed", isFav(current) ? "true" : "false");
    showToast(isFav(current) ? "Ajouté aux favoris" : "Retiré des favoris");
    applyListFilter();
  });
  $("#btnSpeak").addEventListener("click", ()=>{
    const current = state.order[state.index] ?? 0;
    const q = state.questions[current];
    const txt = `Réponse : ${q.reponse}. Précisions : ${(q.points_specifiques||[]).join("; ")}`;
    speak(txt);
  });

  // Tabs
  $("#tab-reviser").addEventListener("click", ()=>switchTab("reviser"));
  $("#tab-liste").addEventListener("click", ()=>switchTab("liste"));
  $("#tab-stats").addEventListener("click", ()=>switchTab("stats"));

  // Liste
  $("#search").addEventListener("input", applyListFilter);
  $all('input[name="lfilter"]').forEach(el=> el.addEventListener("change", applyListFilter));

  // Stats / data
  $("#btnExport").addEventListener("click", exportProgress);
  $("#btnImport").addEventListener("click", ()=> $("#fileImport").click());
  $("#fileImport").addEventListener("change", (e)=>{
    const file = e.target.files[0]; if(file) importProgress(file); e.target.value = "";
  });
  $("#btnReset").addEventListener("click", resetAll);

  updateKpis();

  // Gestes : swipe gauche/droite pour suivant/précédent
  let touchStartX = 0;
  document.addEventListener("touchstart", (e)=>{
    if(e.touches.length===1) touchStartX = e.touches[0].clientX;
  }, {passive:true});
  document.addEventListener("touchend", (e)=>{
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX;
    if(Math.abs(dx) > 60){ dx < 0 ? next() : prev(); }
  });

  // Raccourcis clavier (desktop)
  document.addEventListener("keydown", (e)=>{
    if(e.target && (/** @type HTMLElement */(e.target)).tagName === "INPUT") return;
    if(e.code === "Space"){ e.preventDefault(); if(!state.revealed) $("#btnShow").click(); else next(); }
    else if(e.key.toLowerCase() === "a"){ mark("review"); }
    else if(e.key.toLowerCase() === "m"){ mark("mastered"); }
    else if(e.key.toLowerCase() === "f"){ $("#btnFav").click(); }
    else if(e.key === "ArrowRight"){ next(); }
    else if(e.key === "ArrowLeft"){ prev(); }
  });
}

init();