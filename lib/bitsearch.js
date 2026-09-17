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

// Necesario porque el español es minoría en casi cualquier búsqueda: con
// sort=seeders y una sola página (como se hacía al principio), los pocos
// resultados en español de una franquicia grande ("resident evil") quedan
// fuera de los primeros 100 por tener menos seeders/relevancia que las
// decenas de versiones en otros idiomas — con una query concreta
// ("resident evil 6") hay tan pocos resultados en total que sí entran.
//
// Para cubrir el máximo posible, se pide primero la página 1 (que informa
// de pagination.totalPages) y luego TODAS las páginas restantes que
// reporte la API, en paralelo (no una tras otra: las funciones serverless
// de Vercel tienen un límite de ejecución corto, 10s en plan Hobby si no
// se configura maxDuration, y varias peticiones secuenciales de hasta 15s
// cada una lo agotan de sobra). SAFETY_CAP_PAGES pone un techo para
// búsquedas extremadamente genéricas (con miles de páginas): sin él, una
// ráfaga de cientos de peticiones simultáneas al mismo host puede hacer
// que Cloudflare las bloquee todas, y además vaciaría el cupo diario
// (200-1000 peticiones) de un solo golpe.
const SAFETY_CAP_PAGES = 20;
const PAGE_TIMEOUT_MS = 8000;

async function fetchSearchPage(query, category, page, headers) {
    // Sin "sort": la API usa relevancia por defecto. Pasar sort=relevance
    // explícito junto con "page" hace que bitsearch.eu devuelva error 500.
    const params = new URLSearchParams({ q: query, limit: "100", page: String(page) });
    if (category) params.set("category", category);

    const res = await fetchWithTimeout(`${BASE_URL}/search?${params.toString()}`, { headers }, PAGE_TIMEOUT_MS);
    if (!res.ok) {
        if (res.status === 429) throw new Error("Límite diario de peticiones a bitsearch.eu agotado.");
        if (res.status === 520) throw new Error("bitsearch.eu no respondió correctamente (520, protección de Cloudflare). Prueba de nuevo en unos segundos.");
        throw new Error(`bitsearch.eu respondió con error ${res.status}`);
    }
    const data = await res.json();
    if (!data.success) throw new Error("bitsearch.eu no pudo procesar la búsqueda.");
    return data;
}

function toResult(r) {
    return {
        title: r.title || "",
        size: r.size || null,
        seeders: typeof r.seeders === "number" ? r.seeders : null,
        leechers: typeof r.leechers === "number" ? r.leechers : null,
        category: r.category || null,
        verified: !!r.verified,
        year: extractYear(r.title),
        createdAt: r.createdAt || null,
        magnet: buildMagnetUri(r.infohash, r.title),
    };
}

async function searchBitsearch(query, scope) {
    const { category } = SEARCH_SCOPES[scope] || {};
    const apiKey = (process.env.BITSEARCH_API_KEY || "").trim();
    // Cloudflare (delante de bitsearch.eu) devuelve 520 a peticiones sin
    // User-Agent de navegador, como el fetch por defecto de Node.
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
    };

    // La primera página se pide sola: si falla (520, 429...), se propaga
    // el error tal cual, como antes.
    const first = await fetchSearchPage(query, category, 1, headers);
    const matches = (first.results || []).filter((r) => isSpanish(r.title)).map(toResult);

    const totalPages = (first.pagination && first.pagination.totalPages) || 1;
    const targetPages = Math.min(totalPages, SAFETY_CAP_PAGES);

    if (targetPages > 1) {
        const remaining = Array.from({ length: targetPages - 1 }, (_, i) => i + 2);
        const settled = await Promise.allSettled(
            remaining.map((page) => fetchSearchPage(query, category, page, headers))
        );
        settled.forEach((outcome) => {
            if (outcome.status === "fulfilled") {
                matches.push(...(outcome.value.results || []).filter((r) => isSpanish(r.title)).map(toResult));
            }
            // Los fallos de páginas adicionales se ignoran: ya se
            // consiguió al menos la página 1.
        });
    }

    return matches.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
}

module.exports = { searchBitsearch, isSpanish };
