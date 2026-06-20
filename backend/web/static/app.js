// Interfaz Dominikito — cuento interactivo escena a escena (ramificado por las decisiones).

const ILLUS = ["🐵", "🛸", "⭐", "🌙", "☁️", "🍌"];
const OPT_COLORS = ["blue", "orange", "green", "purple", "red"];

let profile = null;
let storySoFar = [];   // textos de todas las páginas mostradas
let choicesMade = 0;
let total = 2;
let illusIdx = 0;
let currentAudio = null;     // Audio en reproducción (ElevenLabs)
let highlightUpdateId = null; // ID para requestAnimationFrame del resaltado
let childId = null;          // id del niño (BD)
let storyId = null;          // id del cuento (BD)
let currentDilemma = null;   // dilema de la escena actual (para guardar la decisión)
let sceneShownAt = 0;        // timestamp para response_latency_ms
let dashPin = "";            // PIN del dashboard (sesión)

// Variables para paginación (formato libro)
let bookPages = [];          // Lista de páginas en el libro actual
let currentPageIndex = 0;    // Índice de la página actualmente mostrada en el libro
let pageTransitioning = false; // Flag para evitar clicks múltiples durante la transición

function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
async function errMsg(res) { try { const j = await res.json(); return j.detail || ("HTTP " + res.status); } catch (_) { return "HTTP " + res.status; } }
function showScreen(id) { document.querySelectorAll(".screen").forEach(s => s.classList.remove("active")); document.getElementById(id).classList.add("active"); }
function toggleDev() { document.body.classList.toggle("dev"); }
function backToCreate() { stopAudio(); showScreen("screen-create"); document.getElementById("subtitle").textContent = "Cuentos que escuchan a tu peque"; }

function stopHighlightLoop() {
  if (highlightUpdateId) {
    cancelAnimationFrame(highlightUpdateId);
    highlightUpdateId = null;
  }
}

function startHighlightLoopForPage(words, pageIdx) {
  stopHighlightLoop();
  function update() {
    if (!currentAudio || currentAudio.paused) return;
    const time = currentAudio.currentTime;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const el = document.getElementById(`p${pageIdx}-word-${i}`);
      if (el) {
        if (time >= w.start && time <= w.end) {
          el.classList.add("highlight");
        } else {
          el.classList.remove("highlight");
        }
      }
    }
    highlightUpdateId = requestAnimationFrame(update);
  }
  highlightUpdateId = requestAnimationFrame(update);
}

function stopAudio() {
  if (currentAudio) { try { currentAudio.pause(); } catch (_) {} currentAudio = null; }
  stopHighlightLoop();
  document.querySelectorAll(".word-span").forEach(el => el.classList.remove("highlight"));
}

function playCurrentPageAudio() {
  const page = bookPages[currentPageIndex];
  const btn = document.getElementById("read-btn");
  if (!page || page.type !== "story") {
    if (btn) btn.style.display = "none";
    stopAudio();
    return;
  }
  
  if (btn) {
    btn.style.display = "inline-block";
    btn.textContent = "⏳ preparando…";
  }
  
  stopAudio();
  
  const textToRead = page.text;
  currentAudio = new Audio("/api/tts?text=" + encodeURIComponent(textToRead));
  
  let wordsTimestamps = [];
  fetch("/api/tts/timestamps?text=" + encodeURIComponent(textToRead))
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data && data.words) {
        wordsTimestamps = data.words;
        if (currentAudio && !currentAudio.paused) {
          startHighlightLoopForPage(wordsTimestamps, currentPageIndex);
        }
      }
    })
    .catch(err => console.error("Error al obtener timestamps:", err));
    
  currentAudio.onplaying = () => {
    if (btn) btn.textContent = "⏸ Parar";
    if (wordsTimestamps && wordsTimestamps.length > 0) {
      startHighlightLoopForPage(wordsTimestamps, currentPageIndex);
    }
  };
  
  currentAudio.onended = () => {
    if (btn) btn.textContent = "🔊 Léemelo";
    stopAudio();
    
    // Auto-advance to next page after a brief pause
    setTimeout(() => {
      if (currentPageIndex < bookPages.length - 1) {
        nextPage(true);
      }
    }, 1200);
  };
  
  currentAudio.onerror = () => {
    if (btn) btn.textContent = "🔊 Léemelo";
    stopAudio();
  };
  
  currentAudio.play().catch(e => {
    stopAudio();
    if (btn) btn.textContent = "🔊 Léemelo";
    console.log("Autoplay blocked or audio error:", e);
  });
}

function togglePlayPause() {
  const btn = document.getElementById("read-btn");
  if (currentAudio && !currentAudio.paused) {
    stopAudio();
    if (btn) btn.textContent = "🔊 Léemelo";
  } else {
    playCurrentPageAudio();
  }
}

function profileFromForm() {
  const likes = document.getElementById("f-likes").value.split(",").map(s => s.trim()).filter(Boolean);
  const events = document.getElementById("f-events").value.trim();
  return {
    name: document.getElementById("f-name").value.trim() || "Dominik",
    age: parseFloat(document.getElementById("f-age").value) || 6,
    likes,
    temperament: document.getElementById("f-temp").value.trim(),
    recent_events: events ? [events] : [],
    story_theme: document.getElementById("f-theme").value.trim(),
  };
}

function showLoading(msg) {
  showScreen("screen-reader");
  document.getElementById("reader").innerHTML =
    '<div class="loading"><div class="rocket">🚀</div><p>' + esc(msg || "Creando la aventura…") +
    '</p><p style="opacity:.6;font-size:14px">(unos segundos)</p></div>';
}

function wrapTextInSpans(text, startWordIdx, pageIdx) {
  let currentIdx = startWordIdx;
  const words = text.trim().split(/\s+/);
  const html = words.map(w => {
    const span = `<span class="word-span" id="p${pageIdx}-word-${currentIdx}">${esc(w)}</span>`;
    currentIdx++;
    return span;
  }).join(" ");
  return { html, nextIdx: currentIdx };
}

function renderBook() {
  let html = '<div id="book-container">';
  
  bookPages.forEach((page, idx) => {
    const activeClass = idx === currentPageIndex ? "active" : "";
    
    if (page.type === "story") {
      const emoji = ILLUS[illusIdx++ % ILLUS.length];
      const illus = page.image
        ? '<img class="illus-img" src="' + page.image + '" alt="">'
        : '<span>' + emoji + '</span><span class="tag">ilustración…</span>';
      
      const wrap = wrapTextInSpans(page.text, 0, idx);
      
      html += `
        <div class="book-page page ${activeClass}" id="page-${idx}">
          <div class="illus">${illus}</div>
          <p class="story-text">${wrap.html}</p>
        </div>
      `;
    } else if (page.type === "dilemma") {
      const d = page.dilemma;
      let dilemmaHtml = `
        <div class="book-page page ${activeClass}" id="page-${idx}">
          <div class="dilemma">
            <p class="prompt">${esc(d.prompt)}</p>
            <div class="options">
      `;
      (d.options || []).forEach((opt, j) => {
        const color = OPT_COLORS[j % OPT_COLORS.length];
        const isSample = !childId;
        const clickHandler = isSample ? `selectSampleOption(this)` : `choose(this)`;
        
        dilemmaHtml += `
          <button class="opt opt-${color}" data-dim="${esc(d.primary_dimension)}" 
            data-id="${esc(opt.id)}" data-pole="${esc(opt.pole)}" data-txt="${esc(opt.text)}" 
            onclick="${clickHandler}">
            <span class="bul">${esc(opt.id)}</span>
            <span>${esc(opt.text)}</span>
            <span class="pole-tag">${esc(opt.pole)}</span>
          </button>
        `;
      });
      dilemmaHtml += `
            </div>
          </div>
        </div>
      `;
      html += dilemmaHtml;
    } else if (page.type === "ending") {
      html += `
        <div class="book-page page ${activeClass}" id="page-${idx}" style="text-align:center">
          <p class="prompt">🌟 ¡Fin! 🌟</p>
          <button class="btn primary" onclick="backToCreate()">Crear otro cuento ✨</button>
        </div>
      `;
    }
  });
  
  html += '</div>'; // cierra book-container
  
  // Agregar barra de navegación
  html += `
    <div class="book-nav">
      <button class="btn nav-btn" id="prev-btn" onclick="prevPage()">⬅️ Ant.</button>
      <button class="btn read" id="read-btn" onclick="togglePlayPause()">🔊 Léemelo</button>
      <div class="page-indicator" id="page-indicator">Página 1 de 1</div>
      <button class="btn nav-btn" id="next-btn" onclick="nextPage()">Sig. ➡️</button>
    </div>
  `;
  
  return html;
}

function updateNavButtons() {
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const indicator = document.getElementById("page-indicator");
  const readBtn = document.getElementById("read-btn");
  
  if (!prevBtn || !nextBtn || !indicator) return;
  
  const pageCount = bookPages.length;
  indicator.textContent = `Página ${currentPageIndex + 1} de ${pageCount}`;
  
  prevBtn.disabled = currentPageIndex === 0;
  
  const currentPage = bookPages[currentPageIndex];
  
  if (currentPage.type === "story") {
    if (readBtn) {
      readBtn.style.display = "inline-block";
      if (currentAudio && !currentAudio.paused) {
        readBtn.textContent = "⏸ Parar";
      } else {
        readBtn.textContent = "🔊 Léemelo";
      }
    }
    nextBtn.style.display = "inline-block";
    nextBtn.disabled = false;
  } else if (currentPage.type === "dilemma") {
    if (readBtn) readBtn.style.display = "none";
    
    const isSample = !childId;
    if (isSample) {
      nextBtn.style.display = "inline-block";
      nextBtn.disabled = false;
    } else {
      nextBtn.style.display = "none";
    }
  } else if (currentPage.type === "ending") {
    if (readBtn) readBtn.style.display = "none";
    nextBtn.style.display = "none";
  }
}

function goToPage(idx, autoPlay = true) {
  if (idx < 0 || idx >= bookPages.length || pageTransitioning) return;
  
  pageTransitioning = true;
  stopAudio();
  
  const oldPageEl = document.getElementById(`page-${currentPageIndex}`);
  const newPageEl = document.getElementById(`page-${idx}`);
  
  if (oldPageEl && newPageEl) {
    oldPageEl.classList.add("fade-out");
    
    setTimeout(() => {
      oldPageEl.classList.remove("active", "fade-out");
      currentPageIndex = idx;
      newPageEl.classList.add("active");
      
      updateNavButtons();
      pageTransitioning = false;
      
      if (bookPages[currentPageIndex].type === "story" && autoPlay) {
        playCurrentPageAudio();
      } else {
        const btn = document.getElementById("read-btn");
        if (btn) btn.style.display = "none";
      }
    }, 400); // 400ms para coincidir con la transición CSS (0.4s)
  } else {
    currentPageIndex = idx;
    const reader = document.getElementById("reader");
    const progressHtml = renderProgressHtml();
    reader.innerHTML = progressHtml + renderBook();
    updateNavButtons();
    pageTransitioning = false;
    if (bookPages[currentPageIndex].type === "story" && autoPlay) {
      playCurrentPageAudio();
    }
  }
}

function nextPage(isAuto = false) {
  if (currentPageIndex < bookPages.length - 1) {
    goToPage(currentPageIndex + 1, true);
  }
}

function prevPage() {
  if (currentPageIndex > 0) {
    goToPage(currentPageIndex - 1, true);
  }
}

function renderProgressHtml() {
  const ending = bookPages.length > 0 && bookPages[bookPages.length - 1].type === "ending";
  if (!ending && childId) {
    return '<div class="progress">Decisión ' + (choicesMade + 1) + " de " + total + "</div>";
  }
  return "";
}

// Renderiza UN tramo (escena). data = {segment, dilemma, done?}
function renderStep(data) {
  const seg = data.segment;
  const dilemma = data.dilemma;
  const ending = seg.is_ending || data.done;

  // acumula las páginas mostradas para la continuidad
  (seg.pages || []).forEach(p => storySoFar.push(p.text));

  currentDilemma = dilemma;   // para guardar la decisión (Contrato B)
  sceneShownAt = Date.now();

  bookPages = [];
  (seg.pages || []).forEach(p => {
    bookPages.push({
      type: "story",
      text: p.text,
      image: p.image,
      isCheckpoint: p.is_checkpoint,
      pageNumber: p.page
    });
  });

  if (!ending && dilemma) {
    bookPages.push({
      type: "dilemma",
      dilemma: dilemma
    });
  } else if (ending) {
    bookPages.push({
      type: "ending"
    });
  }

  currentPageIndex = 0;
  
  const progressHtml = renderProgressHtml();
  document.getElementById("reader").innerHTML = progressHtml + renderBook();
  
  showScreen("screen-reader");
  window.scrollTo(0, 0);
  
  // Reproducir el audio de la primera página del tramo
  playCurrentPageAudio();
}

async function createStory() {
  document.getElementById("create-err").textContent = "";
  profile = profileFromForm();
  storySoFar = []; choicesMade = 0; illusIdx = 0;
  document.getElementById("devlog-body").innerHTML = "";
  document.getElementById("subtitle").textContent = "Tu aventura";
  showLoading("Creando la aventura…");
  try {
    const res = await fetch("/api/story/start", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(profile),
    });
    if (!res.ok) throw new Error(await errMsg(res));
    const data = await res.json();
    total = data.total || 2;
    childId = data.child_id || null;
    storyId = data.story_id || null;
    renderStep(data);
  } catch (e) {
    backToCreate();
    document.getElementById("create-err").textContent = "Ups, no se pudo crear el cuento: " + e.message;
  }
}

async function choose(btn) {
  const group = btn.closest(".options");
  group.querySelectorAll(".opt").forEach(b => b.classList.remove("sel"));
  btn.classList.add("sel");

  const rec = { dimension: btn.dataset.dim, pole: btn.dataset.pole, text: btn.dataset.txt };
  const line = document.createElement("div");
  line.textContent = "→ [" + rec.dimension + '] eligió: "' + rec.text + '"  ⇒  polo=' + rec.pole;
  document.getElementById("devlog-body").appendChild(line);

  // guarda la decisión (lookup del polo pre-registrado) — no bloquea la historia
  if (currentDilemma) {
    fetch("/api/decision", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        child_id: childId, story_id: storyId,
        dilemma_id: currentDilemma.dilemma_id, page: currentDilemma.page,
        dimension: currentDilemma.primary_dimension, subaxis: currentDilemma.subaxis,
        pole: rec.pole, chosen_option_id: btn.dataset.id,
        age_at_decision: profile ? profile.age : null,
        developmental_stage: currentDilemma.developmental_stage,
        response_latency_ms: sceneShownAt ? (Date.now() - sceneShownAt) : null,
      }),
    }).catch(() => {});
  }

  choicesMade += 1;
  showLoading("La historia cambia según tu elección…");
  try {
    const res = await fetch("/api/story/next", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile, story_so_far: storySoFar, choice: rec.text, choices_made: choicesMade }),
    });
    if (!res.ok) throw new Error(await errMsg(res));
    renderStep(await res.json());
  } catch (e) {
    document.getElementById("reader").innerHTML = '<div class="err">No se pudo continuar: ' + esc(e.message) + "</div>";
  }
}

function selectSampleOption(btn) {
  const optionsDiv = btn.closest('.options');
  optionsDiv.querySelectorAll('.opt').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
}

// "Ver ejemplo": preview de estilo NO interactivo (cuento completo de fixture).
async function loadSample() {
  showLoading("Cargando ejemplo…");
  illusIdx = 0;
  childId = null;
  storyId = null;
  choicesMade = 0;
  try {
    const res = await fetch("/api/storybook/sample");
    const data = await res.json();
    const byPage = {}; (data.dilemmas || []).forEach(d => { byPage[d.page] = d; });
    document.getElementById("subtitle").textContent = (data.story.title || "") + " (ejemplo)";
    
    bookPages = [];
    (data.story.pages || []).forEach((page) => {
      bookPages.push({
        type: "story",
        text: page.text,
        image: page.image,
        isCheckpoint: page.is_checkpoint,
        pageNumber: page.page
      });
      const d = page.is_checkpoint ? byPage[page.page] : null;
      if (d) {
        bookPages.push({
          type: "dilemma",
          dilemma: d
        });
      }
    });
    bookPages.push({
      type: "ending"
    });
    
    currentPageIndex = 0;
    
    const progressHtml = renderProgressHtml();
    document.getElementById("reader").innerHTML = progressHtml + renderBook();
    showScreen("screen-reader"); 
    window.scrollTo(0, 0);
    
    // Autoplay the first page
    playCurrentPageAudio();
  } catch (e) {
    backToCreate();
    document.getElementById("create-err").textContent = "No se pudo cargar el ejemplo: " + e.message;
  }
}

// ---------- Dashboard de padres (protegido con PIN) ----------
const POLE_BAR_COLORS = ["var(--purple)", "var(--orange)", "var(--green)", "var(--pink)", "var(--yellow)"];
const ALERT = { watch: ["⚠️ vale la pena observar", "#FFE9C2"], elevated: ["🔔 conviene prestar atención", "#FFD1DE"] };

function showDashboardLogin() {
  stopAudio();
  showScreen("screen-dashboard");
  document.getElementById("dash-login").style.display = "block";
  document.getElementById("dash-content").style.display = "none";
  document.getElementById("dash-err").textContent = "";
  document.getElementById("subtitle").textContent = "Dashboard de papás";
}

async function dashLogin() {
  const pin = document.getElementById("dash-pin").value.trim();
  const err = document.getElementById("dash-err");
  err.textContent = "";
  try {
    const res = await fetch("/api/children?pin=" + encodeURIComponent(pin));
    if (!res.ok) throw new Error(await errMsg(res));
    dashPin = pin;
    const kids = (await res.json()).children || [];
    if (!kids.length) { err.textContent = "Aún no hay datos. Crea algunos cuentos primero."; return; }
    document.getElementById("dash-child").innerHTML =
      kids.map(k => '<option value="' + k.id + '">' + esc(k.name) + " (" + k.age + " años)</option>").join("");
    document.getElementById("dash-login").style.display = "none";
    document.getElementById("dash-content").style.display = "block";
    loadChildDashboard(kids[0].id);
  } catch (e) {
    err.textContent = "No se pudo entrar: " + (e.message || e);
  }
}

async function loadChildDashboard(cid) {
  const box = document.getElementById("dash-trends");
  box.innerHTML = '<div class="loading"><div class="rocket">🛸</div></div>';
  try {
    const res = await fetch("/api/dashboard?child_id=" + encodeURIComponent(cid) + "&pin=" + encodeURIComponent(dashPin));
    if (!res.ok) throw new Error(await errMsg(res));
    renderDashboard(await res.json());
  } catch (e) {
    box.innerHTML = '<div class="err">' + esc(e.message || e) + "</div>";
  }
}

function renderDashboard(data) {
  const dims = data.dimensions || [];
  if (!dims.length) {
    document.getElementById("dash-trends").innerHTML =
      '<div class="card">Aún no hay decisiones registradas para este niño/a.</div>';
    return;
  }
  let html = '<div class="note">Banda de edad ' + esc(data.age_band || "") + ' · describe patrones, no diagnostica</div>';
  dims.forEach(d => {
    html += '<div class="card dash-dim">';
    html += '<div class="dash-head"><b>' + esc(d.label) + '</b><span class="dash-n">' + d.sample_size + ' decisiones</span></div>';
    if (!d.meets_min_threshold) {
      html += '<div class="hint">Aún no hay suficientes datos para hablar de un patrón — sigue creando cuentos. 🌱</div>';
    } else {
      const totalN = d.sample_size || 1;
      html += '<div class="bar">';
      Object.keys(d.distribution).forEach((p, i) => {
        const c = d.distribution[p]; if (!c) return;
        const w = (100 * c / totalN).toFixed(1);
        html += '<span class="seg" style="width:' + w + '%;background:' + POLE_BAR_COLORS[i % POLE_BAR_COLORS.length] +
          '" title="' + esc(p) + ': ' + c + '"></span>';
      });
      html += '</div><div class="dash-sum">' + esc(d.neutral_summary) + '</div>';
      const a = ALERT[d.alert_level];
      if (a) html += '<div class="alert-chip" style="background:' + a[1] + '">' + a[0] + '</div>';
    }
    html += '</div>';
  });
  document.getElementById("dash-trends").innerHTML = html;
}
