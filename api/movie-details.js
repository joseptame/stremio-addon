const { getDetailsByImdb } = require("../lib/tmdb");
const { RD_ACCOUNTS, getPlayableStream } = require("../lib/realdebrid");
const { isAuthenticated } = require("../lib/adminAuth");

// Dos usos desde la ficha del panel (en un solo endpoint porque el plan
// Hobby de Vercel admite como máximo 12 funciones por despliegue):
// - { imdbId, type }: sinopsis, datos y tráiler de TMDB.
// - { action: "play", infoHash }: enlace para reproducir la película con
//   la primera cuenta de RD (en el orden de RD_ACCOUNTS) que la tenga lista.
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

module.exports = async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido." });
    }

    if (!isAuthenticated(req, (process.env.ADMIN_PASSWORD || "").trim())) {
        return res.status(401).json({ error: "Sesión caducada. Vuelve a iniciar sesión en /admin." });
    }

    const { imdbId, type, action, infoHash } = req.body || {};

    try {
        if (action === "play") return await playStream(res, infoHash);

        if (!imdbId || !/^tt[0-9]+$/.test(String(imdbId))) {
            return res.status(400).json({ error: "ID de IMDb inválido." });
        }
        const details = await getDetailsByImdb(String(imdbId), type === "series" ? "series" : "movie");
        return res.status(200).json({ details });
    } catch (err) {
        return res.status(502).json({ error: err.message });
    }
};
