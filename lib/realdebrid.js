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

// Añade el magnet a la cuenta de RD y selecciona sus ficheros, lo que
// dispara la descarga/caché en la infraestructura de RD. Devuelve el
// estado del torrent tras ese paso, o null si algo falla.
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

    const info1Res = await fetchWithTimeout(`${RD_API}/torrents/info/${id}`, { headers });
    if (!info1Res.ok) return null;
    const info1 = await info1Res.json();
    const fileIds = (info1.files || []).map((f) => f.id).join(",") || "all";

    await fetchWithTimeout(`${RD_API}/torrents/selectFiles/${id}`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ files: fileIds }),
    });

    const info2Res = await fetchWithTimeout(`${RD_API}/torrents/info/${id}`, { headers });
    if (!info2Res.ok) return null;
    return info2Res.json();
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

// Da de alta el magnet en la cuenta de RD para que empiece a cachearlo ya
// mismo (en vez de esperar a que alguien le dé a reproducir). Se usa desde
// /admin al añadir una película. Devuelve { started, cached } o null si
// falla la llamada a la API.
async function triggerRealDebridCache(apiKey, infoHash, sources) {
    if (!apiKey) return null;
    try {
        const info = await addAndSelectFiles(apiKey, infoHash, sources);
        if (!info) return null;
        return {
            started: true,
            cached: info.status === "downloaded" && !!(info.links && info.links.length),
        };
    } catch {
        return null;
    }
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
};
