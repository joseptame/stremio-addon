// Busca torrents en una instancia de Prowlarr (agregador de indexers) por
// texto libre, para el buscador de /admin. Para cada resultado se intenta
// construir un magnet link: directo si el indexer ya da magnetUrl/infoHash
// (típico de trackers públicos), o si no, descargando el .torrent a través
// del proxy de Prowlarr y calculando el infoHash a partir de su bencode
// (típico de trackers privados, que no exponen el hash en la búsqueda).
//
// Requiere PROWLARR_URL (ej. https://mi-prowlarr.ejemplo.com, sin barra
// final) y PROWLARR_API_KEY configurados como variables de entorno en el
// servidor (nunca en el cliente).

const crypto = require("crypto");
const { buildMagnetUri } = require("./realdebrid");

const SPANISH_HINTS = /castellano|espa[ñn]ol|\bspanish\b|\[es\]|\bes-es\b/i;
const LATINO_HINTS = /latino|\blat\b/i;

function isSpainSpanish(title) {
    return SPANISH_HINTS.test(title || "") && !LATINO_HINTS.test(title || "");
}

// Deduce "Película" / "Serie" a partir de las categorías Torznab que
// devuelve Prowlarr (2000-2999 = Movies, 5000-5999 = TV, en el árbol
// estándar de categorías, aunque cada indexer puede anidarlas distinto).
function flattenCategories(categories) {
    const out = [];
    (categories || []).forEach((c) => {
        if (!c) return;
        out.push(c);
        if (Array.isArray(c.subCategories)) out.push(...flattenCategories(c.subCategories));
    });
    return out;
}

function contentTypeLabel(categories) {
    const flat = flattenCategories(categories);
    if (flat.length === 0) return null;
    const isMovie = (c) => (c.id >= 2000 && c.id < 3000) || /movie/i.test(c.name || "");
    const isTv = (c) => (c.id >= 5000 && c.id < 6000) || /\btv\b|anime/i.test(c.name || "");
    const hasMovie = flat.some(isMovie);
    const hasTv = flat.some(isTv);
    if (hasMovie && hasTv) return "Película/Serie";
    if (hasMovie) return "Película";
    if (hasTv) return "Serie";
    return null;
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

// ── Bencode mínimo: solo lo necesario para aislar los bytes exactos del
// diccionario "info" de un .torrent y calcular su SHA1 (= infoHash). No
// decodifica el resto del fichero, solo lo recorre para saltárselo.
function readBencodeString(buf, pos) {
    const colon = buf.indexOf(0x3a, pos);
    const len = parseInt(buf.toString("latin1", pos, colon), 10);
    const start = colon + 1;
    const end = start + len;
    return { value: buf.slice(start, end), next: end };
}

function skipBencodeValue(buf, pos) {
    const c = buf[pos];
    if (c === 0x64) {
        // 'd' — diccionario
        pos++;
        while (buf[pos] !== 0x65) {
            const key = readBencodeString(buf, pos);
            pos = skipBencodeValue(buf, key.next);
        }
        return pos + 1;
    }
    if (c === 0x6c) {
        // 'l' — lista
        pos++;
        while (buf[pos] !== 0x65) {
            pos = skipBencodeValue(buf, pos);
        }
        return pos + 1;
    }
    if (c === 0x69) {
        // 'i' — entero
        return buf.indexOf(0x65, pos) + 1;
    }
    // string con prefijo de longitud
    return readBencodeString(buf, pos).next;
}

function infoHashFromTorrentBytes(buf) {
    if (buf[0] !== 0x64) throw new Error("Fichero .torrent inválido");
    let pos = 1;
    while (buf[pos] !== 0x65) {
        const key = readBencodeString(buf, pos);
        if (key.value.toString("latin1") === "info") {
            const infoEnd = skipBencodeValue(buf, key.next);
            return crypto.createHash("sha1").update(buf.slice(key.next, infoEnd)).digest("hex");
        }
        pos = skipBencodeValue(buf, key.next);
    }
    throw new Error("El .torrent no contiene la clave 'info'");
}

// Resuelve el magnet de un resultado: directo si es posible, o descargando
// el .torrent y calculando el hash si el indexer solo da un enlace de
// descarga (caso típico de trackers privados en España).
async function resolveMagnet(r, apiKey) {
    if (r.downloadUrl && /^magnet:/i.test(r.downloadUrl)) return r.downloadUrl;
    if (r.magnetUrl && /^magnet:/i.test(r.magnetUrl)) return r.magnetUrl;
    if (r.infoHash) return buildMagnetUri(String(r.infoHash).toLowerCase(), []);
    if (!r.downloadUrl) return null;

    try {
        const res = await fetchWithTimeout(r.downloadUrl, { headers: { "X-Api-Key": apiKey } }, 12000);
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        const infoHash = infoHashFromTorrentBytes(buf);
        return buildMagnetUri(infoHash, []);
    } catch {
        return null;
    }
}

// Resuelve un array con un límite de peticiones en vuelo a la vez: lanzar
// decenas de descargas de .torrent de golpe contra el mismo tracker privado
// hace que muchas se rechacen por límite de conexiones simultáneas, y esos
// resultados se pierden en silencio (el catch de arriba los descarta).
async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

// Ámbito de la búsqueda: a qué tipo de contenido y categoría de Prowlarr
// restringirla. "all" no manda categoría (deja que cada indexer devuelva
// lo que tenga, de cualquier tipo).
const SEARCH_SCOPES = {
    movie: { type: "movie-search", categories: "2000" },
    tv: { type: "tv-search", categories: "5000" },
    all: { type: "search", categories: null },
};

async function searchProwlarr(query, scope) {
    // .trim() también recorta un BOM inicial (U+FEFF cuenta como whitespace
    // en JS), por si la variable de entorno se guardó con ese carácter
    // colado desde alguna terminal.
    const base = (process.env.PROWLARR_URL || "").trim();
    const apiKey = (process.env.PROWLARR_API_KEY || "").trim();
    if (!base || !apiKey) {
        throw new Error("Prowlarr no está configurado (faltan PROWLARR_URL / PROWLARR_API_KEY en el servidor).");
    }

    const { type, categories } = SEARCH_SCOPES[scope] || SEARCH_SCOPES.movie;
    const categoriesParam = categories ? `&categories=${categories}` : "";
    const url = `${base.replace(/\/$/, "")}/api/v1/search?query=${encodeURIComponent(query)}&type=${type}${categoriesParam}`;
    const res = await fetchWithTimeout(url, { headers: { "X-Api-Key": apiKey } });
    if (!res.ok) {
        throw new Error(`Prowlarr respondió con error ${res.status}`);
    }
    const data = await res.json();
    // Las descargas de .torrent contra algunos trackers (NOBS) se sirven en
    // fila, no en paralelo, tenga la concurrencia que tenga este código —
    // así que en vez de intentar resolver "los primeros N" (orden arbitrario
    // de Prowlarr), se ordena por seeders antes de recortar, para gastar el
    // tiempo disponible en los mejores resultados primero.
    const candidates = [...data]
        .sort((a, b) => (b.seeders || 0) - (a.seeders || 0))
        .slice(0, 15);

    const withMagnets = await mapWithConcurrency(candidates, 4, async (r) => ({
        title: r.title || "",
        indexer: r.indexer || "",
        size: r.size || null,
        seeders: typeof r.seeders === "number" ? r.seeders : null,
        leechers: typeof r.leechers === "number" ? r.leechers : null,
        publishDate: r.publishDate || null,
        magnet: await resolveMagnet(r, apiKey),
        isSpainSpanish: isSpainSpanish(r.title),
        contentType: contentTypeLabel(r.categories),
        // No todos los indexers dan carátula: Prowlarr solo la expone
        // cuando el propio indexer la incluye en su página de resultados.
        poster: r.posterUrl || null,
    }));

    return withMagnets.filter((r) => !!r.magnet).sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
}

module.exports = { searchProwlarr, isSpainSpanish };
