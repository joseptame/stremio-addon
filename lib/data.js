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

// PRUEBA: enganchar un stream a una ficha YA EXISTENTE de IMDb.
// Solo contenido de dominio público. Usa el imdb id (tt...) como key.
const IMDB_STREAMS = {
    // Night of the Living Dead (1968) - dominio público en EEUU
    // Fuente: archive.org/details/night-of-the-living-dead-1968-english
    tt0063350: {
        infoHash: "4d5f74f5babcd7bf62b75acd8182370ca495dfa5",
        sources: [
            "tracker:udp://tracker.opentrackr.org:1337/announce",
            "tracker:udp://open.tracker.cl:1337/announce",
        ],
        title: "Night of the Living Dead (1968) - Archive.org",
    },
};

const manifest = {
    id: "org.tuombre.cortos",
    version: "1.0.0",
    name: "Cortos de [Tu Nombre / Estudio]",
    description: "Catálogo propio de cortometrajes originales",
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
