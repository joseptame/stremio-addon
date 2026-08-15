const { CORTOS } = require("../../../lib/data");

module.exports = (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const id = String(req.query.id || "").replace(/\.json$/, "");

    const corto = CORTOS.find((c) => c.id === id);
    if (!corto) return res.status(200).json({ meta: {} });

    return res.status(200).json({
        meta: {
            id: corto.id,
            type: corto.type,
            name: corto.name,
            poster: corto.poster,
            description: corto.description,
        },
    });
};
