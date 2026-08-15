const { CORTOS, IMDB_STREAMS } = require("../../../lib/data");
const { resolveRealDebridLink, parseRdKeyFromConfig } = require("../../../lib/realdebrid");

module.exports = async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const id = String(req.query.id || "").replace(/\.json$/, "");
    const rdKey = parseRdKeyFromConfig(req.query.config);

    let infoHash;
    let sources;
    let name;
    let title;
    let directUrl;

    // Caso 1: uno de los cortos propios (id "cortos-*")
    const corto = CORTOS.find((c) => c.id === id);
    if (corto) {
        infoHash = corto.infoHash.toLowerCase();
        sources = corto.sources;
        name = "JFuster RD";
        title = corto.name;
        directUrl = corto.url || null;
    } else if (id.startsWith("tt") && IMDB_STREAMS[id]) {
        // Caso 2: id de IMDb (tt...) -> engancha stream a una ficha ya existente
        const s = IMDB_STREAMS[id];
        infoHash = s.infoHash.toLowerCase();
        sources = s.sources;
        name = "JFuster RD";
        title = s.title;
        directUrl = s.url || null;
    } else {
        return res.status(200).json({ streams: [] });
    }

    const streams = [];

    if (rdKey) {
        const rdUrl = await resolveRealDebridLink(rdKey, infoHash, sources);
        if (rdUrl) {
            streams.push({
                name: "Real-Debrid",
                title: `${title} (RD)`,
                url: rdUrl,
            });
        }
    }

    // Enlace HTTP directo (si lo hay): no depende de seeders ni de RD, es la
    // opción más fiable cuando existe.
    if (directUrl) {
        streams.push({
            name,
            title: `${title} (directo)`,
            url: directUrl,
        });
    }

    // Stream P2P normal, siempre presente como opción de respaldo.
    streams.push({ name, title, infoHash, sources });

    return res.status(200).json({ streams });
};
