const { parseMagnet } = require("../lib/magnet");
const { fetchCinemetaMeta } = require("../lib/cinemeta");

const OWNER = "joseptame";
const REPO = "stremio-addon";
const BRANCH = "master";
const FILE_PATH = "lib/imdb-streams.json";

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

function renderForm(message) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin · Añadir stream IMDb</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; color: #222; }
  label { display: block; margin-top: 16px; font-weight: 600; }
  input { width: 100%; padding: 8px; margin-top: 4px; box-sizing: border-box; font-size: 1rem; }
  button { margin-top: 20px; padding: 10px 16px; font-size: 1rem; cursor: pointer; }
  .msg { margin-top: 16px; padding: 12px; border-radius: 6px; word-break: break-word; }
  .ok { background: #d4edda; color: #155724; }
  .err { background: #f8d7da; color: #721c24; }
  .hint { color: #666; font-size: 0.9em; margin-top: 24px; }
</style>
</head>
<body>
  <h1>Añadir stream a una ficha de IMDb</h1>
  <p>Solo contenido de dominio público o propio.</p>
  ${message || ""}
  <form method="POST" action="/admin">
    <label for="imdbId">ID de IMDb (ej. tt0063350)</label>
    <input id="imdbId" name="imdbId" required pattern="tt[0-9]+" placeholder="tt0063350">

    <label for="magnet">Magnet link</label>
    <input id="magnet" name="magnet" required placeholder="magnet:?xt=urn:btih:...">

    <label for="title">Título (se muestra en el stream)</label>
    <input id="title" name="title" required placeholder="Nombre de la película (fuente)">

    <label for="secret">Contraseña de admin</label>
    <input id="secret" name="secret" type="password" required>

    <button type="submit">Guardar y desplegar</button>
  </form>
  <p class="hint">Al guardar se hace un commit al repo y Vercel redespliega automáticamente (~1 min).</p>
</body>
</html>`;
}

module.exports = async (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    if (req.method === "GET") {
        return res.status(200).send(renderForm());
    }

    if (req.method !== "POST") {
        return res.status(405).send(renderForm('<div class="msg err">Método no permitido.</div>'));
    }

    const { imdbId, magnet, title, secret } = req.body || {};

    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
        return res.status(401).send(renderForm('<div class="msg err">Contraseña incorrecta.</div>'));
    }

    if (!imdbId || !/^tt[0-9]+$/.test(imdbId)) {
        return res.status(400).send(renderForm('<div class="msg err">ID de IMDb inválido, debe ser del tipo tt1234567.</div>'));
    }

    if (!title || !title.trim()) {
        return res.status(400).send(renderForm('<div class="msg err">Falta el título.</div>'));
    }

    let parsed;
    try {
        parsed = parseMagnet(magnet);
    } catch (err) {
        return res.status(400).send(renderForm(`<div class="msg err">${escapeHtml(err.message)}</div>`));
    }

    if (!process.env.GITHUB_TOKEN) {
        return res.status(500).send(renderForm('<div class="msg err">Falta configurar GITHUB_TOKEN en Vercel.</div>'));
    }

    const cinemeta = await fetchCinemetaMeta(imdbId);

    try {
        const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
        const ghHeaders = {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "stremio-addon-admin",
        };

        const getRes = await fetch(`${apiUrl}?ref=${BRANCH}`, { headers: ghHeaders });
        if (!getRes.ok) throw new Error(`No se pudo leer el fichero actual (${getRes.status})`);
        const getData = await getRes.json();
        const current = JSON.parse(Buffer.from(getData.content, "base64").toString("utf-8"));

        current[imdbId] = {
            infoHash: parsed.infoHash,
            sources: parsed.sources,
            title: title.trim(),
            name: (cinemeta && cinemeta.name) || title.trim(),
            poster: (cinemeta && cinemeta.poster) || null,
        };

        const newContent = Buffer.from(JSON.stringify(current, null, 2) + "\n", "utf-8").toString("base64");

        const putRes = await fetch(apiUrl, {
            method: "PUT",
            headers: ghHeaders,
            body: JSON.stringify({
                message: `Añadir stream para ${imdbId} vía panel admin`,
                content: newContent,
                sha: getData.sha,
                branch: BRANCH,
            }),
        });

        if (!putRes.ok) {
            const errBody = await putRes.text();
            throw new Error(`Error de la API de GitHub (${putRes.status}): ${errBody}`);
        }

        const posterNote = cinemeta && cinemeta.poster
            ? " Póster y nombre obtenidos de Cinemeta."
            : " No se encontró póster en Cinemeta (se guardó igualmente, aparecerá sin imagen en el catálogo).";

        return res.status(200).send(
            renderForm(`<div class="msg ok">Guardado. ${escapeHtml(imdbId)} → infoHash ${escapeHtml(parsed.infoHash)}.${posterNote} Vercel está redesplegando, estará online en ~1 min.</div>`)
        );
    } catch (err) {
        return res.status(500).send(renderForm(`<div class="msg err">${escapeHtml(err.message)}</div>`));
    }
};
