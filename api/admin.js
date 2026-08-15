const { parseMagnet } = require("../lib/magnet");
const { fetchCinemetaMeta } = require("../lib/cinemeta");
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
    return `<ul class="movie-list">${entries.map(([imdbId, s]) => {
        const name = escapeHtml(s.name || s.title || imdbId);
        const poster = s.poster
            ? `<img class="poster" src="${escapeHtml(s.poster)}" alt="" loading="lazy">`
            : `<div class="poster poster-placeholder">🎬</div>`;
        return `<li class="movie-item">
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
                    <button type="submit" class="btn btn-delete">Eliminar</button>
                </form>
            </div>
        </li>`;
    }).join("")}</ul>`;
}

function renderPage({ message, imdbStreams }) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin · Biblioteca de jfuster</title>
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
  .wrap { max-width: 640px; margin: 0 auto; }
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
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <img src="/icon.png" alt="">
      <div>
        <h1>Biblioteca de jfuster</h1>
        <p>Panel de administración</p>
      </div>
    </header>

    ${message || ""}

    <section class="card">
      <h2 id="form-title">Añadir película</h2>
      <p class="desc">Solo contenido de dominio público o propio.</p>
      <form method="POST" action="/admin" id="main-form">
        <label for="imdbId">ID de IMDb (ej. tt0063350)</label>
        <input id="imdbId" name="imdbId" required pattern="tt[0-9]+" placeholder="tt0063350">

        <label for="magnet">Magnet link</label>
        <input id="magnet" name="magnet" required placeholder="magnet:?xt=urn:btih:...">
        <div class="hint-field" id="magnet-hint">Se extraen el infoHash y los trackers automáticamente.</div>

        <label for="title">Título (se muestra en el stream)</label>
        <input id="title" name="title" required placeholder="Nombre de la película (fuente)">

        <label for="secret">Contraseña de admin</label>
        <input id="secret" name="secret" type="password" required autocomplete="off">

        <button type="submit" class="btn btn-primary">Guardar y desplegar</button>
        <button type="button" id="cancel-edit" class="btn" style="display:none">Cancelar edición</button>
      </form>
      <p class="footer-hint">Al guardar se hace un commit al repo y Vercel redespliega automáticamente (~1 min).</p>
    </section>

    <section class="card">
      <h2>Películas (${Object.keys(imdbStreams).length})</h2>
      ${renderMovieList(imdbStreams)}
    </section>
  </div>

  <script>
    document.getElementById('main-form').addEventListener('submit', function () {
      // nada que sincronizar, el campo secret ya vive en este form
    });

    document.querySelectorAll('.delete-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        var name = form.closest('.movie-item').querySelector('.name').textContent;
        if (!confirm('¿Eliminar "' + name + '" del addon?')) {
          e.preventDefault();
          return;
        }
        var secretValue = document.getElementById('secret').value;
        if (!secretValue) {
          e.preventDefault();
          alert('Escribe la contraseña de admin en el formulario de arriba primero.');
          return;
        }
        form.querySelector('.del-secret').value = secretValue;
      });
    });

    document.querySelectorAll('.edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.getElementById('imdbId').value = btn.dataset.id;
        document.getElementById('title').value = btn.dataset.title;
        document.getElementById('magnet').value = '';
        document.getElementById('magnet').required = false;
        document.getElementById('magnet-hint').textContent = 'Editando ' + btn.dataset.id + ': deja este campo vacío para conservar el stream actual, o pega un magnet nuevo para sustituirlo.';
        document.getElementById('form-title').textContent = 'Editar película';
        document.getElementById('cancel-edit').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

    const { imdbId, magnet, title, secret, action } = req.body || {};

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

        return res.status(200).send(renderPage({
            imdbStreams: current,
            message: `<div class="msg ok">Guardado. ${escapeHtml(imdbId)} → infoHash ${escapeHtml(parsed.infoHash)}.${posterNote} Vercel está redesplegando, estará online en ~1 min.</div>`,
        }));
    } catch (err) {
        return res.status(500).send(renderPage({
            imdbStreams: IMDB_STREAMS,
            message: `<div class="msg err">${escapeHtml(err.message)}</div>`,
        }));
    }
};
