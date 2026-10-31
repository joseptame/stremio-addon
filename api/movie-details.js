const { getDetailsByImdb } = require("../lib/tmdb");
const { RD_ACCOUNTS, getPlayableStream, accountStates, loadAccountMaps } = require("../lib/realdebrid");
const { isAuthenticated } = require("../lib/adminAuth");
const { runWishlistCheck } = require("../lib/wishlist");

// Dos usos desde la ficha del panel (en un solo endpoint porque el plan
// Hobby de Vercel admite como máximo 12 funciones por despliegue):
// - { imdbId, type }: sinopsis, datos y tráiler de TMDB.
// - { action: "play", infoHash }: enlace para reproducir la película con
//   la primera cuenta de RD (en el orden de RD_ACCOUNTS) que la tenga lista.
// - { action: "status", infoHashes }: progreso en RD, para la ficha y la
//   biblioteca mientras algo se está descargando.
// Y por GET, la lista HLS recortada para el reproductor (trimmedPlaylist).
async function playStream(res, infoHash) {
    if (!infoHash || !/^[0-9a-fA-F]{40}$/.test(String(infoHash))) {
        return res.status(400).json({ error: "infoHash inválido." });
    }
    for (const acc of RD_ACCOUNTS) {
        const key = process.env[acc.envVar];
        if (!key) continue;
        const stream = await getPlayableStream(key, infoHash);
        if (stream && (stream.hls || stream.download)) {
            return res.status(200).json({ account: acc.id, ...stream });
        }
    }
    return res.status(404).json({ error: "Ninguna cuenta de Real-Debrid la tiene lista todavía." });
}

// GET ?hls=<lista de RD>: la misma lista HLS sin el primer fragmento. En
// RD ese fragmento es el que arranca la conversión: tarda ~1 min y vuelve
// vacío o con 503, y el reproductor se queda parado en él. El panel lo pide
// antes por su cuenta y le pasa al reproductor esta lista, que empieza en
// el segundo (ya listo al momento). Sin sesión: la URL de RD ya es el
// secreto y solo se aceptan listas de real-debrid.com.
async function trimmedPlaylist(res, hlsUrl) {
    let url;
    try {
        url = new URL(String(hlsUrl));
    } catch {
        return res.status(400).end();
    }
    if (url.protocol !== "https:" || !/(^|\.)real-debrid\.com$/.test(url.hostname) || !/\.m3u8$/.test(url.pathname)) {
        return res.status(400).end();
    }
    const upstream = await fetch(url.href);
    if (!upstream.ok) return res.status(502).end();
    const lines = (await upstream.text()).split(/\r?\n/);

    let skipped = false;
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!skipped && line.startsWith("#EXTINF")) {
            skipped = true;
            i++; // y la URI del fragmento que va justo después
            continue;
        }
        if (line.startsWith("#EXT-X-MEDIA-SEQUENCE")) {
            out.push("#EXT-X-MEDIA-SEQUENCE:1");
        } else if (line && !line.startsWith("#")) {
            out.push(new URL(line, url.href).href);
        } else {
            out.push(line);
        }
    }

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.status(200).send(out.join("\n"));
}

// Tarea diaria de Vercel (ver "crons" en vercel.json): vuelve a buscar la
// lista de deseos. Solo la lanza Vercel: con CRON_SECRET configurado, por
// su cabecera Authorization; si no, por su User-Agent.
function isVercelCron(req) {
    const secret = (process.env.CRON_SECRET || "").trim();
    if (secret) return req.headers.authorization === `Bearer ${secret}`;
    return /vercel-cron/i.test(req.headers["user-agent"] || "");
}

module.exports = async (req, res) => {
    if (req.method === "GET" && req.query && req.query.cron === "wishlist") {
        if (!isVercelCron(req)) return res.status(401).json({ error: "Solo para la tarea programada." });
        try {
            return res.status(200).json(await runWishlistCheck());
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    if (req.method === "GET" && req.query && req.query.hls) {
        try {
            return await trimmedPlaylist(res, req.query.hls);
        } catch {
            return res.status(502).end();
        }
    }

    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido." });
    }

    if (!isAuthenticated(req, (process.env.ADMIN_PASSWORD || "").trim())) {
        return res.status(401).json({ error: "Sesión caducada. Vuelve a iniciar sesión en /admin." });
    }

    const { imdbId, type, action, infoHash, infoHashes } = req.body || {};

    try {
        if (action === "play") return await playStream(res, infoHash);

        // Estado en RD de varias películas a la vez (para ver el progreso
        // en directo): { status: { <infoHash>: [estado por cuenta] } }.
        if (action === "status") {
            const hashes = (Array.isArray(infoHashes) ? infoHashes : [])
                .map((h) => String(h).toLowerCase())
                .filter((h) => /^[0-9a-f]{40}$/.test(h))
                .slice(0, 100);
            const maps = await loadAccountMaps();
            const status = {};
            hashes.forEach((h) => { status[h] = accountStates(h, maps); });
            return res.status(200).json({ status });
        }

        if (!imdbId || !/^tt[0-9]+$/.test(String(imdbId))) {
            return res.status(400).json({ error: "ID de IMDb inválido." });
        }
        const details = await getDetailsByImdb(String(imdbId), type === "series" ? "series" : "movie");
        return res.status(200).json({ details });
    } catch (err) {
        return res.status(502).json({ error: err.message });
    }
};
