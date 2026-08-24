# Addon de Stremio — Despliegue en Vercel

## Objetivo

Adaptar y desplegar un addon de Stremio (basado en `stremio-addon-sdk`) para que
funcione en Vercel como funciones serverless, y quede accesible públicamente en
una URL tipo `https://<proyecto>.vercel.app/manifest.json`.

El addon sirve:

2. Streams enganchados a fichas ya existentes de Cinemeta/IMDb (identificados
   con `tt...`), también vía infoHash

## Por qué hay que adaptar el código

`stremio-addon-sdk` usa internamente `serveHTTP()`, que levanta un servidor
Express persistente. Vercel no ejecuta servidores persistentes: ejecuta
**funciones serverless** individuales bajo `/api`, cada una con su propio
handler `(req, res) => {...}`. Por tanto, en vez de `serveHTTP()`, hay que:

- Construir el addon con `addonBuilder` (esto no cambia).
- Exponer el router interno del SDK (`getRouter()` o `getInterface()`)
  envuelto en un handler compatible con Vercel, usando el paquete
  `serverless-http`, **o**
- Implementar manualmente los endpoints (`/manifest.json`,
  `/catalog/...`, `/meta/...`, `/stream/...`) como funciones serverless que
  llaman directamente a los handlers ya definidos (`defineCatalogHandler`,
  `defineMetaHandler`, `defineStreamHandler`).

La opción manual es más fiable en Vercel (evita problemas de routing con
`serverless-http` y el SDK), así que es la que debe implementarse.

## Estructura final esperada

```
/
├── api/
│   ├── manifest.json.js      → devuelve el manifest del addon
│   ├── catalog/
│   │   └── [type]/[id].js    → devuelve el catálogo (cortos propios)
│   ├── meta/
│   │   └── [type]/[id].js    → devuelve metadata de un corto propio
│   └── stream/
│       └── [type]/[id].js    → devuelve el/los stream(s) (infoHash) para
│                                 un id propio (cortos-*) o de IMDb (tt...)
├── lib/
│   └── data.js                → CORTOS[] e IMDB_STREAMS{} (contenido y
│                                 lógica compartida entre los endpoints)
├── vercel.json
├── package.json
└── README.md
```

> Nota: Vercel espera rutas de archivo tipo `api/stream/[type]/[id].js`
> usando su convención de rutas dinámicas (carpetas entre corchetes). Todos
> los handlers deben poner cabeceras CORS (`Access-Control-Allow-Origin: *`)
> porque Stremio hace las peticiones desde la app, no desde un navegador con
> el mismo origen.

## Contenido de referencia a migrar

El código de partida (versión "servidor Node normal", **NO apta para
Vercel tal cual**, pero con toda la lógica de negocio ya definida) es este
`addon.js`:

```javascript
const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const CORTOS = [
    {
        id: "cortos-1",
        type: "movie",
        name: "Mi corto 1",
        poster: "https://tu-servidor-o-imgur.com/poster1.jpg",
        description: "Descripción breve del corto",
        infoHash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        sources: [
            "tracker:udp://tracker.opentrackr.org:1337/announce",
            "tracker:udp://open.tracker.cl:1337/announce",
            "tracker:udp://tracker.openbittorrent.com:6969/announce",
        ],
    },
];

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
    idPrefixes: ["cortos-", "tt"],
};

const builder = new addonBuilder(manifest);

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

builder.defineStreamHandler(({ type, id }) => {
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

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
```

## Tareas para Claude Code

1. **Extraer los datos** (`CORTOS`, `IMDB_STREAMS`, `manifest`) a
   `lib/data.js`, exportados como módulo, sin depender de `addonBuilder`
   ni de `serveHTTP` (esa parte no sirve en serverless).

2. **Crear `api/manifest.json.js`**: handler que simplemente responde el
   objeto `manifest` en JSON, con cabecera
   `Content-Type: application/json` y CORS abierto.

3. **Crear `api/catalog/[type]/[id].js`**: replica la lógica de
   `defineCatalogHandler` leyendo `req.query.type` y `req.query.id`
   (Vercel inyecta los segmentos de ruta dinámica ahí).

4. **Crear `api/meta/[type]/[id].js`**: replica `defineMetaHandler`.

5. **Crear `api/stream/[type]/[id].js`**: replica `defineStreamHandler`,
   con el `id` pudiendo venir con extensión `.json` (Stremio pide
   `/stream/movie/tt0063350.json` — hay que quitar el `.json` del id antes
   de comparar).

6. **`vercel.json`**: configurar rewrites si hace falta para que
   `/manifest.json` en la raíz apunte a `api/manifest.json.js`, y que las
   demás rutas usen el formato exacto que espera Stremio:
   - `/manifest.json`
   - `/catalog/:type/:id.json`
   - `/meta/:type/:id.json`
   - `/stream/:type/:id.json`

7. **`package.json`**: dependencias mínimas, sin `stremio-addon-sdk` si se
   opta por handlers manuales (no es necesario en Vercel), o mantenerlo
   solo si se usan sus tipos/validaciones de manifest.

8. **Desplegar**: 
   - Verificar que el repo está en GitHub.
   - Ejecutar `vercel` (o conectar el repo desde el dashboard de Vercel)
     para desplegar.
   - Confirmar que `https://<proyecto>.vercel.app/manifest.json` responde
     con el JSON correcto.
   - Confirmar que `https://<proyecto>.vercel.app/stream/movie/tt0063350.json`
     responde con el stream de prueba (Night of the Living Dead, infoHash
     `4d5f74f5babcd7bf62b75acd8182370ca495dfa5`).

9. **Instrucciones finales para el usuario**: una vez desplegado, indicar
   que la URL de instalación en Stremio es
   `https://<proyecto>.vercel.app/manifest.json`, y que puede compartirla
   con cualquiera para que la añada desde Stremio → Addons → pegar URL.

## Notas importantes

- Vercel no seedea nada: sigue haciendo falta que alguien (vosotros)
  mantenga el torrent activo con seeders para que el stream funcione,
  igual que en local.
- Si en el futuro se quiere evitar depender de seeders propios, valorar
  migrar los streams de `infoHash` a URLs HTTP directas (alojando los
  vídeos en algún storage), lo cual también es compatible con Vercel sin
  cambios estructurales grandes.

## Buscador de torrents en /admin (Prowlarr)

Además de pegar un magnet link a mano, el panel `/admin` tiene un botón
"🔍 Buscar torrent (Prowlarr)" que busca por título en una instancia propia
de [Prowlarr](https://github.com/Prowlarr/Prowlarr) (agregador de indexers),
filtra por defecto los resultados que parecen estar en español de España
(heurística sobre el título: "castellano", "español", etc., excluyendo
"latino") y, al hacer clic en un resultado, rellena el campo de magnet
automáticamente.

Variables de entorno necesarias en Vercel:

- `PROWLARR_URL`: URL base de tu instancia de Prowlarr, accesible desde
  internet (Vercel no puede llegar a una IP de tu LAN local sin exponerla
  primero, p. ej. vía Tailscale Funnel o Cloudflare Tunnel).
- `PROWLARR_API_KEY`: API key de Prowlarr (Settings → General).

El endpoint `/api/prowlarr-search` (POST, requiere `ADMIN_SECRET`) solo
devuelve resultados de los que se puede construir un magnet link
directamente (indexers de torrent con `infoHash` o `magnetUrl`); los
resultados que solo ofrecen descarga de fichero `.torrent` se descartan.

## Buscador de películas por nombre en /admin (TMDB)

El campo "Nombre de la película" del formulario de alta busca en
[TMDB](https://www.themoviedb.org/) en español (`language=es-ES`), a
diferencia de Cinemeta (el catálogo de metadatos de Stremio), que solo
devuelve títulos en inglés/original y no soporta idioma. Al elegir un
resultado se resuelve aparte el ID de IMDb (TMDB no lo incluye en la
búsqueda) vía `/api/movie-resolve`.

Variable de entorno necesaria en Vercel:

- `TMDB_API_KEY`: la "API Key (v3 auth)", gratuita, en
  https://www.themoviedb.org/settings/api.
