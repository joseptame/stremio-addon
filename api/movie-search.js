const { searchMovies, searchTv } = require("../lib/tmdb");
const { isAuthenticated } = require("../lib/adminAuth");

module.exports = async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido." });
    }

    if (!isAuthenticated(req, (process.env.ADMIN_PASSWORD || "").trim())) {
        return res.status(401).json({ error: "Sesión caducada. Vuelve a iniciar sesión en /admin." });
    }

    const { q, type } = req.body || {};

    if (!q || !String(q).trim()) {
        return res.status(400).json({ error: "Falta el término de búsqueda." });
    }

    try {
        const isSeries = type === "series";
        const results = isSeries ? await searchTv(String(q).trim()) : await searchMovies(String(q).trim());
        return res.status(200).json({ results });
    } catch (err) {
        return res.status(502).json({ error: err.message });
    }
};
