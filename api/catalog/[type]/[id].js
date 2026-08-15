const { CORTOS, IMDB_STREAMS } = require("../../../lib/data");

module.exports = (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const { type } = req.query;
    const id = String(req.query.id || "").replace(/\.json$/, "");

    if (type === "movie" && id === "cortos-catalogo") {
        const cortosMetas = CORTOS.map((c) => ({
            id: c.id,
            type: c.type,
            name: c.name,
            poster: c.poster,
            description: c.description,
        }));

        const imdbMetas = Object.entries(IMDB_STREAMS).map(([imdbId, s]) => ({
            id: imdbId,
            type: "movie",
            name: s.name || s.title,
            poster: s.poster || undefined,
        }));

        return res.status(200).json({ metas: [...cortosMetas, ...imdbMetas] });
    }

    return res.status(200).json({ metas: [] });
};
