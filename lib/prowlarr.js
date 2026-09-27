// Busca torrents en una instancia de Prowlarr (agregador de indexers) por
// texto libre, para el buscador de /admin. La búsqueda en sí es rápida
// (igual que la propia web de Prowlarr): solo lee los metadatos que ya
// vienen en la respuesta de búsqueda, sin descargar nada. El magnet de
// cada resultado se resuelve aparte, bajo demanda, cuando el admin elige
// uno concreto — resolverlos todos de antemano es lo que hacía la
// búsqueda lentísima (algunos trackers como NOBS sirven las descargas de
// .torrent en fila, no en paralelo, y con 79 resultados eso son minutos).
//
// Requiere PROWLARR_URL (ej. https://mi-prowlarr.ejemplo.com, sin barra
// final) y PROWLARR_API_KEY configurados como variables de entorno en el
// servidor (nunca en el cliente).

const crypto = require("crypto");
const { buildMagnetUri } = require("./realdebrid");
const { searchMoviePoster } = require("./tmdb");

const SPANISH_HINTS = /castellano|espa[ñn]ol|\bspanish\b|\[es\]|\bes-es\b/i;
const LATINO_HINTS = /latino|\blat\b/i;

// Trackers que indexan por título en castellano (DivxTotal, DonTorrent...),
// no por el título original en inglés. A estos solo se les envía el título
// en español; los demás (TPB...) necesitan además el original en inglés.
const SPANISH_TITLE_INDEXERS = ["divxtotal"];

// Trackers propios (privados) que deben aparecer primero en los resultados
// cuando se busca en "Todos", por delante del resto (ordenados por tamaño).
const PRIORITY_INDEXERS = ["nobs", "milnueve"];

function indexerPriority(indexerName) {
    const name = String(indexerName || "").toLowerCase();
    const idx = PRIORITY_INDEXERS.findIndex((p) => name.includes(p));
    return idx === -1 ? PRIORITY_INDEXERS.length : idx;
}

function isSpainSpanish(title) {
    return SPANISH_HINTS.test(title || "") && !LATINO_HINTS.test(title || "");
}

// Prowlarr no da el año de estreno de la película, solo el título del
// release — pero casi todos lo llevan, ya sea entre paréntesis o suelto
// (p. ej. "Avatar.Aang.2026.2160p..."). Útil para distinguir remakes.
function extractYear(title) {
    const m = (title || "").match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : null;
}

// De un título de release saca un título limpio y el año, quitando los
// separadores (. _), el año y toda la morralla de release (resolución,
// codec, audio, "SPANISH", "DUAL", grupo...). Se usa para buscar el póster
// correcto de cada resultado cuando el indexer no lo trae.
// DivxTotal devuelve títulos tipo "Mascotas 2 1080P DUAL SPANISH BDRip x264"
// (sin año y con sufijos), así que hay que filtrar esos tokens sueltos.
const JUNK_TOKEN = /^(1080p|720p|2160p|480p|4k|uhd|hd|bdrip|brrip|dvdrip|dvd|dvdr|hdtv|webrip|web[-]?dl|hdcam|screener|vhsrip|remux|bdremux|microhd|dvd9|pal|ntsc|x264|x265|h264|h265|hevc|xvid|avc|mpeg|dual|spanish|castellano|espanol|español|ac3|atmos|aac|ddp[0-9.]*|dd[0-9.]*|dts[0-9.]*|multi|ita|eng|spa|sub|hdr[0-9+]*|dv|10bit|8bit|leak|pmntp)$/i;

function parseReleaseTitle(title) {
    const s = String(title || "").replace(/[._]/g, " ");
    const m = s.match(/\b(19|20)\d{2}\b/);
    const year = m ? m[0] : "";
    const beforeYear = m ? s.slice(0, m.index) : s;

    const tokens = beforeYear
        .split(/[\s\-]+/)
        .map((t) => t.trim())
        .filter((t) => t && !JUNK_TOKEN.test(t));

    let cleanTitle = tokens.join(" ").replace(/\s+/g, " ").trim();
    if (cleanTitle.length < 2) cleanTitle = s.replace(/\s+/g, " ").trim();
    return { cleanTitle, year };
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

// Decodifica un valor bencode cualquiera a JS (a diferencia de
// skipBencodeValue, que solo avanza la posición). Se usa para leer
// "announce"/"announce-list" — el resto del fichero (en particular
// "info", que puede ser grande) se sigue saltando sin decodificar.
function decodeBencodeValue(buf, pos) {
    const c = buf[pos];
    if (c === 0x64) {
        pos++;
        const obj = {};
        while (buf[pos] !== 0x65) {
            const key = readBencodeString(buf, pos);
            const val = decodeBencodeValue(buf, key.next);
            obj[key.value.toString("latin1")] = val.value;
            pos = val.next;
        }
        return { value: obj, next: pos + 1 };
    }
    if (c === 0x6c) {
        pos++;
        const arr = [];
        while (buf[pos] !== 0x65) {
            const val = decodeBencodeValue(buf, pos);
            arr.push(val.value);
            pos = val.next;
        }
        return { value: arr, next: pos + 1 };
    }
    if (c === 0x69) {
        const end = buf.indexOf(0x65, pos);
        return { value: parseInt(buf.toString("latin1", pos + 1, end), 10), next: end + 1 };
    }
    const s = readBencodeString(buf, pos);
    return { value: s.value.toString("utf8"), next: s.next };
}

// infoHash + trackers (announce/announce-list) de un .torrent. Los
// trackers son imprescindibles para los que vienen de trackers privados
// (NOBS, Milnueve...): esos torrents no están en la DHT pública, así que
// un magnet sin su tracker no encuentra peers aunque el hash sea
// correcto — Real-Debrid lo rechaza como "Invalid Magnet".
function parseTorrentBytes(buf) {
    if (buf[0] !== 0x64) throw new Error("Fichero .torrent inválido");
    let pos = 1;
    let infoHash = null;
    const trackers = [];
    while (buf[pos] !== 0x65) {
        const key = readBencodeString(buf, pos);
        const keyStr = key.value.toString("latin1");
        if (keyStr === "info") {
            const infoEnd = skipBencodeValue(buf, key.next);
            infoHash = crypto.createHash("sha1").update(buf.slice(key.next, infoEnd)).digest("hex");
            pos = infoEnd;
        } else if (keyStr === "announce") {
            const decoded = decodeBencodeValue(buf, key.next);
            if (typeof decoded.value === "string") trackers.push(decoded.value);
            pos = decoded.next;
        } else if (keyStr === "announce-list") {
            const decoded = decodeBencodeValue(buf, key.next);
            (decoded.value || []).forEach((tier) => {
                (tier || []).forEach((u) => { if (typeof u === "string") trackers.push(u); });
            });
            pos = decoded.next;
        } else {
            pos = skipBencodeValue(buf, key.next);
        }
    }
    if (!infoHash) throw new Error("El .torrent no contiene la clave 'info'");
    return { infoHash, trackers: [...new Set(trackers)] };
}

// El downloadUrl que da Prowlarr lleva su apikey como query param — nunca
// se manda al cliente tal cual (fugaría la clave). Se quita antes de
// devolverlo, y se vuelve a añadir en el servidor al resolver.
function stripApiKey(rawUrl) {
    try {
        const u = new URL(rawUrl);
        u.searchParams.delete("apikey");
        return u.toString();
    } catch {
        return null;
    }
}

function isSameOrigin(rawUrl, base) {
    try {
        return new URL(rawUrl).origin === new URL(base).origin;
    } catch {
        return false;
    }
}

// Ámbito de la búsqueda: a qué tipo de contenido y categoría de Prowlarr
// restringirla. "all" no manda categoría (deja que cada indexer devuelva
// lo que tenga, de cualquier tipo).
const SEARCH_SCOPES = {
    movie: { type: "movie", categories: "2000" },
    tv: { type: "tvsearch", categories: "5000" },
    all: { type: "search", categories: null },
};

// Nombres de los indexers que llevan la etiqueta "spanish" en Prowlarr
// (Settings → Indexers → editar → Tags). Esos se dan por español entero,
// sin mirar el título — a diferencia de trackers mixtos (Pirate Bay...),
// donde solo se puede adivinar por el título de cada resultado.
async function getSpanishIndexerNames(base, apiKey) {
    try {
        const [tagsRes, indexersRes] = await Promise.all([
            fetchWithTimeout(`${base}/api/v1/tag`, { headers: { "X-Api-Key": apiKey } }),
            fetchWithTimeout(`${base}/api/v1/indexer`, { headers: { "X-Api-Key": apiKey } }),
        ]);
        if (!tagsRes.ok || !indexersRes.ok) return new Set();
        const tags = await tagsRes.json();
        const indexers = await indexersRes.json();
        const spanishTag = tags.find((t) => (t.label || "").toLowerCase() === "spanish");
        if (!spanishTag) return new Set();
        return new Set(
            indexers
                .filter((ix) => Array.isArray(ix.tags) && ix.tags.includes(spanishTag.id))
                .map((ix) => ix.name)
        );
    } catch {
        // Si falla, se sigue solo con la heurística de título — no bloquea
        // la búsqueda por esto.
        return new Set();
    }
}

// Resuelve los ids de Prowlarr de los indexers cuyo nombre contiene el
// texto indicado (búsqueda por subcadena, sin distinguir mayúsculas). Se
// usa para restringir una búsqueda a un indexer concreto desde /admin.
async function getIndexerIdsByName(base, apiKey, name) {
    try {
        const res = await fetchWithTimeout(`${base}/api/v1/indexer`, { headers: { "X-Api-Key": apiKey } });
        if (!res.ok) return [];
        const indexers = await res.json();
        const needle = String(name).toLowerCase();
        return indexers
            .filter((ix) => (ix.name || "").toLowerCase().includes(needle))
            .map((ix) => ix.id);
    } catch {
        return [];
    }
}

// Mapea un resultado crudo de Prowlarr a la forma que consume el cliente.
// Devuelve null si no se puede construir ni magnet ni referencia de .torrent.
// spanishIndexers es el set de nombres de indexers marcados como españoles.
function mapResult(r, spanishIndexers) {
    let magnet = null;
    if (r.downloadUrl && /^magnet:/i.test(r.downloadUrl)) magnet = r.downloadUrl;
    else if (r.magnetUrl && /^magnet:/i.test(r.magnetUrl)) magnet = r.magnetUrl;
    else if (r.infoHash) magnet = buildMagnetUri(String(r.infoHash).toLowerCase(), []);

    // Se guarda la referencia al .torrent siempre que haya una (aunque ya
    // haya magnet directo): al cachear en Real-Debrid se prefiere subir el
    // .torrent real en vez del magnet, más fiable para trackers privados
    // (ver resolveDownloadRef).
    const downloadRef = r.downloadUrl && !/^magnet:/i.test(r.downloadUrl)
        ? stripApiKey(r.downloadUrl)
        : null;

    if (!magnet && !downloadRef) return null;

    return {
        title: r.title || "",
        indexer: r.indexer || "",
        size: r.size || null,
        seeders: typeof r.seeders === "number" ? r.seeders : null,
        leechers: typeof r.leechers === "number" ? r.leechers : null,
        publishDate: r.publishDate || null,
        isSpainSpanish: spanishIndexers.has(r.indexer) || isSpainSpanish(r.title),
        contentType: contentTypeLabel(r.categories),
        year: extractYear(r.title),
        poster: r.posterUrl || null,
        magnet,
        downloadRef,
    };
}

async function searchProwlarr(query, scope, indexer, altQuery) {
    // .trim() también recorta un BOM inicial (U+FEFF cuenta como whitespace
    // en JS), por si la variable de entorno se guardó con ese carácter
    // colado desde alguna terminal.
    const base = (process.env.PROWLARR_URL || "").trim();
    const apiKey = (process.env.PROWLARR_API_KEY || "").trim();
    if (!base || !apiKey) {
        throw new Error("Prowlarr no está configurado (faltan PROWLARR_URL / PROWLARR_API_KEY en el servidor).");
    }

    const cleanBase = base.replace(/\/$/, "");

    const { type, categories } = SEARCH_SCOPES[scope] || SEARCH_SCOPES.movie;
    const categoriesParam = categories ? `&categories=${categories}` : "";

    // Si se pide un indexer concreto, se resuelve su nombre a ids y se
    // restringe la búsqueda con indexerIds; si no se pide ninguno, se busca
    // en todos (incluido The Pirate Bay).
    let indexerIdsParam = "";
    if (indexer) {
        const ids = await getIndexerIdsByName(cleanBase, apiKey, indexer);
        if (ids.length > 0) indexerIdsParam = `&indexerIds=${ids.join(",")}`;
    }

    const spanishIndexers = await getSpanishIndexerNames(cleanBase, apiKey);

    // Se lanza una búsqueda por cada término distinto y se mezclan sin
    // duplicados. Para trackers que indexan en castellano (DivxTotal) solo
    // se envía el título en español; para el resto (TPB...) se añade además
    // el título original en inglés. De cada término se envía también una
    // variante "limpia" (sin guiones y con los dos puntos como espacio:
    // "Spider-Man: Homecoming" -> "SpiderMan Homecoming"), porque ni TPB ni
    // DivxTotal indexan el guion/los dos puntos.
    const queries = [];
    const push = (raw) => {
        const q = String(raw || "").replace(/\s+/g, " ").trim();
        if (!q) return;
        const k = q.toLowerCase();
        if (!queries.some((x) => x.toLowerCase() === k)) queries.push(q);
    };
    const addVariants = (raw) => {
        const q = String(raw || "").trim();
        if (!q) return;
        push(q);
        push(q.replace(/[-–—]/g, "").replace(/[:;]/g, " "));
    };

    const isSpanishTitleIndexer = !!indexer && SPANISH_TITLE_INDEXERS.some((name) => String(indexer).toLowerCase().includes(name));
    if (isSpanishTitleIndexer) {
        addVariants(query);
    } else {
        addVariants(query);
        addVariants(altQuery);
    }

    const seen = new Set();
    const all = [];
    for (const q of queries) {
        const url = `${cleanBase}/api/v1/search?query=${encodeURIComponent(q)}&type=${type}${categoriesParam}${indexerIdsParam}`;
        const res = await fetchWithTimeout(url, { headers: { "X-Api-Key": apiKey } });
        if (!res.ok) {
            throw new Error(`Prowlarr respondió con error ${res.status}`);
        }
        const data = await res.json();
        for (const r of data) {
            const mapped = mapResult(r, spanishIndexers);
            if (!mapped) continue;
            const key = (mapped.magnet || mapped.downloadRef || `${mapped.indexer}|${mapped.title}`).toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            all.push(mapped);
        }
    }

    const sorted = all
        .sort((a, b) => {
            const pa = indexerPriority(a.indexer);
            const pb = indexerPriority(b.indexer);
            if (pa !== pb) return pa - pb;
            return (b.size || 0) - (a.size || 0);
        })
        .slice(0, 60);

    await attachPosters(sorted);

    return sorted;
}

// Rellena el póster de los resultados que no traen imagen propia buscando
// en TMDB por el título limpio + año. Agrupa por combinación única
// título+año para no lanzar una petición por cada resultado.
async function attachPosters(results) {
    const unique = new Map();
    for (const r of results) {
        if (r.poster) continue;
        const { cleanTitle, year } = parseReleaseTitle(r.title);
        if (!cleanTitle) continue;
        const key = `${cleanTitle.toLowerCase()}|${year}`;
        if (!unique.has(key)) unique.set(key, { cleanTitle, year });
    }

    const entries = Array.from(unique.values());
    if (entries.length === 0) return;

    const posters = await Promise.all(
        entries.map((e) => searchMoviePoster(e.cleanTitle, e.year))
    );

    const posterByKey = new Map();
    entries.forEach((e, i) => {
        if (posters[i]) posterByKey.set(`${e.cleanTitle.toLowerCase()}|${e.year}`, posters[i]);
    });

    for (const r of results) {
        if (r.poster) continue;
        const { cleanTitle, year } = parseReleaseTitle(r.title);
        if (!cleanTitle) continue;
        const key = `${cleanTitle.toLowerCase()}|${year}`;
        const p = posterByKey.get(key);
        if (p) r.poster = p;
    }
}

// Descarga el .torrent real a partir de la referencia que se envió al
// cliente en la búsqueda. Se usa tanto para calcular el magnet al elegir
// un resultado como, más tarde, para poder subírselo tal cual a
// Real-Debrid (más fiable que un magnet en trackers privados).
async function fetchTorrentBytes(downloadRef) {
    const base = (process.env.PROWLARR_URL || "").trim();
    const apiKey = (process.env.PROWLARR_API_KEY || "").trim();
    if (!base || !apiKey) {
        throw new Error("Prowlarr no está configurado (faltan PROWLARR_URL / PROWLARR_API_KEY en el servidor).");
    }
    if (!downloadRef || !isSameOrigin(downloadRef, base)) {
        throw new Error("Referencia de descarga inválida.");
    }

    const u = new URL(downloadRef);
    u.searchParams.set("apikey", apiKey);

    const res = await fetchWithTimeout(u.toString(), { headers: { "X-Api-Key": apiKey } }, 20000);
    if (!res.ok) {
        throw new Error(`No se pudo descargar el .torrent (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
}

// Resuelve el magnet de un resultado concreto a partir de la referencia
// que se envió al cliente en la búsqueda (se llama al elegir un
// resultado, no antes).
async function resolveDownloadRef(downloadRef) {
    const buf = await fetchTorrentBytes(downloadRef);
    const { infoHash, trackers } = parseTorrentBytes(buf);
    return buildMagnetUri(infoHash, trackers.map((t) => "tracker:" + t));
}

module.exports = { searchProwlarr, resolveDownloadRef, fetchTorrentBytes, isSpainSpanish };
