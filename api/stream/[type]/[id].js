const { CORTOS, IMDB_STREAMS } = require("../../../lib/data");

module.exports = (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const id = String(req.query.id || "").replace(/\.json$/, "");

    // Caso 1: uno de los cortos propios (id "cortos-*")
    const corto = CORTOS.find((c) => c.id === id);
    if (corto) {
        return res.status(200).json({
            streams: [
                {
                    name: "Cortos propios",
                    title: corto.name,
                    infoHash: corto.infoHash.toLowerCase(),
                    sources: corto.sources,
                },
            ],
        });
    }

    // Caso 2: id de IMDb (tt...) -> engancha stream a una ficha ya existente
    if (id.startsWith("tt") && IMDB_STREAMS[id]) {
        const s = IMDB_STREAMS[id];
        return res.status(200).json({
            streams: [
                {
                    name: "Nuestro addon",
                    title: s.title,
                    infoHash: s.infoHash.toLowerCase(),
                    sources: s.sources,
                },
            ],
        });
    }

    return res.status(200).json({ streams: [] });
};
