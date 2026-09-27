// Busca películas por título en TMDB (The Movie Database) para el
// autocompletado de /admin, con resultados en español — a diferencia
// de Cinemeta, que solo devuelve títulos en inglés/original y no
// soporta idioma.
//
// Requiere TMDB_API_KEY (la "API Key (v3 auth)", gratuita en
// https://www.themoviedb.org/settings/api) como variable de entorno
// en el servidor.
//
// La búsqueda de TMDB no incluye el id de IMDb — solo su propio id
// numérico — así que ese se resuelve aparte, bajo demanda, cuando el
// admin elige un resultado concreto (resolveImdbId), igual que los
// magnets de Prowlarr se resuelven solo al elegir un resultado.

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w200";

async function fetchWithTimeout(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function getApiKey() {
    const key = (process.env.TMDB_API_KEY || "").trim();
    if (!key) {
        throw new Error("TMDB no está configurado (falta TMDB_API_KEY en el servidor).");
    }
    return key;
}

async function searchMovies(query) {
    const apiKey = getApiKey();
    const url = `${TMDB_BASE}/search/movie?api_key=${apiKey}&language=es-ES&include_adult=false&query=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
        throw new Error(`TMDB respondió con error ${res.status}`);
    }
    const data = await res.json();
    return (data.results || []).map((r) => ({
        tmdbId: r.id,
        name: r.title || r.original_title || "",
        originalName: r.original_title || "",
        poster: r.poster_path ? `${TMDB_IMG_BASE}${r.poster_path}` : null,
        releaseInfo: r.release_date ? r.release_date.slice(0, 4) : "",
    }));
}

async function searchTv(query) {
    const apiKey = getApiKey();
    const url = `${TMDB_BASE}/search/tv?api_key=${apiKey}&language=es-ES&include_adult=false&query=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
        throw new Error(`TMDB respondió con error ${res.status}`);
    }
    const data = await res.json();
    return (data.results || []).map((r) => ({
        tmdbId: r.id,
        name: r.name || r.original_name || "",
        originalName: r.original_name || "",
        poster: r.poster_path ? `${TMDB_IMG_BASE}${r.poster_path}` : null,
        releaseInfo: r.first_air_date ? r.first_air_date.slice(0, 4) : "",
    }));
}

async function resolveImdbId(tmdbId) {
    const apiKey = getApiKey();
    const url = `${TMDB_BASE}/movie/${encodeURIComponent(tmdbId)}/external_ids?api_key=${apiKey}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
        throw new Error(`TMDB respondió con error ${res.status}`);
    }
    const data = await res.json();
    return data.imdb_id || null;
}

async function resolveTvImdbId(tmdbId) {
    const apiKey = getApiKey();
    const url = `${TMDB_BASE}/tv/${encodeURIComponent(tmdbId)}/external_ids?api_key=${apiKey}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
        throw new Error(`TMDB respondió con error ${res.status}`);
    }
    const data = await res.json();
    return data.imdb_id || null;
}

// Busca el póster de una película por título limpio (+ año opcional) para
// los resultados de Prowlarr que no traen imagen propia (p. ej. The Pirate
// Bay, DivxTotal). Prueba primero en inglés y luego en español, porque TPB
// indexa títulos originales y DivxTotal títulos en castellano; el póster es
// el mismo en ambos idiomas. Devuelve la URL del mejor resultado o null.
async function searchMoviePoster(query, year) {
    try {
        const apiKey = getApiKey();
        const yearParam = year ? `&year=${encodeURIComponent(String(year))}` : "";
        for (const type of ["movie", "tv"]) {
            for (const lang of ["en-US", "es-ES"]) {
                const url = `${TMDB_BASE}/search/${type}?api_key=${apiKey}&language=${lang}&include_adult=false&query=${encodeURIComponent(query)}${yearParam}`;
                const res = await fetchWithTimeout(url);
                if (!res.ok) continue;
                const data = await res.json();
                const r = (data.results || [])[0];
                if (r && r.poster_path) return `${TMDB_IMG_BASE}${r.poster_path}`;
            }
        }
        return null;
    } catch {
        return null;
    }
}

module.exports = { searchMovies, searchTv, resolveImdbId, resolveTvImdbId, searchMoviePoster };
