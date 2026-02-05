/**********************
 * Locker Room Legends
 * code.js (frontend)
 **********************/

/** ✅ PUT YOUR WEB APP URL HERE (must end with /exec) **/
const API_BASE = "https://script.google.com/macros/s/AKfycbzogzmwzbc4KNVycT22yyqHZni1RlxYFnsw6jcd9dSwm0b4SgS_943GvedM_KjKZoUU_w/exec";

/** UI elements */
const pagePick = document.getElementById("pagePick");
const pageSignup = document.getElementById("pageSignup");

const spinCards = document.getElementById("spinCards");
const globalStatus = document.getElementById("globalStatus");

const btnBack = document.getElementById("btnBack");
const btnSubmit = document.getElementById("btnSubmit");

const signupTitle = document.getElementById("signupTitle");
const signupDesc = document.getElementById("signupDesc");
const signupPrice = document.getElementById("signupPrice");
const signupFill = document.getElementById("signupFill");
const signupSpots = document.getElementById("signupSpots");
const signupBar = document.getElementById("signupBar");
const signupPhotoWrap = document.getElementById("signupPhotoWrap");
const signupStatus = document.getElementById("signupStatus");

const nameEl = document.getElementById("name");
const phoneEl = document.getElementById("phone");
const emailEl = document.getElementById("email");
const venmoEl = document.getElementById("venmo");

const msg = document.getElementById("msg");

/** App state (in memory) */
const state = {
  spins: [],
  selectedSpinId: null
};

function showMsg(html) {
  if (!msg) return;
  msg.classList.remove("hidden");
  msg.innerHTML = html;
}
function clearMsg() {
  if (!msg) return;
  msg.classList.add("hidden");
  msg.innerHTML = "";
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "");
}

function getSpin(id) {
  return state.spins.find(s => String(s.spinId || s.id) === String(id));
}

/** Price normalizer: supports price OR entryPrice */
function getPrice(spin) {
  const p = Number(spin?.price ?? spin?.entryPrice ?? 0);
  return Number.isFinite(p) ? p : 0;
}

/** Capacity normalizer */
function getCapacity(spin) {
  const c = Number(spin?.capacity ?? 0);
  return Number.isFinite(c) ? c : 0;
}

/** Signed-up normalizer */
function getSignedUp(spin) {
  const n = Number(spin?.signedUp ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Spots-left normalizer */
function getSpotsLeft(spin) {
  if (spin?.spotsLeft !== undefined && spin?.spotsLeft !== null) {
    const x = Number(spin.spotsLeft);
    return Number.isFinite(x) ? x : 0;
  }
  const cap = getCapacity(spin);
  const signed = getSignedUp(spin);
  return Math.max(0, cap - signed);
}

/**
 * Photo resolver (FIXED):
 * - relative filenames like: "boozer.jpg" (stored in same repo folder as index.html)
 * - relative paths like: "images/boozer.jpg"
 * - GitHub blob links -> raw.githubusercontent.com
 * - Google Drive share links -> uc?export=view&id=...
 */
function resolvePhotoUrl(photo) {
  const p = String(photo || "").trim();
  if (!p) return "";

  // Full URL already
  if (p.startsWith("http://") || p.startsWith("https://")) {
    // Convert github blob link -> raw
    if (p.includes("github.com") && p.includes("/blob/")) {
      return p
        .replace("https://github.com/", "https://raw.githubusercontent.com/")
        .replace("/blob/", "/");
    }

    // Convert Google Drive "file/d/ID/view" -> direct view URL
    // Example: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    const m1 = p.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (m1 && m1[1]) {
      return `https://drive.google.com/uc?export=view&id=${m1[1]}`;
    }

    // Convert Google Drive "open?id=ID" -> direct view URL
    const m2 = p.match(/drive\.google\.com\/open\?id=([^&]+)/i);
    if (m2 && m2[1]) {
      return `https://drive.google.com/uc?export=view&id=${m2[1]}`;
    }

    return p;
  }

  // Relative path: resolve against current page (GitHub Pages safe)
  // IMPORTANT: this makes "boozer.jpg" become "https://.../boozer.jpg"
  try {
    return new URL(p.replace(/^\/+/, ""), window.location.href).href;
  } catch {
    return p.replace(/^\/+/, "");
  }
}

/** API */
function assertApiBase_() {
  if (!API_BASE || API_BASE.includes("PASTE_YOUR")) {
    throw new Error("API_BASE is not set. Paste your Apps Script Web App /exec URL into code.js");
  }
  if (!API_BASE.endsWith("/exec")) {
    throw new Error("API_BASE must end with /exec (Apps Script Web App URL).");
  }
}

async function apiGetSpins() {
  assertApiBase_();
  // Your Code.gs already returns spins for doGet, no action needed
  const url = `${API_BASE}?ts=${Date.now()}`;
  const res = await fetch(url, { method: "GET", redirect: "follow" });
  if (!res.ok) throw new Error(`GET failed (${res.status})`);
  return res.json();
}

async function apiSubmitEntry(payload) {
  assertApiBase_();
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // GAS-friendly
    redirect: "follow",
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    let errText = "";
    try { errText = (await res.json()).error || ""; } catch {}
    throw new Error(errText || `Submit failed (${res.status})`);
  }
  return res.json();
}

/** Navigation */
function goSignup(spinId) {
  state.selectedSpinId = spinId;

  clearMsg();
  nameEl.value = "";
  phoneEl.value = "";
  emailEl.value = "";
  venmoEl.value = "";

  pagePick.classList.add("hidden");
  pageSignup.classList.remove("hidden");

  renderSignup();
}

function goPick() {
  state.selectedSpinId = null;
  clearMsg();
  pageSignup.classList.add("hidden");
  pagePick.classList.remove("hidden");
  renderPick();
}

/** Render pick page */
function renderPick() {
  spinCards.innerHTML = "";

  let anyOpen = false;

  state.spins.forEach(spin => {
    const id = String(spin.spinId || spin.id);
    const title = String(spin.title || "");
    const desc = String(spin.desc || "");
    const price = getPrice(spin);
    const cap = getCapacity(spin);
    const signed = getSignedUp(spin);
    const left = getSpotsLeft(spin);

    const status = String(spin.status || "OPEN").toUpperCase();
    const isOpen = left > 0 && status === "OPEN";

    if (isOpen) anyOpen = true;

    const pct = cap > 0 ? Math.min(100, (signed / cap) * 100) : 0;

    // IMPORTANT: use "photo" column from sheet
    const photoUrl = resolvePhotoUrl(spin.photo);

    const div = document.createElement("div");
    div.className = "card";
    div.style.background = "#fff";
    div.innerHTML = `
      <div class="row between">
        <div>
          <div class="title">${escapeHtml(title)}</div>
          <div class="sub">${escapeHtml(desc)}</div>
        </div>
        <span class="pill blue">$${price}</span>
      </div>

      <div class="row" style="margin-top:6px">
        <span class="pill">${signed}/${cap} filled</span>
        <span class="pill ${isOpen ? "good" : "bad"}">${isOpen ? "Open" : "Full"}</span>
      </div>

      <div class="progressWrap">
        <div class="bar" style="width:${pct}%"></div>
      </div>

      <div class="photos">
        ${photoUrl ? `<div class="photo">
          <img src="${photoUrl}" alt="Spin photo"
               onerror="this.style.display='none'; console.warn('Image failed:', this.src);" />
        </div>` : ""}
      </div>

      <button data-pick="${escapeHtml(id)}" ${isOpen ? "" : "disabled"} style="margin-top:10px;width:100%">
        ${isOpen ? "Choose Spin" : "Full"}
      </button>
    `;
    spinCards.appendChild(div);
  });

  globalStatus.textContent = anyOpen ? "Open" : "All Full";
  globalStatus.className = `pill ${anyOpen ? "good" : "bad"}`;

  spinCards.querySelectorAll("button[data-pick]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-pick");
      goSignup(id);
    });
  });
}

/** Render signup page */
function renderSignup() {
  const spin = getSpin(state.selectedSpinId);
  if (!spin) return;

  const title = String(spin.title || "");
  const desc = String(spin.desc || "");
  const price = getPrice(spin);
  const cap = getCapacity(spin);
  const signed = getSignedUp(spin);
  const left = getSpotsLeft(spin);

  const pct = cap > 0 ? Math.min(100, Math.round((signed / cap) * 100)) : 0;
  const photoUrl = resolvePhotoUrl(spin.photo);

  signupTitle.textContent = `Sign up — ${title}`;
  signupDesc.textContent = desc;
  signupPrice.textContent = `$${price} per entry`;
  signupFill.textContent = `${signed}/${cap} filled`;
  signupSpots.textContent = `${left} spots left`;
  signupBar.style.width = pct + "%";

  const open = left > 0 && String(spin.status || "OPEN").toUpperCase() === "OPEN";
  signupStatus.textContent = open ? "Open" : "Full";
  signupStatus.className = `pill ${open ? "good" : "bad"}`;

  signupPhotoWrap.innerHTML = photoUrl
    ? `<div class="photo">
         <img src="${photoUrl}" alt="Spin photo"
              onerror="this.style.display='none'; console.warn('Signup image failed:', this.src);" />
       </div>`
    : `<div class="notice" style="margin:10px 0 0"><strong>No photo found.</strong></div>`;

  btnSubmit.disabled = !open;
}

/** Submit */
async function submitEntry() {
  const spin = getSpin(state.selectedSpinId);
  if (!spin) return;

  const spinId = String(spin.spinId || spin.id);
  const name = nameEl.value.trim();
  const phone = phoneEl.value.trim();
  const email = emailEl.value.trim();
  const venmo = venmoEl.value.trim();

  if (!name) return showMsg("Please enter your <strong>name</strong>.");
  if (!phone) return showMsg("Please enter your <strong>phone</strong>.");
  if (!email || !validEmail(email)) return showMsg("Please enter a valid <strong>email</strong>.");
  if (!venmo) return showMsg("Please enter your <strong>Venmo username</strong>.");

  clearMsg();
  btnSubmit.disabled = true;
  const oldText = btnSubmit.textContent;
  btnSubmit.textContent = "Submitting…";

  try {
    await apiSubmitEntry({ spinId, name, email, phone, venmo });

    // refresh counts from server
    await refreshSpins();

    const priceNow = getPrice(getSpin(spinId));
    showMsg(
      `<strong>You're signed up ✅</strong><br/>
       A confirmation email has been sent to <strong>${escapeHtml(email)}</strong>.<br/>
       Amount due: <strong>$${priceNow}</strong>`
    );

    renderSignup();
  } catch (err) {
    btnSubmit.disabled = false;
    showMsg(`<strong>Error:</strong> ${escapeHtml(err.message || String(err))}`);
  } finally {
    btnSubmit.textContent = oldText || "Submit Entry";
    const s2 = getSpin(state.selectedSpinId);
    if (s2) btnSubmit.disabled = !(getSpotsLeft(s2) > 0);
  }
}

/** Refresh spins from API */
async function refreshSpins() {
  const data = await apiGetSpins();
  if (!data || !data.ok) throw new Error(data?.error || "Bad response from API");
  state.spins = Array.isArray(data.spins) ? data.spins : [];
}

/** Init */
async function init() {
  try {
    await refreshSpins();
    renderPick();
  } catch (err) {
    showMsg(
      `<strong>Could not load spins.</strong><br/>
       ${escapeHtml(err.message || String(err))}<br/><br/>
       Check: (1) API_BASE is set to your /exec URL, (2) Apps Script deployed as "Anyone".`
    );
  }
}

/** Events */
btnBack?.addEventListener("click", goPick);
btnSubmit?.addEventListener("click", submitEntry);

/** Run */
init();
