// Sesión de /admin basada en una cookie firmada (HMAC), sin base de datos:
// la cookie lleva la fecha de caducidad y una firma calculada con
// ADMIN_PASSWORD como clave. Si la firma no coincide o ha caducado, no hay
// sesión válida. "Recordarme" simplemente alarga la caducidad.

const crypto = require("crypto");

const COOKIE_NAME = "admin_session";
const REMEMBER_SECONDS = 60 * 60 * 24 * 30; // 30 días
const SESSION_SECONDS = 60 * 60 * 8; // 8 horas

function sign(expiry, secret) {
    return crypto.createHmac("sha256", secret).update(String(expiry)).digest("hex");
}

function createSessionCookie(secret, remember) {
    const maxAge = remember ? REMEMBER_SECONDS : SESSION_SECONDS;
    const expiry = Date.now() + maxAge * 1000;
    const value = `${expiry}.${sign(expiry, secret)}`;
    return `${COOKIE_NAME}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie() {
    return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function parseCookies(header) {
    const out = {};
    (header || "").split(";").forEach((part) => {
        const idx = part.indexOf("=");
        if (idx === -1) return;
        const key = part.slice(0, idx).trim();
        if (key) out[key] = decodeURIComponent(part.slice(idx + 1).trim());
    });
    return out;
}

function isAuthenticated(req, secret) {
    if (!secret) return false;
    const raw = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!raw) return false;

    const dot = raw.indexOf(".");
    if (dot === -1) return false;
    const expiry = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    if (!/^[0-9a-f]{64}$/.test(sig)) return false;

    const expected = sign(expiry, secret);
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

    return Number(expiry) > Date.now();
}

module.exports = { createSessionCookie, clearSessionCookie, isAuthenticated, COOKIE_NAME };
