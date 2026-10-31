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

async function readSubscriptions() {
    const { data, sha } = await readJsonFile(PUSH_PATH, {});
    return { subs: decrypt(data), sha };
}

async function writeSubscriptions(subs, sha, message) {
    return writeJsonFile(PUSH_PATH, encrypt(subs), sha, message);
}

// Guarda la suscripción de un dispositivo (sin duplicar por endpoint).
async function saveSubscription(sub) {
    if (!isPushConfigured()) throw new Error("Las notificaciones no están configuradas en el servidor.");
    if (!sub || !/^https:\/\//.test(String(sub.endpoint || "")) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        throw new Error("Suscripción no válida.");
    }
    const { subs, sha } = await readSubscriptions();
    if (subs.some((s) => s.endpoint === sub.endpoint)) return { saved: false, total: subs.length };
    subs.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, addedAt: new Date().toISOString() });
    await writeSubscriptions(subs, sha, "Notificaciones: nuevo dispositivo");
    return { saved: true, total: subs.length };
}

// Manda { title, body, url } a todos los dispositivos. Los que el navegador
// ya no reconoce (404/410: app desinstalada, permiso quitado) se borran.
async function sendToAll(payload) {
    const keys = vapid();
    if (!keys) return { sent: 0, failed: 0 };
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
    const { subs, sha } = await readSubscriptions();
    if (!subs.length) return { sent: 0, failed: 0 };

    const body = JSON.stringify(payload);
    const gone = [];
    let sent = 0;
    let failed = 0;
    await Promise.all(subs.map(async (s) => {
        try {
            await webpush.sendNotification(s, body);
            sent++;
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) gone.push(s.endpoint);
            else failed++;
        }
    }));
    if (gone.length) {
        const left = subs.filter((s) => !gone.includes(s.endpoint));
        try {
            await writeSubscriptions(left, sha, "Notificaciones: quitar dispositivos que ya no existen");
        } catch {
            // Se reintentará en el próximo envío.
        }
    }
    return { sent, failed, removed: gone.length };
}

module.exports = { isPushConfigured, saveSubscription, sendToAll };
