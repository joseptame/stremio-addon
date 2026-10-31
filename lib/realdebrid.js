// Resuelve un infoHash a un enlace HTTP directo vía Real-Debrid, usando la
// API key de cada usuario (nunca una clave compartida del addon). Si el
// torrent no está cacheado al instante en RD, o falla cualquier paso,
// devuelve null y el llamador debe recurrir al stream P2P normal.

const RD_API = "https://api.real-debrid.com/rest/1.0";

// Cuentas de Real-Debrid propias sobre las que el panel puede cachear un
// stream al guardarlo y cuyo estado de descarga se muestra en el listado.
// "id" se usa para el nombre del checkbox (rdCache<Id>) y como clave en los
// mapas de estado; "envVar" es la variable de entorno con la API key.
const RD_ACCOUNTS = [
    { id: "Jfuster", envVar: "RD_KEY_JFUSTER" },
    { id: "Ivan", envVar: "RD_KEY_IVAN" },
    { id: "Manolo", envVar: "RD_KEY_MANOLO" },
];

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

// Error de la API de RD al dar de alta un torrent, con su código (p. ej.
// "infringing_file" cuando RD tiene el hash bloqueado por copyright),
// para poder explicárselo al usuario en vez de un fallo genérico.
class RealDebridError extends Error {
    constructor(code, status) {
        super(code);
        this.code = code;
        this.status = status;
    }
}

async function rdAddError(res) {
    let code = `HTTP ${res.status}`;
    try {
        const body = await res.json();
        if (body && body.error) code = body.error;
    } catch {
        // Sin cuerpo JSON: se queda con el código HTTP.
    }
    return new RealDebridError(code, res.status);
}

const VIDEO_EXTENSION =/\.(mkv|mp4|avi|mov|wmv|m4v|ts|m2ts|webm|flv)$/i;

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
    if (!addRes.ok) throw await rdAddError(addRes);
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
    if (!addRes.ok) throw await rdAddError(addRes);
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

// La URL del streaming lleva la pista de audio y los subtítulos (que RD
// incrusta en la imagen) en el propio camino:
// .../t/<id>/<audio>/<subtítulos>/<códec>/<calidad>.m3u8
// Con mediaInfos se sacan las pistas del fichero para que el panel deje
// elegirlas, y se parte del audio en castellano o, si el fichero no lo
// tiene, de los subtítulos en castellano. RD por defecto suele poner inglés.
const SPANISH = /^(spa|es)/i;
async function streamTracks(headers, fileId, hls) {
    const parts = hls.split("/");
    const n = parts.length;
    if (n < 5) return null;
    try {
        const res = await fetchWithTimeout(`${RD_API}/streaming/mediaInfos/${fileId}`, { headers });
        if (!res.ok) return null;
        const details = (await res.json()).details || {};
        const list = (tracks) =>
            Object.keys(tracks || {}).map((key) => ({
                key,
                lang: tracks[key].lang_iso || key,
                label: tracks[key].lang || key,
            }));
        const audio = list(details.audio);
        const subtitles = list(details.subtitles);
        const spanish = (tracks) => (tracks.find((t) => SPANISH.test(t.lang)) || {}).key;

        let current = { audio: parts[n - 4], subtitles: parts[n - 3] };
        const spaAudio = spanish(audio);
        if (spaAudio) current.audio = spaAudio;
        else if (spanish(subtitles)) current.subtitles = spanish(subtitles);
        parts[n - 4] = current.audio;
        parts[n - 3] = current.subtitles;
        return { hls: parts.join("/"), tracks: { audio, subtitles, current } };
    } catch {
        return null;
    }
}

// Para reproducir en el panel una película ya descargada en la cuenta:
// busca el torrent por infoHash, desrestringe el enlace del fichero de
// vídeo más grande y pide a RD su versión en streaming. "hls" es la lista
// HLS (la reproduce el iPhone de forma nativa y el resto con hls.js, y RD
// la sirve con CORS abierto); "download" es el fichero original, por si
// el navegador lo reproduce tal cual. Devuelve null si no está descargado.
async function getPlayableStream(apiKey, infoHash) {
    if (!apiKey || !infoHash) return null;
    const headers = { Authorization: `Bearer ${apiKey}` };
    const hash = String(infoHash).toLowerCase();

    const list = await listTorrents(apiKey);
    const torrent = list.find((t) => (t.hash || "").toLowerCase() === hash && t.status === "downloaded");
    if (!torrent) return null;

    const infoRes = await fetchWithTimeout(`${RD_API}/torrents/info/${torrent.id}`, { headers });
    if (!infoRes.ok) return null;
    const info = await infoRes.json();
    if (!info.links || info.links.length === 0) return null;

    // Los enlaces van en el mismo orden que los ficheros seleccionados: se
    // elige el del vídeo más grande (no el sample ni los extras).
    const rank = (f) => (VIDEO_EXTENSION.test(f.path || "") ? 1e15 : 0) + (f.bytes || 0);
    const selected = (info.files || []).filter((f) => f.selected).slice(0, info.links.length);
    const best = selected.reduce((bi, f, i) => (rank(f) > rank(selected[bi]) ? i : bi), 0);

    const unRes = await fetchWithTimeout(`${RD_API}/unrestrict/link`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ link: info.links[best] || info.links[0] }),
    });
    if (!unRes.ok) return null;
    const un = await unRes.json();

    let hls = null;
    try {
        const trRes = await fetchWithTimeout(`${RD_API}/streaming/transcode/${un.id}`, { headers });
        if (trRes.ok) {
            const tr = await trRes.json();
            // "medium" (720p H.264): con fuentes 4K HEVC/HDR, "high" y
            // "original" muchas veces no llegan a entregar ni el primer
            // fragmento; "medium" arranca y lo reproduce cualquier equipo.
            const apple = tr.apple || {};
            hls = apple.medium || apple.high || apple.original || Object.values(apple)[0] || null;
        }
    } catch {
        // Sin streaming se intenta con el fichero original.
    }
    const withTracks = hls ? await streamTracks(headers, un.id, hls) : null;

    return {
        filename: un.filename || "",
        mimeType: un.mimeType || "",
        download: un.download || null,
        hls: withTracks ? withTracks.hls : hls,
        tracks: withTracks ? withTracks.tracks : null,
    };
}

// Da de alta el torrent en la cuenta de RD para que empiece a cachearlo
// ya mismo (en vez de esperar a que alguien le dé a reproducir). Se usa
// desde /admin al añadir una película. Si se pasa torrentBuffer (el
// .torrent descargado de Prowlarr), se sube el fichero real en vez de un
// magnet — más fiable para trackers privados, ver addTorrentFileAndSelect.
// Devuelve { started, cached }, { error } si RD rechaza el torrent (con su
// código, p. ej. "infringing_file") o null si falla la llamada a la API.
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
    } catch (err) {
        if (err instanceof RealDebridError) return { started: false, error: err.code };
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

// Mapa infoHash (minúsculas) → { status, progress, speed, seeders } para
// pintar el progreso de cada película en el listado de /admin.
function torrentsByHash(torrents) {
    const map = {};
    (torrents || []).forEach((t) => {
        if (t.hash) map[t.hash.toLowerCase()] = { status: t.status, progress: t.progress, speed: t.speed, seeders: t.seeders };
    });
    return map;
}

// Estados de RD que no son "descargando X%", en castellano.
const RD_STATUS_LABELS = {
    queued: "En cola",
    magnet_conversion: "Buscando metadatos",
    waiting_files_selection: "Esperando selección",
    compressing: "Procesando",
    uploading: "Procesando",
    magnet_error: "Error del magnet",
    error: "Error",
    virus: "Virus detectado",
    dead: "Sin fuentes",
};

function formatSpeed(bytesPerSec) {
    if (!bytesPerSec) return "";
    const mb = bytesPerSec / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1).replace(".", ",")} MB/s` : `${Math.round(bytesPerSec / 1024)} KB/s`;
}

// { pct, label } de un torrent de torrentsByHash, o null si no está.
function describeTorrent(t) {
    if (!t) return null;
    if (t.status === "downloaded") return { pct: 100, label: "listo" };
    const pct = typeof t.progress === "number" ? Math.floor(t.progress) : 0;
    if (t.status === "downloading") {
        const extra = [formatSpeed(t.speed), typeof t.seeders === "number" ? `${t.seeders} seeders` : ""].filter(Boolean);
        return { pct, label: [`${pct}%`, ...extra].join(" · ") };
    }
    return { pct, label: RD_STATUS_LABELS[t.status] || t.status || "?" };
}

// Estado de una película en cada cuenta (siempre las tres, para la ficha):
// "ok" si la tiene, "missing" si no y "nokey" si en este entorno no hay API
// key de esa cuenta (p. ej. en local). maps: id de cuenta → torrentsByHash.
function accountStates(infoHash, maps) {
    const hashKey = String(infoHash || "").toLowerCase();
    return RD_ACCOUNTS.map((acc) => {
        if (!process.env[acc.envVar]) return { id: acc.id, state: "nokey", pct: 0, label: "Sin clave" };
        const info = describeTorrent(((maps && maps[acc.id]) || {})[hashKey]);
        return info
            ? { id: acc.id, state: "ok", pct: info.pct, label: info.label }
            : { id: acc.id, state: "missing", pct: 0, label: "No añadida" };
    });
}

// torrentsByHash de cada cuenta con clave en este entorno.
async function loadAccountMaps() {
    const lists = await Promise.all(RD_ACCOUNTS.map((acc) => listTorrents(process.env[acc.envVar])));
    const maps = {};
    RD_ACCOUNTS.forEach((acc, i) => { maps[acc.id] = torrentsByHash(lists[i]); });
    return maps;
}

// El segmento de configuración en la URL tiene forma "rd=<APIKEY>".
function parseRdKeyFromConfig(config) {
    if (!config) return null;
    const match = String(config).match(/^rd=(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
}

module.exports = {
    RD_ACCOUNTS,
    getPlayableStream,
    resolveRealDebridLink,
    triggerRealDebridCache,
    parseRdKeyFromConfig,
    buildMagnetUri,
    listTorrents,
    torrentsByHash,
    accountStates,
    loadAccountMaps,
};
