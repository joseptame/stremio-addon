// Parsea magnet links a { infoHash, sources, name }.
// Soporta infoHash en hex (40 chars) o base32 (32 chars, como generan
// algunos clientes de torrent).

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32ToHex(base32) {
    const clean = base32.toUpperCase().replace(/=+$/, "");
    let bits = "";
    for (const char of clean) {
        const val = BASE32_ALPHABET.indexOf(char);
        if (val === -1) throw new Error("Hash del magnet con caracteres inválidos");
        bits += val.toString(2).padStart(5, "0");
    }
    let hex = "";
    for (let i = 0; i + 4 <= bits.length; i += 4) {
        hex += parseInt(bits.substring(i, i + 4), 2).toString(16);
    }
    return hex;
}

function parseMagnet(magnet) {
    if (!magnet || !magnet.trim().toLowerCase().startsWith("magnet:")) {
        throw new Error("Eso no parece un magnet link (debe empezar por \"magnet:\")");
    }

    const btihMatch = magnet.match(/xt=urn:btih:([A-Za-z0-9]+)/i);
    if (!btihMatch) {
        throw new Error("No se encontró el hash (xt=urn:btih:...) en el magnet link");
    }

    let hash = btihMatch[1];
    if (hash.length === 32) {
        hash = base32ToHex(hash);
    } else if (hash.length !== 40) {
        throw new Error("Longitud de hash inesperada en el magnet link");
    }
    const infoHash = hash.toLowerCase();

    const sources = [];
    for (const m of magnet.matchAll(/tr=([^&]+)/g)) {
        sources.push("tracker:" + decodeURIComponent(m[1]));
    }

    const dnMatch = magnet.match(/dn=([^&]+)/);
    const name = dnMatch ? decodeURIComponent(dnMatch[1].replace(/\+/g, " ")) : null;

    return { infoHash, sources, name };
}

module.exports = { parseMagnet };
