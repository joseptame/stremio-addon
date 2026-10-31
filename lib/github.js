// Lectura y escritura de ficheros JSON del propio repo vía la API de
// GitHub (el catálogo, la lista de deseos...). Cada escritura es un commit
// en master, y Vercel redespliega con el fichero nuevo.

const OWNER = "joseptame";
const REPO = "stremio-addon";
const BRANCH = "master";

function githubHeaders() {
    if (!process.env.GITHUB_TOKEN) throw new Error("Falta configurar GITHUB_TOKEN en Vercel.");
    return {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "stremio-addon-admin",
    };
}

function contentsUrl(path) {
    return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
}

// { data, sha } del fichero; si aún no existe, data = fallback y sha = null
// (la primera escritura lo crea).
async function readJsonFile(path, fallback) {
    const res = await fetch(`${contentsUrl(path)}?ref=${BRANCH}`, { headers: githubHeaders() });
    if (res.status === 404 && fallback !== undefined) return { data: fallback, sha: null };
    if (!res.ok) throw new Error(`No se pudo leer ${path} (${res.status})`);
    const body = await res.json();
    return { data: JSON.parse(Buffer.from(body.content, "base64").toString("utf-8")), sha: body.sha };
}

// Escribe el fichero (commit en master) y devuelve el sha del commit.
async function writeJsonFile(path, data, sha, message) {
    const content = Buffer.from(JSON.stringify(data, null, 2) + "\n", "utf-8").toString("base64");
    const res = await fetch(contentsUrl(path), {
        method: "PUT",
        headers: githubHeaders(),
        body: JSON.stringify({ message, content, branch: BRANCH, ...(sha ? { sha } : {}) }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`Error de la API de GitHub (${res.status}): ${raw}`);
    let body;
    try {
        body = JSON.parse(raw);
    } catch {
        throw new Error(`Respuesta de GitHub no válida: ${raw.slice(0, 300)}`);
    }
    if (!body || !body.commit || !body.commit.sha) {
        throw new Error(`GitHub no devolvió un commit (respuesta inesperada): ${raw.slice(0, 300)}`);
    }
    return body.commit.sha;
}

module.exports = { readJsonFile, writeJsonFile };
