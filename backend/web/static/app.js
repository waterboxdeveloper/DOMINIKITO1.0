// Interfaz Dominikito — cuento interactivo escena a escena (ramificado por las decisiones).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  projectId: "dominikito-c21fd",
  appId: "1:920971971262:web:c16dfe833965d5f6856cef",
  storageBucket: "dominikito-c21fd.firebasestorage.app",
  apiKey: "AIzaSyDNSJXT7zQJIBF1LccK-PB7Nru6ZreEnlE",
  authDomain: "dominikito-c21fd.firebaseapp.com",
  messagingSenderId: "920971971262",
  measurementId: "G-84N6ECME66"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

const SEED_CHARACTERS = [
  {
    id: "dominik",
    name: "Dominik",
    type: "character",
    emoji: "👦",
    description: "Un niño alegre y curioso de 6 años al que le encanta explorar, hacer preguntas y vivir aventuras creativas en compañía de sus amigos.",
    imageUrl: "/assets/dominik.jpeg"
  },
  {
    id: "maria",
    name: "María",
    type: "character",
    emoji: "👧",
    description: "Una niña activa y entusiasta de 7 años, muy observadora y creativa, que siempre propone ideas ingeniosas y disfruta del trabajo en equipo.",
    imageUrl: "/assets/maria.jpeg"
  },
  {
    id: "mateo",
    name: "Mateo",
    type: "character",
    emoji: "🧒",
    description: "Un niño reflexivo y empático de 6 años, gran observador de la naturaleza y los animales, que prefiere pensar las cosas antes de actuar y siempre cuida de sus compañeros.",
    imageUrl: "/assets/mateo.jpeg"
  },
  {
    id: "dino",
    name: "Dino",
    type: "creature",
    emoji: "🦖",
    description: "Un dinosaurio de juguete muy expresivo y amigable, con escamas verdes y una gran sonrisa, siempre listo para acompañar en juegos imaginativos.",
    imageUrl: "/assets/dino.jpeg"
  },
  {
    id: "robot",
    name: "Robot",
    type: "creature",
    emoji: "🤖",
    description: "Un pequeño robot asistente de aspecto simpático y metálico, con luces de colores y pantalla expresiva, curioso por aprender sobre las emociones y el mundo que lo rodea.",
    imageUrl: "/assets/robot.jpeg"
  }
];

let dbCharacters = [...SEED_CHARACTERS];
let selectedMainCharacter = "dominik";
let selectedSecondaryCharacters = new Set(["dino"]);

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

// Variables para Firebase
let currentUser = null;
let allStoryPages = [];      // Todas las páginas del cuento actual (para historial)
let isOfflineMode = false;
let currentFirestoreStoryId = null;

function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
async function errMsg(res) { try { const j = await res.json(); return j.detail || ("HTTP " + res.status); } catch (_) { return "HTTP " + res.status; } }
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  // El dashboard aprovecha todo el ancho; el resto de pantallas se mantienen en columna angosta.
  const wrap = document.querySelector(".wrap");
  if (wrap) wrap.classList.toggle("wrap-wide", id === "screen-dashboard");
}
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

function setupAudioEvents(audio, btn, wordsTimestampsPromise) {
  audio.onplaying = () => {
    if (btn) btn.textContent = "⏸ Parar";
    wordsTimestampsPromise.then(words => {
      if (words && words.length > 0 && currentAudio === audio) {
        startHighlightLoopForPage(words, currentPageIndex);
      }
    });
  };
  
  audio.onended = () => {
    if (btn) btn.textContent = "🔊 Léemelo";
    stopAudio();
    
    // Auto-advance to next page after a brief pause
    setTimeout(() => {
      if (currentPageIndex < bookPages.length - 1) {
        nextPage(true);
      }
    }, 1200);
  };
  
  audio.onerror = () => {
    if (btn) btn.textContent = "🔊 Léemelo";
    stopAudio();
  };
}

function dataURItoBlob(dataURI) {
  const parts = dataURI.split(',');
  const byteString = atob(parts[1]);
  const mimeString = parts[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
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

  // Promise to get timestamps (either from cache or API)
  let resolveTimestamps;
  const wordsTimestampsPromise = new Promise((resolve) => {
    resolveTimestamps = resolve;
  });

  if (page.words) {
    resolveTimestamps(page.words);
  } else {
    fetch("/api/tts/timestamps?text=" + encodeURIComponent(textToRead))
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.words) {
          resolveTimestamps(data.words);
          // Cache in Firestore
          if (!isOfflineMode && currentFirestoreStoryId && page.pageIndex !== undefined) {
            const pageRef = doc(db, "stories", currentFirestoreStoryId, "pages", String(page.pageIndex));
            updateDoc(pageRef, { words: data.words }).catch(err => console.error("Error caching words:", err));
          }
        } else {
          resolveTimestamps([]);
        }
      })
      .catch(err => {
        console.error("Error getting timestamps:", err);
        resolveTimestamps([]);
      });
  }

  // Play audio (either from cache URL, base64, or API)
  if (page.audio) {
    currentAudio = new Audio(page.audio);
    setupAudioEvents(currentAudio, btn, wordsTimestampsPromise);
    currentAudio.play().catch(e => {
      stopAudio();
      if (btn) btn.textContent = "🔊 Léemelo";
      console.log("Autoplay blocked or audio error:", e);
    });
  } else {
    fetch("/api/tts?text=" + encodeURIComponent(textToRead))
      .then(res => {
        if (!res.ok) throw new Error("TTS failed");
        return res.blob();
      })
      .then(blob => {
        // Play audio immediately from object URL (instant playback)
        const objectURL = URL.createObjectURL(blob);

        if (currentPageIndex === bookPages.indexOf(page)) {
          stopAudio();
          currentAudio = new Audio(objectURL);
          setupAudioEvents(currentAudio, btn, wordsTimestampsPromise);
          currentAudio.play().catch(e => {
            stopAudio();
            if (btn) btn.textContent = "🔊 Léemelo";
            console.log("Autoplay blocked or audio error:", e);
          });
        }

        // Cache in Firebase Storage and Firestore in background (non-blocking)
        if (!isOfflineMode && currentFirestoreStoryId && page.pageIndex !== undefined) {
          const uploadAndCache = async () => {
            try {
              const audioRef = ref(storage, `stories/${currentFirestoreStoryId}/pages/${page.pageIndex}/audio.mp3`);
              await uploadBytes(audioRef, blob);
              const downloadURL = await getDownloadURL(audioRef);
              page.audio = downloadURL;
              
              const pageRef = doc(db, "stories", currentFirestoreStoryId, "pages", String(page.pageIndex));
              await updateDoc(pageRef, { audio: downloadURL });
            } catch (err) {
              console.error("Error caching audio to Storage/Firestore:", err);
            }
          };
          uploadAndCache();
        }
      })
      .catch(err => {
        console.error("Error loading audio:", err);
        if (btn) btn.textContent = "🔊 Léemelo";
        stopAudio();
      });
  }
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
    main_character: selectedMainCharacter,
    secondary_characters: Array.from(selectedSecondaryCharacters),
    include_toy: !!(document.getElementById("f-toy-include") && document.getElementById("f-toy-include").checked && toyImageB64),
    toy_image_b64: toyImageB64,
    favorite_toy: "",
  };
}

// Lee la foto del juguete como data-URI y la guarda en memoria (no se sube hasta crear el cuento).
let toyImageB64 = "";
window.onToySelected = function(input) {
  const status = document.getElementById("f-toy-status");
  const file = input.files && input.files[0];
  if (!file) { toyImageB64 = ""; if (status) status.textContent = ""; return; }
  const reader = new FileReader();
  reader.onload = e => {
    toyImageB64 = e.target.result || "";
    const cb = document.getElementById("f-toy-include");
    if (cb) cb.checked = true;  // al subir foto asumimos que sí lo quiere (puede desmarcar)
    if (status) status.textContent = "🧸 Foto lista: su juguete aparecerá en una escena del cuento.";
  };
  reader.readAsDataURL(file);
};

// Loader animado del monito (rebota, se bambolea y suelta destellos). Reutilizable.
function monkeyLoaderHTML(msg) {
  return '<div class="loading">'
    + '<div class="monkey-loader">'
    +   '<img class="monkey-img" src="/assets/loading-monkey.png" alt="Cargando">'
    + '</div>'
    + (msg ? '<p class="loading-sub">' + esc(msg) + '</p>' : '')
    + '</div>';
}

function showLoading(msg) {
  showScreen("screen-reader");
  document.getElementById("reader").innerHTML = monkeyLoaderHTML(msg || "Creando la aventura…");
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
        const isSel = (page.chosenOptionId && opt.id === page.chosenOptionId) ? "sel" : "";
        
        let clickHandler = "";
        let disabledAttr = "";
        
        if (isOfflineMode && currentFirestoreStoryId) {
          disabledAttr = "disabled";
        } else {
          const isSample = !currentFirestoreStoryId;
          clickHandler = isSample ? `selectSampleOption(this)` : `choose(this)`;
        }
        
        dilemmaHtml += `
          <button class="opt opt-${color} ${isSel}" data-dim="${esc(d.primary_dimension)}" 
            data-id="${esc(opt.id)}" data-pole="${esc(opt.pole)}" data-txt="${esc(opt.text)}" 
            onclick="${clickHandler}" ${disabledAttr}>
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
      <div class="page-indicator" id="page-indicator">Página ${currentPageIndex + 1} de ${bookPages.length}</div>
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
    
    if (isOfflineMode && !currentFirestoreStoryId) {
      nextBtn.style.display = "inline-block";
      nextBtn.disabled = false;
    } else {
      // En cuento interactivo el dilema se avanza eligiendo una opción, no con "Sig.".
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

async function checkAndSeedCharacters() {
  if (!currentUser) return;
  try {
    const charsCollection = collection(db, "characters");
    const snapshot = await getDocs(charsCollection);
    if (snapshot.empty) {
      console.log("Firestore characters collection is empty. Seeding characters...");
      for (const char of SEED_CHARACTERS) {
        await setDoc(doc(db, "characters", char.id), char);
      }
    }
  } catch (e) {
    console.error("Error checking/seeding characters:", e);
  }
}

async function loadCharacters() {
  if (currentUser) {
    try {
      const snapshot = await getDocs(collection(db, "characters"));
      if (!snapshot.empty) {
        dbCharacters = [];
        snapshot.forEach(doc => {
          dbCharacters.push(doc.data());
        });
      }
    } catch (e) {
      console.error("Error loading characters from Firestore, using seed fallback:", e);
    }
  }
  renderCharactersUI();
}

function renderCharactersUI() {
  const mainGrid = document.getElementById("main-character-grid");
  const secondaryGrid = document.getElementById("secondary-characters-grid");
  if (!mainGrid || !secondaryGrid) return;

  // Render main characters (only humans: dominik, maria, mateo)
  const mainChars = dbCharacters.filter(c => c.type === "character");
  mainGrid.innerHTML = mainChars.map(c => {
    const isSelected = c.id === selectedMainCharacter ? "selected" : "";
    return `
      <div class="character-card ${isSelected}" data-id="${c.id}" onclick="selectMainCharacter('${c.id}')">
        <div class="character-card-emoji">${c.emoji}</div>
        <div class="character-card-name">${c.name}</div>
        <div class="character-card-desc">${c.description}</div>
      </div>
    `;
  }).join("");

  // Render secondary characters (all except the selected main character)
  const secondaryChars = dbCharacters.filter(c => c.id !== selectedMainCharacter);
  secondaryGrid.innerHTML = secondaryChars.map(c => {
    const isSelected = selectedSecondaryCharacters.has(c.id) ? "selected" : "";
    return `
      <div class="character-card ${isSelected}" data-id="${c.id}" onclick="toggleSecondaryCharacter('${c.id}')">
        <div class="character-card-emoji">${c.emoji}</div>
        <div class="character-card-name">${c.name}</div>
        <div class="character-card-desc">${c.description}</div>
      </div>
    `;
  }).join("");
}

function selectMainCharacter(charId) {
  selectedMainCharacter = charId;
  
  // Update name field to match selected character's name
  const char = dbCharacters.find(c => c.id === charId);
  if (char) {
    document.getElementById("f-name").value = char.name;
  }
  
  // If the new main character was a selected secondary character, remove it
  selectedSecondaryCharacters.delete(charId);
  
  renderCharactersUI();
}

function toggleSecondaryCharacter(charId) {
  if (selectedSecondaryCharacters.has(charId)) {
    selectedSecondaryCharacters.delete(charId);
  } else {
    selectedSecondaryCharacters.add(charId);
  }
  renderCharactersUI();
}

// Bind all module functions to window so they are globally accessible from inline HTML
window.selectMainCharacter = selectMainCharacter;
window.toggleSecondaryCharacter = toggleSecondaryCharacter;
window.createStory = createStory;
window.loadSample = loadSample;
window.backToCreate = backToCreate;
window.toggleDev = toggleDev;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.togglePlayPause = togglePlayPause;
window.dashLogin = dashLogin;
window.loadChildDashboard = loadChildDashboard;
window.choose = choose;
window.selectSampleOption = selectSampleOption;
window.showDashboardLogin = showDashboardLogin;
window.showHistoryScreen = showHistoryScreen;
window.readSavedStory = readSavedStory;
window.deleteSavedStory = deleteSavedStory;

function prevPage() {
  if (currentPageIndex > 0) {
    goToPage(currentPageIndex - 1, true);
  }
}

function renderProgressHtml() {
  const ending = bookPages.length > 0 && bookPages[bookPages.length - 1].type === "ending";
  if (!ending && currentFirestoreStoryId && !isOfflineMode) {
    return '<div class="progress">Decisión ' + (choicesMade + 1) + " de " + total + "</div>";
  }
  return "";
}

async function savePageToFirestore(storyIdVal, page) {
  if (!currentUser || !storyIdVal) return;
  try {
    const pageRef = doc(db, "stories", storyIdVal, "pages", String(page.pageIndex));
    
    // If image is a base64 data-URI, upload it to Storage in the background and replace with download URL
    if (page.image && page.image.startsWith("data:image/")) {
      try {
        const imageBlob = dataURItoBlob(page.image);
        const imageRef = ref(storage, `stories/${storyIdVal}/pages/${page.pageIndex}/image.png`);
        await uploadBytes(imageRef, imageBlob);
        const downloadURL = await getDownloadURL(imageRef);
        page.image = downloadURL;
      } catch (err) {
        console.error("Error uploading image to Storage:", err);
        page.image = null; // Fallback to null to prevent Firestore document size errors
      }
    }
    
    await setDoc(pageRef, page);
  } catch (e) {
    console.error("Error saving page to Firestore:", e);
  }
}

// Renderiza UN tramo (escena). data = {segment, dilemma, done?}
async function renderStep(data) {
  const seg = data.segment;
  const dilemma = data.dilemma;
  const ending = seg.is_ending || data.done;

  // acumula las páginas mostradas para la continuidad
  (seg.pages || []).forEach(p => storySoFar.push(p.text));

  currentDilemma = dilemma;   // para guardar la decisión (Contrato B)
  sceneShownAt = Date.now();

  bookPages = [];
  const newPages = [];
  const startIndex = allStoryPages.length;

  (seg.pages || []).forEach((p, idx) => {
    const pageObj = {
      type: "story",
      text: p.text,
      image: p.image || null,
      isCheckpoint: p.is_checkpoint,
      pageNumber: p.page,
      pageIndex: startIndex + idx
    };
    bookPages.push(pageObj);
    
    if (!isOfflineMode) {
      allStoryPages.push(pageObj);
      newPages.push(pageObj);
    }
  });

  if (!ending && dilemma) {
    const dilemmaObj = {
      type: "dilemma",
      dilemma: dilemma,
      chosenOptionId: null,
      pageIndex: allStoryPages.length
    };
    bookPages.push(dilemmaObj);
    
    if (!isOfflineMode) {
      allStoryPages.push(dilemmaObj);
      newPages.push(dilemmaObj);
    }
  } else if (ending) {
    const endingObj = {
      type: "ending",
      pageIndex: allStoryPages.length
    };
    bookPages.push(endingObj);
    
    if (!isOfflineMode) {
      allStoryPages.push(endingObj);
      newPages.push(endingObj);
    }
  }

  currentPageIndex = 0;

  // Save new pages to Firestore (non-blocking)
  if (!isOfflineMode && currentFirestoreStoryId) {
    newPages.forEach(page => {
      savePageToFirestore(currentFirestoreStoryId, page);
    });
  }

  const progressHtml = renderProgressHtml();
  document.getElementById("reader").innerHTML = progressHtml + renderBook();
  updateNavButtons();
  
  showScreen("screen-reader");
  window.scrollTo(0, 0);
  
  // Reproducir el audio de la primera página del tramo
  playCurrentPageAudio();
}

async function createStory() {
  document.getElementById("create-err").textContent = "";
  if (!currentUser) {
    document.getElementById("create-err").textContent = "Por favor, inicia sesión con tu cuenta de Google arriba para empezar.";
    return;
  }
  
  profile = profileFromForm();
  storySoFar = []; choicesMade = 0; illusIdx = 0;
  isOfflineMode = false;
  allStoryPages = [];
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
    if (data.favorite_toy && profile) profile.favorite_toy = data.favorite_toy;  // cachea la descripción de visión
    
    // Create new story metadata document in Firestore
    const storyRef = doc(collection(db, "stories"));
    currentFirestoreStoryId = storyRef.id;
    const storyMetadata = {
      userId: currentUser.uid,
      childName: profile.name,
      childAge: profile.age,
      theme: profile.story_theme,
      likes: profile.likes,
      temperament: profile.temperament || "",
      recentEvents: profile.recent_events || [],
      createdAt: new Date(),
      status: "in_progress",
      choicesMade: 0,
      totalChoices: total
    };
    try {
      await setDoc(storyRef, storyMetadata);
    } catch (err) {
      console.error("Error creating story metadata:", err);
      currentFirestoreStoryId = null; // Prevent writes that would fail rules
    }
    
    await renderStep(data);
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

  // Update choice in local list of pages and Firestore
  if (!isOfflineMode && currentFirestoreStoryId) {
    const lastPageIdx = allStoryPages.length - 1;
    if (lastPageIdx >= 0 && allStoryPages[lastPageIdx].type === "dilemma") {
      allStoryPages[lastPageIdx].chosenOptionId = btn.dataset.id;
      allStoryPages[lastPageIdx].chosenOptionText = btn.dataset.txt;
      
      const pageRef = doc(db, "stories", currentFirestoreStoryId, "pages", String(lastPageIdx));
      updateDoc(pageRef, {
        chosenOptionId: btn.dataset.id,
        chosenOptionText: btn.dataset.txt
      }).catch(err => console.error("Error saving chosen option:", err));
    }

    const nextChoicesCount = choicesMade + 1;
    const storyRef = doc(db, "stories", currentFirestoreStoryId);
    updateDoc(storyRef, {
      choicesMade: nextChoicesCount,
      status: (nextChoicesCount >= total) ? "completed" : "in_progress"
    }).catch(err => console.error("Error updating story choicesMade:", err));
  }

  // guarda la decisión en Firestore (lookup del polo pre-registrado, client-side; ver consideraciones.md)
  if (currentDilemma && currentUser && profile) {
    try {
      const decRef = doc(collection(db, "decisions"));
      setDoc(decRef, {
        userId: currentUser.uid,
        childName: profile.name,
        dimension: currentDilemma.primary_dimension,
        subaxis: currentDilemma.subaxis || null,
        pole: rec.pole,
        chosenOptionId: btn.dataset.id,
        ageAtDecision: profile.age,
        developmentalStage: currentDilemma.developmental_stage || null,
        dilemmaId: currentDilemma.dilemma_id || null,
        page: currentDilemma.page || null,
        responseLatencyMs: sceneShownAt ? (Date.now() - sceneShownAt) : null,
        createdAt: new Date(),
      }).catch(err => console.error("Error guardando decisión:", err));
    } catch (err) { console.error("Error guardando decisión:", err); }
  }

  choicesMade += 1;
  showLoading("La historia cambia según tu elección…");
  try {
    const res = await fetch("/api/story/next", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile, story_so_far: storySoFar, choice: rec.text, choices_made: choicesMade }),
    });
    if (!res.ok) throw new Error(await errMsg(res));
    await renderStep(await res.json());
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
  isOfflineMode = true; // Samples act like offline stories (no api writes)
  currentFirestoreStoryId = null;
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
    updateNavButtons();
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

let activeDashboardTab = "trends"; // "trends" | "evolution" | "validity" | "privacy"
let lastDashboardData = null;      // datos cacheados para redibujo instantáneo
let currentDashChild = "";         // niño/a seleccionado en el dashboard (para el hero)

// ===== Agregación client-side (port EXACTO de backend/aggregate.py; spec en tests/test_aggregate.py) =====
// ⚠️ En producción esta lógica debería vivir en el servidor (ver consideraciones.md).
const MIN_SAMPLE = 5, WATCH_SHARE = 0.70, ELEVATED_SHARE = 0.85;
const TAXONOMY = {
  regulacion_emocional: { poles: ["regulado", "desregulado"], secondary: false },
  confianza_apego:      { poles: ["busca_vinculo", "evita_desconfia"], secondary: false },
  honestidad:           { poles: ["asume_transparente", "evade_oculta"], secondary: false },
  empatia:              { poles: ["prosocial_asertivo", "pasivo_evitativo", "reactivo_agresivo"], secondary: false },
  autonomia:            { poles: ["autonomo", "dependiente"], secondary: false },
  riesgo_cautela:       { poles: ["explorador", "cauto"], secondary: true },
};
const DIM_LABEL = {
  regulacion_emocional: "regulación emocional", confianza_apego: "confianza y cercanía",
  honestidad: "honestidad", empatia: "empatía", autonomia: "autonomía", riesgo_cautela: "exploración",
};
const POLE_LABEL = {
  regulado: "mantener la calma", desregulado: "reaccionar con intensidad",
  busca_vinculo: "acercarse o pedir ayuda", evita_desconfia: "resolver solo o mantener distancia",
  asume_transparente: "decir la verdad o asumir", evade_oculta: "evitar o callar",
  prosocial_asertivo: "ayudar o intervenir", pasivo_evitativo: "observar sin intervenir",
  reactivo_agresivo: "reaccionar con enojo", autonomo: "decidir por sí mismo",
  dependiente: "buscar la guía de un adulto", explorador: "explorar lo nuevo", cauto: "quedarse en lo seguro",
};
const AGE_BAND = { ma_stage_1: "3-6", ma_stage_2: "6-9", ma_stage_3: "9-12" };
function maStage(age) { return age < 6 ? "ma_stage_1" : age < 9 ? "ma_stage_2" : "ma_stage_3"; }

function dashSummary(dim, dominant, count, n, meets) {
  const dl = DIM_LABEL[dim] || dim;
  if (!meets) return `Aún no hay suficientes datos en ${dl} (${n}). Hacen falta al menos ${MIN_SAMPLE} para hablar de un patrón.`;
  return `En ${count} de ${n} situaciones de ${dl}, tu peque eligió ${POLE_LABEL[dominant] || dominant}.`;
}

function aggregateDecisions(rows) {
  const byDim = {};
  let latestAge = null;
  rows.forEach(r => {
    const dim = r.dimension;
    if (!TAXONOMY[dim]) return;
    (byDim[dim] = byDim[dim] || []).push(r);
    if (r.ageAtDecision != null) latestAge = Number(r.ageAtDecision);
  });
  const dimensions = [];
  Object.keys(byDim).forEach(dim => {
    const poles = TAXONOMY[dim].poles;
    const distribution = {}; poles.forEach(p => distribution[p] = 0);
    let subaxis = null;
    byDim[dim].forEach(r => { if (r.pole in distribution) distribution[r.pole]++; subaxis = subaxis || r.subaxis || null; });
    const n = poles.reduce((s, p) => s + distribution[p], 0);
    let dominant = null, mx = -1;
    poles.forEach(p => { if (distribution[p] > mx) { mx = distribution[p]; dominant = p; } });
    const share = (n && dominant) ? distribution[dominant] / n : 0;
    const meets = n >= MIN_SAMPLE;
    let alert = "none";
    if (meets && !TAXONOMY[dim].secondary) {
      if (share >= ELEVATED_SHARE) alert = "elevated";
      else if (share >= WATCH_SHARE) alert = "watch";
    }
    dimensions.push({
      dimension: dim, label: DIM_LABEL[dim] || dim, subaxis,
      sample_size: n, meets_min_threshold: meets, distribution,
      dominant_pole: dominant, alert_level: alert, secondary: TAXONOMY[dim].secondary,
      neutral_summary: dashSummary(dim, dominant, dominant ? distribution[dominant] : 0, n, meets),
    });
  });
  return { age_band: latestAge != null ? (AGE_BAND[maStage(latestAge)] || "") : "", dimensions };
}

// Lee las decisiones del usuario autenticado desde Firestore (filtra childName en cliente → sin índice compuesto).
async function loadDecisions(childName) {
  if (!currentUser) return [];
  const q = query(collection(db, "decisions"), where("userId", "==", currentUser.uid));
  const snap = await getDocs(q);
  const rows = [];
  snap.forEach(d => { const v = d.data(); if (v.childName === childName) rows.push(v); });
  return rows;
}

// Lista los niños (childName distintos) con decisiones del usuario.
async function loadUserChildren() {
  if (!currentUser) return [];
  const q = query(collection(db, "decisions"), where("userId", "==", currentUser.uid));
  const snap = await getDocs(q);
  const byName = new Map();
  snap.forEach(d => { const v = d.data(); if (v.childName && !byName.has(v.childName)) byName.set(v.childName, v.ageAtDecision); });
  return [...byName.entries()].map(([name, age]) => ({ name, age }));
}

function showDashboardLogin() {
  stopAudio();
  activeDashboardTab = "trends";
  lastDashboardData = null;
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
  if (!currentUser) { err.textContent = "Inicia sesión con Google para ver el dashboard."; return; }
  dashPin = pin; // PIN = gate local suave; la privacidad real la da tu sesión de Google
  try {
    const kids = await loadUserChildren();
    if (!kids.length) { err.textContent = "Aún no hay decisiones. Crea algunos cuentos primero."; return; }
    document.getElementById("dash-child").innerHTML =
      kids.map(k => '<option value="' + esc(k.name) + '">' + esc(k.name) + (k.age ? " (" + k.age + " años)" : "") + "</option>").join("");
    document.getElementById("dash-login").style.display = "none";
    document.getElementById("dash-content").style.display = "block";
    loadChildDashboard(kids[0].name);
  } catch (e) {
    err.textContent = "No se pudo cargar: " + (e.message || e);
  }
}

async function loadChildDashboard(childName) {
  currentDashChild = childName || "";
  const box = document.getElementById("dash-trends");
  box.innerHTML = monkeyLoaderHTML("Cargando el perfil…");
  try {
    const rows = await loadDecisions(childName);          // lee de Firestore
    lastDashboardData = aggregateDecisions(rows);          // agrega con umbrales psicologia.md
    renderDashboard(lastDashboardData);
  } catch (e) {
    box.innerHTML = '<div class="err">' + esc(e.message || e) + "</div>";
  }
}

window.switchDashboardTab = function(tab) {
  activeDashboardTab = tab;
  if (lastDashboardData) {
    renderDashboard(lastDashboardData);
  }
};

// Mapa dimensión → cuento sugerido (honesto: practica una conducta, no "corrige" nada clínico).
const STORY_SUGGESTION = {
  regulacion_emocional: { theme: "un día lleno de sorpresas donde algo no sale como se esperaba", focus: "manejar la frustración con calma", icon: "🌊" },
  confianza_apego:      { theme: "una aventura donde pedir ayuda a un amigo es la clave para avanzar", focus: "buscar apoyo y confiar en otros", icon: "🤝" },
  honestidad:           { theme: "un pequeño misterio donde decir la verdad cambia el final feliz", focus: "decir la verdad y asumir errores", icon: "💎" },
  empatia:              { theme: "un nuevo compañero que necesita ayuda en el recreo", focus: "ayudar y entender a los demás", icon: "💗" },
  autonomia:            { theme: "una misión donde el protagonista elige su propio camino", focus: "decidir por sí mismo", icon: "🧭" },
  riesgo_cautela:       { theme: "explorar con cuidado un lugar nuevo y desconocido", focus: "explorar lo nuevo con confianza", icon: "🚀" },
};

// Construye el hero del dashboard (Insight + Próximo cuento sugerido) SOLO con datos reales del agregado.
function buildDashHero(data) {
  const dims = data.dimensions || [];
  const name = esc(currentDashChild || "tu peque");
  const ready = dims.filter(d => d.meets_min_threshold && !d.secondary);
  const alerted = ready.filter(d => d.alert_level !== "none")
    .sort((a, b) => (b.alert_level === "elevated") - (a.alert_level === "elevated"));

  // ---- Insight (lenguaje neutro, nunca diagnóstico) ----
  let insightTitle, insightBody;
  if (alerted.length) {
    const d = alerted[0];
    insightTitle = `Patrón a observar en ${esc(d.label)}`;
    insightBody = esc(d.neutral_summary);
  } else if (ready.length) {
    const strongest = ready
      .map(d => ({ d, share: d.dominant_pole ? d.distribution[d.dominant_pole] / (d.sample_size || 1) : 0 }))
      .sort((a, b) => b.share - a.share)[0].d;
    insightTitle = `Lo más marcado hasta ahora: ${esc(strongest.label)}`;
    insightBody = esc(strongest.neutral_summary);
  } else {
    const most = dims.slice().sort((a, b) => b.sample_size - a.sample_size)[0];
    const have = most ? most.sample_size : 0;
    insightTitle = "Aún reuniendo las primeras decisiones";
    insightBody = `Con cada cuento que juega ${name}, su perfil se va dibujando. Hacen falta al menos ${MIN_SAMPLE} decisiones por dimensión para hablar de un patrón (la que más tiene va en ${have}).`;
  }

  // ---- Próximo cuento sugerido: si hay alerta, trabaja esa dimensión; si no, la que menos datos tiene ----
  let target = alerted.length ? alerted[0] : dims.slice().sort((a, b) => a.sample_size - b.sample_size)[0];
  const sug = STORY_SUGGESTION[target ? target.dimension : "empatia"] || STORY_SUGGESTION.empatia;
  const reason = alerted.length
    ? `Para acompañar lo observado en ${esc(target.label)}.`
    : `Para conocer mejor a ${name} en ${esc(target ? target.label : "una nueva área")}.`;

  return `
    <div class="dash-hero">
      <div class="card hero-insight">
        <div class="hero-tag">💡 Insight</div>
        <h3>${insightTitle}</h3>
        <p>${insightBody}</p>
        <p class="hero-disclaimer">Es una observación de patrones de juego, no un diagnóstico.</p>
      </div>
      <div class="card hero-suggest">
        <div class="hero-tag">📖 Próximo cuento sugerido</div>
        <div class="suggest-row">
          <span class="suggest-icon">${sug.icon}</span>
          <div>
            <h4>Un cuento sobre ${esc(sug.theme)}</h4>
            <p class="suggest-focus">Practica: <b>${esc(sug.focus)}</b></p>
          </div>
        </div>
        <p class="suggest-reason">${reason}</p>
        <button class="btn primary suggest-cta" onclick="suggestStory('${esc(sug.theme).replace(/'/g, "\\'")}')">Generar este cuento →</button>
      </div>
    </div>
  `;
}

// CTA del hero: pre-llena el tema y lleva a la pantalla de crear cuento.
window.suggestStory = function(theme) {
  const t = document.getElementById("f-theme");
  if (t) t.value = theme;
  backToCreate();
  window.scrollTo(0, 0);
};

function renderDashboard(data) {
  const dims = data.dimensions || [];
  if (!dims.length) {
    document.getElementById("dash-trends").innerHTML =
      '<div class="card">Aún no hay decisiones registradas para este niño/a.</div>';
    return;
  }

  // Cuenta alertas para el panel de resumen
  let watchCount = 0;
  let elevatedCount = 0;
  let totalDecisions = 0;
  dims.forEach(d => {
    totalDecisions += d.sample_size || 0;
    if (d.meets_min_threshold) {
      if (d.alert_level === "watch") watchCount++;
      if (d.alert_level === "elevated") elevatedCount++;
    }
  });

  // Generación de la barra de pestañas (Tabs Navigation)
  let html = `
    <div class="dash-tabs">
      <button class="dash-tab-btn ${activeDashboardTab === 'trends' ? 'active' : ''}" onclick="switchDashboardTab('trends')">📊 Tendencias</button>
      <button class="dash-tab-btn ${activeDashboardTab === 'evolution' ? 'active' : ''}" onclick="switchDashboardTab('evolution')">🎓 Perfil Evolutivo</button>
      <button class="dash-tab-btn ${activeDashboardTab === 'validity' ? 'active' : ''}" onclick="switchDashboardTab('validity')">⚖️ Rúbrica de Validez</button>
      <button class="dash-tab-btn ${activeDashboardTab === 'privacy' ? 'active' : ''}" onclick="switchDashboardTab('privacy')">🛡️ Seguridad & Ética</button>
    </div>
  `;

  if (activeDashboardTab === "trends") {
    // ---- PESTAÑA 1: TENDENCIAS CONDUCTUALES (EL GRID) ----
    const DIM_METADATA = {
      regulacion_emocional: {
        icon: "🌊",
        anchor: "CASEL · Self-Management · Erikson",
        desc: "Mide cómo el niño/a modula sus respuestas ante la frustración o el miedo en el cuento.",
      },
      confianza_apego: {
        icon: "🤝",
        anchor: "Bowlby (Apego) · CASEL Relationship",
        desc: "Refleja la tendencia a buscar vínculos seguros y pedir ayuda frente a retos y extraños.",
      },
      honestidad: {
        icon: "💎",
        anchor: "CASEL · Decisión Responsable · Ma (Moral)",
        desc: "Muestra la transparencia y asunción de errores cuando evitar o callar es más fácil.",
      },
      empatia: {
        icon: "💗",
        anchor: "CASEL · Conciencia Social · Ma Altruismo",
        desc: "Evalúa comportamientos de ayuda activa vs. indiferencia pasiva o reactividad en conflictos.",
      },
      autonomia: {
        icon: "🧭",
        anchor: "Erikson · Autonomía / Iniciativa",
        desc: "Mide la iniciativa para decidir por sí mismo frente a la búsqueda excesiva de guía del adulto.",
      },
      riesgo_cautela: {
        icon: "🚀",
        anchor: "Erikson · Iniciativa vs. Culpa (Secundario)",
        desc: "Analiza el balance entre explorar lo desconocido y quedarse en la zona segura.",
      }
    };

    const POLE_LABELS = {
      regulado: "Autorregulado 🧘‍♂️",
      desregulado: "Intenso / Reactivo ⚡",
      busca_vinculo: "Busca Apoyo / Vínculo 🤝",
      evita_desconfia: "Resuelve Solo / Evitativo 🛡️",
      asume_transparente: "Honesto / Transparente 💎",
      evade_oculta: "Evasivo / Oculta 😶",
      prosocial_asertivo: "Prosocial / Colaborador 💗",
      pasivo_evitativo: "Pasivo / Observador 💤",
      reactivo_agresivo: "Reactivo / Hostil 😡",
      autonomo: "Autónomo / Decidido 🧭",
      dependiente: "Dependiente / Busca Guía 🧑‍🤝‍🧑",
      explorador: "Explorador / Curioso 🚀",
      cauto: "Prudente / Cauto 🐾"
    };

    const ALERT_BADGES = {
      watch: '<span class="alert-tag watch-tag"><span class="dot"></span>Atención Recomendada</span>',
      elevated: '<span class="alert-tag elevated-tag"><span class="dot pulse"></span>Patrón Persistente</span>'
    };

    html += buildDashHero(data);

    html += `
      <div class="dash-overview">
        <div class="overview-item card shadow-sm">
          <div class="label">Banda Evolutiva</div>
          <div class="val">${esc(data.age_band || "3-10")} años</div>
          <div class="sub">Clasificación Ma Stage / Erikson</div>
        </div>
        <div class="overview-item card shadow-sm">
          <div class="label">Muestras Totales</div>
          <div class="val">${totalDecisions}</div>
          <div class="sub">Decisiones registradas</div>
        </div>
        <div class="overview-item card shadow-sm">
          <div class="label">Observaciones Activas</div>
          <div class="val">
            ${elevatedCount > 0 ? `<span class="badge badge-red">${elevatedCount} Elevada</span>` : ""}
            ${watchCount > 0 ? `<span class="badge badge-orange">${watchCount} Atención</span>` : ""}
            ${watchCount === 0 && elevatedCount === 0 ? '<span class="badge badge-green">Estable</span>' : ""}
          </div>
          <div class="sub">Señales fuera del promedio</div>
        </div>
      </div>
      
      <div class="dash-grid">
    `;

    dims.forEach(d => {
      const meta = DIM_METADATA[d.dimension] || { icon: "📊", anchor: "CASEL Framework", desc: "" };
      const alertClass = d.alert_level !== "none" && d.meets_min_threshold ? `card-alert-${d.alert_level}` : "";
      
      html += `
        <div class="card dash-card ${alertClass} ${!d.meets_min_threshold ? 'dash-card-pending' : ''}">
          <div class="dash-card-header">
            <span class="dash-card-icon">${meta.icon}</span>
            <div class="dash-card-title-box">
              <h3>${esc(d.label)}</h3>
              <span class="anchor-ref">${esc(meta.anchor)}</span>
            </div>
            <span class="dash-n">${d.sample_size} dec.</span>
          </div>
          
          <div class="dash-card-body">
      `;

      if (!d.meets_min_threshold) {
        html += `
          <div class="pending-box">
            <div class="pending-icon">🌱</div>
            <h4>Sembrando datos...</h4>
            <p>Aún no hay suficientes decisiones registradas para trazar un patrón sólido. Sigue jugando cuentos con tu peque.</p>
            <div class="pending-progress-bar">
              <div class="pending-progress-fill" style="width: ${(d.sample_size / 5 * 100)}%"></div>
            </div>
            <span class="pending-ratio">${d.sample_size} / 5 decisiones</span>
          </div>
        `;
      } else {
        const totalN = d.sample_size || 1;
        const domCount = d.dominant_pole ? d.distribution[d.dominant_pole] : 0;
        const domShare = Math.round(100 * domCount / totalN);
        const domLabel = POLE_LABELS[d.dominant_pole] || d.dominant_pole || "—";
        const gaugeColor = d.alert_level === "elevated" ? "var(--pink)"
                         : d.alert_level === "watch" ? "var(--orange)" : "var(--lila)";

        // Termómetro circular: el anillo se llena con la fuerza de la tendencia dominante.
        html += `
          <div class="gauge-row">
            <div class="gauge" style="--pct:${domShare};--gcol:${gaugeColor}">
              <span class="gauge-pct">${domShare}%</span>
            </div>
            <div class="gauge-side">
              <div class="gauge-dom">${esc(domLabel)}</div>
              <div class="gauge-meta">${domCount} de ${totalN} decisiones</div>
              ${d.alert_level !== "none"
                ? (ALERT_BADGES[d.alert_level] || "")
                : '<span class="alert-tag stable-tag"><span class="dot"></span>Estable</span>'}
            </div>
          </div>
        `;

        html += '<div class="distribution-bar">';
        Object.keys(d.distribution).forEach((p, i) => {
          const c = d.distribution[p];
          if (!c) return;
          const w = (100 * c / totalN).toFixed(1);
          html += `<span class="dist-seg" style="width:${w}%;background:${POLE_BAR_COLORS[i % POLE_BAR_COLORS.length]}" title="${esc(POLE_LABELS[p] || p)}: ${c}"></span>`;
        });
        html += '</div>';

        html += '<div class="dist-legend-compact">';
        Object.keys(d.distribution).forEach((p, i) => {
          const c = d.distribution[p];
          if (!c) return;
          const color = POLE_BAR_COLORS[i % POLE_BAR_COLORS.length];
          html += `<span class="legc"><span class="legc-dot" style="background:${color}"></span>${esc(POLE_LABELS[p] || p)} ${c}</span>`;
        });
        html += '</div>';

        html += `
          <div class="summary-box">
            <p class="dash-sum">« ${esc(d.neutral_summary)} »</p>
          </div>
        `;
      }

      html += `
          </div> <!-- fin body -->
          <div class="dash-card-footer">
            <button class="btn-toggle-science" onclick="toggleScience(this)">
              <span>🔍 Fundamento Científico</span> <span class="arrow">▼</span>
            </button>
            <div class="science-detail-box" style="display:none">
              <p>${esc(meta.desc)}</p>
              <small>Basado en el marco teórico de <b>${esc(meta.anchor)}</b>.</small>
            </div>
          </div>
        </div> <!-- fin card -->
      `;
    });

    html += '</div>'; // fin dash-grid

    // Directorio de derivación clínica si hay alertas
    if (watchCount > 0 || elevatedCount > 0) {
      html += `
        <div class="card clinical-handoff shadow-sm">
          <div class="handoff-header">
            <span class="handoff-icon">🩺</span>
            <div>
              <h3>Guía de Acompañamiento Profesional</h3>
              <p class="hint">Recomendaciones éticas y canales de consulta autorizados</p>
            </div>
          </div>
          <div class="handoff-body">
            <p>
              Dominikito es una herramienta lúdica diseñada para observar patrones de conducta y fomentar la comunicación familiar. 
              <b>Bajo ninguna circunstancia sustituye un diagnóstico clínico.</b>
            </p>
            <div class="clinical-tabs">
              <div class="clinical-tab">
                <h5>🧠 Cuándo Consultar</h5>
                <p>Considera conversar con un profesional si observas que las conductas mostradas interfieren con el desarrollo social, escolar o familiar de tu peque de forma persistente.</p>
              </div>
              <div class="clinical-tab">
                <h5>📞 Directorios Sugeridos</h5>
                <ul>
                  <li><b>Psicopedagogía y Apoyo Escolar:</b> Consulta con el orientador de su escuela.</li>
                  <li><b>Asociación de Psicología Infantil:</b> Directorios certificados en tu país.</li>
                  <li><b>Línea de Acompañamiento:</b> Orientación pediátrica primaria de tu localidad.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      `;
    }

  } else if (activeDashboardTab === "evolution") {
    // ---- PESTAÑA 2: PERFIL EVOLUTIVO (MA & ERIKSON) ----
    let stageTitle = "";
    let stageSubtitle = "";
    let stageDesc = "";
    let stageNorms = [];
    let eriksonStage = "";
    let eriksonDesc = "";
    
    if (data.age_band === "3-6") {
      stageTitle = "Estadio 1 de Ma (3-6 años) — Egocentrismo y Supervivencia";
      stageSubtitle = "Foco moral primario: Egocentrismo funcional y obediencia pragmática.";
      stageDesc = "A esta edad, las decisiones del niño están orientadas a la autoprotección y la satisfacción de necesidades inmediatas. El egocentrismo es evolutivamente normal y no constituye una falta de empatía o egoísmo clínico, sino la consolidación de su supervivencia básica.";
      stageNorms = [
        "Egocentrismo normativo: prioriza sus deseos y pertenencias ante extraños o amigos.",
        "Obediencia instrumental: sigue reglas principalmente para evitar castigos físicos o regaños.",
        "Comprensión concreta: percibe situaciones morales basadas únicamente en el resultado físico directo."
      ];
      eriksonStage = "Iniciativa vs. Culpa (Estadio Psicosocial de 3 a 6 años)";
      eriksonDesc = "El niño explota su creatividad, ensaya roles en mundos de fantasía y experimenta con límites. La toma de riesgos lúdicos es normal y fomenta la confianza en sí mismo.";
    } else if (data.age_band === "6-9") {
      stageTitle = "Estadio 2 de Ma (6-9 años) — Altruismo Recíproco";
      stageSubtitle = "Foco moral primario: Intercambio mutuo y conexión afectiva.";
      stageDesc = "El desarrollo moral de tu peque se encuentra en la etapa del altruismo recíproco ('te ayudo si me ayudas'). Sus acciones prosociales y de honestidad están fuertemente motivadas por la reciprocidad concreta y el afecto interpersonal cercano.";
      stageNorms = [
        "Reciprocidad pragmática: colabora activamente si percibe un intercambio justo o aprobación mutua.",
        "Apego relacional: busca validar sus elecciones bajo la mirada afectiva de padres y maestros.",
        "Empatía selectiva: mayor tendencia a socorrer a personajes cercanos, familiares o mascotas."
      ];
      eriksonStage = "Laboriosidad vs. Inferioridad (Estadio Escolar de 6 a 12 años)";
      eriksonDesc = "Centrado en el desarrollo de habilidades sociales, aprendizaje de normas y orgullo derivado de la competencia escolar y social.";
    } else { // "9-12"
      stageTitle = "Estadio 3 de Ma (9-12 años) — Altruismo de Grupo Primario";
      stageSubtitle = "Foco moral primario: Pertenencia e interdependencia del grupo.";
      stageDesc = "El razonamiento del preadolescente integra dinámicas colectivas de grupo. El deseo de pertenencia, la justicia compartida y las expectativas de los pares definen su noción de honestidad, empatía y responsabilidad social.";
      stageNorms = [
        "Altruismo comunitario: actúa de forma empática para resguardar la cohesión y armonía de su círculo de pares.",
        "Comprensión avanzada: asume verdades y dilemas morales complejos con mayor capacidad de autoanálisis.",
        "Autorregulación grupal: modula comportamientos guiado por normas del colectivo aceptadas autónomamente."
      ];
      eriksonStage = "Laboriosidad vs. Inferioridad / Identidad vs. Confusión";
      eriksonDesc = "Comienza la transición hacia la exploración de la identidad social propia dentro del colectivo escolar y comunitario.";
    }

    html += `
      <div class="card evolution-card shadow-sm">
        <div class="evo-header">
          <span class="evo-icon">🎓</span>
          <div>
            <h3>Perfil de Desarrollo Evolutivo</h3>
            <p class="hint">Anclado a las investigaciones de Ma (2013) y los estadios de Erikson</p>
          </div>
        </div>
        
        <div class="evo-timeline">
          <div class="timeline-step ${data.age_band === '3-6' ? 'active' : ''}">
            <span class="step-num">3-6</span>
            <span class="step-lbl">Estadio 1</span>
          </div>
          <div class="timeline-step ${data.age_band === '6-9' ? 'active' : ''}">
            <span class="step-num">6-9</span>
            <span class="step-lbl">Estadio 2</span>
          </div>
          <div class="timeline-step ${data.age_band === '9-12' ? 'active' : ''}">
            <span class="step-num">9-12</span>
            <span class="step-lbl">Estadio 3</span>
          </div>
        </div>
        
        <div class="evo-body">
          <div class="evo-stage-badge">Banda evolutiva activa: ${esc(data.age_band || "3-10")} años</div>
          <h4>${esc(stageTitle)}</h4>
          <p class="stage-sub">${esc(stageSubtitle)}</p>
          <p class="stage-desc">${esc(stageDesc)}</p>
          
          <div class="evo-norms">
            <h5>📋 Conductas del Desarrollo Normativas</h5>
            <ul>
              ${stageNorms.map(n => `<li>${esc(n)}</li>`).join("")}
            </ul>
          </div>
          
          <div class="erikson-box">
            <h5>🧭 Estadio Psicosocial de Erikson</h5>
            <p class="erikson-title"><b>${esc(eriksonStage)}</b></p>
            <p class="erikson-desc">${esc(eriksonDesc)}</p>
          </div>
        </div>
      </div>
    `;

  } else if (activeDashboardTab === "validity") {
    // ---- PESTAÑA 3: RÚBRICA DE VALIDEZ (COOPER & SANTILLO) ----
    const hasEnoughData = totalDecisions >= 5;
    
    html += `
      <div class="card validity-card shadow-sm">
        <div class="validity-header">
          <span class="validity-icon">⚖️</span>
          <div>
            <h3>Rúbrica de Validez Científica</h3>
            <p class="hint">Evaluación de límites psicométricos según Cooper (2013) y la revisión Santillo (2025)</p>
          </div>
        </div>
        
        <div class="validity-gauge-container">
          <div class="gauge-item">
            <div class="gauge-status ${hasEnoughData ? 'status-green' : 'status-yellow'}">
              ${hasEnoughData ? '✓' : '⚠'}
            </div>
            <div class="gauge-label-box">
              <h5>Criterio de Persistencia Temporal</h5>
              <p>Evita falsos positivos por conductas transitorias o juegos de rol aislados.</p>
              <small>Estado: <b>${totalDecisions} / 5 decisiones</b> registradas totales.</small>
            </div>
          </div>
          
          <div class="gauge-item">
            <div class="gauge-status status-blue">ℹ</div>
            <div class="gauge-label-box">
              <h5>Exclusión de Deterioro Funcional (Impairment)</h5>
              <p>El juego en casa no mide distrés o incapacidad escolar. No se pueden inducir diagnósticos.</p>
              <small>Estado: <b>Inferencia Excluida de Diagnósticos Clínicos</b>.</small>
            </div>
          </div>
          
          <div class="gauge-item">
            <div class="gauge-status status-green">✓</div>
            <div class="gauge-label-box">
              <h5>Criterio de Normalización por Edad</h5>
              <p>Las métricas e interpretaciones se ajustan automáticamente a la banda evolutiva exacta.</p>
              <small>Estado: <b>Banda evolutiva activa para ${esc(data.age_band || "3-10")} años</b>.</small>
            </div>
          </div>
        </div>
        
        <div class="validity-citation">
          <h5>📖 Revisión PRISMA (Santillo et al., 2025 — MDPI Children)</h5>
          <blockquote>
            "Las técnicas proyectivas de construcción sirven como complementos eficaces de la evaluación clínica... no deben ser tratadas como herramientas de diagnóstico independientes."
          </blockquote>
          <p class="citation-note">
            ⚠️ <b>Aviso de validez digital:</b> Dominikito es un instrumento de <b>señalización y observación lúdica</b>. Dado que no existe validación clínica documentada de pruebas proyectivas digitales sin terapeuta presente, Dominikito adopta un tono humilde, descriptivo y enfocado puramente en la derivación activa a profesionales si persisten las dudas.
          </p>
        </div>
      </div>
    `;

  } else if (activeDashboardTab === "privacy") {
    // ---- PESTAÑA 4: SEGURIDAD Y ÉTICA (COPPA & GDPR) ----
    html += `
      <div class="card privacy-card shadow-sm">
        <div class="privacy-header">
          <span class="privacy-icon">🛡️</span>
          <div>
            <h3>Seguridad, Privacidad y Cumplimiento</h3>
            <p class="hint">Protocolos éticos de resguardo del menor y la familia</p>
          </div>
        </div>
        
        <div class="privacy-body">
          <p class="privacy-intro">
            Los datos afectivos y de decisiones de menores son clasificados como información de categoría especial de alta sensibilidad. Dominikito implementa las directivas de seguridad del marco legal ético:
          </p>
          
          <div class="check-list">
            <div class="check-item">
              <div class="check-box checked">✓</div>
              <div class="check-text">
                <b>Cumplimiento de Ley COPPA (FTC EE.UU.)</b>
                <p>Verificación del consentimiento parental e inicio protegido mediante PIN de padres antes del almacenamiento de cualquier registro de menores de 13 años.</p>
              </div>
            </div>
            
            <div class="check-item">
              <div class="check-box checked">✓</div>
              <div class="check-text">
                <b>Regulación GDPR (Categoría Especial)</b>
                <p>Cifrado y minimización en el almacenamiento de datos mentales y de comportamiento socioemocional, restringiendo el acceso del menor a la capa evaluativa.</p>
              </div>
            </div>
            
            <div class="check-item">
              <div class="check-box checked">✓</div>
              <div class="check-text">
                <b>Guardrail de Integridad (Anti-Sesgo de Confirmación)</b>
                <p>Separación estricta de motores: El Agente 1 genera la trama, el Agente 2 pre-registra el dilema (lookup sin interpretación libre posterior) y el dashboard acumula con fórmulas fijas. Ningún componente genera y se autocalifica circularmente.</p>
              </div>
            </div>
            
            <div class="check-item">
              <div class="check-box checked">✓</div>
              <div class="check-text">
                <b>Lista de Exclusión de Eventos Recientes</b>
                <p>Filtro proactivo de recuerdos de los padres. Evita forzar dilemas sobre duelos, mudanzas o separaciones, protegiendo al niño de la re-activación de traumas en juego.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  document.getElementById("dash-trends").innerHTML = html;
}

// ---------- Historial de Cuentos (Firebase) ----------
async function showHistoryScreen() {
  stopAudio();
  showScreen("screen-history");
  document.getElementById("subtitle").textContent = "Mis cuentos";
  const listDiv = document.getElementById("history-list");
  listDiv.innerHTML = monkeyLoaderHTML("Cargando tus cuentos…");
  
  if (!currentUser) {
    listDiv.innerHTML = '<div class="err">Debes iniciar sesión con Google para ver tus cuentos.</div>';
    return;
  }

  try {
    const q = query(
      collection(db, "stories"),
      where("userId", "==", currentUser.uid)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      listDiv.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;">Aún no tienes cuentos creados. ¡Crea el primero! ✨</div>';
      return;
    }

    const stories = [];
    querySnapshot.forEach((docSnap) => {
      stories.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Sort in-memory to avoid requiring a composite index in Firestore
    stories.sort((a, b) => {
      const timeA = a.createdAt ? (a.createdAt.seconds || 0) : 0;
      const timeB = b.createdAt ? (b.createdAt.seconds || 0) : 0;
      return timeB - timeA;
    });

    let html = "";
    stories.forEach((story) => {
      const date = story.createdAt ? new Date(story.createdAt.seconds * 1000).toLocaleDateString() : "";
      html += `
        <div class="story-item-card">
          <div>
            <h3 class="story-item-title">${esc(story.theme || "Cuento sin tema")}</h3>
            <div class="story-item-meta">
              <div><b>Para:</b> ${esc(story.childName)} (${story.childAge} años)</div>
              <div><b>Fecha:</b> ${date}</div>
              <div><b>Estado:</b> ${story.status === "completed" ? "✅ Completado" : "⏳ En progreso"}</div>
            </div>
          </div>
          <div class="story-item-actions">
            <button class="btn primary" onclick="readSavedStory('${story.id}')">Leer 📖</button>
            <button class="btn" style="background:var(--pink);" onclick="deleteSavedStory('${story.id}')">Borrar 🗑️</button>
          </div>
        </div>
      `;
    });
    listDiv.innerHTML = html;
  } catch (e) {
    console.error("Error loading history:", e);
    listDiv.innerHTML = '<div class="err">Error al cargar la lista: ' + esc(e.message) + '</div>';
  }
}

async function readSavedStory(storyIdVal) {
  showLoading("Cargando tu cuento guardado…");
  currentFirestoreStoryId = storyIdVal;
  allStoryPages = [];
  
  try {
    const storySnap = await getDoc(doc(db, "stories", storyIdVal));
    if (storySnap.exists()) {
      const storyData = storySnap.data();
      document.getElementById("subtitle").textContent = storyData.theme + " (guardado)";
      if (storyData.status === "in_progress") {
        isOfflineMode = false;
        childId = storyData.childId;
        storyId = storyData.backendStoryId;
        choicesMade = storyData.choicesMade || 0;
        total = storyData.total || 3;
      } else {
        isOfflineMode = true;
      }
    } else {
      isOfflineMode = true;
    }

    const pagesSnapshot = await getDocs(collection(db, "stories", storyIdVal, "pages"));
    const pages = [];
    pagesSnapshot.forEach((docSnap) => {
      pages.push(docSnap.data());
    });
    
    pages.sort((a, b) => a.pageIndex - b.pageIndex);
    
    if (pages.length === 0) {
      throw new Error("No se encontraron páginas para este cuento.");
    }
    
    allStoryPages = pages.map(p => {
      if (p.type === "story") {
        return {
          type: "story",
          text: p.text,
          image: p.image,
          pageNumber: p.pageIndex,
          words: p.words,
          audio: p.audio,
          pageIndex: p.pageIndex,
          chosenOptionId: p.chosenOptionId,
          chosenOptionText: p.chosenOptionText
        };
      } else if (p.type === "dilemma") {
        return {
          type: "dilemma",
          dilemma: p.dilemma || {},
          chosenOptionId: p.chosenOptionId,
          chosenOptionText: p.chosenOptionText,
          pageIndex: p.pageIndex
        };
      } else if (p.type === "ending") {
        return {
          type: "ending",
          pageIndex: p.pageIndex
        };
      }
    });
    
    bookPages = JSON.parse(JSON.stringify(allStoryPages));
    currentPageIndex = 0;
    
    const lastPage = allStoryPages[allStoryPages.length - 1];
    if (lastPage && lastPage.type === "dilemma") {
      currentDilemma = lastPage.dilemma;
    } else {
      currentDilemma = null;
    }
    
    const progressHtml = renderProgressHtml();
    document.getElementById("reader").innerHTML = progressHtml + renderBook();
    updateNavButtons();
    showScreen("screen-reader");
    window.scrollTo(0, 0);
    
    playCurrentPageAudio();
  } catch (e) {
    console.error("Error reading saved story:", e);
    alert("Error al cargar el cuento: " + e.message);
    showHistoryScreen();
  }
}

async function deleteSavedStory(storyIdVal) {
  if (!confirm("¿Seguro que deseas borrar este cuento de tu historial?")) return;
  try {
    const pagesSnapshot = await getDocs(collection(db, "stories", storyIdVal, "pages"));
    const deletePromises = [];
    pagesSnapshot.forEach((pDoc) => {
      const pageData = pDoc.data();
      deletePromises.push(deleteDoc(doc(db, "stories", storyIdVal, "pages", pDoc.id)));
      
      // Delete from storage in background
      if (pageData.image && pageData.image.includes("firebasestorage")) {
        const imageRef = ref(storage, `stories/${storyIdVal}/pages/${pageData.pageIndex}/image.png`);
        deleteObject(imageRef).catch(err => console.error("Error deleting image from storage:", err));
      }
      if (pageData.audio && pageData.audio.includes("firebasestorage")) {
        const audioRef = ref(storage, `stories/${storyIdVal}/pages/${pageData.pageIndex}/audio.mp3`);
        deleteObject(audioRef).catch(err => console.error("Error deleting audio from storage:", err));
      }
    });
    await Promise.all(deletePromises);
    
    await deleteDoc(doc(db, "stories", storyIdVal));
    alert("Cuento borrado con éxito.");
    showHistoryScreen();
  } catch (e) {
    console.error("Error deleting story:", e);
    alert("Error al borrar el cuento: " + e.message);
  }
}

// ---------- Firebase Authentication Listener ----------
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    document.getElementById("user-header").style.display = "flex";
    document.getElementById("user-header-anonymous").style.display = "none";
    document.getElementById("user-avatar-img").src = user.photoURL || "";
    document.getElementById("user-name-span").textContent = user.displayName || user.email;
    document.getElementById("btn-show-history").style.display = "inline-block";
    checkAndSeedCharacters().then(() => {
      loadCharacters();
    });
  } else {
    currentUser = null;
    document.getElementById("user-header").style.display = "none";
    document.getElementById("user-header-anonymous").style.display = "flex";
    document.getElementById("btn-show-history").style.display = "none";
  }
});

document.getElementById("login-btn-app")?.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Login error:", error);
    alert("Error al iniciar sesión: " + error.message);
  }
});

document.getElementById("logout-btn")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "/";
  } catch (error) {
    console.error("Logout error:", error);
  }
});

// Función global para expandir/colapsar
window.toggleScience = function(btn) {
  const card = btn.closest(".dash-card");
  const box = card.querySelector(".science-detail-box");
  const arrow = btn.querySelector(".arrow");
  if (box.style.display === "none") {
    box.style.display = "block";
    arrow.textContent = "▲";
    btn.classList.add("active");
  } else {
    box.style.display = "none";
    arrow.textContent = "▼";
    btn.classList.remove("active");
  }
};

// Render initial characters on page load
renderCharactersUI();
