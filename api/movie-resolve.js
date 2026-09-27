const { resolveImdbId, resolveTvImdbId } = require("../lib/tmdb");
const { isAuthenticated } = require("../lib/adminAuth");

module.exports = async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido." });
    }

    if (!isAuthenticated(req, (process.env.ADMIN_PASSWORD || "").trim())) {
        return res.status(401).json({ error: "Sesión caducada. Vuelve a iniciar sesión en /admin." });
    }

    const { tmdbId, type } = req.body || {};

    if (!tmdbId) {
        return res.status(400).json({ error: "Falta tmdbId." });
    }

    try {
        const isSeries = type === "series";
        const imdbId = isSeries ? await resolveTvImdbId(tmdbId) : await resolveImdbId(tmdbId);
        if (!imdbId) {
            return res.status(404).json({ error: "No se encontró el ID de IMDb para este título." });
        }
        return res.status(200).json({ imdbId });
    } catch (err) {
        return res.status(502).json({ error: err.message });
    }
};
