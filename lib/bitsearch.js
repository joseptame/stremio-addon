// Busca torrents en la API pública de bitsearch.eu (https://bitsearch.eu/api).
// No requiere infraestructura propia: sin BITSEARCH_API_KEY va limitado a
// 200 peticiones/día por IP; con la clave (opcional, cuenta gratis en
// bitsearch.eu), 1000/día.
//
// A diferencia de Prowlarr, la búsqueda ya da el infoHash directamente (no
// hace falta descargar y parsear el .torrent), así que el magnet se puede
// construir al vuelo. bitsearch no incluye trackers en la respuesta de
// búsqueda, así que se añaden unos trackers públicos conocidos para que el
// magnet tenga más probabilidades de encontrar peers vía DHT.

const BASE_URL = "https://bitsearch.eu/api/v1";

const PUBLIC_TRACKERS = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://open.tracker.cl:1337/announce",
    "udp://tracker.openbittorrent.com:6969/announce",
    "udp://explodie.org:6969/announce",
];

// "Castellano", "Español"/"Espanol", "Spanish", o la etiqueta de idioma
// "ES" suelta en el título (p.ej. "Movie 2024 1080p ES WEB-DL" o
// "[ES]"). LATINO_HINTS excluye el español latinoamericano.
const SPANISH_HINTS = /castellano|espa[ñn]ol|\bspanish\b|(^|[.\-_ [(])es([.\-_ \])]|$)/i;
const LATINO_HINTS = /latino|\blat\b/i;

function isSpanish(title) {
    return SPANISH_HINTS.test(title || "") && !LATINO_HINTS.test(title || "");
}

function extractYear(title) {
    const m = (title || "").match(/\((19|20)\d{2}\)|\b(19|20)\d{2}\b/);
    return m ? m[0].replace(/[()]/g, "") : null;
}

function buildMagnetUri(infohash, title) {
    const trackers = PUBLIC_TRACKERS.map((t) => "tr=" + encodeURIComponent(t)).join("&");
    return `magnet:?xt=urn:btih:${infohash}&dn=${encodeURIComponent(title || "")}&${trackers}`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// scope: "movie" (category 2), "tv" (category 3), o cualquier otra cosa
// para no filtrar por categoría.
const SEARCH_SCOPES = {
    movie: { category: "2" },
    tv: { category: "3" },
};

async function searchBitsearch(query, scope) {
    const { category } = SEARCH_SCOPES[scope] || {};
    const params = new URLSearchParams({ q: query, limit: "100", sort: "seeders", order: "desc" });
    if (category) params.set("category", category);

    const apiKey = (process.env.BITSEARCH_API_KEY || "").trim();
    // Cloudflare (delante de bitsearch.eu) devuelve 520 a peticiones sin
    // User-Agent de navegador, como el fetch por defecto de Node.
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
    };

    const res = await fetchWithTimeout(`${BASE_URL}/search?${params.toString()}`, { headers });
    if (!res.ok) {
        if (res.status === 429) throw new Error("Límite diario de peticiones a bitsearch.eu agotado.");
        if (res.status === 520) throw new Error("bitsearch.eu no respondió correctamente (520, protección de Cloudflare). Prueba de nuevo en unos segundos.");
        throw new Error(`bitsearch.eu respondió con error ${res.status}`);
    }
    const data = await res.json();
    if (!data.success) throw new Error("bitsearch.eu no pudo procesar la búsqueda.");

    return (data.results || [])
        .filter((r) => isSpanish(r.title))
        .map((r) => ({
            title: r.title || "",
            size: r.size || null,
            seeders: typeof r.seeders === "number" ? r.seeders : null,
            leechers: typeof r.leechers === "number" ? r.leechers : null,
            category: r.category || null,
            verified: !!r.verified,
            year: extractYear(r.title),
            createdAt: r.createdAt || null,
            magnet: buildMagnetUri(r.infohash, r.title),
        }))
        .sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
}

module.exports = { searchBitsearch, isSpanish };
