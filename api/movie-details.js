const { getDetailsByImdb } = require("../lib/tmdb");
const { isAuthenticated } = require("../lib/adminAuth");

module.exports = async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido." });
    }

    if (!isAuthenticated(req, (process.env.ADMIN_PASSWORD || "").trim())) {
        return res.status(401).json({ error: "Sesión caducada. Vuelve a iniciar sesión en /admin." });
    }

    const { imdbId, type } = req.body || {};

    if (!imdbId || !/^tt[0-9]+$/.test(String(imdbId))) {
        return res.status(400).json({ error: "ID de IMDb inválido." });
    }

    try {
        const details = await getDetailsByImdb(String(imdbId), type === "series" ? "series" : "movie");
        return res.status(200).json({ details });
    } catch (err) {
        return res.status(502).json({ error: err.message });
    }
};
