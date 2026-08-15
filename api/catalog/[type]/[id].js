const { CORTOS } = require("../../../lib/data");

module.exports = (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const { type } = req.query;
    const id = String(req.query.id || "").replace(/\.json$/, "");

    if (type === "movie" && id === "cortos-catalogo") {
        const metas = CORTOS.map((c) => ({
            id: c.id,
            type: c.type,
            name: c.name,
            poster: c.poster,
            description: c.description,
        }));
        return res.status(200).json({ metas });
    }

    return res.status(200).json({ metas: [] });
};
