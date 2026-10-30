const { RD_ACCOUNTS, getPlayableStream } = require("../lib/realdebrid");
const { isAuthenticated } = require("../lib/adminAuth");

// Enlace para reproducir en el panel una película ya lista en RD, con la
// primera cuenta (en el orden de RD_ACCOUNTS) que la tenga descargada.
module.exports = async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido." });
    }

    if (!isAuthenticated(req, (process.env.ADMIN_PASSWORD || "").trim())) {
        return res.status(401).json({ error: "Sesión caducada. Vuelve a iniciar sesión en /admin." });
    }

    const { infoHash } = req.body || {};
    if (!infoHash || !/^[0-9a-fA-F]{40}$/.test(String(infoHash))) {
        return res.status(400).json({ error: "infoHash inválido." });
    }

    try {
        for (const acc of RD_ACCOUNTS) {
            const key = process.env[acc.envVar];
            if (!key) continue;
            const stream = await getPlayableStream(key, infoHash);
            if (stream && (stream.hls || stream.download)) {
                return res.status(200).json({ account: acc.id, ...stream });
            }
        }
        return res.status(404).json({ error: "Ninguna cuenta de Real-Debrid la tiene lista todavía." });
    } catch (err) {
        return res.status(502).json({ error: err.message });
    }
};
