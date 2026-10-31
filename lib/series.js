// Series: cada entrada del catálogo de tipo "series" guarda sus copias en
// "seasons", por clave:
// - "all": pack con la serie completa (o varias temporadas).
// - "2": pack con la temporada 2 entera.
// - "2:5": capítulo suelto (temporada 2, episodio 5); puede haber varios
//   por temporada, junto a su pack o sin él.
// Cada copia: { infoHash, sources, title }. El "infoHash" de primer nivel
// es el de la última copia guardada (para el estado en la biblioteca); las
// entradas antiguas sin "seasons" cuentan como pack completo.

function parseKey(key) {
    if (key === "all") return { season: null, episode: null };
    const [s, e] = String(key).split(":");
    return { season: Number(s), episode: e ? Number(e) : null };
}

function seasonLabel(key) {
    if (key === "all") return "Serie completa";
    const { season, episode } = parseKey(key);
    return episode ? `Temporada ${season} · Capítulo ${episode}` : `Temporada ${season}`;
}

// Clave para una temporada y, opcionalmente, un capítulo suelto.
function copyKey(season, episode) {
    if (!/^\d+$/.test(String(season || ""))) return "all";
    const s = String(Number(season));
    return /^\d+$/.test(String(episode || "")) && Number(episode) > 0 ? `${s}:${Number(episode)}` : s;
}

// Orden: serie completa, y por temporada el pack antes que sus capítulos.
function compareKeys(a, b) {
    if (a === "all" || b === "all") return a === "all" ? (b === "all" ? 0 : -1) : 1;
    const ka = parseKey(a);
    const kb = parseKey(b);
    return ka.season - kb.season || (ka.episode || 0) - (kb.episode || 0);
}

// Copias de una entrada: [{ key, infoHash, sources, title }]. Para una
// película, la única que tiene (key null).
function entryCopies(entry) {
    if (!entry) return [];
    if (entry.type === "series" && entry.seasons && Object.keys(entry.seasons).length) {
        return Object.keys(entry.seasons).sort(compareKeys).map((key) => ({ key, ...entry.seasons[key] }));
    }
    if (!entry.infoHash) return [];
    return [{ key: entry.type === "series" ? "all" : null, infoHash: entry.infoHash, sources: entry.sources, title: entry.title }];
}

// Todos los infoHash (en minúsculas) que usa una entrada.
function entryHashes(entry) {
    return [...new Set(entryCopies(entry).map((c) => String(c.infoHash || "").toLowerCase()).filter(Boolean))];
}

// Copia con la que reproducir un episodio: su capítulo suelto si lo hay;
// si no, el pack de su temporada; si no, el de la serie completa.
function copyForEpisode(entry, season, episode) {
    const copies = entryCopies(entry);
    const s = String(Number(season));
    return copies.find((c) => c.key === `${s}:${Number(episode)}`)
        || copies.find((c) => c.key === s)
        || copies.find((c) => c.key === "all")
        || null;
}

// ¿Este fichero es el episodio pedido? Formatos habituales: S02E05,
// 2x05, Cap.205 (temporada + episodio a 2 cifras, típico de las webs en
// castellano) y, en packs de una sola temporada, "Capitulo 5"/"E05".
function isEpisodeFile(path, season, episode, singleSeason) {
    const name = String(path || "").split("/").pop();
    const s = Number(season);
    const e = Number(episode);
    const ee = String(e).padStart(2, "0");
    const patterns = [
        new RegExp(`s0*${s}[ ._-]*e0*${e}(?!\\d)`, "i"),
        new RegExp(`(?<!\\d)0*${s}x0*${e}(?!\\d)`, "i"),
        new RegExp(`cap[^0-9]{0,3}${s}${ee}(?!\\d)`, "i"),
    ];
    if (singleSeason) {
        patterns.push(new RegExp(`(?:episodio|cap[ií]tulo|capitulo|ep|e)[ ._-]*0*${e}(?!\\d)`, "i"));
    }
    return patterns.some((re) => re.test(name));
}

module.exports = { parseKey, seasonLabel, copyKey, compareKeys, entryCopies, entryHashes, copyForEpisode, isEpisodeFile };
