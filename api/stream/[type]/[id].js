const { CORTOS, IMDB_STREAMS } = require("../../../lib/data");
const { resolveRealDebridLink, parseRdKeyFromConfig } = require("../../../lib/realdebrid");
const { copyForSeason } = require("../../../lib/series");

module.exports = async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const id = String(req.query.id || "").replace(/\.json$/, "");
    const rdKey = parseRdKeyFromConfig(req.query.config);

    // Para series, Stremio pide streams por episodio (ttXXXXX:1:2). Se
    // descarta el sufijo de temporada/episodio para localizar la ficha.
    const baseId = id.includes(":") ? id.split(":")[0] : id;

    let infoHash;
    let sources;
    let name;
    let title;
    let directUrl;
    let episode = null;

    // Caso 1: uno de los cortos propios (id "cortos-*")
    const corto = CORTOS.find((c) => c.id === id);
    if (corto) {
        infoHash = corto.infoHash.toLowerCase();
        sources = corto.sources;
        name = "JFuster RD";
        title = corto.name;
        directUrl = corto.url || null;
    } else if (baseId.startsWith("tt") && IMDB_STREAMS[baseId]) {
        // Caso 2: id de IMDb (tt...) -> engancha stream a una ficha ya existente
        const s = IMDB_STREAMS[baseId];
        name = "JFuster RD";
        directUrl = s.url || null;
        // Series (ttXXX:T:E): la copia de esa temporada (o el pack completo)
        // y, dentro, el fichero de ese episodio.
        const [, season, ep] = id.split(":");
        if (season && ep) {
            const copy = copyForSeason(s, season);
            if (!copy) return res.status(200).json({ streams: [] });
            infoHash = copy.infoHash.toLowerCase();
            sources = copy.sources;
            title = `${s.title || s.name} · T${season}E${ep}`;
            episode = { season, episode: ep, singleSeason: copy.key !== "all" };
        } else {
            infoHash = s.infoHash.toLowerCase();
            sources = s.sources;
            title = s.title;
        }
    } else {
        return res.status(200).json({ streams: [] });
    }

    const streams = [];

    if (rdKey) {
        const rdUrl = await resolveRealDebridLink(rdKey, infoHash, sources, episode);
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

    // El stream P2P (infoHash) ya no se ofrece: solo se muestran opciones
    // instantáneas (Real-Debrid o enlace directo). Si ninguna está
    // disponible, no se devuelve ningún stream.

    return res.status(200).json({ streams });
};
