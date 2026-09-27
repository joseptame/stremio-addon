const { CORTOS, IMDB_STREAMS } = require("../../../lib/data");

function imdbMetas(filterType) {
    return Object.entries(IMDB_STREAMS)
        .filter(([, s]) => (s.type || "movie") === filterType)
        .map(([imdbId, s]) => ({
            id: imdbId,
            type: filterType,
            name: s.name || s.title,
            poster: s.poster || undefined,
        }));
}

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

        return res.status(200).json({ metas: [...cortosMetas, ...imdbMetas("movie")] });
    }

    if (type === "series" && id === "series-catalogo") {
        return res.status(200).json({ metas: imdbMetas("series") });
    }

    return res.status(200).json({ metas: [] });
};
