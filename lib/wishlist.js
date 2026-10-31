// Lista de deseos: películas que aún no tienen una buena copia en
// castellano. Se guarda en lib/wishlist.json (vía GitHub, como el
// catálogo) y una tarea diaria de Vercel las vuelve a buscar; cuando
// aparecen copias buenas, la biblioteca avisa.
//
// Cada entrada: { imdbId, name, originalName, year, type, poster, addedAt,
// lastChecked, count, best: { title, quality, seeders, size } }.

const { searchProwlarr } = require("./prowlarr");
const { readJsonFile, writeJsonFile } = require("./github");

const WISHLIST_PATH = "lib/wishlist.json";
// Una copia "buena": en castellano, con fuentes y de la película correcta.
const MIN_SEEDS = 2;
// Como mucho tantas búsquedas por pasada, para no pasar del tiempo
// máximo de la función de Vercel.
const MAX_PER_RUN = 8;

function qualityOf(title) {
    const t = String(title || "").toLowerCase();
    if (/2160|4k|uhd/.test(t)) return "4K";
    if (/1080/.test(t)) return "1080p";
    if (/720/.test(t)) return "720p";
    return "SD";
}
const QUALITY_RANK = { "4K": 4, "1080p": 3, "720p": 2, SD: 1 };

// Si el título de la copia lleva un año que no es el de la película (±1,
// por los estrenos en España), es de otra con el mismo nombre. Los años
// que forman parte del propio título ("Blade Runner 2049") no cuentan.
// Igual que en el buscador del panel.
function sameFilm(release, wish) {
    if (wish.type === "series" || !wish.year) return true;
    const names = `${wish.name || ""} ${wish.originalName || ""}`.toLowerCase();
    const years = (String(release.title || "").match(/\b(19|20)\d{2}\b/g) || []).filter((y) => !names.includes(y));
    if (!years.length) return true;
    return years.some((y) => Math.abs(Number(y) - Number(wish.year)) <= 1);
}

// Busca copias buenas de una entrada: { count, best } (best = la de más
// calidad y, a igualdad, más seeders).
async function checkWish(wish) {
    const scope = wish.type === "series" ? "tv" : "movie";
    const results = await searchProwlarr(wish.name, scope, "", wish.originalName || "");
    const good = results.filter((r) => r.isSpainSpanish && (r.seeders || 0) >= MIN_SEEDS && sameFilm(r, wish));
    good.sort((a, b) =>
        (QUALITY_RANK[qualityOf(b.title)] - QUALITY_RANK[qualityOf(a.title)]) || ((b.seeders || 0) - (a.seeders || 0)));
    const best = good[0];
    return {
        count: good.length,
        best: best ? { title: best.title, quality: qualityOf(best.title), seeders: best.seeders, size: best.size || null } : null,
    };
}

async function readWishlist() {
    return readJsonFile(WISHLIST_PATH, {});
}

async function writeWishlist(data, sha, message) {
    return writeJsonFile(WISHLIST_PATH, data, sha, message);
}

// Pasada diaria: vuelve a buscar las entradas (las que hace más tiempo que
// no se miran primero) y guarda solo si cambia algún resultado, para no
// hacer un commit (y un redespliegue) cada día sin motivo.
async function runWishlistCheck() {
    const { data, sha } = await readWishlist();
    const wishes = Object.values(data)
        .sort((a, b) => Date.parse(a.lastChecked || 0) - Date.parse(b.lastChecked || 0))
        .slice(0, MAX_PER_RUN);
    const now = new Date().toISOString();
    const changed = [];
    // Las que han pasado de no tener copias buenas a tenerlas (para el
    // aviso push; solo esa vez, no cada día).
    const found = [];
    for (const wish of wishes) {
        let result;
        try {
            result = await checkWish(wish);
        } catch {
            continue;
        }
        const before = `${wish.count || 0}|${wish.best ? wish.best.title : ""}`;
        const after = `${result.count}|${result.best ? result.best.title : ""}`;
        data[wish.imdbId] = { ...wish, ...result, lastChecked: now };
        if (before !== after) changed.push(wish.name);
        if (!wish.count && result.count) {
            found.push({ imdbId: wish.imdbId, name: wish.name, count: result.count, quality: result.best.quality });
        }
    }
    if (changed.length) {
        await writeWishlist(data, sha, `Lista de deseos: copias nuevas para ${changed.join(", ")}`);
    }
    return { checked: wishes.length, changed, found };
}

module.exports = { WISHLIST_PATH, checkWish, readWishlist, writeWishlist, runWishlistCheck };
