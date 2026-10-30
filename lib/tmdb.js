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
const TMDB_POSTER_LARGE = "https://image.tmdb.org/t/p/w342";
const TMDB_BACKDROP = "https://image.tmdb.org/t/p/w1280";

// Campos extra para la ficha de la página de añadir (portada grande,
// fondo, sinopsis y nota), comunes a películas y series.
function extraFields(r) {
    return {
        posterLarge: r.poster_path ? `${TMDB_POSTER_LARGE}${r.poster_path}` : null,
        backdrop: r.backdrop_path ? `${TMDB_BACKDROP}${r.backdrop_path}` : null,
        overview: r.overview || "",
        rating: typeof r.vote_average === "number" && r.vote_count > 0 ? Math.round(r.vote_average * 10) / 10 : null,
    };
}

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
        ...extraFields(r),
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
        ...extraFields(r),
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

// Elige el tráiler de YouTube: primero en castellano, luego en inglés y
// si no, cualquier tráiler o teaser que haya.
function pickTrailer(videos) {
    const yt = (videos || []).filter((v) => v.site === "YouTube" && v.key);
    const score = (v) => (v.type === "Trailer" ? 0 : v.type === "Teaser" ? 2 : 4)
        + (v.iso_639_1 === "es" ? 0 : v.iso_639_1 === "en" ? 1 : 2)
        + (v.official ? 0 : 0.5);
    const best = yt.filter((v) => v.type === "Trailer" || v.type === "Teaser").sort((a, b) => score(a) - score(b))[0];
    return best ? best.key : null;
}

// Ficha completa de una película o serie a partir de su id de IMDb (para
// la ficha del panel): sinopsis en castellano, año, duración, géneros,
// nota y la clave de YouTube del tráiler. Devuelve null si TMDB no la
// conoce.
async function getDetailsByImdb(imdbId, type) {
    const apiKey = getApiKey();
    const findUrl = `${TMDB_BASE}/find/${encodeURIComponent(imdbId)}?api_key=${apiKey}&external_source=imdb_id`;
    const findRes = await fetchWithTimeout(findUrl);
    if (!findRes.ok) throw new Error(`TMDB respondió con error ${findRes.status}`);
    const found = await findRes.json();
    // Se busca primero en el tipo guardado y, si no aparece, en el otro.
    const movie = (found.movie_results || [])[0];
    const tv = (found.tv_results || [])[0];
    const [kind, hit] = type === "series"
        ? (tv ? ["tv", tv] : ["movie", movie])
        : (movie ? ["movie", movie] : ["tv", tv]);
    if (!hit) return null;

    const url = `${TMDB_BASE}/${kind}/${hit.id}?api_key=${apiKey}&language=es-ES&append_to_response=videos&include_video_language=es,en,null`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`TMDB respondió con error ${res.status}`);
    const d = await res.json();

    const date = d.release_date || d.first_air_date || "";
    const runtime = d.runtime || (Array.isArray(d.episode_run_time) && d.episode_run_time[0]) || null;
    return {
        name: d.title || d.name || "",
        overview: d.overview || "",
        tagline: d.tagline || "",
        year: date ? date.slice(0, 4) : "",
        runtime,
        seasons: d.number_of_seasons || null,
        genres: (d.genres || []).map((g) => g.name),
        rating: typeof d.vote_average === "number" && d.vote_count > 0 ? Math.round(d.vote_average * 10) / 10 : null,
        backdrop: d.backdrop_path ? `${TMDB_BACKDROP}${d.backdrop_path}` : null,
        trailerKey: pickTrailer(d.videos && d.videos.results),
    };
}

module.exports = { searchMovies, searchTv, resolveImdbId, resolveTvImdbId, searchMoviePoster, getDetailsByImdb };
