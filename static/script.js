/* ══════════════════════════════════════════════════════════════════
   History Explorer — Frontend Logic
   ══════════════════════════════════════════════════════════════════ */

"use strict";

// ── State ─────────────────────────────────────────────────────────────────
const State = {
  currentCentury:    null,
  currentCountry:    null,
  currentKingIndex:  null,
  currentKing:       null,
  allKings:          [],       // kings for current selection
  filteredType:      "all",
  compareKingData:   null,
  searchTimer:       null,
};

// ── DOM Refs ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const DOM = {
  body:               document.body,
  themeToggle:        $("themeToggle"),
  themeIcon:          $("themeToggle").querySelector(".theme-icon"),

  centurySelect:      $("centurySelect"),
  countrySelect:      $("countrySelect"),
  kingSelect:         $("kingSelect"),

  filterChips:        $("filterChips"),

  searchInput:        $("searchInput"),
  searchClear:        $("searchClear"),
  searchDropdown:     $("searchDropdown"),

  compareSection:     $("compareSection"),
  compareSelect:      $("compareSelect"),
  btnCompare:         $("btnCompare"),

  // Content views
  welcomeState:       $("welcomeState"),
  kingsGridView:      $("kingsGridView"),
  kingsGrid:          $("kingsGrid"),
  gridTitle:          $("gridTitle"),
  gridCount:          $("gridCount"),
  kingDetail:         $("kingDetail"),
  compareView:        $("compareView"),
  searchResultsView:  $("searchResultsView"),
  searchResultsGrid:  $("searchResultsGrid"),
  searchResultCount:  $("searchResultCount"),
  loadingOverlay:     $("loadingOverlay"),
  errorState:         $("errorState"),
  errorMsg:           $("errorMsg"),
  btnRetry:           $("btnRetry"),
  backBtn:            $("backBtn"),
  compareBackBtn:     $("compareBackBtn"),

  // King detail fields
  kingImageWrap:      $("kingImageWrap"),
  kingImage:          $("kingImage"),
  kingImagePlaceholder: $("kingImagePlaceholder"),
  kingTypeBadge:      $("kingTypeBadge"),
  kingName:           $("kingName"),
  kingCountry:        $("kingCountry"),
  kingCentury:        $("kingCentury"),
  kingReign:          $("kingReign"),
  timelineFill:       $("timelineFill"),
  timelineStart:      $("timelineStart"),
  timelineEnd:        $("timelineEnd"),
  kingBio:            $("kingBio"),
  achievementsList:   $("achievementsList"),

  compareGrid:        $("compareGrid"),

  // Stats
  statCenturies:      $("statCenturies"),
  statKingdoms:       $("statKingdoms"),
  statRulers:         $("statRulers"),
};

// ── Helpers ───────────────────────────────────────────────────────────────
function showView(name) {
  const views = ["welcomeState","kingsGridView","kingDetail","compareView","searchResultsView","errorState"];
  views.forEach(v => DOM[v] && (DOM[v].style.display = "none"));
  if (name && DOM[name]) DOM[name].style.display = "";
}

function showLoading(on) {
  DOM.loadingOverlay.style.display = on ? "flex" : "none";
}

function showError(msg) {
  showView("errorState");
  DOM.errorMsg.textContent = msg || "Something went wrong. Please try again.";
}

async function api(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function typeClass(type) {
  return type ? `type-${type}` : "";
}

function typeLabel(type) {
  const map = {
    conqueror:    "⚔ Conqueror",
    peaceful:     "☮ Peaceful",
    military:     "🛡 Military",
    religious:    "✝ Religious",
    controversial:"⚡ Controversial",
  };
  return map[type] || type;
}

// ── Theme Toggle ──────────────────────────────────────────────────────────
let isDark = true;

DOM.themeToggle.addEventListener("click", () => {
  isDark = !isDark;
  DOM.body.classList.toggle("dark-mode",  isDark);
  DOM.body.classList.toggle("light-mode", !isDark);
  DOM.themeIcon.textContent = isDark ? "☀" : "☾";
});

// ── Initialise App ────────────────────────────────────────────────────────
async function init() {
  showLoading(true);
  try {
    const data = await api("/get_centuries");
    populateCenturies(data.centuries);
    await loadFilterTypes();
    await loadWelcomeStats();
    showView("welcomeState");
  } catch (e) {
    showError("Failed to load historical data. " + e.message);
  } finally {
    showLoading(false);
  }
}

// ── Welcome Stats ─────────────────────────────────────────────────────────
async function loadWelcomeStats() {
  try {
    const cenData = await api("/get_centuries");
    const centuries = cenData.centuries;
    let kingdoms = 0, rulers = 0;

    for (const c of centuries) {
      const cData = await api(`/get_countries/${c}`);
      kingdoms += cData.countries.length;
      for (const k of cData.countries) {
        const kData = await api(`/get_kings/${c}/${encodeURIComponent(k)}`);
        rulers += kData.kings.length;
      }
    }

    animateCount(DOM.statCenturies, centuries.length);
    animateCount(DOM.statKingdoms,  kingdoms);
    animateCount(DOM.statRulers,    rulers);
  } catch (_) {}
}

function animateCount(el, target) {
  let start = 0;
  const step = Math.ceil(target / 30);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) { el.textContent = target; clearInterval(timer); }
    else { el.textContent = start; }
  }, 40);
}

// ── Filter Types ──────────────────────────────────────────────────────────
async function loadFilterTypes() {
  try {
    const data = await api("/get_all_types");
    const chips = DOM.filterChips;
    data.types.forEach(type => {
      const btn = document.createElement("button");
      btn.className = `chip ${typeClass(type)}`;
      btn.dataset.type = type;
      btn.textContent = typeLabel(type);
      btn.addEventListener("click", () => setFilter(type));
      chips.appendChild(btn);
    });
  } catch (_) {}
}

function setFilter(type) {
  State.filteredType = type;
  DOM.filterChips.querySelectorAll(".chip").forEach(c => {
    c.classList.toggle("active", c.dataset.type === type);
  });
  if (State.allKings.length) renderKingsGrid(State.allKings);
}

// ── Century Select ────────────────────────────────────────────────────────
function populateCenturies(centuries) {
  DOM.centurySelect.innerHTML = `<option value="">— Choose a century —</option>`;
  centuries.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = `${c} Century`;
    DOM.centurySelect.appendChild(opt);
  });
  DOM.centurySelect.disabled = false;
}

DOM.centurySelect.addEventListener("change", async () => {
  const century = DOM.centurySelect.value;
  if (!century) return;
  State.currentCentury = century;
  State.currentCountry = null;
  State.currentKingIndex = null;

  resetSelect(DOM.countrySelect, "Loading empires…");
  resetSelect(DOM.kingSelect, "— Select an empire first —");
  DOM.compareSection.style.display = "none";
  showView("welcomeState");

  showLoading(true);
  try {
    const data = await api(`/get_countries/${century}`);
    populateCountries(data.countries);
  } catch (e) {
    showError(e.message);
  } finally {
    showLoading(false);
  }
});

// ── Country Select ────────────────────────────────────────────────────────
function populateCountries(countries) {
  DOM.countrySelect.innerHTML = `<option value="">— Choose an empire —</option>`;
  countries.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    DOM.countrySelect.appendChild(opt);
  });
  DOM.countrySelect.disabled = false;
}

DOM.countrySelect.addEventListener("change", async () => {
  const country = DOM.countrySelect.value;
  if (!country) return;
  State.currentCountry = country;
  State.currentKingIndex = null;

  resetSelect(DOM.kingSelect, "Loading rulers…");
  DOM.compareSection.style.display = "none";

  showLoading(true);
  try {
    const data = await api(`/get_kings/${State.currentCentury}/${encodeURIComponent(country)}`);
    State.allKings = data.kings;
    populateKingSelect(data.kings);
    renderKingsGrid(data.kings);
    showView("kingsGridView");
  } catch (e) {
    showError(e.message);
  } finally {
    showLoading(false);
  }
});

// ── King Select ───────────────────────────────────────────────────────────
function populateKingSelect(kings) {
  DOM.kingSelect.innerHTML = `<option value="">— Choose a ruler —</option>`;
  kings.forEach(k => {
    const opt = document.createElement("option");
    opt.value = k.index;
    opt.textContent = k.name;
    DOM.kingSelect.appendChild(opt);
  });
  DOM.kingSelect.disabled = false;
}

DOM.kingSelect.addEventListener("change", async () => {
  const idx = DOM.kingSelect.value;
  if (idx === "") return;
  await loadKingDetail(State.currentCentury, State.currentCountry, parseInt(idx));
});

// ── Kings Grid ────────────────────────────────────────────────────────────
function renderKingsGrid(kings) {
  const filtered = State.filteredType === "all"
    ? kings
    : kings.filter(k => k.type === State.filteredType);

  DOM.gridTitle.textContent = `${State.currentCountry} · ${State.currentCentury} Century`;
  DOM.gridCount.textContent = `${filtered.length} ruler${filtered.length !== 1 ? "s" : ""}`;
  DOM.kingsGrid.innerHTML = "";

  if (filtered.length === 0) {
    DOM.kingsGrid.innerHTML = `<p style="color:var(--text-muted);font-style:italic;padding:20px 0;">No rulers match this filter.</p>`;
    return;
  }

  filtered.forEach(king => {
    const card = document.createElement("div");
    card.className = "king-card";
    card.dataset.index = king.index;
    card.innerHTML = `
      <span class="card-badge ${typeClass(king.type)}">${typeLabel(king.type) || "Ruler"}</span>
      <div class="card-name">${king.name}</div>
      <div class="card-reign">${king.reign}</div>
      <span class="card-arrow">→</span>
    `;
    card.addEventListener("click", () => {
      DOM.kingSelect.value = king.index;
      loadKingDetail(State.currentCentury, State.currentCountry, king.index);
    });
    DOM.kingsGrid.appendChild(card);
  });
}

// ── King Detail ───────────────────────────────────────────────────────────
async function loadKingDetail(century, country, index) {
  showLoading(true);
  try {
    const data = await api(`/get_king_info/${century}/${encodeURIComponent(country)}/${index}`);
    const king = data.king;
    State.currentKing = king;
    State.currentKingIndex = index;
    renderKingDetail(king, century, country);
    populateCompareSelect(State.allKings, index);
    DOM.compareSection.style.display = "";
    showView("kingDetail");
  } catch (e) {
    showError(e.message);
  } finally {
    showLoading(false);
  }
}

function renderKingDetail(king, century, country) {
  // Image
  if (king.image) {
    DOM.kingImage.src = king.image;
    DOM.kingImage.alt = king.name;
    DOM.kingImage.onload = () => {
      DOM.kingImage.classList.add("loaded");
      DOM.kingImagePlaceholder.style.display = "none";
    };
    DOM.kingImage.onerror = () => {
      DOM.kingImage.classList.remove("loaded");
      DOM.kingImagePlaceholder.style.display = "";
    };
    DOM.kingImage.classList.remove("loaded");
    DOM.kingImagePlaceholder.style.display = "";
  } else {
    DOM.kingImage.classList.remove("loaded");
    DOM.kingImagePlaceholder.style.display = "";
  }

  // Type badge
  DOM.kingTypeBadge.className = `king-type-badge ${typeClass(king.type)}`;
  DOM.kingTypeBadge.textContent = typeLabel(king.type) || "";

  // Meta
  DOM.kingName.textContent   = king.name;
  DOM.kingCountry.textContent = country;
  DOM.kingCentury.textContent = `${century} Century`;
  DOM.kingReign.textContent   = king.reign;

  // Timeline
  renderTimeline(king.reign);

  // Bio
  DOM.kingBio.textContent = king.info;

  // Achievements
  DOM.achievementsList.innerHTML = "";
  (king.achievements || []).forEach((a, i) => {
    const li = document.createElement("li");
    li.textContent = a;
    li.style.animationDelay = `${0.1 + i * 0.08}s`;
    DOM.achievementsList.appendChild(li);
  });
}

function renderTimeline(reignStr) {
  // Parse years from reign string like "1556 AD – 1605 AD" or "27 BC – 14 AD"
  const nums = reignStr.match(/-?\d+/g);
  if (!nums || nums.length < 2) {
    DOM.timelineFill.style.width = "60%";
    DOM.timelineStart.textContent = reignStr.split("–")[0]?.trim() || "";
    DOM.timelineEnd.textContent   = reignStr.split("–")[1]?.trim() || "";
    return;
  }

  // Handle BC years (negative) — we need to check context
  let start = parseInt(nums[0]);
  let end   = parseInt(nums[1]);

  // Check if BC is mentioned
  const isBCStart = reignStr.includes("BC") && reignStr.indexOf("BC") < reignStr.indexOf("–");
  const isBCEnd   = reignStr.split("–")[1]?.includes("BC");

  if (isBCStart) start = -Math.abs(start);
  if (isBCEnd)   end   = -Math.abs(end);

  const duration = Math.abs(end - start);
  const pct = Math.min(100, Math.max(5, duration * 1.5));

  DOM.timelineFill.style.width = `${pct}%`;
  DOM.timelineStart.textContent = reignStr.split(/[–—-]/)[0]?.trim() || "";
  DOM.timelineEnd.textContent   = reignStr.split(/[–—-]/).slice(-1)[0]?.trim() || "";
}

// ── Back Buttons ──────────────────────────────────────────────────────────
DOM.backBtn.addEventListener("click", () => {
  showView("kingsGridView");
  DOM.kingSelect.value = "";
  DOM.compareSection.style.display = "none";
});

DOM.compareBackBtn.addEventListener("click", () => {
  if (State.currentKing) showView("kingDetail");
  else showView("kingsGridView");
});

// ── Compare ───────────────────────────────────────────────────────────────
function populateCompareSelect(kings, currentIndex) {
  DOM.compareSelect.innerHTML = `<option value="">— Select to compare —</option>`;
  kings.forEach(k => {
    if (k.index === currentIndex) return;
    const opt = document.createElement("option");
    opt.value = k.index;
    opt.textContent = k.name;
    DOM.compareSelect.appendChild(opt);
  });
}

DOM.btnCompare.addEventListener("click", async () => {
  const idx = parseInt(DOM.compareSelect.value);
  if (isNaN(idx)) return;

  showLoading(true);
  try {
    const data = await api(`/get_king_info/${State.currentCentury}/${encodeURIComponent(State.currentCountry)}/${idx}`);
    State.compareKingData = data.king;
    renderCompare(State.currentKing, data.king);
    showView("compareView");
  } catch (e) {
    showError(e.message);
  } finally {
    showLoading(false);
  }
});

function renderCompare(king1, king2) {
  DOM.compareGrid.innerHTML = `
    ${compareCard(king1)}
    <div class="compare-vs">VS</div>
    ${compareCard(king2)}
  `;
}

function compareCard(king) {
  const achievements = (king.achievements || []).slice(0, 4).map(a => `<li>${a}</li>`).join("");
  return `
    <div class="compare-card">
      <div class="king-type-badge ${typeClass(king.type)}" style="display:inline-block;margin-bottom:8px;">${typeLabel(king.type) || "Ruler"}</div>
      <div class="compare-card-name">${king.name}</div>
      <div class="compare-card-reign">${king.reign}</div>
      <div class="compare-row">
        <div class="compare-row-label">Biography</div>
        <div class="compare-row-val" style="font-style:italic;font-size:14px;color:var(--text-dim);">${king.info.slice(0, 160)}…</div>
      </div>
      <div class="compare-row">
        <div class="compare-row-label">Key Achievements</div>
        <ul style="list-style:none;margin-top:6px;display:flex;flex-direction:column;gap:4px;">
          ${achievements}
        </ul>
      </div>
    </div>
  `;
}

// ── Search ────────────────────────────────────────────────────────────────
DOM.searchInput.addEventListener("input", () => {
  const q = DOM.searchInput.value.trim();
  DOM.searchClear.classList.toggle("visible", q.length > 0);

  clearTimeout(State.searchTimer);
  if (q.length < 2) {
    hideSearchDropdown();
    return;
  }

  State.searchTimer = setTimeout(() => fetchSearchDropdown(q), 300);
});

DOM.searchInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const q = DOM.searchInput.value.trim();
    if (q.length >= 2) {
      hideSearchDropdown();
      fetchFullSearch(q);
    }
  }
  if (e.key === "Escape") {
    hideSearchDropdown();
  }
});

DOM.searchClear.addEventListener("click", () => {
  DOM.searchInput.value = "";
  DOM.searchClear.classList.remove("visible");
  hideSearchDropdown();
  if (State.currentCountry) showView("kingsGridView");
  else showView("welcomeState");
});

document.addEventListener("click", e => {
  if (!e.target.closest(".search-section")) hideSearchDropdown();
});

function hideSearchDropdown() {
  DOM.searchDropdown.classList.remove("visible");
  DOM.searchDropdown.innerHTML = "";
}

async function fetchSearchDropdown(q) {
  try {
    const data = await api(`/search?q=${encodeURIComponent(q)}`);
    const results = data.results.slice(0, 5);

    if (!results.length) {
      DOM.searchDropdown.innerHTML = `<div class="search-result-item"><div class="sri-meta">No rulers found for "${q}"</div></div>`;
    } else {
      DOM.searchDropdown.innerHTML = results.map(r => `
        <div class="search-result-item"
             data-century="${r.century}"
             data-country="${encodeURIComponent(r.country)}"
             data-index="${r.king_index}">
          <div>
            <div class="sri-name">${highlight(r.name, q)}</div>
            <div class="sri-meta">${r.country} · ${r.century} century · ${r.reign}</div>
          </div>
        </div>
      `).join("");

      DOM.searchDropdown.querySelectorAll(".search-result-item[data-century]").forEach(item => {
        item.addEventListener("click", () => {
          const {century, country, index} = item.dataset;
          DOM.searchInput.value = "";
          DOM.searchClear.classList.remove("visible");
          hideSearchDropdown();
          navigateToKing(century, decodeURIComponent(country), parseInt(index));
        });
      });
    }

    DOM.searchDropdown.classList.add("visible");
  } catch (_) {}
}

async function fetchFullSearch(q) {
  showLoading(true);
  try {
    const data = await api(`/search?q=${encodeURIComponent(q)}`);
    renderSearchResults(data.results, q);
    showView("searchResultsView");
  } catch (e) {
    showError(e.message);
  } finally {
    showLoading(false);
  }
}

function renderSearchResults(results, query) {
  DOM.searchResultCount.textContent = `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`;
  DOM.searchResultsGrid.innerHTML = "";

  if (!results.length) {
    DOM.searchResultsGrid.innerHTML = `<p style="color:var(--text-muted);font-style:italic;padding:20px 0;">No rulers found matching "${query}".</p>`;
    return;
  }

  results.forEach(r => {
    const card = document.createElement("div");
    card.className = "king-card";
    card.innerHTML = `
      <span class="card-badge ${typeClass(r.type)}">${typeLabel(r.type) || "Ruler"}</span>
      <div class="card-name">${highlight(r.name, query)}</div>
      <div class="card-reign">${r.country} · ${r.century} century</div>
      <div class="card-reign" style="margin-top:4px;">${r.reign}</div>
      <span class="card-arrow">→</span>
    `;
    card.addEventListener("click", () => {
      navigateToKing(r.century, r.country, r.king_index);
    });
    DOM.searchResultsGrid.appendChild(card);
  });
}

function highlight(text, query) {
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, "gi");
  return text.replace(re, `<mark style="background:rgba(201,146,42,0.35);color:inherit;border-radius:2px;">$1</mark>`);
}

async function navigateToKing(century, country, index) {
  State.currentCentury = century;
  State.currentCountry = country;

  // Sync selectors
  DOM.centurySelect.value = century;

  showLoading(true);
  try {
    const cData = await api(`/get_countries/${century}`);
    populateCountries(cData.countries);
    DOM.countrySelect.value = country;

    const kData = await api(`/get_kings/${century}/${encodeURIComponent(country)}`);
    State.allKings = kData.kings;
    populateKingSelect(kData.kings);
    DOM.kingSelect.value = index;

    await loadKingDetail(century, country, index);
  } catch (e) {
    showError(e.message);
  } finally {
    showLoading(false);
  }
}

// ── Retry ─────────────────────────────────────────────────────────────────
DOM.btnRetry.addEventListener("click", () => {
  showView("welcomeState");
  init();
});

// ── Helpers ───────────────────────────────────────────────────────────────
function resetSelect(select, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>`;
  select.disabled = true;
}

// ── Start ─────────────────────────────────────────────────────────────────
init();
