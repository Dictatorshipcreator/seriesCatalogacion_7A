"use strict";

const STORAGE_KEY = "plano-series-catalog.v1";
const root = document.querySelector("#view-root");
const modalBackdrop = document.querySelector("#modal-backdrop");
const modalFields = document.querySelector("#modal-fields");
const recordForm = document.querySelector("#record-form");
const errorNotice = document.querySelector("#error-notice");
const toast = document.querySelector("#toast");
const viewTitles = { overview: "Resumen", series: "Mis series", platforms: "Plataformas", ratings: "Valoraciones" };
let currentView = "overview";
let searchQuery = "";
let modalRecord = null;
let toastTimer;
let state;
let storageUnavailable = false;

const icons = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></svg>',
  series: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="m8 4.5 4 15m1-15 4 15"/></svg>',
  platform: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8m-4-4v4"/></svg>',
  rating: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>',
};

function emptyState() {
  return { platforms: [], series: [], ratings: [] };
}

function validState(value) {
  return value && Array.isArray(value.platforms) && Array.isArray(value.series) && Array.isArray(value.ratings)
    && value.platforms.every((item) => item && typeof item.id === "string" && typeof item.name === "string")
    && value.series.every((item) => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.platformId === "string")
    && value.ratings.every((item) => item && typeof item.id === "string" && typeof item.platformId === "string" && typeof item.seriesId === "string" && Number.isInteger(item.score) && item.score >= 1 && item.score <= 10 && typeof item.observation === "string");
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return emptyState();
    const parsed = JSON.parse(stored);
    if (!validState(parsed)) throw new Error("El formato de los datos guardados no es válido.");
    return parsed;
  } catch (error) {
    storageUnavailable = true;
    errorNotice.hidden = false;
    errorNotice.textContent = `No se pudieron leer los datos guardados: ${error.message} No se modificará tu colección hasta recuperar el acceso a este almacenamiento.`;
    return emptyState();
  }
}

function commit(nextState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch (error) {
    showError(`No se pudieron guardar los cambios: ${error.message}`);
    return false;
  }
  state = nextState;
  storageUnavailable = false;
  errorNotice.hidden = true;
  render();
  return true;
}

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function escapeAttribute(value) {
  return escapeHTML(value).replace(/`/g, "&#96;");
}

function getPlatform(id) { return state.platforms.find((platform) => platform.id === id); }
function getSeries(id) { return state.series.find((item) => item.id === id); }
function getPlatformName(id) { return getPlatform(id)?.name ?? "Plataforma no disponible"; }
function getSeriesName(id) { return getSeries(id)?.name ?? "Serie no disponible"; }
function seriesForPlatform(id) { return state.series.filter((item) => item.platformId === id); }
function ratingsForSeries(id) { return state.ratings.filter((item) => item.seriesId === id); }
function averageScore(items) { return items.length ? (items.reduce((sum, item) => sum + item.score, 0) / items.length).toFixed(1) : "—"; }
function initials(name) { return escapeHTML(name.trim().slice(0, 1).toUpperCase()); }
function visibleItems(items) {
  const query = searchQuery.trim().toLocaleLowerCase("es");
  return query ? items.filter((item) => item.searchText.toLocaleLowerCase("es").includes(query)) : items;
}
function actionButton(action, id, label, icon) {
  return `<button class="icon-button ${action === "delete" ? "delete" : ""}" type="button" data-action="${action}" data-id="${escapeAttribute(id)}" aria-label="${label}" title="${label}">${icon}</button>`;
}
function editIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round"><path d="m14 5 5 5M4 20l4-.8L19 8l-3-3L5 16l-1 4Z"/></svg>'; }
function deleteIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>'; }
function scoreBadge(score) { return `<span class="rating-badge">${icons.rating}${score}<span style="color:#909b80;font-weight:400">/10</span></span>`; }
function actions(id) { return `<div class="row-actions">${actionButton("edit", id, "Editar", editIcon())}${actionButton("delete", id, "Eliminar", deleteIcon())}</div>`; }
function pageHeading(eyebrow, title, description, buttonLabel, buttonAction) {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div><button class="button button-primary" type="button" data-action="${buttonAction}">${icons.plus}${buttonLabel}</button></div>`;
}
function emptyPanel(icon, title, description, action, label) {
  return `<div class="empty-state"><span class="empty-icon">${icons[icon]}</span><h3>${title}</h3><p>${description}</p>${action ? `<button class="button button-accent" type="button" data-action="${action}">${icons.plus}${label}</button>` : ""}</div>`;
}
function getSearchField(placeholder) {
  return `<label class="search-box">${icons.search}<input type="search" id="search-input" placeholder="${placeholder}" value="${escapeAttribute(searchQuery)}" autocomplete="off" /></label>`;
}

function renderOverview() {
  const recent = [...state.ratings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const platformList = state.platforms.slice(0, 5);
  return `
    <div class="page-heading"><div><div class="eyebrow">TU ARCHIVO PERSONAL</div><h1>Tu mundo, <span style="color:#83ad4e">episodio a episodio.</span></h1><p>Un rincón para llevar el hilo de todo lo que estás viendo.</p></div><button class="button button-primary" type="button" data-action="create-series">${icons.plus}Añadir serie</button></div>
    <section class="welcome-banner" aria-label="Resumen de tu colección">
      <div class="welcome-copy"><div class="eyebrow">QUÉ BUENO VERTE POR AQUÍ</div><h2>Todo lo que ves,<br />en un mismo lugar.</h2><p>Organiza tus series favoritas y guarda lo que te hicieron sentir.</p><button class="button button-accent" type="button" data-action="create-rating">${icons.plus}Dejar una valoración</button></div>
      <div class="welcome-graphic" aria-hidden="true"><span class="graphic-orb"></span></div>
      <div class="welcome-stats"><div class="welcome-stat"><strong>${state.series.length}</strong><span>Series</span></div><div class="welcome-stat"><strong>${state.platforms.length}</strong><span>Plataformas</span></div><div class="welcome-stat"><strong>${state.ratings.length}</strong><span>Opiniones</span></div><div class="welcome-stat"><strong>${averageScore(state.ratings)}</strong><span>Tu promedio</span></div></div>
    </section>
    <div class="section-heading"><h2>Tu colección, de un vistazo</h2><button class="text-button" type="button" data-view="series">Ver todas las series →</button></div>
    <div class="overview-grid">
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Valoraciones recientes</h2><p class="panel-subtitle">Tus últimas impresiones</p></div><button class="text-button" type="button" data-view="ratings">Ver todas →</button></div>
        ${recent.length ? `<div class="recent-list">${recent.map((item, index) => `<div class="recent-item"><span class="poster-mini" style="background:${["linear-gradient(145deg,#d9ba95,#946341)","linear-gradient(145deg,#aebfd0,#536c80)","linear-gradient(145deg,#c7aecc,#735779)","linear-gradient(145deg,#c5cf9f,#70814b)"][index]}">${initials(getSeriesName(item.seriesId))}</span><div class="recent-meta"><strong>${escapeHTML(getSeriesName(item.seriesId))}</strong><small>${escapeHTML(getPlatformName(item.platformId))} · ${escapeHTML(item.observation || "Sin observación")}</small></div><div class="recent-score">${item.score}<span> / 10</span></div></div>`).join("")}</div>` : `<div class="empty-small">Todavía no tienes valoraciones. ¡Sé el primero en dejar una!</div>`}
      </section>
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Tus plataformas</h2><p class="panel-subtitle">Dónde están tus historias</p></div><button class="text-button" type="button" data-view="platforms">Ver →</button></div>
        ${platformList.length ? `<div class="platform-chips">${platformList.map((platform, index) => `<div class="platform-chip"><span class="platform-dot color-${index % 4}"></span><strong>${escapeHTML(platform.name)}</strong><small>${seriesForPlatform(platform.id).length} series</small></div>`).join("")}</div>` : `<div class="empty-small">Añade una plataforma para empezar a ordenar tu colección.</div>`}
      </section>
    </div>`;
}

function renderSeries() {
  const records = visibleItems(state.series.map((item) => ({ ...item, searchText: `${item.name} ${getPlatformName(item.platformId)}` })));
  const body = records.length ? records.map((item) => `<tr><td class="table-primary">${escapeHTML(item.name)}</td><td>${escapeHTML(getPlatformName(item.platformId))}</td><td>${ratingsForSeries(item.id).length}</td><td>${actions(item.id)}</td></tr>`).join("") : "";
  const cards = records.map((item) => `<article class="mobile-record-card"><span class="poster-mini">${initials(item.name)}</span><div class="mobile-card-copy"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(getPlatformName(item.platformId))} · ${ratingsForSeries(item.id).length} valoraciones</small></div><div class="mobile-card-actions">${actionButton("edit", item.id, "Editar", editIcon())}${actionButton("delete", item.id, "Eliminar", deleteIcon())}</div></article>`).join("");
  return `${pageHeading("TU CATÁLOGO", "Mis series", "Cada historia que empezaste, terminaste o quieres recordar.", "Añadir serie", "create-series")}
    <div class="toolbar">${getSearchField("Buscar por serie o plataforma...")}<span class="toolbar-note">${records.length} ${records.length === 1 ? "serie" : "series"}</span></div>
    <section class="panel">${records.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Nombre de la serie</th><th>Plataforma</th><th>Valoraciones</th><th style="text-align:right">Acciones</th></tr></thead><tbody>${body}</tbody></table></div><div class="mobile-card-list">${cards}</div>` : emptyPanel("series", searchQuery ? "No encontramos esa serie" : "Tu archivo está esperando su primera serie", searchQuery ? "Prueba con otro nombre o plataforma." : "Agrega una serie y vincúlala con una de tus plataformas favoritas.", searchQuery ? "" : "create-series", searchQuery ? "" : "Agregar primera serie")}</section>`;
}

function renderPlatforms() {
  const records = visibleItems(state.platforms.map((item) => ({ ...item, searchText: item.name })));
  const rows = records.map((item) => {
    const series = seriesForPlatform(item.id);
    const platformRatings = state.ratings.filter((rating) => rating.platformId === item.id);
    return `<tr><td><span class="platform-summary"><span class="platform-square">${initials(item.name)}</span><span class="table-primary">${escapeHTML(item.name)}</span></span></td><td>${series.length}</td><td>${platformRatings.length}</td><td class="score-average">${averageScore(platformRatings)}${platformRatings.length ? " / 10" : ""}</td><td>${actions(item.id)}</td></tr>`;
  }).join("");
  const cards = records.map((item) => `<article class="mobile-record-card"><span class="platform-square">${initials(item.name)}</span><div class="mobile-card-copy"><strong>${escapeHTML(item.name)}</strong><small>${seriesForPlatform(item.id).length} series · ${state.ratings.filter((rating) => rating.platformId === item.id).length} valoraciones</small></div><div class="mobile-card-actions">${actionButton("edit", item.id, "Editar", editIcon())}${actionButton("delete", item.id, "Eliminar", deleteIcon())}</div></article>`).join("");
  return `${pageHeading("DÓNDE VERLAS", "Plataformas", "Tus servicios de streaming, todos en el mismo lugar.", "Añadir plataforma", "create-platform")}
    <div class="toolbar">${getSearchField("Buscar plataforma...")}<span class="toolbar-note">${records.length} ${records.length === 1 ? "plataforma" : "plataformas"}</span></div>
    <section class="panel">${records.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Plataforma</th><th>Series</th><th>Valoraciones</th><th>Promedio</th><th style="text-align:right">Acciones</th></tr></thead><tbody>${rows}</tbody></table></div><div class="mobile-card-list">${cards}</div>` : emptyPanel("platform", searchQuery ? "No encontramos esa plataforma" : "Agrega tus plataformas favoritas", searchQuery ? "Prueba con otro nombre." : "Crea una plataforma para poder agregar series a tu colección.", searchQuery ? "" : "create-platform", searchQuery ? "" : "Agregar primera plataforma")}</section>`;
}

function renderRatings() {
  const records = visibleItems(state.ratings.map((item) => ({ ...item, searchText: `${getSeriesName(item.seriesId)} ${getPlatformName(item.platformId)} ${item.observation}` })));
  const rows = records.map((item) => `<tr><td class="table-primary">${escapeHTML(getSeriesName(item.seriesId))}</td><td>${escapeHTML(getPlatformName(item.platformId))}</td><td>${scoreBadge(item.score)}</td><td class="observation-cell" title="${escapeAttribute(item.observation)}">${escapeHTML(item.observation || "—")}</td><td>${actions(item.id)}</td></tr>`).join("");
  const cards = records.map((item) => `<article class="mobile-record-card"><span class="poster-mini">${initials(getSeriesName(item.seriesId))}</span><div class="mobile-card-copy"><strong>${escapeHTML(getSeriesName(item.seriesId))}</strong><small>${escapeHTML(getPlatformName(item.platformId))} · ${item.score} / 10</small><span class="mobile-card-observation">${escapeHTML(item.observation || "Sin observación")}</span></div><div class="mobile-card-actions">${actionButton("edit", item.id, "Editar", editIcon())}${actionButton("delete", item.id, "Eliminar", deleteIcon())}</div></article>`).join("");
  return `${pageHeading("LO QUE TE DEJÓ", "Valoraciones", "Tus notas, opiniones y recuerdos de cada serie.", "Nueva valoración", "create-rating")}
    <div class="toolbar">${getSearchField("Buscar serie, plataforma u opinión...")}<span class="toolbar-note">${records.length} ${records.length === 1 ? "valoración" : "valoraciones"}</span></div>
    <section class="panel">${records.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Serie</th><th>Plataforma</th><th>Puntaje</th><th>Observación</th><th style="text-align:right">Acciones</th></tr></thead><tbody>${rows}</tbody></table></div><div class="mobile-card-list">${cards}</div>` : emptyPanel("rating", searchQuery ? "No encontramos esa valoración" : "Las historias merecen una opinión", searchQuery ? "Prueba con otra búsqueda." : "Guarda lo que pensaste de una serie y añade una nota que quieras recordar.", searchQuery ? "" : "create-rating", searchQuery ? "" : "Dejar primera valoración")}</section>`;
}

function render() {
  if (storageUnavailable) return;
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === currentView));
  document.querySelector("#breadcrumb-current").textContent = viewTitles[currentView];
  document.querySelector("#nav-series-count").textContent = state.series.length;
  document.querySelector("#nav-platforms-count").textContent = state.platforms.length;
  document.querySelector("#nav-ratings-count").textContent = state.ratings.length;
  root.innerHTML = currentView === "overview" ? renderOverview()
    : currentView === "series" ? renderSeries()
      : currentView === "platforms" ? renderPlatforms() : renderRatings();
}

function setView(view) {
  if (!viewTitles[view]) return;
  currentView = view;
  searchQuery = "";
  document.querySelector("#sidebar").classList.remove("open");
  render();
}

function field(name, label, control, hint = "") {
  return `<div class="form-field"><label for="${name}">${label}</label>${control}${hint ? `<p class="field-hint">${hint}</p>` : ""}</div>`;
}

function openModal(type, record = null) {
  if (storageUnavailable) return;
  modalRecord = { type, id: record?.id ?? null };
  const editing = Boolean(record);
  const title = `${editing ? "Editar" : "Nueva"} ${type === "series" ? "serie" : type === "platform" ? "plataforma" : "valoración"}`;
  document.querySelector("#modal-title").textContent = title;
  document.querySelector("#modal-kicker").textContent = type === "series" ? "TU CATÁLOGO" : type === "platform" ? "TUS SERVICIOS" : "TU OPINIÓN";
  document.querySelector("#modal-submit").textContent = editing ? "Guardar cambios" : "Guardar";
  const error = `<p class="form-error" id="form-error" role="alert"></p>`;

  if (type === "platform") {
    modalFields.innerHTML = `${error}${field("platform-name", "Nombre de la plataforma", `<input id="platform-name" name="name" type="text" maxlength="60" placeholder="Ej. Netflix" value="${escapeAttribute(record?.name ?? "")}" required autocomplete="off" />`, "Hasta 60 caracteres. El nombre debe ser único.")}`;
  } else if (type === "series") {
    const options = state.platforms.map((item) => `<option value="${escapeAttribute(item.id)}" ${item.id === record?.platformId ? "selected" : ""}>${escapeHTML(item.name)}</option>`).join("");
    modalFields.innerHTML = `${error}${field("series-name", "Nombre de la serie", `<input id="series-name" name="name" type="text" maxlength="100" placeholder="Ej. El problema de los 3 cuerpos" value="${escapeAttribute(record?.name ?? "")}" required autocomplete="off" />`)}${field("series-platform", "Plataforma", `<select id="series-platform" name="platformId" required><option value="">Elige una plataforma</option>${options}</select>`, "La serie siempre pertenecerá a una plataforma.")}`;
  } else {
    const platformOptions = state.platforms.map((item) => `<option value="${escapeAttribute(item.id)}" ${item.id === record?.platformId ? "selected" : ""}>${escapeHTML(item.name)}</option>`).join("");
    const availableSeries = state.series.filter((item) => item.platformId === (record?.platformId ?? ""));
    const seriesOptions = availableSeries.map((item) => `<option value="${escapeAttribute(item.id)}" ${item.id === record?.seriesId ? "selected" : ""}>${escapeHTML(item.name)}</option>`).join("");
    const disabled = !record?.platformId;
    modalFields.innerHTML = `${error}${field("rating-platform", "Plataforma", `<select id="rating-platform" name="platformId" required><option value="">Elige una plataforma</option>${platformOptions}</select>`)}${field("rating-series", "Serie", `<select id="rating-series" name="seriesId" required ${disabled ? "disabled" : ""}><option value="">${disabled ? "Elige primero una plataforma" : "Elige una serie"}</option>${seriesOptions}</select>`)}${field("rating-score", "Puntaje", `<div class="rating-input-row"><select id="rating-score" name="score" required>${Array.from({ length: 10 }, (_, index) => 10 - index).map((score) => `<option value="${score}" ${score === (record?.score ?? 8) ? "selected" : ""}>${score} / 10</option>`).join("")}</select><span class="rating-scale">1 = no me gustó · 10 = me encantó</span></div>`)}${field("rating-observation", "Observación", `<textarea id="rating-observation" name="observation" maxlength="1000" placeholder="¿Qué te pareció? ¿Qué quieres recordar?">${escapeHTML(record?.observation ?? "")}</textarea>`, "Opcional · hasta 1.000 caracteres")}`;
  }

  modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  modalFields.querySelector("input, select, textarea")?.focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = "";
  modalRecord = null;
  recordForm.reset();
}

function showError(message) {
  errorNotice.hidden = false;
  errorNotice.textContent = message;
  errorNotice.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showFormError(message) {
  const error = document.querySelector("#form-error");
  error.textContent = message;
  error.classList.add("visible");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

function removeRecord(type, id) {
  const record = type === "series" ? getSeries(id) : type === "platform" ? getPlatform(id) : state.ratings.find((item) => item.id === id);
  if (!record) return;
  if (type === "platform") {
    const associated = seriesForPlatform(id).length;
    if (associated) {
      showError(`No puedes eliminar «${record.name}» porque tiene ${associated} ${associated === 1 ? "serie asociada" : "series asociadas"}. Elimina primero esas series.`);
      return;
    }
  }
  if (type === "series") {
    const associated = ratingsForSeries(id).length;
    if (associated) {
      showError(`No puedes eliminar «${record.name}» porque tiene ${associated} ${associated === 1 ? "valoración asociada" : "valoraciones asociadas"}. Elimina primero esas valoraciones.`);
      return;
    }
  }
  const label = type === "series" ? "la serie" : type === "platform" ? "la plataforma" : "la valoración";
  if (!window.confirm(`¿Seguro que quieres eliminar ${label} «${type === "rating" ? getSeriesName(record.seriesId) : record.name}»? Esta acción no se puede deshacer.`)) return;
  const next = {
    platforms: type === "platform" ? state.platforms.filter((item) => item.id !== id) : state.platforms,
    series: type === "series" ? state.series.filter((item) => item.id !== id) : state.series,
    ratings: type === "rating" ? state.ratings.filter((item) => item.id !== id) : state.ratings,
  };
  if (commit(next)) showToast(`${type === "series" ? "Serie" : type === "platform" ? "Plataforma" : "Valoración"} eliminada.`);
}

function normalizedName(value) { return value.trim().replace(/\s+/g, " "); }

recordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!modalRecord) return;
  const data = new FormData(recordForm);
  const type = modalRecord.type;
  const id = modalRecord.id;
  let next;

  if (type === "platform") {
    const name = normalizedName(data.get("name"));
    if (!name) return showFormError("Escribe un nombre para la plataforma.");
    if (state.platforms.some((item) => item.id !== id && item.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) return showFormError("Ya existe una plataforma con ese nombre.");
    const platform = id ? { ...getPlatform(id), name } : { id: newId(), name };
    next = { ...state, platforms: id ? state.platforms.map((item) => item.id === id ? platform : item) : [...state.platforms, platform] };
  } else if (type === "series") {
    const name = normalizedName(data.get("name"));
    const platformId = String(data.get("platformId") ?? "");
    if (!name) return showFormError("Escribe un nombre para la serie.");
    if (!getPlatform(platformId)) return showFormError("Selecciona una plataforma válida.");
    if (state.series.some((item) => item.id !== id && item.platformId === platformId && item.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) return showFormError("Ya existe una serie con ese nombre en esta plataforma.");
    const series = id ? { ...getSeries(id), name, platformId } : { id: newId(), name, platformId };
    next = {
      ...state,
      series: id ? state.series.map((item) => item.id === id ? series : item) : [...state.series, series],
      ratings: id ? state.ratings.map((item) => item.seriesId === id ? { ...item, platformId } : item) : state.ratings,
    };
  } else {
    const platformId = String(data.get("platformId") ?? "");
    const seriesId = String(data.get("seriesId") ?? "");
    const series = getSeries(seriesId);
    const score = Number(data.get("score"));
    const observation = String(data.get("observation") ?? "").trim();
    if (!getPlatform(platformId) || !series || series.platformId !== platformId) return showFormError("Selecciona una serie que pertenezca a la plataforma elegida.");
    if (!Number.isInteger(score) || score < 1 || score > 10) return showFormError("El puntaje debe ser un número entero entre 1 y 10.");
    const rating = id
      ? { ...state.ratings.find((item) => item.id === id), platformId, seriesId, score, observation }
      : { id: newId(), platformId, seriesId, score, observation, createdAt: new Date().toISOString() };
    next = { ...state, ratings: id ? state.ratings.map((item) => item.id === id ? rating : item) : [...state.ratings, rating] };
  }

  if (commit(next)) {
    const created = !id;
    const label = type === "series" ? "serie" : type === "platform" ? "plataforma" : "valoración";
    closeModal();
    showToast(`${label[0].toUpperCase()}${label.slice(1)} ${created ? "agregada" : "actualizada"}.`);
  }
});

document.addEventListener("click", (event) => {
  const viewControl = event.target.closest("[data-view]");
  if (viewControl) {
    setView(viewControl.dataset.view);
    return;
  }
  const actionControl = event.target.closest("[data-action]");
  if (!actionControl) return;
  const { action, id } = actionControl.dataset;
  if (action === "create-series") {
    if (!state.platforms.length) return showError("Primero agrega una plataforma antes de crear una serie.");
    openModal("series");
  } else if (action === "create-platform") openModal("platform");
  else if (action === "create-rating") {
    if (!state.platforms.length) return showError("Primero agrega una plataforma para poder valorar una serie.");
    if (!state.series.length) return showError("Primero agrega una serie para poder dejar una valoración.");
    openModal("rating");
  } else if (action === "edit") {
    const item = currentView === "series" ? getSeries(id) : currentView === "platforms" ? getPlatform(id) : state.ratings.find((rating) => rating.id === id);
    if (item) openModal(currentView === "series" ? "series" : currentView === "platforms" ? "platform" : "rating", item);
  } else if (action === "delete") {
    removeRecord(currentView === "series" ? "series" : currentView === "platforms" ? "platform" : "rating", id);
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "search-input") {
    const position = event.target.selectionStart;
    searchQuery = event.target.value;
    render();
    const replacement = document.querySelector("#search-input");
    replacement.focus();
    replacement.setSelectionRange(position, position);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.id === "rating-platform") {
    const platformId = event.target.value;
    const seriesSelect = document.querySelector("#rating-series");
    const series = seriesForPlatform(platformId);
    seriesSelect.disabled = !platformId;
    seriesSelect.innerHTML = `<option value="">${platformId ? "Elige una serie" : "Elige primero una plataforma"}</option>${series.map((item) => `<option value="${escapeAttribute(item.id)}">${escapeHTML(item.name)}</option>`).join("")}`;
  }
});

document.querySelector("#modal-close").addEventListener("click", closeModal);
document.querySelector("#modal-cancel").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (event) => { if (event.target === modalBackdrop) closeModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !modalBackdrop.hidden) closeModal(); });
document.querySelector("#menu-button").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));

state = loadState();
render();
