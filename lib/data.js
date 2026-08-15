// ─────────────────────────────────────────────────────────────
// Datos y manifest del addon, compartidos entre los endpoints
// serverless de /api. Sin dependencia de addonBuilder ni serveHTTP.
// ─────────────────────────────────────────────────────────────

const CORTOS = [
    {
        id: "cortos-1",
        type: "movie",
        name: "Mi corto 1",
        poster: "https://tu-servidor-o-imgur.com/poster1.jpg", // opcional
        description: "Descripción breve del corto",
        infoHash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        sources: [
            "tracker:udp://tracker.opentrackr.org:1337/announce",
            "tracker:udp://open.tracker.cl:1337/announce",
            "tracker:udp://tracker.openbittorrent.com:6969/announce",
        ],
    },
];

// Streams enganchados a fichas YA EXISTENTES de IMDb (id "tt..." como key).
// Solo contenido de dominio público. Se edita desde /admin (ver api/admin.js),
// que hace commit de este fichero vía la API de GitHub.
const IMDB_STREAMS = require("./imdb-streams.json");

const manifest = {
    id: "org.tuombre.cortos",
    version: "1.0.0",
    name: "Cortos de [Tu Nombre / Estudio]",
    description: "Catálogo propio de cortometrajes originales",
    logo: "https://stremio-addon-green.vercel.app/icon.png",
    resources: ["catalog", "stream", "meta"],
    types: ["movie"],
    catalogs: [
        {
            type: "movie",
            id: "cortos-catalogo",
            name: "Nuestros cortos",
        },
    ],
    // "tt" permite que el addon responda también a ids de IMDb (Cinemeta)
    idPrefixes: ["cortos-", "tt"],
};

module.exports = { CORTOS, IMDB_STREAMS, manifest };
