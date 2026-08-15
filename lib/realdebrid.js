// Resuelve un infoHash a un enlace HTTP directo vía Real-Debrid, usando la
// API key de cada usuario (nunca una clave compartida del addon). Si el
// torrent no está cacheado al instante en RD, o falla cualquier paso,
// devuelve null y el llamador debe recurrir al stream P2P normal.

const RD_API = "https://api.real-debrid.com/rest/1.0";

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function buildMagnetUri(infoHash, sources) {
    const trackers = (sources || [])
        .filter((s) => s.startsWith("tracker:"))
        .map((s) => "tr=" + encodeURIComponent(s.slice("tracker:".length)));
    return `magnet:?xt=urn:btih:${infoHash}${trackers.length ? "&" + trackers.join("&") : ""}`;
}

const VIDEO_EXTENSION = /\.(mkv|mp4|avi|mov|wmv|m4v|ts|m2ts|webm|flv)$/i;

// De la lista de ficheros de un torrent, se queda solo con los de vídeo
// (si hay alguno): .nfo, .txt, samples, subtítulos sueltos, etc. no
// deben seleccionarse — si se seleccionan a la vez que el vídeo, RD
// puede devolver el enlace equivocado o empaquetarlo todo junto.
function pickFileIds(files) {
    const all = files || [];
    const videos = all.filter((f) => VIDEO_EXTENSION.test(f.path || f.filename || ""));
    const chosen = videos.length > 0 ? videos : all;
    return chosen.map((f) => f.id).join(",") || "all";
}

// Común a addMagnet y addTorrent: una vez RD tiene el torrent dado de
// alta con un id, selecciona sus ficheros (dispara la descarga/caché) y
// devuelve el estado resultante, o null si algo falla.
async function selectFilesAndGetInfo(apiKey, id) {
    const headers = { Authorization: `Bearer ${apiKey}` };

    // Justo tras dar de alta el torrent, RD puede tardar un pelín en tener
    // la lista de ficheros lista (sobre todo subiendo el .torrent en vez
    // de un magnet) — sin ficheros que seleccionar, selectFiles no llega a
    // arrancar la descarga y se queda "esperando selección" en la web.
    let info1 = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        const info1Res = await fetchWithTimeout(`${RD_API}/torrents/info/${id}`, { headers });
        if (!info1Res.ok) return null;
        info1 = await info1Res.json();
        if ((info1.files || []).length > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 800));
    }
    const fileIds = pickFileIds(info1.files);

    const selectRes = await fetchWithTimeout(`${RD_API}/torrents/selectFiles/${id}`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ files: fileIds }),
    });
    if (!selectRes.ok) return null;

    const info2Res = await fetchWithTimeout(`${RD_API}/torrents/info/${id}`, { headers });
    if (!info2Res.ok) return null;
    return info2Res.json();
}

// Añade el magnet a la cuenta de RD y selecciona sus ficheros. Con un
// magnet, RD tiene que negociar los metadatos con algún peer antes de
// poder empezar — si nadie en el swarm se los da (típico de trackers
// privados), RD lo rechaza aunque el torrent esté vivo (ver
// addTorrentFileAndSelect, que evita justo este paso).
async function addAndSelectFiles(apiKey, infoHash, sources) {
    const headers = { Authorization: `Bearer ${apiKey}` };
    const magnet = buildMagnetUri(infoHash, sources);

    const addRes = await fetchWithTimeout(`${RD_API}/torrents/addMagnet`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ magnet }),
    });
    if (!addRes.ok) return null;
    const { id } = await addRes.json();
    if (!id) return null;

    return selectFilesAndGetInfo(apiKey, id);
}

// Igual que addAndSelectFiles, pero subiendo el .torrent real en vez de
// un magnet: RD ya tiene los metadatos (piece hashes, lista de ficheros)
// sin depender de que ningún peer se los mande primero.
async function addTorrentFileAndSelect(apiKey, torrentBuffer) {
    const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-bittorrent",
    };

    const addRes = await fetchWithTimeout(`${RD_API}/torrents/addTorrent`, {
        method: "PUT",
        headers,
        body: torrentBuffer,
    });
    if (!addRes.ok) return null;
    const { id } = await addRes.json();
    if (!id) return null;

    return selectFilesAndGetInfo(apiKey, id);
}

async function resolveRealDebridLink(apiKey, infoHash, sources) {
    if (!apiKey) return null;
    try {
        const info = await addAndSelectFiles(apiKey, infoHash, sources);
        if (!info || info.status !== "downloaded" || !info.links || info.links.length === 0) {
            // No está cacheado al instante: RD ya ha empezado a descargarlo
            // en su infraestructura para la próxima vez, pero esta petición
            // no puede esperar. Se recurre al stream P2P normal.
            return null;
        }

        const headers = { Authorization: `Bearer ${apiKey}` };
        const unrestrictRes = await fetchWithTimeout(`${RD_API}/unrestrict/link`, {
            method: "POST",
            headers,
            body: new URLSearchParams({ link: info.links[0] }),
        });
        if (!unrestrictRes.ok) return null;
        const unrestrictData = await unrestrictRes.json();
        return unrestrictData.download || null;
    } catch {
        return null;
    }
}

// Da de alta el torrent en la cuenta de RD para que empiece a cachearlo
// ya mismo (en vez de esperar a que alguien le dé a reproducir). Se usa
// desde /admin al añadir una película. Si se pasa torrentBuffer (el
// .torrent descargado de Prowlarr), se sube el fichero real en vez de un
// magnet — más fiable para trackers privados, ver addTorrentFileAndSelect.
// Devuelve { started, cached } o null si falla la llamada a la API.
async function triggerRealDebridCache(apiKey, infoHash, sources, torrentBuffer) {
    if (!apiKey) return null;
    try {
        const info = torrentBuffer
            ? await addTorrentFileAndSelect(apiKey, torrentBuffer)
            : await addAndSelectFiles(apiKey, infoHash, sources);
        if (!info) return null;
        return {
            started: true,
            cached: info.status === "downloaded" && !!(info.links && info.links.length),
        };
    } catch {
        return null;
    }
}

// Todos los torrents de una cuenta de RD (para el panel de /admin, que
// quiere mostrar el progreso de cada película sin tener que guardar el
// id de RD de cada una — se busca por infoHash en la lista completa).
async function listTorrents(apiKey) {
    if (!apiKey) return [];
    try {
        const headers = { Authorization: `Bearer ${apiKey}` };
        const res = await fetchWithTimeout(`${RD_API}/torrents?limit=100`, { headers }, 10000);
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}

// Mapa infoHash (minúsculas) → { status, progress } para pintar el
// progreso de cada película en el listado de /admin de un vistazo.
function torrentsByHash(torrents) {
    const map = {};
    (torrents || []).forEach((t) => {
        if (t.hash) map[t.hash.toLowerCase()] = { status: t.status, progress: t.progress };
    });
    return map;
}

// El segmento de configuración en la URL tiene forma "rd=<APIKEY>".
function parseRdKeyFromConfig(config) {
    if (!config) return null;
    const match = String(config).match(/^rd=(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
}

module.exports = {
    resolveRealDebridLink,
    triggerRealDebridCache,
    parseRdKeyFromConfig,
    buildMagnetUri,
    listTorrents,
    torrentsByHash,
};
