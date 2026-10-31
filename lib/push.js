// Notificaciones push (Web Push estándar, como en pandora-tcg): avisos al
// móvil aunque la app esté cerrada — copias nuevas en la lista de deseos y
// descargas de Real-Debrid terminadas.
//
// Las suscripciones de cada dispositivo se guardan en lib/push.json vía
// GitHub, CIFRADAS: el repo es público y con el endpoint + claves de una
// suscripción se puede mandar avisos a ese dispositivo. La clave de
// cifrado sale de VAPID_PRIVATE_KEY, que solo está en Vercel.
//
// Requiere VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT (mailto:...).

const crypto = require("crypto");
const webpush = require("web-push");
const { readJsonFile, writeJsonFile } = require("./github");

const PUSH_PATH = "lib/push.json";

function vapid() {
    const publicKey = (process.env.VAPID_PUBLIC_KEY || "").trim();
    const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();
    const subject = (process.env.VAPID_SUBJECT || "").trim();
    return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

function isPushConfigured() {
    return !!vapid();
}

function cipherKey() {
    return crypto.createHash("sha256").update(`stremio-addon-push:${vapid().privateKey}`).digest();
}

function encrypt(list) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", cipherKey(), iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(list), "utf8"), cipher.final()]);
    return { v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

function decrypt(blob) {
    if (!blob || !blob.data) return [];
    try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(blob.iv, "base64"));
        decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
        const text = Buffer.concat([decipher.update(Buffer.from(blob.data, "base64")), decipher.final()]).toString("utf8");
        return JSON.parse(text);
    } catch {
        return [];
    }
}

// Estado guardado (cifrado): { subs: [suscripciones], notified: { <clave>:
// fecha } }. "notified" recuerda de qué se ha avisado ya (p. ej. cada
// descarga terminada), para no repetir el aviso aunque la comprobación se
// lance muchas veces o con retraso. Las versiones antiguas guardaban solo
// la lista de suscripciones.
async function readState() {
    const { data, sha } = await readJsonFile(PUSH_PATH, {});
    const raw = decrypt(data);
    const state = Array.isArray(raw) ? { subs: raw, notified: {} } : { subs: raw.subs || [], notified: raw.notified || {} };
    return { ...state, sha };
}

async function writeState(state, sha, message) {
    return writeJsonFile(PUSH_PATH, encrypt({ subs: state.subs, notified: state.notified }), sha, message);
}

// Guarda la suscripción de un dispositivo (sin duplicar por endpoint).
async function saveSubscription(sub) {
    if (!isPushConfigured()) throw new Error("Las notificaciones no están configuradas en el servidor.");
    if (!sub || !/^https:\/\//.test(String(sub.endpoint || "")) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        throw new Error("Suscripción no válida.");
    }
    const state = await readState();
    if (state.subs.some((s) => s.endpoint === sub.endpoint)) return { saved: false, total: state.subs.length };
    state.subs.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, addedAt: new Date().toISOString() });
    await writeState(state, state.sha, "Notificaciones: nuevo dispositivo");
    return { saved: true, total: state.subs.length };
}

// Envía a todas las suscripciones del estado; quita del estado las que el
// navegador ya no reconoce (404/410: app desinstalada, permiso quitado).
// Devuelve si ha cambiado algo que haya que guardar.
async function deliver(state, payload) {
    const keys = vapid();
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
    const body = JSON.stringify(payload);
    const gone = [];
    let sent = 0;
    let failed = 0;
    await Promise.all(state.subs.map(async (s) => {
        try {
            await webpush.sendNotification(s, body);
            sent++;
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) gone.push(s.endpoint);
            else failed++;
        }
    }));
    if (gone.length) state.subs = state.subs.filter((s) => !gone.includes(s.endpoint));
    return { sent, failed, removed: gone.length };
}

// Manda { title, body, url } a todos los dispositivos.
async function sendToAll(payload) {
    if (!vapid()) return { sent: 0, failed: 0 };
    const state = await readState();
    if (!state.subs.length) return { sent: 0, failed: 0 };
    const result = await deliver(state, payload);
    if (result.removed) {
        try {
            await writeState(state, state.sha, "Notificaciones: quitar dispositivos que ya no existen");
        } catch {
            // Se reintentará en el próximo envío.
        }
    }
    return result;
}

// Avisos que solo se mandan una vez: events = [{ key, payload }]. Los que
// ya se avisaron (según "notified") se saltan; los avisos de más de 7 días
// se olvidan. Un solo commit, y solo si hay algo nuevo.
const NOTIFIED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
async function sendOnce(events) {
    if (!vapid() || !events.length) return { sent: [] };
    const state = await readState();
    const fresh = events.filter((e) => !state.notified[e.key]);
    if (!fresh.length) return { sent: [] };
    for (const e of fresh) {
        if (state.subs.length) await deliver(state, e.payload);
        state.notified[e.key] = new Date().toISOString();
    }
    const cutoff = Date.now() - NOTIFIED_TTL_MS;
    Object.keys(state.notified).forEach((k) => {
        if (Date.parse(state.notified[k]) < cutoff) delete state.notified[k];
    });
    await writeState(state, state.sha, `Notificaciones: aviso de ${fresh.length} descarga${fresh.length === 1 ? "" : "s"} terminada${fresh.length === 1 ? "" : "s"}`);
    return { sent: fresh.map((e) => e.key) };
}

module.exports = { isPushConfigured, saveSubscription, sendToAll, sendOnce };
