// Búsqueda en bitsearch.eu (buscador público de la DHT) leyendo su HTML,
// como un indexer más del buscador de /admin. Cada resultado trae el magnet
// directo, así que no hay .torrent que descargar.
//
// Solo se quedan los resultados en castellano (el título dice Castellano,
// Español, ESP o CAST). Para que salgan, a la búsqueda se le añade
// "castellano"/"español": con el título a secas casi todo es en inglés. No
// se filtra por la categoría Movies de bitsearch porque la mayoría de copias
// en castellano están como "Other/Video"; en su lugar se descartan las
// categorías que no son vídeo (juegos, programas...).

const BASE = "https://bitsearch.eu";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const SPANISH_TITLE = /castellano|espa[ñn]ol|\besp\b|\bcast\b/i;
const NAME = "Bitsearch";

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function decodeEntities(s) {
    return String(s || "")
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
}

const SIZE_UNITS = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
function parseSize(text) {
    const m = String(text || "").match(/([\d.]+)\s*(B|KB|MB|GB|TB)\b/i);
    return m ? Math.round(parseFloat(m[1]) * SIZE_UNITS[m[2].toUpperCase()]) : null;
}

// Cada resultado de la página va en una tarjeta que empieza con el enlace
// a /torrent/<id>: se trocea por ahí y de cada trozo se sacan los datos.
function parseResults(html) {
    const out = [];
    const chunks = html.split('href="/torrent/').slice(1);
    for (const chunk of chunks) {
        const title = decodeEntities((chunk.match(/^[a-f0-9]+"[^>]*>\s*([^<]+?)\s*<\/a>/) || [])[1]);
        const magnet = decodeEntities((chunk.match(/href="(magnet:\?[^"]+)"/) || [])[1]);
        if (!title || !magnet) continue;
        const spans = [...chunk.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) => m[1].trim()).filter(Boolean);
        const category = spans.find((s) => /\//.test(s) && !/^\d/.test(s)) || "";
        const size = parseSize(spans.find((s) => /\d\s*(B|KB|MB|GB|TB)$/i.test(s)));
        const date = spans.find((s) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) || null;
        const before = (label) => {
            const i = spans.indexOf(label);
            return i > 0 && /^\d+$/.test(spans[i - 1]) ? parseInt(spans[i - 1], 10) : null;
        };
        out.push({ title, magnet, category, size, date, seeders: before("seeders"), leechers: before("leechers") });
    }
    return out;
}

// Muchas series van en la categoría genérica "Other/Video", igual que las
// películas: se reconocen por el título ("Temporada 5 [Cap.504]", "S04E06",
// "1X4", "(11X03)"...).
const SERIES_TITLE = /\btemp[oe]r[ao]da\b|\bcap[._\s]?\d|\bcap[ií]tulo|\bepisodio|\bS\d{1,2}E\d{1,3}\b|\bS\d{1,2}\b|\b\d{1,2}x\d{1,3}(?!\d)|\bseason\b|\bminiserie|\bserie\b/i;

// Si el resultado encaja con lo que se busca: vídeo (no juegos, programas...)
// y película o serie según el ámbito.
function matchesScope(category, title, scope) {
    const c = category.toLowerCase();
    const looksSeries = SERIES_TITLE.test(title) || /^(tv|anime)/.test(c);
    const isVideo = c.startsWith("other/video") || /^(movies|tv|anime)/.test(c);
    if (!isVideo) return false;
    if (scope === "tv") return looksSeries;
    if (scope === "all") return true;
    return !looksSeries;
}

function toDate(mdY) {
    if (!mdY) return null;
    const [m, d, y] = mdY.split("/").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

// queries: los términos que ya prepara el buscador (título en español,
// original, variantes); a cada uno se le añaden las palabras en castellano.
// mapRelease convierte cada resultado a la forma común del buscador.
// Bitsearch busca de forma muy laxa y cuela títulos de otras cosas que
// solo mencionan el nombre por el medio ("FBI - Temporada 1 [Cap.110]...
// The Big Bang Theory - Temporada 12"). Se exige que el nombre buscado esté
// en la primera parte del título (antes del primer " - ", "[" o "(").
function normalize(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, " ").replace(/^the /, "").trim();
}

function titleHead(title) {
    return normalize(String(title || "").replace(/[._]/g, " ").split(/\s[-–]\s|\[|\(/)[0]);
}

function isAbout(title, names) {
    const head = titleHead(title);
    const wanted = names.map(normalize).filter(Boolean);
    return !wanted.length || wanted.some((n) => head.includes(n));
}

// names: los nombres buscados (en castellano y el original), para descartar
// resultados que no son de eso (ver isAbout).
async function searchBitsearch(queries, scope, mapRelease, names = []) {
    const terms = [];
    for (const q of queries) {
        for (const suffix of ["castellano", "español"]) {
            const t = `${q} ${suffix}`;
            if (!terms.some((x) => x.toLowerCase() === t.toLowerCase())) terms.push(t);
        }
    }

    const settled = await Promise.allSettled(terms.map(async (t) => {
        const res = await fetchWithTimeout(`${BASE}/search?q=${encodeURIComponent(t)}`, { headers: { "User-Agent": UA } });
        if (!res.ok) throw new Error(`Bitsearch respondió con error ${res.status}`);
        return parseResults(await res.text());
    }));
    if (settled.every((s) => s.status === "rejected")) throw settled[0].reason;

    const seen = new Set();
    const out = [];
    for (const s of settled) {
        if (s.status !== "fulfilled") continue;
        for (const r of s.value) {
            if (!SPANISH_TITLE.test(r.title) || !matchesScope(r.category, r.title, scope) || !isAbout(r.title, names)) continue;
            const hash = (r.magnet.match(/btih:([a-z0-9]+)/i) || [])[1];
            const key = (hash || r.magnet).toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(mapRelease({
                title: r.title,
                indexer: NAME,
                size: r.size,
                seeders: r.seeders,
                leechers: r.leechers,
                publishDate: toDate(r.date),
                contentType: /^tv|^anime/i.test(r.category) || SERIES_TITLE.test(r.title) ? "Serie" : "Película",
                magnet: r.magnet,
            }));
        }
    }
    return out;
}

module.exports = { searchBitsearch, BITSEARCH_NAME: NAME };
