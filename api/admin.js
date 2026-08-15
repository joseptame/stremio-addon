const { parseMagnet } = require("../lib/magnet");
const { fetchCinemetaMeta } = require("../lib/cinemeta");
const { triggerRealDebridCache } = require("../lib/realdebrid");
const { IMDB_STREAMS } = require("../lib/data");

const OWNER = "joseptame";
const REPO = "stremio-addon";
const BRANCH = "master";
const FILE_PATH = "lib/imdb-streams.json";

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

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
                <button type="button" class="btn btn-edit edit-btn"
                    data-id="${escapeHtml(imdbId)}"
                    data-title="${escapeHtml(s.title || "")}">Editar</button>
                <form method="POST" action="/admin" class="delete-form">
                    <input type="hidden" name="imdbId" value="${escapeHtml(imdbId)}">
                    <input type="hidden" name="action" value="delete">
                    <input type="hidden" name="secret" class="del-secret">
                    <button type="button" class="btn btn-delete delete-trigger" data-name="${name}">Eliminar</button>
                </form>
            </div>
        </li>`;
    }).join("")}</ul>
    <p class="empty" id="no-results" style="display:none">No hay ninguna película que coincida con la búsqueda.</p>
    <div class="pagination" id="pagination"></div>`;
}

function renderPage({ message, imdbStreams }) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/icon.png">
<title>Admin · JFuster RD</title>
<style>
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
  .layout { display: flex; gap: 20px; align-items: flex-start; }
  .col-form { flex: 0 0 25%; min-width: 280px; position: sticky; top: 20px; }
  .col-list { flex: 1; min-width: 0; }
  @media (max-width: 800px) {
    .layout { flex-direction: column; }
    .col-form { position: static; width: 100%; flex-basis: auto; }
  }
  header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
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
  }
  .autocomplete-results.open { display: block; }
  .autocomplete-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    cursor: pointer;
  }
  .autocomplete-item:hover, .autocomplete-item.active { background: #201c30; }
  .autocomplete-item .poster {
    width: 32px; height: 46px; object-fit: cover; border-radius: 4px; flex-shrink: 0; background: #100e1a;
  }
  .autocomplete-item .ac-info { min-width: 0; }
  .autocomplete-item .ac-name { font-size: 0.88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .autocomplete-item .ac-year { font-size: 0.75rem; color: var(--text-dim); }
  .autocomplete-empty { padding: 10px; font-size: 0.85rem; color: var(--text-dim); }
  .checkbox-label {
    display: flex; align-items: center; gap: 8px; font-weight: 400;
    margin-top: 8px; font-size: 0.9rem; cursor: pointer;
  }
  .checkbox-label input { width: auto; margin-top: 0; }
  .btn {
    padding: 10px 16px;
    font-size: 0.9rem;
    cursor: pointer;
    border: none;
    border-radius: 8px;
    font-weight: 600;
  }
  button[type="submit"].btn-primary {
    margin-top: 20px;
    background: var(--accent);
    color: white;
    width: 100%;
  }
  button[type="submit"].btn-primary:hover { background: var(--accent-hover); }
  #cancel-edit {
    margin-top: 10px;
    width: 100%;
    background: transparent;
    color: var(--text-dim);
    border: 1px solid var(--panel-border);
  }
  .msg { margin-bottom: 20px; padding: 12px 14px; border-radius: 8px; font-size: 0.9rem; line-height: 1.4; }
  .ok { background: var(--ok-bg); color: var(--ok-text); }
  .err { background: var(--err-bg); color: var(--err-text); }
  .footer-hint { color: var(--text-dim); font-size: 0.78rem; margin-top: 16px; text-align: center; }
  .movie-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .movie-item {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #17142399;
    border: 1px solid var(--panel-border);
    border-radius: 10px;
    padding: 10px;
  }
  .poster { width: 46px; height: 68px; object-fit: cover; border-radius: 6px; flex-shrink: 0; background: #100e1a; }
  .poster-placeholder { display: flex; align-items: center; justify-content: center; font-size: 1.4rem; }
  .info { flex: 1; min-width: 0; }
  .info .name { font-weight: 600; font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .info .sub { color: var(--text-dim); font-size: 0.75rem; }
  .info .mono { font-family: ui-monospace, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
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
  .pagination button {
    background: #2c2840; color: var(--text); border: none; border-radius: 8px;
    width: 34px; height: 34px; cursor: pointer; font-size: 1rem;
  }
  .pagination button:hover:not(:disabled) { background: #383253; }
  .pagination button:disabled { opacity: 0.35; cursor: default; }
  .pagination span { color: var(--text-dim); font-size: 0.85rem; }
  .modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(8, 7, 14, 0.7);
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 100;
  }
  .modal-overlay.open { display: flex; }
  .modal {
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 12px;
    padding: 22px;
    width: 100%;
    max-width: 360px;
  }
  .modal h3 { margin: 0 0 6px; font-size: 1.05rem; }
  .modal p { margin: 0; color: var(--text-dim); font-size: 0.85rem; line-height: 1.4; }
  .modal .modal-actions { display: flex; gap: 10px; margin-top: 18px; }
  .modal .modal-actions .btn { flex: 1; margin-top: 0; }
  .btn-cancel { background: #2c2840; color: var(--text); }
  .btn-cancel:hover { background: #383253; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <img src="/icon.png" alt="">
      <div>
        <h1>JFuster RD</h1>
        <p>Panel de administración</p>
      </div>
    </header>

    ${message || ""}

    <div class="layout">
      <div class="col-form">
        <section class="card">
          <h2 id="form-title">Añadir película</h2>
          <p class="desc">Solo contenido de dominio público o propio.</p>
          <form method="POST" action="/admin" id="main-form">
            <label for="imdbId">Película (busca por nombre o pega el ID de IMDb)</label>
            <div class="autocomplete-wrap">
              <input id="imdbId" name="imdbId" required pattern="tt[0-9]+" placeholder="Ej. Inception, o tt0063350" autocomplete="off">
              <div class="autocomplete-results" id="imdb-results"></div>
            </div>
            <div class="hint-field" id="imdb-hint">Escribe el nombre, elige una opción de la lista y se rellena el ID automáticamente.</div>

            <label for="magnet">Magnet link</label>
            <input id="magnet" name="magnet" required placeholder="magnet:?xt=urn:btih:...">
            <div class="hint-field" id="magnet-hint">Se extraen el infoHash y los trackers automáticamente.</div>

            <label for="title">Título (se muestra en el stream)</label>
            <input id="title" name="title" required placeholder="Nombre de la película (fuente)">

            <label>Cachear en Real-Debrid al guardar</label>
            <label class="checkbox-label"><input type="checkbox" name="rdCacheJfuster" value="1"> RD de Jfuster</label>
            <label class="checkbox-label"><input type="checkbox" name="rdCacheIvan" value="1"> RD de Ivan</label>
            <div class="hint-field">Marca las cuentas donde quieras que RD empiece a descargarla ya, en vez de esperar a que alguien le dé a reproducir.</div>

            <label for="secret">Contraseña de admin</label>
            <input id="secret" name="secret" type="password" required autocomplete="off">

            <button type="submit" class="btn btn-primary">Guardar y desplegar</button>
            <button type="button" id="cancel-edit" class="btn" style="display:none">Cancelar edición</button>
          </form>
          <p class="footer-hint">Al guardar se hace un commit al repo y Vercel redespliega automáticamente (~1 min).</p>
        </section>
      </div>

      <div class="col-list">
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
    </div>
  </div>

  <div class="modal-overlay" id="delete-modal-overlay">
    <div class="modal">
      <h3>Eliminar película</h3>
      <p id="delete-modal-text"></p>
      <label for="delete-modal-secret">Contraseña de admin</label>
      <input id="delete-modal-secret" type="password" autocomplete="off" placeholder="Contraseña de admin">
      <div class="modal-actions">
        <button type="button" class="btn btn-cancel" id="delete-modal-cancel">Cancelar</button>
        <button type="button" class="btn btn-delete" id="delete-modal-confirm">Eliminar</button>
      </div>
    </div>
  </div>

  <script>
    document.getElementById('main-form').addEventListener('submit', function () {
      // nada que sincronizar, el campo secret ya vive en este form
    });

    // ── Modal de confirmación para eliminar ───────────────────
    (function () {
      var overlay = document.getElementById('delete-modal-overlay');
      var textEl = document.getElementById('delete-modal-text');
      var secretInput = document.getElementById('delete-modal-secret');
      var cancelBtn = document.getElementById('delete-modal-cancel');
      var confirmBtn = document.getElementById('delete-modal-confirm');
      var pendingForm = null;

      function openModal(form, name) {
        pendingForm = form;
        textEl.textContent = 'Vas a eliminar "' + name + '" del addon. Esta acción no se puede deshacer.';
        secretInput.value = '';
        overlay.classList.add('open');
        secretInput.focus();
      }

      function closeModal() {
        overlay.classList.remove('open');
        pendingForm = null;
      }

      function confirmDelete() {
        if (!pendingForm) return;
        if (!secretInput.value) {
          secretInput.focus();
          return;
        }
        pendingForm.querySelector('.del-secret').value = secretInput.value;
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
      secretInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') confirmDelete();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
      });
    })();

    // ── Buscador de películas por nombre (Cinemeta) ───────────
    (function () {
      var input = document.getElementById('imdbId');
      var titleInput = document.getElementById('title');
      var resultsEl = document.getElementById('imdb-results');
      var debounceTimer = null;
      var currentRequestId = 0;

      function escapeHtmlClient(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      function closeResults() {
        resultsEl.classList.remove('open');
        resultsEl.innerHTML = '';
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
          return '<div class="autocomplete-item" data-id="' + escapeHtmlClient(m.id) + '" data-name="' + escapeHtmlClient(m.name) + '">' +
            poster +
            '<div class="ac-info"><div class="ac-name">' + escapeHtmlClient(m.name) + '</div><div class="ac-year">' + year + '</div></div>' +
            '</div>';
        }).join('');
        resultsEl.classList.add('open');

        resultsEl.querySelectorAll('.autocomplete-item').forEach(function (item) {
          item.addEventListener('click', function () {
            input.value = item.dataset.id;
            if (!titleInput.value) titleInput.value = item.dataset.name;
            closeResults();
          });
        });
      }

      input.addEventListener('input', function () {
        var q = input.value.trim();
        clearTimeout(debounceTimer);

        if (/^tt[0-9]+$/i.test(q) || q.length < 2) {
          closeResults();
          return;
        }

        debounceTimer = setTimeout(function () {
          var requestId = ++currentRequestId;
          fetch('https://v3-cinemeta.strem.io/catalog/movie/top/search=' + encodeURIComponent(q) + '.json')
            .then(function (res) { return res.json(); })
            .then(function (data) {
              if (requestId !== currentRequestId) return; // respuesta obsoleta
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

    document.querySelectorAll('.edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.getElementById('imdbId').value = btn.dataset.id;
        document.getElementById('title').value = btn.dataset.title;
        document.getElementById('magnet').value = '';
        document.getElementById('magnet').required = false;
        document.getElementById('magnet-hint').textContent = 'Editando ' + btn.dataset.id + ': deja este campo vacío para conservar el stream actual, o pega un magnet nuevo para sustituirlo.';
        document.getElementById('form-title').textContent = 'Editar película';
        document.getElementById('cancel-edit').style.display = 'block';
        document.querySelector('.col-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('imdbId').focus();
      });
    });

    document.getElementById('cancel-edit').addEventListener('click', function () {
      document.getElementById('main-form').reset();
      document.getElementById('magnet').required = true;
      document.getElementById('magnet-hint').textContent = 'Se extraen el infoHash y los trackers automáticamente.';
      document.getElementById('form-title').textContent = 'Añadir película';
      this.style.display = 'none';
    });

    // ── Buscador + paginación (client-side) ──────────────────
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

    if (req.method === "GET") {
        return res.status(200).send(renderPage({ imdbStreams: IMDB_STREAMS }));
    }

    if (req.method !== "POST") {
        return res.status(405).send(renderPage({
            imdbStreams: IMDB_STREAMS,
            message: '<div class="msg err">Método no permitido.</div>',
        }));
    }

    const { imdbId, magnet, title, secret, action, rdCacheJfuster, rdCacheIvan } = req.body || {};

    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
        return res.status(401).send(renderPage({
            imdbStreams: IMDB_STREAMS,
            message: '<div class="msg err">Contraseña incorrecta.</div>',
        }));
    }

    if (!imdbId || !/^tt[0-9]+$/.test(imdbId)) {
        return res.status(400).send(renderPage({
            imdbStreams: IMDB_STREAMS,
            message: '<div class="msg err">ID de IMDb inválido, debe ser del tipo tt1234567.</div>',
        }));
    }

    if (!process.env.GITHUB_TOKEN) {
        return res.status(500).send(renderPage({
            imdbStreams: IMDB_STREAMS,
            message: '<div class="msg err">Falta configurar GITHUB_TOKEN en Vercel.</div>',
        }));
    }

    const ghHeaders = {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "stremio-addon-admin",
    };

    // ── Eliminar ──────────────────────────────────────────────
    if (action === "delete") {
        try {
            const { data: current, sha, apiUrl } = await readImdbStreamsFromGitHub(ghHeaders);
            if (!current[imdbId]) {
                return res.status(400).send(renderPage({
                    imdbStreams: IMDB_STREAMS,
                    message: `<div class="msg err">${escapeHtml(imdbId)} no existe.</div>`,
                }));
            }
            const removedName = current[imdbId].name || current[imdbId].title || imdbId;
            delete current[imdbId];

            await writeImdbStreamsToGitHub(ghHeaders, apiUrl, current, sha, `Eliminar stream de ${imdbId} vía panel admin`);

            return res.status(200).send(renderPage({
                imdbStreams: current,
                message: `<div class="msg ok">Eliminado "${escapeHtml(removedName)}" (${escapeHtml(imdbId)}). Vercel está redesplegando, ~1 min.</div>`,
            }));
        } catch (err) {
            return res.status(500).send(renderPage({
                imdbStreams: IMDB_STREAMS,
                message: `<div class="msg err">${escapeHtml(err.message)}</div>`,
            }));
        }
    }

    // ── Añadir / editar ───────────────────────────────────────
    if (!title || !title.trim()) {
        return res.status(400).send(renderPage({
            imdbStreams: IMDB_STREAMS,
            message: '<div class="msg err">Falta el título.</div>',
        }));
    }

    try {
        const { data: current, sha, apiUrl } = await readImdbStreamsFromGitHub(ghHeaders);
        const existing = current[imdbId];

        let parsed;
        if (magnet && magnet.trim()) {
            try {
                parsed = parseMagnet(magnet);
            } catch (err) {
                return res.status(400).send(renderPage({
                    imdbStreams: IMDB_STREAMS,
                    message: `<div class="msg err">${escapeHtml(err.message)}</div>`,
                }));
            }
        } else if (existing) {
            parsed = { infoHash: existing.infoHash, sources: existing.sources };
        } else {
            return res.status(400).send(renderPage({
                imdbStreams: IMDB_STREAMS,
                message: '<div class="msg err">Falta el magnet link para dar de alta una película nueva.</div>',
            }));
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

        return res.status(200).send(renderPage({
            imdbStreams: current,
            message: `<div class="msg ok">Guardado. ${escapeHtml(imdbId)} → infoHash ${escapeHtml(parsed.infoHash)}.${posterNote}${rdNote} Vercel está redesplegando, estará online en ~1 min.</div>`,
        }));
    } catch (err) {
        return res.status(500).send(renderPage({
            imdbStreams: IMDB_STREAMS,
            message: `<div class="msg err">${escapeHtml(err.message)}</div>`,
        }));
    }
};
