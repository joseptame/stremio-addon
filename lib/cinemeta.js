// Consulta Cinemeta (el catálogo de metadatos público de Stremio) para
// obtener póster y nombre oficial a partir de un id de IMDb. No requiere
// clave de API. Devuelve null si no se encuentra o falla la petición.

async function fetchCinemetaMeta(imdbId, type = "movie") {
    try {
        const res = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data.meta) return null;
        return {
            name: data.meta.name || null,
            poster: data.meta.poster || null,
        };
    } catch {
        return null;
    }
}

module.exports = { fetchCinemetaMeta };
