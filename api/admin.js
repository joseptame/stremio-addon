const { parseMagnet } = require("../lib/magnet");
const { fetchCinemetaMeta } = require("../lib/cinemeta");
const { triggerRealDebridCache } = require("../lib/realdebrid");
const { IMDB_STREAMS } = require("../lib/data");
const { isAuthenticated } = require("../lib/adminAuth");

const OWNER = "joseptame";
const REPO = "stremio-addon";
const BRANCH = "master";
const FILE_PATH = "lib/imdb-streams.json";

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

// ── Estilos compartidos entre el listado y la página de añadir ────────
function baseStyles() {
    return `
  :root {
    --bg: #14121f;
    --panel: #1d1a2b;
    --panel-border: #2c2840;
    --text: #eae7f5;
    --text-dim: #9691ad;
    --accent: #7b5bf0;
    --accent-hover: #6a4adf;
    --ok-bg: #17301f;
    --ok-text: #7ee2a0;
    --err-bg: #331b22;
    --err-text: #f28ba0;
    --danger: #e14f6a;
    --danger-hover: #c73f58;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    margin: 0;
    padding: 32px 16px 64px;
  }
  .wrap { max-width: 1200px; margin: 0 auto; }
  .wrap.narrow { max-width: 620px; }
  .back-link { color: var(--text-dim); text-decoration: none; font-size: 0.85rem; }
  .back-link:hover { color: var(--text); }
  header { margin-bottom: 24px; }
  .header-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 10px; flex-wrap: wrap; }
  .header-left { display: flex; align-items: center; gap: 12px; }
  header img { width: 40px; height: 40px; border-radius: 8px; }
  header h1 { font-size: 1.3rem; margin: 0; }
  header p { margin: 2px 0 0; color: var(--text-dim); font-size: 0.85rem; }
  .card {
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
  }
  .card h2 { margin: 0 0 4px; font-size: 1.05rem; }
  .card > p.desc { margin: 0 0 16px; color: var(--text-dim); font-size: 0.85rem; }
  label { display: block; margin-top: 14px; font-weight: 600; font-size: 0.9rem; }
  input {
    width: 100%;
    padding: 10px 12px;
    margin-top: 6px;
    box-sizing: border-box;
    font-size: 0.95rem;
    background: #100e1a;
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    color: var(--text);
  }
  input:focus { outline: none; border-color: var(--accent); }
  input::placeholder { color: #5c5875; }
  input:read-only { opacity: 0.65; cursor: default; }
  .hint-field { color: var(--text-dim); font-size: 0.78rem; margin-top: 4px; }
  .autocomplete-wrap { position: relative; }
  .autocomplete-results {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: #100e1a;
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    max-height: 320px;
    overflow-y: auto;
    z-index: 50;
    scrollbar-width: thin;
    scrollbar-color: #3a3555 transparent;
  }
  .autocomplete-results.block { display: block; position: static; margin-top: 8px; max-height: 280px; }
  .autocomplete-results::-webkit-scrollbar { width: 8px; }
  .autocomplete-results::-webkit-scrollbar-track { background: transparent; }
  .autocomplete-results::-webkit-scrollbar-thumb { background: #3a3555; border-radius: 8px; }
  .autocomplete-results::-webkit-scrollbar-thumb:hover { background: var(--accent); }
  .autocomplete-results.open { display: block; }
  .autocomplete-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; cursor: pointer; }
  .autocomplete-item:hover, .autocomplete-item.active { background: #201c30; }
  .autocomplete-item .poster { width: 32px; height: 46px; object-fit: cover; border-radius: 4px; flex-shrink: 0; background: #100e1a; }
  .autocomplete-item .ac-info { min-width: 0; }
  .autocomplete-item .ac-name { font-size: 0.88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .autocomplete-item .ac-year { font-size: 0.75rem; color: var(--text-dim); }
  .autocomplete-empty { padding: 10px; font-size: 0.85rem; color: var(--text-dim); }
  .checkbox-label { display: flex; align-items: center; gap: 8px; font-weight: 400; margin-top: 8px; font-size: 0.9rem; cursor: pointer; }
  .checkbox-label input { width: auto; margin-top: 0; }
  .btn {
    display: inline-block;
    padding: 10px 16px;
    font-size: 0.9rem;
    cursor: pointer;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    text-decoration: none;
    text-align: center;
  }
  .btn.full { width: 100%; margin-top: 20px; }
  .btn-primary { background: var(--accent); color: white; }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-add { background: var(--accent); color: white; }
  .btn-add:hover { background: var(--accent-hover); }
  .msg { margin-bottom: 20px; padding: 12px 14px; border-radius: 8px; font-size: 0.9rem; line-height: 1.4; }
  .ok { background: var(--ok-bg); color: var(--ok-text); }
  .err { background: var(--err-bg); color: var(--err-text); }
  .footer-hint { color: var(--text-dim); font-size: 0.78rem; margin-top: 16px; text-align: center; }
  .movie-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .movie-item { display: flex; align-items: center; gap: 12px; background: #17142399; border: 1px solid var(--panel-border); border-radius: 10px; padding: 10px; }
  .poster { width: 46px; height: 68px; object-fit: cover; border-radius: 6px; flex-shrink: 0; background: #100e1a; }
  .poster-placeholder { display: flex; align-items: center; justify-content: center; font-size: 1.4rem; }
  .info { flex: 1; min-width: 0; }
  .info .name { font-weight: 600; font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .info .sub { color: var(--text-dim); font-size: 0.75rem; }
  .info .mono { font-family: ui-monospace, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; width: 90px; }
  .btn-edit { background: #2c2840; color: var(--text); }
  .btn-edit:hover { background: #383253; }
  .delete-form { margin: 0; }
  .btn-delete { background: var(--danger); color: white; width: 100%; }
  .btn-delete:hover { background: var(--danger-hover); }
  .empty { color: var(--text-dim); font-size: 0.9rem; }
  .search-wrap { position: relative; margin-bottom: 16px; }
  .search-wrap input { padding-left: 36px; margin-top: 0; }
  .search-wrap svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); opacity: 0.5; }
  .pagination { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 18px; }
  .pagination button { background: #2c2840; color: var(--text); border: none; border-radius: 8px; width: 34px; height: 34px; cursor: pointer; font-size: 1rem; }
  .pagination button:hover:not(:disabled) { background: #383253; }
  .pagination button:disabled { opacity: 0.35; cursor: default; }
  .pagination span { color: var(--text-dim); font-size: 0.85rem; }
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(8, 7, 14, 0.7); align-items: center; justify-content: center; padding: 16px; z-index: 100; }
  .modal-overlay.open { display: flex; }
  .modal { background: var(--panel); border: 1px solid var(--panel-border); border-radius: 12px; padding: 22px; width: 100%; max-width: 360px; }
  .modal h3 { margin: 0 0 6px; font-size: 1.05rem; }
  .modal p { margin: 0; color: var(--text-dim); font-size: 0.85rem; line-height: 1.4; }
  .modal .modal-actions { display: flex; gap: 10px; margin-top: 18px; }
  .modal .modal-actions .btn { flex: 1; margin-top: 0; }
  .btn-cancel { background: #2c2840; color: var(--text); }
  .btn-cancel:hover { background: #383253; }
  .switch-row { display: flex; align-items: center; gap: 12px; margin-top: 18px; padding: 12px; background: #100e1a; border: 1px solid var(--panel-border); border-radius: 8px; }
  .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .switch-slider { position: absolute; inset: 0; cursor: pointer; background: #3a3555; border-radius: 999px; transition: background 0.15s; }
  .switch-slider::before { content: ""; position: absolute; height: 18px; width: 18px; left: 3px; top: 3px; background: white; border-radius: 50%; transition: transform 0.15s; }
  .switch input:checked + .switch-slider { background: var(--accent); }
  .switch input:checked + .switch-slider::before { transform: translateX(20px); }
  .switch input:focus-visible + .switch-slider { outline: 2px solid var(--accent); outline-offset: 2px; }
  .switch-title { font-weight: 600; font-size: 0.9rem; }
  #prowlarr-panel { margin-top: 4px; }
  .wrap.sheet-wrap { max-width: 980px; }
  .sheet { display: grid; grid-template-columns: 300px 1fr; gap: 20px; align-items: start; }
  @media (max-width: 760px) { .sheet { grid-template-columns: 1fr; } }
  .poster-preview {
    width: 100%;
    aspect-ratio: 2 / 3;
    border: 1px dashed var(--panel-border);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--text-dim);
    font-size: 0.82rem;
    padding: 14px;
    overflow: hidden;
    background: #100e1a;
    margin-bottom: 6px;
  }
  .poster-preview img { width: 100%; height: 100%; object-fit: cover; }
  .prowlarr-search-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; margin: 14px 0; }
  .prowlarr-search-row .field { flex: 1; min-width: 180px; }
  .prowlarr-search-row input { margin-top: 0; }
  .prowlarr-search-row .checkbox-label { margin: 0 0 10px; white-space: nowrap; }
  .prowlarr-search-row .btn { margin: 0; white-space: nowrap; }
  .prowlarr-search-row select {
    margin-top: 0; width: auto; padding: 10px 32px 10px 12px; font-size: 0.9rem;
    background: #100e1a; border: 1px solid var(--panel-border); border-radius: 8px; color: var(--text);
  }
  .prowlarr-search-row select:focus { outline: none; border-color: var(--accent); }
  .table-wrap { overflow-x: auto; border: 1px solid var(--panel-border); border-radius: 10px; }
  .results-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .results-table th {
    text-align: left; padding: 10px 12px; color: var(--text-dim); font-weight: 600;
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em;
    border-bottom: 1px solid var(--panel-border); white-space: nowrap;
  }
  .results-table th.sortable { cursor: pointer; user-select: none; }
  .results-table th.sortable:hover { color: var(--text); }
  .results-table th.sortable .sort-arrow { color: var(--accent); font-size: 0.65rem; }
  .results-table td { padding: 10px 12px; border-bottom: 1px solid var(--panel-border); vertical-align: top; }
  .results-table tbody tr { cursor: pointer; }
  .results-table tbody tr:hover { background: #201c30; }
  .results-table tbody tr:last-child td { border-bottom: none; }
  .results-table tbody tr.selected { background: #2a2340; }
  .results-table .title-cell { max-width: 340px; }
  .results-table .go { color: var(--accent); white-space: nowrap; font-weight: 600; font-size: 0.8rem; }
  .result-poster { width: 32px; height: 46px; object-fit: cover; border-radius: 4px; display: block; background: #100e1a; flex-shrink: 0; }
  .result-poster-placeholder {
    display: flex; align-items: center; justify-content: center; text-align: center;
    box-sizing: border-box; border: 1px dashed var(--panel-border); background: #100e1a;
  }
  .result-poster-placeholder span { font-size: 0.6rem; font-weight: 600; line-height: 1.15; color: var(--text-dim); }
  .loading-row { display: flex; align-items: center; gap: 10px; }
  .spinner {
    width: 14px; height: 14px; flex-shrink: 0; border-radius: 50%;
    border: 2px solid var(--panel-border); border-top-color: var(--accent);
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .spinner { animation: none; border-top-color: var(--panel-border); }
  }
`;
}

// ── Listado ────────────────────────────────────────────────────────
function renderMovieList(imdbStreams) {
    const entries = Object.entries(imdbStreams);
    if (entries.length === 0) {
        return `<p class="empty">Todavía no hay ninguna película añadida.</p>`;
    }
    return `<ul class="movie-list" id="movie-list">${entries.map(([imdbId, s]) => {
        const name = escapeHtml(s.name || s.title || imdbId);
        const searchKey = `${s.name || ""} ${s.title || ""} ${imdbId}`.toLowerCase();
        const poster = s.poster
            ? `<img class="poster" src="${escapeHtml(s.poster)}" alt="" loading="lazy">`
            : `<div class="poster poster-placeholder">🎬</div>`;
        return `<li class="movie-item" data-search="${escapeHtml(searchKey)}">
            ${poster}
            <div class="info">
                <div class="name">${name}</div>
                <div class="sub">${escapeHtml(imdbId)}</div>
                <div class="sub mono">${escapeHtml(s.infoHash)}</div>
            </div>
            <div class="actions">
                <a class="btn btn-edit" href="/admin/add?edit=${encodeURIComponent(imdbId)}">Editar</a>
                <form method="POST" action="/admin" class="delete-form">
                    <input type="hidden" name="imdbId" value="${escapeHtml(imdbId)}">
                    <input type="hidden" name="action" value="delete">
                    <button type="button" class="btn btn-delete delete-trigger" data-name="${name}">Eliminar</button>
                </form>
            </div>
        </li>`;
    }).join("")}</ul>
    <p class="empty" id="no-results" style="display:none">No hay ninguna película que coincida con la búsqueda.</p>
    <div class="pagination" id="pagination"></div>`;
}

function renderListPage({ message, imdbStreams }) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/icon.png">
<title>Admin · JFuster RD</title>
<style>${baseStyles()}</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="header-row">
        <div class="header-left">
          <img src="/icon.png" alt="">
          <div>
            <h1>JFuster RD</h1>
            <p>Panel de administración</p>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:14px;">
          <a href="/login?logout=1" class="back-link">Cerrar sesión</a>
          <a href="/admin/add" class="btn btn-add">+ Añadir película</a>
        </div>
      </div>
    </header>

    ${message || ""}

    <section class="card">
      <h2>Películas (<span id="movie-count">${Object.keys(imdbStreams).length}</span>)</h2>
      <div class="search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input id="search" placeholder="Buscar por título o id de IMDb..." autocomplete="off">
      </div>
      ${renderMovieList(imdbStreams)}
    </section>
  </div>

  <div class="modal-overlay" id="delete-modal-overlay">
    <div class="modal">
      <h3>Eliminar película</h3>
      <p id="delete-modal-text"></p>
      <div class="modal-actions">
        <button type="button" class="btn btn-cancel" id="delete-modal-cancel">Cancelar</button>
        <button type="button" class="btn btn-delete" id="delete-modal-confirm">Eliminar</button>
      </div>
    </div>
  </div>

  <script>
    (function () {
      var overlay = document.getElementById('delete-modal-overlay');
      var textEl = document.getElementById('delete-modal-text');
      var cancelBtn = document.getElementById('delete-modal-cancel');
      var confirmBtn = document.getElementById('delete-modal-confirm');
      var pendingForm = null;

      function openModal(form, name) {
        pendingForm = form;
        textEl.textContent = 'Vas a eliminar "' + name + '" del addon. Esta acción no se puede deshacer.';
        overlay.classList.add('open');
        confirmBtn.focus();
      }

      function closeModal() {
        overlay.classList.remove('open');
        pendingForm = null;
      }

      function confirmDelete() {
        if (!pendingForm) return;
        pendingForm.submit();
      }

      document.querySelectorAll('.delete-trigger').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openModal(btn.closest('form'), btn.dataset.name);
        });
      });

      cancelBtn.addEventListener('click', closeModal);
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeModal();
      });
      confirmBtn.addEventListener('click', confirmDelete);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
      });
    })();

    (function () {
      var PAGE_SIZE = 8;
      var currentPage = 1;
      var allItems = Array.prototype.slice.call(document.querySelectorAll('#movie-list .movie-item'));
      var searchInput = document.getElementById('search');
      var noResults = document.getElementById('no-results');
      var paginationEl = document.getElementById('pagination');
      var countEl = document.getElementById('movie-count');

      if (allItems.length === 0) return;

      function getFiltered() {
        var q = (searchInput.value || '').trim().toLowerCase();
        if (!q) return allItems;
        return allItems.filter(function (item) {
          return item.dataset.search.indexOf(q) !== -1;
        });
      }

      function render() {
        var filtered = getFiltered();
        var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;

        allItems.forEach(function (item) { item.style.display = 'none'; });

        var start = (currentPage - 1) * PAGE_SIZE;
        filtered.slice(start, start + PAGE_SIZE).forEach(function (item) {
          item.style.display = 'flex';
        });

        noResults.style.display = filtered.length === 0 ? 'block' : 'none';
        countEl.textContent = filtered.length;

        paginationEl.innerHTML = '';
        if (totalPages > 1) {
          var prev = document.createElement('button');
          prev.type = 'button';
          prev.textContent = '‹';
          prev.disabled = currentPage === 1;
          prev.addEventListener('click', function () { currentPage--; render(); });

          var label = document.createElement('span');
          label.textContent = 'Página ' + currentPage + ' / ' + totalPages;

          var next = document.createElement('button');
          next.type = 'button';
          next.textContent = '›';
          next.disabled = currentPage === totalPages;
          next.addEventListener('click', function () { currentPage++; render(); });

          paginationEl.appendChild(prev);
          paginationEl.appendChild(label);
          paginationEl.appendChild(next);
        }
      }

      searchInput.addEventListener('input', function () {
        currentPage = 1;
        render();
      });

      render();
    })();
  </script>
</body>
</html>`;
}

// ── Página de añadir / editar (ficha con portada + búsqueda) ──────
function renderAddPage({ message, editId, values }) {
    const editing = !!editId;
    const v = Object.assign({
        imdbId: "", title: "", magnet: "", poster: "",
        rdCacheJfuster: true, rdCacheIvan: true, prowlarrMode: true,
    }, values || {});

    const magnetHint = editing
        ? `Editando ${escapeHtml(editId)}: deja este campo vacío para conservar el stream actual, o elige/pega uno nuevo para sustituirlo.`
        : "Se extraen el infoHash y los trackers automáticamente.";

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/icon.png">
<title>${editing ? "Editar" : "Añadir"} película · JFuster RD</title>
<style>${baseStyles()}</style>
</head>
<body>
  <div class="wrap sheet-wrap">
    <header>
      <div class="header-row">
        <a href="/admin" class="back-link">← Volver al listado</a>
        <a href="/login?logout=1" class="back-link">Cerrar sesión</a>
      </div>
      <div class="header-row" style="margin-top:10px;">
        <div class="header-left">
          <img src="/icon.png" alt="">
          <div>
            <h1>${editing ? "Editar película" : "Añadir película"}</h1>
            <p>Solo contenido de dominio público o propio.</p>
          </div>
        </div>
      </div>
    </header>

    ${message || ""}

    <form method="POST" action="/admin" id="main-form">
      <input type="hidden" name="action" value="save">
      <input type="hidden" name="prowlarrMode" id="prowlarrModeField" value="${v.prowlarrMode ? "1" : "0"}">
      <input type="hidden" name="imdbId" id="imdbId" value="${escapeHtml(v.imdbId)}">

      <div class="sheet">
        <div class="card">
          <div class="poster-preview" id="poster-preview">
            <img id="poster-img" src="${escapeHtml(v.poster)}" alt="" style="display:${v.poster ? "block" : "none"}">
            <span id="poster-placeholder-text" style="display:${v.poster ? "none" : "block"}">La portada aparecerá aquí al elegir la película</span>
          </div>

          <label for="movieName">Nombre de la película</label>
          <div class="autocomplete-wrap">
            <input id="movieName" name="title" required placeholder="Escribe para buscar en IMDb..."
              autocomplete="off" value="${escapeHtml(v.title)}"${editing ? " readonly" : ""}>
            <div class="autocomplete-results" id="imdb-results"></div>
          </div>
          <div class="hint-field" id="imdb-hint">${editing ? "La película no se puede cambiar al editar." : "Elige una opción de la lista: se rellena el título y el ID de IMDb automáticamente."}</div>

          <div class="switch-row">
            <label class="switch">
              <input type="checkbox" id="prowlarr-mode"${v.prowlarrMode ? " checked" : ""}>
              <span class="switch-slider"></span>
            </label>
            <div>
              <div class="switch-title">Buscar en Prowlarr</div>
              <div class="hint-field">Desactiva para pegar el magnet tú mismo</div>
            </div>
          </div>

          <label>Cachear en Real-Debrid al guardar</label>
          <label class="checkbox-label"><input type="checkbox" name="rdCacheJfuster" value="1"${v.rdCacheJfuster ? " checked" : ""}> RD de Jfuster</label>
          <label class="checkbox-label"><input type="checkbox" name="rdCacheIvan" value="1"${v.rdCacheIvan ? " checked" : ""}> RD de Ivan</label>

          <button type="submit" class="btn btn-primary full">Guardar y desplegar</button>
          <p class="footer-hint">Al guardar se hace un commit al repo y Vercel redespliega (~1 min).</p>
        </div>

        <div class="card">
          <label for="magnet">Magnet link</label>
          <input id="magnet" name="magnet" placeholder="magnet:?xt=urn:btih:..." value="${escapeHtml(v.magnet)}"${editing ? "" : " required"}>
          <div class="hint-field" id="magnet-hint">${magnetHint}</div>

          <div id="prowlarr-panel">
            <div class="prowlarr-search-row">
              <div class="field">
                <input id="prowlarr-query" placeholder="Título a buscar..." autocomplete="off" value="${escapeHtml(v.title)}">
              </div>
              <select id="prowlarr-scope">
                <option value="movie" selected>Película</option>
                <option value="tv">Serie</option>
                <option value="all">Todo</option>
              </select>
              <button type="button" id="prowlarr-search-btn" class="btn btn-edit">Buscar</button>
            </div>
            <div class="table-wrap">
              <table class="results-table">
                <thead>
                  <tr>
                    <th></th><th>Título</th>
                    <th class="sortable" data-sort="year">Año <span class="sort-arrow"></span></th>
                    <th>Tipo</th><th>Indexer</th>
                    <th class="sortable" data-sort="size">Tamaño <span class="sort-arrow"></span></th>
                    <th class="sortable" data-sort="seeders">Seeders <span class="sort-arrow"></span></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="prowlarr-tbody">
                  <tr><td colspan="8" class="autocomplete-empty">Escribe un título y pulsa Buscar.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>

  <script>
    (function () {
      var modeCheckbox = document.getElementById('prowlarr-mode');
      var modeField = document.getElementById('prowlarrModeField');
      var panel = document.getElementById('prowlarr-panel');
      var magnetInput = document.getElementById('magnet');
      var magnetHintEl = document.getElementById('magnet-hint');
      var imdbIdField = document.getElementById('imdbId');
      var movieNameInput = document.getElementById('movieName');
      var manualHintText = ${JSON.stringify(magnetHint)};

      function applyMode() {
        var isProwlarr = modeCheckbox.checked;
        modeField.value = isProwlarr ? '1' : '0';
        panel.style.display = isProwlarr ? 'block' : 'none';
        magnetInput.readOnly = isProwlarr;
        magnetInput.placeholder = isProwlarr ? 'Elige un resultado de la tabla de abajo...' : 'magnet:?xt=urn:btih:...';
        magnetHintEl.textContent = isProwlarr
          ? 'Se rellena automáticamente al elegir un resultado de Prowlarr.'
          : manualHintText;
        magnetHintEl.style.color = '';
      }

      modeCheckbox.addEventListener('change', applyMode);
      applyMode();

      document.getElementById('main-form').addEventListener('submit', function (e) {
        if (!movieNameInput.readOnly && !imdbIdField.value) {
          e.preventDefault();
          document.getElementById('imdb-hint').textContent = 'Elige una película de la lista de IMDb antes de guardar.';
          document.getElementById('imdb-hint').style.color = 'var(--err-text)';
          movieNameInput.focus();
          return;
        }
        if (!magnetInput.value.trim()) {
          e.preventDefault();
          magnetHintEl.textContent = 'Elige un resultado de Prowlarr o pega un magnet a mano antes de guardar.';
          magnetHintEl.style.color = 'var(--err-text)';
          if (!modeCheckbox.checked) magnetInput.focus();
        }
      });
    })();

    // ── Buscador de películas por nombre (Cinemeta) ───────────
    (function () {
      var input = document.getElementById('movieName');
      var imdbIdField = document.getElementById('imdbId');
      var prowlarrQuery = document.getElementById('prowlarr-query');
      var resultsEl = document.getElementById('imdb-results');
      var posterImg = document.getElementById('poster-img');
      var posterPlaceholder = document.getElementById('poster-placeholder-text');
      var debounceTimer = null;
      var currentRequestId = 0;

      if (input.readOnly) return;

      function escapeHtmlClient(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      function closeResults() {
        resultsEl.classList.remove('open');
        resultsEl.innerHTML = '';
      }

      function setPoster(url) {
        if (url) {
          posterImg.src = url;
          posterImg.style.display = 'block';
          posterPlaceholder.style.display = 'none';
        } else {
          posterImg.style.display = 'none';
          posterPlaceholder.style.display = 'block';
        }
      }

      function renderResults(metas) {
        if (!metas.length) {
          resultsEl.innerHTML = '<div class="autocomplete-empty">Sin resultados.</div>';
          resultsEl.classList.add('open');
          return;
        }
        resultsEl.innerHTML = metas.map(function (m) {
          var poster = m.poster
            ? '<img class="poster" src="' + escapeHtmlClient(m.poster) + '" alt="" loading="lazy">'
            : '<div class="poster" style="display:flex;align-items:center;justify-content:center;">🎬</div>';
          var year = m.releaseInfo ? escapeHtmlClient(String(m.releaseInfo)) : '';
          return '<div class="autocomplete-item" data-id="' + escapeHtmlClient(m.id) + '" data-name="' + escapeHtmlClient(m.name) + '" data-poster="' + escapeHtmlClient(m.poster || '') + '">' +
            poster +
            '<div class="ac-info"><div class="ac-name">' + escapeHtmlClient(m.name) + '</div><div class="ac-year">' + year + '</div></div>' +
            '</div>';
        }).join('');
        resultsEl.classList.add('open');

        resultsEl.querySelectorAll('.autocomplete-item').forEach(function (item) {
          item.addEventListener('click', function () {
            input.value = item.dataset.name;
            imdbIdField.value = item.dataset.id;
            setPoster(item.dataset.poster);
            if (!prowlarrQuery.value) prowlarrQuery.value = item.dataset.name;
            document.getElementById('imdb-hint').textContent = 'Elige una opción de la lista: se rellena el título y el ID de IMDb automáticamente.';
            document.getElementById('imdb-hint').style.color = '';
            closeResults();
          });
        });
      }

      input.addEventListener('input', function () {
        var q = input.value.trim();
        imdbIdField.value = '';
        setPoster('');
        clearTimeout(debounceTimer);

        if (q.length < 2) {
          closeResults();
          return;
        }

        debounceTimer = setTimeout(function () {
          var requestId = ++currentRequestId;
          fetch('https://v3-cinemeta.strem.io/catalog/movie/top/search=' + encodeURIComponent(q) + '.json')
            .then(function (res) { return res.json(); })
            .then(function (data) {
              if (requestId !== currentRequestId) return;
              renderResults((data && data.metas) || []);
            })
            .catch(function () {
              if (requestId !== currentRequestId) return;
              resultsEl.innerHTML = '<div class="autocomplete-empty">No se pudo buscar ahora mismo.</div>';
              resultsEl.classList.add('open');
            });
        }, 350);
      });

      document.addEventListener('click', function (e) {
        if (!e.target.closest('.autocomplete-wrap')) closeResults();
      });
    })();

    // ── Buscador de torrents (Prowlarr) ───────────────────────
    (function () {
      var queryInput = document.getElementById('prowlarr-query');
      var scopeSelect = document.getElementById('prowlarr-scope');
      var searchBtn = document.getElementById('prowlarr-search-btn');
      var tbody = document.getElementById('prowlarr-tbody');
      var magnetInput = document.getElementById('magnet');
      var magnetHintEl = document.getElementById('magnet-hint');
      var sortHeaders = document.querySelectorAll('.results-table th.sortable');
      var lastResults = [];
      var sortState = { key: null, dir: -1 };

      function escapeHtmlClient(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      function formatSize(bytes) {
        if (!bytes) return '—';
        var gb = bytes / (1024 * 1024 * 1024);
        return gb >= 1 ? gb.toFixed(2) + ' GB' : (bytes / (1024 * 1024)).toFixed(0) + ' MB';
      }

      function sortedResults() {
        if (!sortState.key) return lastResults;
        var key = sortState.key;
        var dir = sortState.dir;
        return lastResults.slice().sort(function (a, b) {
          var av = a[key];
          var bv = b[key];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (av - bv) * dir;
        });
      }

      function updateSortArrows() {
        sortHeaders.forEach(function (th) {
          var arrow = th.querySelector('.sort-arrow');
          if (th.dataset.sort === sortState.key) {
            arrow.textContent = sortState.dir === 1 ? '▲' : '▼';
          } else {
            arrow.textContent = '';
          }
        });
      }

      sortHeaders.forEach(function (th) {
        th.addEventListener('click', function () {
          var key = th.dataset.sort;
          if (sortState.key === key) {
            sortState.dir = -sortState.dir;
          } else {
            sortState.key = key;
            sortState.dir = -1;
          }
          updateSortArrows();
          renderResults();
        });
      });

      function renderResults() {
        var results = sortedResults();
        if (results.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" class="autocomplete-empty">Sin resultados.</td></tr>';
          return;
        }
        tbody.innerHTML = results.map(function (r) {
          var i = lastResults.indexOf(r);
          var thumb = r.poster
            ? '<img class="result-poster" src="' + escapeHtmlClient(r.poster) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
              '<div class="result-poster result-poster-placeholder" style="display:none"><span>No<br>Data</span></div>'
            : '<div class="result-poster result-poster-placeholder"><span>No<br>Data</span></div>';
          return '<tr class="prowlarr-row" data-idx="' + i + '">' +
            '<td>' + thumb + '</td>' +
            '<td class="title-cell">' + escapeHtmlClient(r.title) + (r.isSpainSpanish ? ' 🇪🇸' : '') + '</td>' +
            '<td>' + escapeHtmlClient(r.year || '—') + '</td>' +
            '<td>' + escapeHtmlClient(r.contentType || '—') + '</td>' +
            '<td>' + escapeHtmlClient(r.indexer || '') + '</td>' +
            '<td>' + formatSize(r.size) + '</td>' +
            '<td>' + (r.seeders != null ? r.seeders : '—') + '</td>' +
            '<td class="go">Elegir →</td>' +
            '</tr>';
        }).join('');

        function selectResult(row, r, magnet) {
          magnetInput.value = magnet;
          magnetHintEl.textContent = 'Seleccionado: ' + r.title;
          magnetHintEl.style.color = '';
          tbody.querySelectorAll('.prowlarr-row').forEach(function (el) { el.classList.remove('selected'); });
          row.classList.add('selected');
        }

        tbody.querySelectorAll('.prowlarr-row').forEach(function (row) {
          row.addEventListener('click', function () {
            var r = lastResults[Number(row.dataset.idx)];
            if (r.magnet) {
              selectResult(row, r, r.magnet);
              return;
            }
            // Sin magnet directo: hay que descargar el .torrent y calcular
            // el hash, solo para este resultado (no se hizo al buscar).
            var goCell = row.querySelector('.go');
            var originalGo = goCell.textContent;
            goCell.innerHTML = '<span class="spinner"></span>';
            fetch('/api/prowlarr-resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ downloadRef: r.downloadRef }),
            })
              .then(function (res) { return res.json(); })
              .then(function (data) {
                if (data.error) {
                  goCell.textContent = originalGo;
                  magnetHintEl.textContent = data.error;
                  magnetHintEl.style.color = 'var(--err-text)';
                  return;
                }
                r.magnet = data.magnet;
                goCell.textContent = originalGo;
                selectResult(row, r, data.magnet);
              })
              .catch(function () {
                goCell.textContent = originalGo;
                magnetHintEl.textContent = 'No se pudo resolver el magnet de este resultado.';
                magnetHintEl.style.color = 'var(--err-text)';
              });
          });
        });
      }

      function runSearch() {
        var q = queryInput.value.trim();
        if (!q) return;
        tbody.innerHTML = '<tr><td colspan="8"><div class="loading-row"><span class="spinner"></span> Buscando...</div></td></tr>';
        fetch('/api/prowlarr-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: q, scope: scopeSelect.value }),
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data.error) {
              tbody.innerHTML = '<tr><td colspan="8" class="autocomplete-empty">' + escapeHtmlClient(data.error) + '</td></tr>';
              return;
            }
            lastResults = data.results || [];
            renderResults();
          })
          .catch(function () {
            tbody.innerHTML = '<tr><td colspan="8" class="autocomplete-empty">No se pudo buscar ahora mismo.</td></tr>';
          });
      }

      searchBtn.addEventListener('click', runSearch);
      queryInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); runSearch(); }
      });
    })();
  </script>
</body>
</html>`;
}

async function readImdbStreamsFromGitHub(ghHeaders) {
    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
    const getRes = await fetch(`${apiUrl}?ref=${BRANCH}`, { headers: ghHeaders });
    if (!getRes.ok) throw new Error(`No se pudo leer el fichero actual (${getRes.status})`);
    const getData = await getRes.json();
    const data = JSON.parse(Buffer.from(getData.content, "base64").toString("utf-8"));
    return { data, sha: getData.sha, apiUrl };
}

async function writeImdbStreamsToGitHub(ghHeaders, apiUrl, data, sha, message) {
    const newContent = Buffer.from(JSON.stringify(data, null, 2) + "\n", "utf-8").toString("base64");
    const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify({ message, content: newContent, sha, branch: BRANCH }),
    });
    if (!putRes.ok) {
        const errBody = await putRes.text();
        throw new Error(`Error de la API de GitHub (${putRes.status}): ${errBody}`);
    }
}

module.exports = async (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const isAddPage = req.query.view === "add";

    if (!isAuthenticated(req, (process.env.ADMIN_PASSWORD || "").trim())) {
        let publicPath = "/admin";
        if (isAddPage) {
            publicPath = "/admin/add";
            if (req.query.edit) publicPath += `?edit=${encodeURIComponent(req.query.edit)}`;
        }
        return res.redirect(302, `/login?next=${encodeURIComponent(publicPath)}`);
    }

    if (req.method === "GET") {
        if (isAddPage) {
            const editId = req.query.edit && IMDB_STREAMS[req.query.edit] ? req.query.edit : null;
            const entry = editId ? IMDB_STREAMS[editId] : null;
            return res.status(200).send(renderAddPage({
                editId,
                values: {
                    imdbId: editId || "",
                    title: entry ? (entry.title || "") : "",
                    magnet: "",
                    poster: entry ? (entry.poster || "") : "",
                    rdCacheJfuster: true,
                    rdCacheIvan: true,
                    prowlarrMode: !editId,
                },
            }));
        }
        return res.status(200).send(renderListPage({ imdbStreams: IMDB_STREAMS }));
    }

    if (req.method !== "POST") {
        return res.status(405).send(renderListPage({
            imdbStreams: IMDB_STREAMS,
            message: '<div class="msg err">Método no permitido.</div>',
        }));
    }

    const { imdbId, magnet, title, action, rdCacheJfuster, rdCacheIvan, prowlarrMode } = req.body || {};

    // ── Eliminar (siempre vuelve al listado) ───────────────────
    if (action === "delete") {
        if (!process.env.GITHUB_TOKEN) {
            return res.status(500).send(renderListPage({
                imdbStreams: IMDB_STREAMS,
                message: '<div class="msg err">Falta configurar GITHUB_TOKEN en Vercel.</div>',
            }));
        }
        const ghHeaders = {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "stremio-addon-admin",
        };
        try {
            const { data: current, sha, apiUrl } = await readImdbStreamsFromGitHub(ghHeaders);
            if (!current[imdbId]) {
                return res.status(400).send(renderListPage({
                    imdbStreams: IMDB_STREAMS,
                    message: `<div class="msg err">${escapeHtml(imdbId)} no existe.</div>`,
                }));
            }
            const removedName = current[imdbId].name || current[imdbId].title || imdbId;
            delete current[imdbId];

            await writeImdbStreamsToGitHub(ghHeaders, apiUrl, current, sha, `Eliminar stream de ${imdbId} vía panel admin`);

            return res.status(200).send(renderListPage({
                imdbStreams: current,
                message: `<div class="msg ok">Eliminado "${escapeHtml(removedName)}" (${escapeHtml(imdbId)}). Vercel está redesplegando, ~1 min.</div>`,
            }));
        } catch (err) {
            return res.status(500).send(renderListPage({
                imdbStreams: IMDB_STREAMS,
                message: `<div class="msg err">${escapeHtml(err.message)}</div>`,
            }));
        }
    }

    // ── Añadir / editar (siempre vuelve a la página de añadir en caso
    // de error, para no perder lo ya escrito) ──────────────────
    const values = {
        imdbId: imdbId || "",
        title: title || "",
        magnet: magnet || "",
        rdCacheJfuster: !!rdCacheJfuster,
        rdCacheIvan: !!rdCacheIvan,
        prowlarrMode: prowlarrMode === "1",
    };
    const editId = imdbId && IMDB_STREAMS[imdbId] ? imdbId : null;

    function addPageError(status, message) {
        return res.status(status).send(renderAddPage({ editId, values, message }));
    }

    if (!imdbId || !/^tt[0-9]+$/.test(imdbId)) {
        return addPageError(400, '<div class="msg err">ID de IMDb inválido, debe ser del tipo tt1234567.</div>');
    }

    if (!process.env.GITHUB_TOKEN) {
        return addPageError(500, '<div class="msg err">Falta configurar GITHUB_TOKEN en Vercel.</div>');
    }

    if (!title || !title.trim()) {
        return addPageError(400, '<div class="msg err">Falta el título.</div>');
    }

    const ghHeaders = {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "stremio-addon-admin",
    };

    try {
        const { data: current, sha, apiUrl } = await readImdbStreamsFromGitHub(ghHeaders);
        const existing = current[imdbId];

        let parsed;
        if (magnet && magnet.trim()) {
            try {
                parsed = parseMagnet(magnet);
            } catch (err) {
                return addPageError(400, `<div class="msg err">${escapeHtml(err.message)}</div>`);
            }
        } else if (existing) {
            parsed = { infoHash: existing.infoHash, sources: existing.sources };
        } else {
            return addPageError(400, '<div class="msg err">Falta el magnet link para dar de alta una película nueva.</div>');
        }

        const needsMeta = !existing || !existing.poster || !existing.name;
        const cinemeta = needsMeta ? await fetchCinemetaMeta(imdbId) : null;

        current[imdbId] = {
            infoHash: parsed.infoHash,
            sources: parsed.sources,
            title: title.trim(),
            name: (cinemeta && cinemeta.name) || (existing && existing.name) || title.trim(),
            poster: (cinemeta && cinemeta.poster) || (existing && existing.poster) || null,
        };

        await writeImdbStreamsToGitHub(
            ghHeaders,
            apiUrl,
            current,
            sha,
            `${existing ? "Editar" : "Añadir"} stream para ${imdbId} vía panel admin`
        );

        const posterNote = current[imdbId].poster
            ? " Póster y nombre obtenidos de Cinemeta."
            : " No se encontró póster en Cinemeta (se guardó igualmente, aparecerá sin imagen en el catálogo).";

        const rdAccounts = [];
        if (rdCacheJfuster) rdAccounts.push({ label: "Jfuster", key: process.env.RD_KEY_JFUSTER });
        if (rdCacheIvan) rdAccounts.push({ label: "Ivan", key: process.env.RD_KEY_IVAN });

        let rdNote = "";
        if (rdAccounts.length > 0) {
            const results = await Promise.all(rdAccounts.map(async (acc) => {
                if (!acc.key) return `${acc.label}: falta configurar su clave en el servidor`;
                const rdResult = await triggerRealDebridCache(acc.key, parsed.infoHash, parsed.sources);
                if (!rdResult) return `${acc.label}: no se pudo contactar con RD`;
                return rdResult.cached
                    ? `${acc.label}: ya cacheado, listo al instante`
                    : `${acc.label}: pedido a RD, puede tardar según seeders`;
            }));
            rdNote = " Real-Debrid — " + results.join(" · ") + ".";
        }

        const successMsg = `<div class="msg ok">Guardado. ${escapeHtml(imdbId)} → infoHash ${escapeHtml(parsed.infoHash)}.${posterNote}${rdNote} Vercel está redesplegando, estará online en ~1 min.</div>`;
        // Se renderiza aquí mismo con "current" (recién escrito) en vez de
        // redirigir a /admin, que usaría IMDB_STREAMS del último build —
        // desactualizado hasta que termine el redeploy de Vercel.
        return res.status(200).send(renderListPage({ imdbStreams: current, message: successMsg }));
    } catch (err) {
        return addPageError(500, `<div class="msg err">${escapeHtml(err.message)}</div>`);
    }
};
