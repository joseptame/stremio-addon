const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

// ─────────────────────────────────────────────────────────────
// 1) TUS CORTOS CON ID PROPIO (catálogo tuyo, sin ficha de IMDb)
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

// ─────────────────────────────────────────────────────────────
// 1b) PRUEBA: enganchar un stream a una ficha YA EXISTENTE de IMDb
//     Solo contenido de dominio público. Usa el imdb id (tt...) como key.
//     Consigue el infoHash real descargando el .torrent desde archive.org:
//     https://archive.org/download/{id}/{id}_archive.torrent
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// 2) MANIFEST: define quién eres y qué ofreces
// ─────────────────────────────────────────────────────────────
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
    // "tt" permite que tu addon responda también a ids de IMDb (Cinemeta)
    idPrefixes: ["cortos-", "tt"],
};

const builder = new addonBuilder(manifest);

// ─────────────────────────────────────────────────────────────
// 3) CATALOG HANDLER: lista los cortos disponibles
// ─────────────────────────────────────────────────────────────
builder.defineCatalogHandler(({ type, id }) => {
    if (type === "movie" && id === "cortos-catalogo") {
        const metas = CORTOS.map((c) => ({
            id: c.id,
            type: c.type,
            name: c.name,
            poster: c.poster,
            description: c.description,
        }));
        return Promise.resolve({ metas });
    }
    return Promise.resolve({ metas: [] });
});

// ─────────────────────────────────────────────────────────────
// 4) META HANDLER: detalles de un corto concreto
// ─────────────────────────────────────────────────────────────
builder.defineMetaHandler(({ type, id }) => {
    const corto = CORTOS.find((c) => c.id === id);
    if (!corto) return Promise.resolve({ meta: {} });
    return Promise.resolve({
        meta: {
            id: corto.id,
            type: corto.type,
            name: corto.name,
            poster: corto.poster,
            description: corto.description,
        },
    });
});

// ─────────────────────────────────────────────────────────────
// 5) STREAM HANDLER: aquí es donde se sirve el torrent/magnet
// ─────────────────────────────────────────────────────────────
builder.defineStreamHandler(({ type, id }) => {
    // Caso 1: uno de tus cortos con id propio
    const corto = CORTOS.find((c) => c.id === id);
    if (corto) {
        return Promise.resolve({
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
        return Promise.resolve({
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

    return Promise.resolve({ streams: [] });
});

// ─────────────────────────────────────────────────────────────
// 6) LEVANTAR EL SERVIDOR
// ─────────────────────────────────────────────────────────────
serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });

console.log("Addon corriendo. Manifest en: http://localhost:7000/manifest.json");
