const { parseMagnet } = require("../lib/magnet");
const { fetchCinemetaMeta } = require("../lib/cinemeta");
const { RD_ACCOUNTS, triggerRealDebridCache, listTorrents, torrentsByHash } = require("../lib/realdebrid");
const { fetchTorrentBytes } = require("../lib/prowlarr");
const { IMDB_STREAMS } = require("../lib/data");
const { isAuthenticated } = require("../lib/adminAuth");
const { escapeHtml, icon, headTags, themeCss, isLocal, renderTopBar, renderBottomNav } = require("../lib/ui");

const OWNER = "joseptame";
const REPO = "stremio-addon";
const BRANCH = "master";
const FILE_PATH = "lib/imdb-streams.json";


// Recarga si la página vuelve del bfcache (típico al reabrir la PWA desde
// el icono tras dejarla en segundo plano): sin esto, el usuario ve la
// versión que tenía cargada la última vez, no la actual.
const BFCACHE_RELOAD_SCRIPT = `window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });`;

// ── Estilos de la biblioteca ─────────────────────────────────────────
function libraryStyles() {
    return `
  main { max-width: 1400px; margin: 0 auto; padding: 0 24px 80px; }
  .hero {
    position: relative; margin: 20px 0 36px; border-radius: 22px; overflow: hidden;
    min-height: 380px; display: flex; align-items: flex-end; isolation: isolate;
    background: var(--surface); border: 1px solid rgba(255,255,255,0.05);
  }
  .hero-bg { position: absolute; inset: 0; z-index: -2; }
  .hero-bg img { width: 100%; height: 100%; object-fit: cover; object-position: center 25%; }
  .hero-bg.fallback img { filter: blur(30px) saturate(140%); transform: scale(1.3); opacity: 0.6; }
  .hero::before { content: ""; position: absolute; inset: 0; z-index: -1;
    background:
      linear-gradient(90deg, rgba(11,10,15,0.96) 0%, rgba(11,10,15,0.75) 38%, rgba(11,10,15,0.15) 75%),
      linear-gradient(0deg, rgba(11,10,15,0.95) 0%, rgba(11,10,15,0) 55%); }
  .hero::after { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0.35;
    background: repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px); }
  .hero-content { display: flex; align-items: flex-end; gap: 28px; padding: 40px; width: 100%; animation: fade-up 0.5s ease both; }
  .hero-poster { width: 170px; aspect-ratio: 2/3; object-fit: cover; border-radius: 12px; flex-shrink: 0;
    box-shadow: 0 24px 50px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1); }
  .hero-text { min-width: 0; max-width: 640px; }
  .eyebrow { display: inline-flex; align-items: center; gap: 8px; font: 700 0.7rem var(--font-body); letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent); }
  .eyebrow::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); }
  .hero-title { font: 400 clamp(2.6rem, 6vw, 4.6rem)/0.92 var(--font-display); letter-spacing: 0.02em; margin: 12px 0 14px; text-wrap: balance; }
  .hero-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 18px; }
  .hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
  .rd-mini { display: flex; flex-wrap: wrap; gap: 14px; }
  .rd-mini .acc { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--text-dim); }
  .rd-mini .acc b { color: var(--text); font-weight: 600; }

  .shelf-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
  .shelf-title { font: 400 2.1rem/1 var(--font-display); letter-spacing: 0.04em; margin: 0; }
  .shelf-title .count { color: var(--text-mute); font-size: 1.4rem; margin-left: 6px; }
  .shelf-tools { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 22px; }
  .shelf-tools .input-icon { flex: 1 1 260px; max-width: 420px; }
  .filters { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px; min-width: 0; max-width: 100%; }
  .filters::-webkit-scrollbar { display: none; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 28px 20px; }
  .tape { all: unset; cursor: pointer; display: block; min-width: 0; animation: fade-up 0.45s ease both; animation-delay: calc(var(--i, 0) * 35ms); }
  .tape-poster { position: relative; aspect-ratio: 2/3; border-radius: 12px; overflow: hidden; background: var(--surface-2);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 10px 30px -14px rgba(0,0,0,0.9);
    transition: transform 0.25s cubic-bezier(.2,.8,.2,1), box-shadow 0.25s; }
  .tape-poster img { width: 100%; height: 100%; object-fit: cover; }
  .tape-poster::after { content: ""; position: absolute; inset: 0; background: linear-gradient(0deg, rgba(0,0,0,0.75), transparent 45%); opacity: 0; transition: opacity 0.25s; }
  .tape:hover .tape-poster, .tape:focus-visible .tape-poster { transform: translateY(-6px) scale(1.02);
    box-shadow: 0 0 0 2px var(--accent), 0 0 28px -4px var(--accent-glow), 0 22px 40px -16px rgba(0,0,0,0.9); }
  .tape:hover .tape-poster::after { opacity: 1; }
  .tape-placeholder { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 14px; text-align: center;
    background: radial-gradient(circle at 50% 30%, var(--surface-3), var(--surface)); color: var(--text-mute);
    font: 400 1.4rem/1 var(--font-display); letter-spacing: 0.04em; }
  .tape-badge { position: absolute; top: 9px; left: 9px; z-index: 2; display: inline-flex; align-items: center; gap: 5px;
    height: 24px; padding: 0 9px; border-radius: 999px; font: 700 0.68rem/1 var(--font-body); letter-spacing: 0.03em;
    background: rgba(11,10,15,0.78); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); }
  .tape-badge.ready { color: var(--ok); }
  .tape-badge.downloading { color: var(--gold); }
  .tape-badge.none { color: var(--text-dim); }
  .tape-type { position: absolute; top: 9px; right: 9px; z-index: 2; }
  .tape-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; z-index: 2; background: rgba(0,0,0,0.5); }
  .tape-progress span { display: block; height: 100%; background: var(--gold); box-shadow: 0 0 8px var(--gold); }
  .tape-title { margin-top: 11px; font-weight: 600; font-size: 0.92rem; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .tape-sub { margin-top: 3px; font-size: 0.76rem; color: var(--text-mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .empty-state { text-align: center; padding: 70px 20px; color: var(--text-dim); border: 1px dashed var(--line-strong); border-radius: 18px; }
  .empty-state .big { font: 400 2rem/1 var(--font-display); letter-spacing: 0.04em; color: var(--text); margin: 14px 0 8px; }
  .empty-state .icon { margin: 0 auto; color: var(--accent); }

  /* ── Ficha (modal en escritorio, hoja inferior en móvil) ── */
  .sheet-overlay { position: fixed; inset: 0; z-index: 100; display: none; align-items: center; justify-content: center; padding: 24px;
    background: rgba(5,4,8,0.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
  .sheet-overlay.open { display: flex; }
  .sheet { position: relative; width: 100%; max-width: 760px; max-height: calc(100vh - 48px); overflow-y: auto;
    background: var(--bg-2); border: 1px solid var(--line); border-radius: 22px; box-shadow: 0 40px 80px -20px rgba(0,0,0,0.9);
    animation: fade-up 0.25s ease both; }
  .sheet-hero { position: relative; height: 260px; background: var(--surface); }
  .sheet-hero img { width: 100%; height: 100%; object-fit: cover; }
  .sheet-hero.fallback img { filter: blur(26px) saturate(140%); transform: scale(1.2); opacity: 0.55; }
  .sheet-hero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(0deg, var(--bg-2) 0%, rgba(17,15,23,0.2) 60%, rgba(17,15,23,0.4) 100%); }
  .sheet-close { position: absolute; top: 14px; right: 14px; z-index: 3; background: rgba(11,10,15,0.6); backdrop-filter: blur(8px); }
  .sheet-body { position: relative; padding: 0 32px 32px; margin-top: -120px; z-index: 2; }
  .sheet-top { display: flex; gap: 24px; align-items: flex-end; }
  .sheet-poster { width: 140px; aspect-ratio: 2/3; object-fit: cover; border-radius: 12px; flex-shrink: 0; background: var(--surface-2);
    box-shadow: 0 20px 40px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.1); }
  .sheet-title { font: 400 2.6rem/0.95 var(--font-display); letter-spacing: 0.02em; margin: 0 0 12px; }
  .sheet-section { margin-top: 28px; }
  .sheet-section h4 { margin: 0 0 12px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-mute); }
  .rd-list { display: grid; gap: 10px; }
  .rd-item { display: grid; grid-template-columns: 90px 1fr auto; align-items: center; gap: 14px; padding: 12px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); font-size: 0.86rem; }
  .rd-item .name { font-weight: 600; }
  .rd-item .state { min-width: 64px; white-space: nowrap; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text-dim); }
  .rd-item .state.ready { color: var(--ok); }
  .rd-item.missing .state, .rd-item.nokey .state { color: var(--text-mute); font-weight: 500; }
  .rd-item.missing .name, .rd-item.nokey .name { color: var(--text-dim); }
  .rd-item.nokey { border-style: dashed; }
  .sheet-video { display: none; }
  .sheet-play { position: absolute; z-index: 3; left: 50%; top: 42%; transform: translate(-50%, -50%); width: 64px; height: 64px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; padding-left: 4px; cursor: pointer; color: #fff;
    background: rgba(255,61,87,0.9); border: 0; box-shadow: 0 0 0 8px rgba(255,61,87,0.2), 0 10px 30px -6px var(--accent-glow); transition: transform 0.15s, background 0.15s; }
  .sheet-play:hover { transform: translate(-50%, -50%) scale(1.08); background: var(--accent); }
  .sheet-play .icon { fill: currentColor; }
  .sheet.playing .sheet-hero { height: auto; aspect-ratio: 16 / 9; background: #000; }
  .sheet.playing .sheet-hero::after, .sheet.playing .sheet-hero > img, .sheet.playing .sheet-play { display: none; }
  .sheet.playing .sheet-video { display: block; position: absolute; inset: 0; }
  .sheet-video iframe, .sheet-video video { width: 100%; height: 100%; border: 0; display: block; background: #000; }
  .player-msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 20px; text-align: center; color: var(--text-dim); font-size: 0.9rem; }
  .player-src { position: absolute; left: 12px; top: 12px; max-width: calc(100% - 80px); padding: 4px 10px; border-radius: 999px; font-size: 0.7rem; color: var(--text-dim);
    background: rgba(0,0,0,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; transition: opacity 0.3s; }
  .sheet-video:hover .player-src { opacity: 0; }
  .player-ext { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 22px; font-size: 0.8rem; color: var(--text-mute); }
  .player-ext[hidden], .player-ext span[hidden], .player-tracks[hidden] { display: none; }
  .player-tracks { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin-bottom: 14px; font-size: 0.8rem; color: var(--text-mute); }
  .player-tracks label { display: flex; align-items: center; gap: 8px; }
  .player-tracks select { min-height: 34px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--text); font: inherit; }
  .player-tracks span { flex: 1 1 100%; }
  #ext-hint { color: var(--gold); }
  #ext-hint a { color: inherit; text-decoration: underline; }
  .player-ext span { flex: 1 1 100%; }
  .player-ext .btn { min-height: 34px; padding: 0 14px; font-size: 0.8rem; }
  .sheet.playing .sheet-body { margin-top: 0; padding-top: 24px; }
  .sheet-genres { margin-top: 10px; font-size: 0.82rem; color: var(--text-dim); }
  .sheet-tagline { margin: 0 0 8px; font-style: italic; color: var(--text); font-size: 0.92rem; }
  .sheet-overview { color: var(--text-dim); font-size: 0.92rem; line-height: 1.65; max-width: 640px; }
  .bar { height: 6px; background: var(--bg); border-radius: 999px; overflow: hidden; }
  .bar span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--gold), #ffd98a); }
  .bar span.ready { background: linear-gradient(90deg, #22b866, var(--ok)); }
  .hash-row { display: flex; gap: 10px; align-items: center; padding: 6px 6px 6px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); }
  .hash-row code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 0.8rem ui-monospace, "Cascadia Code", monospace; color: var(--text-dim); }
  .sheet-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 30px; }
  .sheet-actions .grow { flex: 1; }
  .confirm { display: none; margin-top: 18px; padding: 18px; border-radius: var(--radius); background: var(--err-soft); border: 1px solid rgba(255,107,129,0.3); }
  .confirm.open { display: block; animation: fade-up 0.2s ease both; }
  .confirm p { margin: 0 0 14px; color: #ffc0ca; font-size: 0.9rem; }
  .confirm .row { display: flex; gap: 10px; justify-content: flex-end; }

  .pull-refresh-indicator { position: fixed; top: calc(14px + var(--safe-t)); left: 50%; transform: translateX(-50%); width: 38px; height: 38px;
    display: flex; align-items: center; justify-content: center; color: var(--accent); background: var(--surface); border: 1px solid var(--line);
    border-radius: 50%; box-shadow: 0 4px 14px rgba(0,0,0,0.4); opacity: 0; z-index: 200; pointer-events: none; transition: opacity 0.25s ease; }
  .pull-refresh-indicator.visible { opacity: 1; }
  .pull-refresh-indicator .icon { transition: transform 0.15s ease; }
  .pull-refresh-indicator.spinning .icon { animation: spin 0.7s linear infinite; }
  #main-wrap { transition: transform 0.25s ease; }

  @media (max-width: 760px) {
    main { padding: 0 16px calc(var(--bottomnav-h) + var(--safe-b) + 32px); }
    .hero { margin: 14px 0 28px; min-height: 0; border-radius: 18px; }
    .hero-content { flex-direction: column; align-items: flex-start; gap: 18px; padding: 120px 20px 22px; }
    .hero-poster { width: 108px; }
    .hero::before { background: linear-gradient(0deg, rgba(11,10,15,0.98) 0%, rgba(11,10,15,0.7) 55%, rgba(11,10,15,0.1) 100%); }
    .hero-actions .btn { flex: 1; }
    .shelf-title { font-size: 1.8rem; }
    .shelf-tools .input-icon { max-width: none; flex-basis: 100%; }
    .filters { flex: 1 1 100%; max-width: none; margin: 0 -16px; padding: 2px 16px; }
    .grid { grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 20px 12px; }
    .tape-title { font-size: 0.82rem; }
    .tape-badge { top: 6px; left: 6px; height: 21px; padding: 0 7px; font-size: 0.62rem; }
    .tape-type { top: 6px; right: 6px; }
    .sheet-overlay { padding: 0; align-items: flex-end; }
    .sheet { max-height: 92vh; border-radius: 22px 22px 0 0; border-bottom: 0; padding-bottom: var(--safe-b); }
    .sheet-hero { height: 190px; }
    .sheet-body { padding: 0 18px 24px; margin-top: -90px; }
    .sheet-top { gap: 16px; }
    .sheet-poster { width: 96px; }
    .sheet-title { font-size: 2rem; }
    .rd-item { grid-template-columns: 70px 1fr auto; gap: 10px; padding: 11px 13px; }
    .sheet-actions .btn { flex: 1; }
  }
`;
}

// ── Listado ────────────────────────────────────────────────────────
// "downloaded" -> 100%/"listo"; el resto de estados de RD (magnet_conversion,
// queued, downloading...) se muestran con el % si lo hay, o el estado tal
// cual si no (mejor un texto crudo que nada, para poder depurar) con la
// barra a 0.
function formatRdEntry(entry) {
    if (!entry) return null;
    if (entry.status === "downloaded") return { pct: 100, label: "listo" };
    if (typeof entry.progress === "number") return { pct: entry.progress, label: `${entry.progress}%` };
    return { pct: 0, label: entry.status || "?" };
}

// Las portadas de Cinemeta (metahub) vienen en tamaño "small"; para la
// cuadrícula y la ficha se pide la "medium", y el fondo se saca del mismo
// servicio a partir del id de IMDb.
function posterHd(poster) {
    return poster ? String(poster).replace("/poster/small/", "/poster/medium/") : null;
}

function backdropFor(imdbId) {
    return `https://images.metahub.space/background/medium/${encodeURIComponent(imdbId)}/img`;
}

// Resumen de estado en RD de una película: por cuenta y global
// ("ready" si todas las cuentas que la tienen la han descargado,
// "downloading" si alguna va por la mitad, "none" si no está en ninguna).
// "all" lleva siempre las tres cuentas para la ficha: "ok" si la tiene,
// "missing" si no la tiene y "nokey" si en este entorno no hay API key
// de esa cuenta (p. ej. en local) y por tanto no se puede saber.
function rdSummary(entry, rdMaps) {
    const hashKey = (entry.infoHash || "").toLowerCase();
    const all = RD_ACCOUNTS.map((acc) => {
        if (!process.env[acc.envVar]) return { id: acc.id, state: "nokey", pct: 0, label: "Sin clave" };
        const info = formatRdEntry(((rdMaps && rdMaps[acc.id]) || {})[hashKey]);
        return info
            ? { id: acc.id, state: "ok", pct: info.pct, label: info.label }
            : { id: acc.id, state: "missing", pct: 0, label: "No añadida" };
    });
    const accounts = all.filter((a) => a.state === "ok");
    if (accounts.length === 0) return { all, accounts, status: "none", pct: 0 };
    const minPct = Math.min(...accounts.map((a) => a.pct));
    return { all, accounts, status: minPct === 100 ? "ready" : "downloading", pct: minPct };
}

function statusBadge(summary) {
    if (summary.status === "ready") return `<span class="tape-badge ready">${icon("check", 12)} En RD</span>`;
    if (summary.status === "downloading") return `<span class="tape-badge downloading">${icon("download", 12)} ${summary.pct}%</span>`;
    return `<span class="tape-badge none">Sin RD</span>`;
}

function renderListPage({ message, imdbStreams, rdMaps }) {
    const entries = Object.entries(imdbStreams);
    const items = entries.map(([imdbId, s]) => {
        const summary = rdSummary(s, rdMaps);
        return {
            id: imdbId,
            name: s.name || s.title || imdbId,
            title: s.title || "",
            type: s.type === "series" ? "series" : "movie",
            poster: posterHd(s.poster),
            backdrop: backdropFor(imdbId),
            infoHash: s.infoHash || "",
            hasTrackers: Array.isArray(s.sources) && s.sources.length > 0,
            rd: summary.all,
            status: summary.status,
            pct: summary.pct,
        };
    });

    const counts = {
        all: items.length,
        movie: items.filter((i) => i.type === "movie").length,
        series: items.filter((i) => i.type === "series").length,
        ready: items.filter((i) => i.status === "ready").length,
        downloading: items.filter((i) => i.status === "downloading").length,
        none: items.filter((i) => i.status === "none").length,
    };

    // La última del JSON es la última añadida (se insertan al final).
    const latest = items[items.length - 1];
    const hero = latest ? `
    <section class="hero" aria-label="Recién añadida">
      <div class="hero-bg" id="hero-bg">
        <img src="${escapeHtml(latest.backdrop)}" alt="" onerror="this.onerror=null;this.parentNode.classList.add('fallback');this.src=${escapeHtml(JSON.stringify(latest.poster || ""))}">
      </div>
      <div class="hero-content">
        ${latest.poster ? `<img class="hero-poster" src="${escapeHtml(latest.poster)}" alt="">` : ""}
        <div class="hero-text">
          <span class="eyebrow">Recién añadida</span>
          <h1 class="hero-title">${escapeHtml(latest.name)}</h1>
          <div class="hero-meta">
            <span class="tag">${latest.type === "series" ? "Serie" : "Película"}</span>
            <span class="tag">${escapeHtml(latest.id)}</span>
            <span class="tag ${latest.hasTrackers ? "accent" : ""}">${latest.hasTrackers ? "Torrent" : "Magnet"}</span>
          </div>
          ${latest.status !== "none" ? `<div class="rd-mini">${latest.rd.filter((a) => a.state === "ok").map((a) => `<span class="acc">${a.pct === 100 ? `<span style="color:var(--ok)">${icon("check", 14)}</span>` : `<span style="color:var(--gold)">${icon("download", 14)}</span>`}<b>${escapeHtml(a.id)}</b> ${escapeHtml(a.label)}</span>`).join("")}</div>` : `<div class="rd-mini"><span class="acc">Aún no está en ninguna cuenta de Real-Debrid</span></div>`}
          <div class="hero-actions">
            <button type="button" class="btn btn-primary" data-open="${escapeHtml(latest.id)}">${icon("eye", 18)} Ver ficha</button>
            <a class="btn btn-ghost" href="/admin/add?edit=${encodeURIComponent(latest.id)}">${icon("edit", 17)} Editar</a>
          </div>
        </div>
      </div>
    </section>` : "";

    const grid = items.length === 0
        ? `<div class="empty-state">
            ${icon("film", 44)}
            <div class="big">El videoclub está vacío</div>
            <p>Añade tu primera película para que aparezca en Stremio.</p>
            <a class="btn btn-primary" href="/admin/add" style="margin-top:10px">${icon("plus", 18)} Añadir película</a>
          </div>`
        : `<div class="grid" id="grid">${items.slice().reverse().map((it, i) => `
          <button type="button" class="tape" data-open="${escapeHtml(it.id)}" data-type="${it.type}" data-status="${it.status}"
            data-search="${escapeHtml(`${it.name} ${it.title} ${it.id}`.toLowerCase())}" style="--i:${Math.min(i, 20)}" aria-label="${escapeHtml(it.name)}">
            <div class="tape-poster">
              ${it.poster
                ? `<img src="${escapeHtml(it.poster)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="tape-placeholder" style="display:none">${icon("film", 30)}${escapeHtml(it.name)}</div>`
                : `<div class="tape-placeholder">${icon("film", 30)}${escapeHtml(it.name)}</div>`}
              ${statusBadge({ status: it.status, pct: it.pct })}
              ${it.type === "series" ? `<span class="tag accent tape-type">Serie</span>` : ""}
              ${it.status === "downloading" ? `<div class="tape-progress"><span style="width:${it.pct}%"></span></div>` : ""}
            </div>
            <div class="tape-title">${escapeHtml(it.name)}</div>
            <div class="tape-sub">${it.type === "series" ? "Serie" : "Película"} · ${escapeHtml(it.id)}</div>
          </button>`).join("")}
        </div>
        <div class="empty-state" id="no-results" style="display:none">
          ${icon("search", 40)}
          <div class="big">Nada por aquí</div>
          <p>Ninguna película coincide con la búsqueda o el filtro.</p>
        </div>`;

    const filterChip = (key, label) => counts[key] || key === "all"
        ? `<button type="button" class="chip${key === "all" ? " active" : ""}" data-filter="${key}">${label} <span class="count">${counts[key]}</span></button>`
        : "";

    // Datos de cada película para pintar la ficha en cliente. Se escapa "<"
    // para que ningún título pueda cerrar la etiqueta <script>.
    const itemsJson = JSON.stringify(items).replace(/</g, "\\u003c");

    return `<!DOCTYPE html>
<html lang="es">
<head>
${headTags("Biblioteca · JFuster RD")}
<style>${themeCss()}${libraryStyles()}</style>
</head>
<body>
  <div id="pull-refresh-indicator" class="pull-refresh-indicator">${icon("refresh", 18)}</div>
  ${renderTopBar("library")}
  <div id="main-wrap">
  <main>
    ${message ? `<div class="toast" id="toast" role="status">${message}</div>
    <script>
      // Aviso flotante: los de éxito se van solos a los 4 s, los de error
      // a los 10 s; tocándolo se cierra antes.
      (function () {
        var t = document.getElementById('toast');
        function close() { t.classList.add('toast-out'); setTimeout(function () { t.remove(); }, 300); }
        t.addEventListener('click', close);
        setTimeout(close, t.querySelector('.err') ? 10000 : 4000);
      })();
    </script>` : ""}
    ${hero}

    <section id="buscar">
      <div class="shelf-head">
        <h2 class="shelf-title">Tu videoclub <span class="count" id="movie-count">${items.length}</span></h2>
      </div>
      ${items.length ? `<div class="shelf-tools">
        <div class="input-icon">
          ${icon("search", 18)}
          <input class="input" id="search" type="search" placeholder="Buscar por título o id de IMDb..." autocomplete="off">
        </div>
        <div class="filters" role="toolbar" aria-label="Filtros">
          ${filterChip("all", "Todas")}
          ${counts.series ? filterChip("movie", "Películas") : ""}
          ${filterChip("series", "Series")}
          ${filterChip("ready", "Listas en RD")}
          ${filterChip("downloading", "Descargando")}
          ${filterChip("none", "Sin RD")}
        </div>
      </div>` : ""}
      ${grid}
    </section>
  </main>
  </div>

  ${renderBottomNav("library")}

  <div class="sheet-overlay" id="sheet-overlay">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet-hero" id="sheet-hero">
        <img id="sheet-backdrop" alt="">
        <div class="sheet-video" id="sheet-video"></div>
        <button type="button" class="sheet-play" id="sheet-play" aria-label="Ver tráiler">${icon("play", 26)}</button>
        <button type="button" class="icon-btn sheet-close" id="sheet-close" aria-label="Cerrar">${icon("x", 18)}</button>
      </div>
      <div class="sheet-body">
        <div class="player-tracks" id="player-tracks" hidden>
          <label>Audio <select id="track-audio"></select></label>
          <label>Subtítulos <select id="track-subs"></select></label>
          <span>Al cambiarlos, la película vuelve a empezar desde el principio.</span>
        </div>
        <div class="player-ext" id="player-ext" hidden>
          <span>¿No arranca o lo quieres en 4K? Original en:</span>
          <a class="btn btn-ghost" id="ext-vlc" href="#">VLC</a>
          <a class="btn btn-ghost" id="ext-infuse" href="#">Infuse</a>
          <button type="button" class="btn btn-ghost" id="ext-copy">${icon("copy", 16)} Copiar enlace</button>
          <span id="ext-hint" hidden></span>
        </div>
        <div class="sheet-top">
          <img class="sheet-poster" id="sheet-poster" alt="">
          <div style="min-width:0">
            <h3 class="sheet-title" id="sheet-title"></h3>
            <div class="hero-meta" id="sheet-tags" style="margin:0"></div>
          </div>
        </div>
        <div class="sheet-section">
          <h4>Sinopsis</h4>
          <p class="sheet-tagline" id="sheet-tagline"></p>
          <div class="sheet-overview" id="sheet-overview"></div>
        </div>
        <div class="sheet-section">
          <h4>Real-Debrid</h4>
          <div class="rd-list" id="sheet-rd"></div>
        </div>
        <div class="sheet-section">
          <h4>InfoHash</h4>
          <div class="hash-row"><code id="sheet-hash"></code><button type="button" class="btn btn-ghost" id="sheet-copy">${icon("copy", 16)} Copiar</button></div>
        </div>
        <div class="sheet-actions">
          <button type="button" class="btn btn-primary" id="sheet-watch" style="display:none">${icon("play", 17)} Ver ahora</button>
          <button type="button" class="btn btn-ghost" id="sheet-trailer" style="display:none">${icon("film", 17)} Tráiler</button>
          <a class="btn btn-ghost grow" id="sheet-edit" href="#">${icon("edit", 17)} Editar copia</a>
          <a class="btn btn-ghost" id="sheet-imdb" href="#" target="_blank" rel="noopener">IMDb</a>
          <button type="button" class="btn btn-danger" id="sheet-delete">${icon("trash", 17)} Eliminar</button>
        </div>
        <div class="confirm" id="sheet-confirm">
          <p id="sheet-confirm-text"></p>
          <div class="row">
            <button type="button" class="btn btn-ghost" id="sheet-confirm-cancel">Cancelar</button>
            <button type="button" class="btn btn-danger solid" id="sheet-confirm-ok">${icon("trash", 17)} Sí, eliminar</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <form method="POST" action="/admin" id="delete-form" style="display:none">
    <input type="hidden" name="imdbId" id="delete-id">
    <input type="hidden" name="action" value="delete">
  </form>

  <script id="library-data" type="application/json">${itemsJson}</script>
  <script>
    ${BFCACHE_RELOAD_SCRIPT}

    // ── Búsqueda y filtros de la cuadrícula ──
    (function () {
      var tapes = Array.prototype.slice.call(document.querySelectorAll('#grid .tape'));
      var searchInput = document.getElementById('search');
      var noResults = document.getElementById('no-results');
      var countEl = document.getElementById('movie-count');
      var chips = document.querySelectorAll('[data-filter]');
      var navSearch = document.getElementById('nav-search');
      var filter = 'all';

      if (navSearch) navSearch.addEventListener('click', function () {
        if (!searchInput) return;
        document.getElementById('buscar').scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(function () { searchInput.focus(); }, 300);
      });
      if (!tapes.length) return;

      function matches(t) {
        if (filter === 'movie' || filter === 'series') { if (t.dataset.type !== filter) return false; }
        else if (filter !== 'all' && t.dataset.status !== filter) return false;
        var q = (searchInput.value || '').trim().toLowerCase();
        return !q || t.dataset.search.indexOf(q) !== -1;
      }

      function render() {
        var shown = 0;
        tapes.forEach(function (t) {
          var ok = matches(t);
          t.style.display = ok ? '' : 'none';
          if (ok) shown++;
        });
        countEl.textContent = shown;
        noResults.style.display = shown ? 'none' : 'block';
      }

      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          chips.forEach(function (c) { c.classList.remove('active'); });
          chip.classList.add('active');
          filter = chip.dataset.filter;
          render();
        });
      });
      searchInput.addEventListener('input', render);
      if (location.hash === '#buscar') setTimeout(function () { searchInput.focus(); }, 200);
    })();

    // ── Ficha de detalle + eliminar ──
    (function () {
      var items = JSON.parse(document.getElementById('library-data').textContent);
      var byId = {};
      items.forEach(function (it) { byId[it.id] = it; });
      var overlay = document.getElementById('sheet-overlay');
      var hero = document.getElementById('sheet-hero');
      var backdrop = document.getElementById('sheet-backdrop');
      var confirmBox = document.getElementById('sheet-confirm');
      var current = null;
      var lastFocus = null;

      function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }

      function open(id) {
        var it = byId[id];
        if (!it) return;
        current = it;
        lastFocus = document.activeElement;
        hero.classList.remove('fallback');
        backdrop.onerror = function () { backdrop.onerror = null; hero.classList.add('fallback'); backdrop.src = it.poster || ''; };
        backdrop.src = it.backdrop;
        var poster = document.getElementById('sheet-poster');
        poster.src = it.poster || '';
        poster.style.visibility = it.poster ? 'visible' : 'hidden';
        document.getElementById('sheet-title').textContent = it.name;
        document.getElementById('sheet-tags').innerHTML =
          '<span class="tag">' + (it.type === 'series' ? 'Serie' : 'Película') + '</span>' +
          '<span class="tag">' + esc(it.id) + '</span>' +
          '<span class="tag' + (it.hasTrackers ? ' accent' : '') + '">' + (it.hasTrackers ? 'Torrent con trackers' : 'Magnet sin trackers') + '</span>';
        document.getElementById('sheet-rd').innerHTML = it.rd.map(function (a) {
          var ready = a.state === 'ok' && a.pct === 100;
          var title = a.state === 'nokey' ? ' title="No hay API key de esta cuenta en este entorno"' : '';
          return '<div class="rd-item ' + a.state + '"' + title + '><span class="name">' + esc(a.id) + '</span>' +
            '<div class="bar"><span class="' + (ready ? 'ready' : '') + '" style="width:' + a.pct + '%"></span></div>' +
            '<span class="state' + (ready ? ' ready' : '') + '">' + (ready ? '✓ Listo' : esc(a.label)) + '</span></div>';
        }).join('');
        var ready = it.rd.some(function (a) { return a.state === 'ok' && a.pct === 100; });
        document.getElementById('sheet-watch').style.display = ready ? '' : 'none';
        loadDetails(it);
        document.getElementById('sheet-hash').textContent = it.infoHash;
        document.getElementById('sheet-edit').href = '/admin/add?edit=' + encodeURIComponent(it.id);
        document.getElementById('sheet-imdb').href = 'https://www.imdb.com/title/' + encodeURIComponent(it.id) + '/';
        confirmBox.classList.remove('open');
        stopTrailer();
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        document.getElementById('sheet-close').focus();
      }

      // ── Sinopsis, datos y tráiler (TMDB), cargados al abrir la ficha ──
      var detailsCache = {};
      var sheetEl = overlay.querySelector('.sheet');
      var videoEl = document.getElementById('sheet-video');
      var playBtn = document.getElementById('sheet-play');
      var trailerBtn = document.getElementById('sheet-trailer');

      function formatRuntime(min) {
        if (!min) return '';
        return min >= 60 ? Math.floor(min / 60) + ' h ' + (min % 60 ? (min % 60) + ' min' : '') : min + ' min';
      }

      function renderDetails(it, d) {
        if (current !== it) return;
        var overviewEl = document.getElementById('sheet-overview');
        var tagline = document.getElementById('sheet-tagline');
        if (!d) {
          overviewEl.innerHTML = '<span style="color:var(--text-mute)">No se encontró información en TMDB.</span>';
          return;
        }
        tagline.textContent = d.tagline || '';
        tagline.style.display = d.tagline ? '' : 'none';
        overviewEl.textContent = d.overview || 'Sin sinopsis disponible en castellano.';
        var extra = '';
        if (d.year) extra += '<span class="tag">' + esc(d.year) + '</span>';
        if (d.rating) extra += '<span class="tag gold">★ ' + esc(d.rating) + '</span>';
        if (d.runtime && it.type !== 'series') extra += '<span class="tag">' + esc(formatRuntime(d.runtime)) + '</span>';
        if (d.seasons) extra += '<span class="tag">' + esc(d.seasons) + (d.seasons === 1 ? ' temporada' : ' temporadas') + '</span>';
        document.getElementById('sheet-tags').insertAdjacentHTML('beforeend', extra);
        if (d.genres && d.genres.length) {
          document.getElementById('sheet-tags').insertAdjacentHTML('afterend',
            '<div class="sheet-genres" id="sheet-genres">' + d.genres.map(esc).join(' · ') + '</div>');
        }
        it._trailer = d.trailerKey || null;
        playBtn.style.display = it._trailer ? '' : 'none';
        trailerBtn.style.display = it._trailer ? '' : 'none';
      }

      function loadDetails(it) {
        var old = document.getElementById('sheet-genres');
        if (old) old.remove();
        document.getElementById('sheet-tagline').style.display = 'none';
        document.getElementById('sheet-overview').innerHTML =
          '<div class="skeleton" style="height:14px;border-radius:6px;margin-bottom:8px"></div>' +
          '<div class="skeleton" style="height:14px;border-radius:6px;margin-bottom:8px;width:92%"></div>' +
          '<div class="skeleton" style="height:14px;border-radius:6px;width:70%"></div>';
        playBtn.style.display = 'none';
        trailerBtn.style.display = 'none';
        if (detailsCache.hasOwnProperty(it.id)) { renderDetails(it, detailsCache[it.id]); return; }
        fetch('/api/movie-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imdbId: it.id, type: it.type }),
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data.error) throw new Error(data.error);
            detailsCache[it.id] = data.details || null;
            renderDetails(it, detailsCache[it.id]);
          })
          .catch(function () {
            if (current !== it) return;
            document.getElementById('sheet-overview').innerHTML = '<span style="color:var(--text-mute)">No se pudo cargar la sinopsis ahora mismo.</span>';
          });
      }

      function playTrailer() {
        if (!current || !current._trailer) return;
        stopTrailer();
        videoEl.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(current._trailer) +
          '?autoplay=1&rel=0&modestbranding=1" title="Tráiler" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
        sheetEl.classList.add('playing');
        sheetEl.scrollTop = 0;
      }

      // ── Reproducir la película desde Real-Debrid ──
      // El servidor da la lista HLS del streaming de RD (el iPhone la
      // reproduce de forma nativa; en el resto se usa hls.js) y el fichero
      // original como último recurso.
      var watchBtn = document.getElementById('sheet-watch');
      var hlsInstance = null;
      var HLS_JS = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js';

      function loadHlsJs() {
        if (window.Hls) return Promise.resolve(window.Hls);
        return new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = HLS_JS;
          s.onload = function () { resolve(window.Hls); };
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      function showPlayerMessage(html) {
        videoEl.innerHTML = '<div class="player-msg">' + html + '</div>';
        sheetEl.classList.add('playing');
      }

      // RD convierte el vídeo bajo demanda: pedir el primer fragmento es lo
      // que arranca la conversión. Vuelve al momento pero vacío (o con 503),
      // y la petición siguiente se queda esperando ~1 min con fuentes 4K
      // mientras RD se pone en marcha; a partir de ahí todo llega al
      // momento. Esa espera se hace aquí (fragmento 0 y la lista otra vez) y
      // el reproductor recibe la lista sin el fragmento 0 (ver
      // trimmedPlaylist en /api/movie-details), para que no se quede parado
      // en él. RD sirve el HLS con CORS abierto.
      function warmUp(hlsUrl) {
        var controller = window.AbortController ? new AbortController() : null;
        var timer = setTimeout(function () { if (controller) controller.abort(); }, 150000);
        var opts = controller ? { signal: controller.signal } : {};
        return fetch(hlsUrl, opts)
          .then(function (r) { return r.text(); })
          .then(function (txt) {
            var first = txt.split('\\n').filter(function (l) { return l && l.charAt(0) !== '#'; })[0];
            if (!first) return;
            return fetch(new URL(first, hlsUrl).href, opts).then(function (r) { return r.arrayBuffer(); });
          })
          .then(function () { return fetch(hlsUrl, opts); })
          .then(function (r) { return r.arrayBuffer(); })
          .catch(function () {})
          .then(function () { clearTimeout(timer); });
      }

      // Esperas largas y reintentos: los saltos lejos también tardan en RD.
      var HLS_CONFIG = {
        fragLoadPolicy: { default: {
          maxTimeToFirstByteMs: 90000, maxLoadTimeMs: 180000,
          timeoutRetry: { maxNumRetry: 3, retryDelayMs: 0, maxRetryDelayMs: 0 },
          errorRetry: { maxNumRetry: 6, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
        } },
      };

      function attachStream(video, data) {
        if (data.hls && video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = data.hls;
          return Promise.resolve();
        }
        if (data.hls) {
          return loadHlsJs().then(function (Hls) {
            if (!Hls || !Hls.isSupported()) throw new Error('hls');
            hlsInstance = new Hls(HLS_CONFIG);
            hlsInstance.loadSource(data.hls);
            hlsInstance.attachMedia(video);
          }).catch(function () { video.src = data.download; });
        }
        video.src = data.download;
        return Promise.resolve();
      }

      function startVideo(it, data) {
        if (current !== it) return;
        videoEl.innerHTML = '<video controls playsinline autoplay preload="auto"></video>' +
          '<div class="player-src">' + esc(data.account) + ' · ' + esc(data.filename) + '</div>';
        var video = videoEl.querySelector('video');
        attachStream(video, data).then(function () {
          var p = video.play();
          if (p && p.catch) p.catch(function () {});
        });
      }

      // Alternativa para el fichero original (4K, sin convertir, se puede
      // adelantar al instante): abrirlo en VLC o Infuse, o copiar el enlace.
      var extEl = document.getElementById('player-ext');
      function showExternal(data) {
        if (!data.download) { extEl.hidden = true; return; }
        var url = encodeURIComponent(data.download);
        document.getElementById('ext-vlc').href = 'vlc-x-callback://x-callback-url/stream?url=' + url;
        document.getElementById('ext-infuse').href = 'infuse://x-callback-url/play?url=' + url;
        extEl.dataset.url = data.download;
        extHint.hidden = true;
        extEl.hidden = false;
      }

      // Si la app no está instalada, iOS no sabe abrir su enlace (Safari
      // avisa de "dirección no válida") y la página sigue a la vista: tras
      // un par de segundos se ofrece instalarla desde la App Store.
      var extHint = document.getElementById('ext-hint');
      var APP_STORE = {
        'ext-vlc': { name: 'VLC', url: 'https://apps.apple.com/app/id650377962' },
        'ext-infuse': { name: 'Infuse', url: 'https://apps.apple.com/app/id1136220934' },
      };
      ['ext-vlc', 'ext-infuse'].forEach(function (id) {
        document.getElementById(id).addEventListener('click', function () {
          var app = APP_STORE[id];
          var left = false;
          function onHide() { if (document.hidden) left = true; }
          document.addEventListener('visibilitychange', onHide);
          setTimeout(function () {
            document.removeEventListener('visibilitychange', onHide);
            if (left) return;
            extHint.innerHTML = '¿No se ha abierto? Necesitas tener ' + app.name + ' instalada: ' +
              '<a href="' + app.url + '" target="_blank" rel="noopener">descárgala gratis en la App Store</a>' +
              ' y vuelve a pulsar el botón.';
            extHint.hidden = false;
          }, 2500);
        });
      });
      document.getElementById('ext-copy').addEventListener('click', function () {
        var btn = this;
        if (!navigator.clipboard || !extEl.dataset.url) return;
        navigator.clipboard.writeText(extEl.dataset.url).then(function () {
          var old = btn.innerHTML;
          btn.textContent = '¡Copiado!';
          setTimeout(function () { btn.innerHTML = old; }, 1400);
        });
      });

      function startConverted(it, data, rdHls) {
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        showPlayerMessage('<span class="spinner"></span> Real-Debrid está preparando el vídeo… con películas 4K puede tardar hasta un minuto.');
        warmUp(rdHls).then(function () {
          startVideo(it, {
            account: data.account, filename: data.filename, download: data.download,
            hls: '/api/movie-details?hls=' + encodeURIComponent(rdHls),
          });
        });
      }

      // Audio y subtítulos del streaming convertido: RD lleva la pista en
      // el camino de la URL (.../<audio>/<subtítulos>/<códec>/<calidad>.m3u8)
      // y solo sabe empezar a convertir desde el principio, así que cambiar
      // de pista vuelve a arrancar la película desde el inicio.
      var tracksEl = document.getElementById('player-tracks');
      var audioSel = document.getElementById('track-audio');
      var subsSel = document.getElementById('track-subs');
      var LANGS = { spa: 'Castellano', es: 'Castellano', eng: 'Inglés', en: 'Inglés', fre: 'Francés', fra: 'Francés',
        ger: 'Alemán', deu: 'Alemán', ita: 'Italiano', por: 'Portugués', jpn: 'Japonés', kor: 'Coreano',
        chi: 'Chino', zho: 'Chino', rus: 'Ruso', cat: 'Catalán', lat: 'Latino', und: 'Desconocido' };
      function trackOptions(tracks, selected) {
        var count = {};
        tracks.forEach(function (t) { count[t.lang] = (count[t.lang] || 0) + 1; });
        var seen = {};
        return tracks.map(function (t) {
          seen[t.lang] = (seen[t.lang] || 0) + 1;
          var name = LANGS[t.lang] || t.label;
          if (count[t.lang] > 1) name += ' ' + seen[t.lang];
          return '<option value="' + esc(t.key) + '"' + (t.key === selected ? ' selected' : '') + '>' + esc(name) + '</option>';
        }).join('');
      }
      function showTracks(it, data) {
        var tr = data.tracks;
        if (!tr || (tr.audio.length < 2 && !tr.subtitles.length)) { tracksEl.hidden = true; return; }
        audioSel.innerHTML = trackOptions(tr.audio, tr.current.audio);
        subsSel.innerHTML = '<option value="none">Sin subtítulos</option>' + trackOptions(tr.subtitles, tr.current.subtitles);
        tracksEl.hidden = false;
        tracksEl.onchange = function () {
          if (current !== it) return;
          var parts = data.hls.split('/');
          var n = parts.length;
          parts[n - 4] = audioSel.value;
          parts[n - 3] = subsSel.value;
          startConverted(it, data, parts.join('/'));
        };
      }

      function playMovie() {
        var it = current;
        if (!it) return;
        stopTrailer();
        showPlayerMessage('<span class="spinner"></span> Preparando la película en Real-Debrid…');
        sheetEl.scrollTop = 0;
        fetch('/api/movie-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'play', infoHash: it.infoHash }),
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (current !== it) return;
            if (data.error) { showPlayerMessage(esc(data.error)); return; }
            showExternal(data);
            // Un MP4 lo reproduce el navegador tal cual: arranca al momento y
            // se adelanta sin esperas, así que no hace falta la conversión.
            if (data.download && /\\.(mp4|m4v|mov)$/i.test(data.filename || '')) data.hls = null;
            if (!data.hls) return startVideo(it, data);
            showTracks(it, data);
            startConverted(it, data, data.hls);
          })
          .catch(function () {
            if (current === it) showPlayerMessage('No se pudo preparar la reproducción ahora mismo.');
          });
      }

      function stopTrailer() {
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        var v = videoEl.querySelector('video');
        if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
        videoEl.innerHTML = '';
        extEl.hidden = true;
        if (tracksEl) tracksEl.hidden = true;
        sheetEl.classList.remove('playing');
      }

      playBtn.addEventListener('click', playTrailer);
      trailerBtn.addEventListener('click', playTrailer);
      watchBtn.addEventListener('click', playMovie);

      function close() {
        stopTrailer();
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        current = null;
        if (lastFocus) lastFocus.focus();
      }

      document.querySelectorAll('[data-open]').forEach(function (el) {
        el.addEventListener('click', function () { open(el.dataset.open); });
      });
      document.getElementById('sheet-close').addEventListener('click', close);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

      document.getElementById('sheet-copy').addEventListener('click', function () {
        var btn = this;
        if (!current || !navigator.clipboard) return;
        navigator.clipboard.writeText(current.infoHash).then(function () {
          var old = btn.innerHTML;
          btn.textContent = '¡Copiado!';
          setTimeout(function () { btn.innerHTML = old; }, 1400);
        });
      });

      document.getElementById('sheet-delete').addEventListener('click', function () {
        if (!current) return;
        document.getElementById('sheet-confirm-text').textContent =
          'Vas a eliminar "' + current.name + '" del addon. Esta acción no se puede deshacer.';
        confirmBox.classList.add('open');
        document.getElementById('sheet-confirm-ok').focus();
      });
      document.getElementById('sheet-confirm-cancel').addEventListener('click', function () { confirmBox.classList.remove('open'); });
      document.getElementById('sheet-confirm-ok').addEventListener('click', function () {
        if (!current) return;
        this.innerHTML = '<span class="spinner"></span> Eliminando…';
        this.disabled = true;
        document.getElementById('delete-id').value = current.id;
        document.getElementById('delete-form').submit();
      });
    })();

    // ── Arrastrar hacia abajo para recargar (solo instalada como PWA;
    // en una pestaña normal del navegador ya existe el gesto nativo).
    // El icono se queda fijo arriba y solo hace fundido de entrada/
    // salida; lo que se mueve con el dedo es el contenido, como el
    // pull-to-refresh nativo — así el icono nunca se superpone a nada. ──
    (function () {
      var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      if (!isStandalone) return;

      var indicator = document.getElementById('pull-refresh-indicator');
      var icon = indicator.querySelector('.icon');
      var content = document.getElementById('main-wrap');
      var revealAt = 18;
      var threshold = 70;
      var maxPull = 110;
      var startY = 0;
      var pulling = false;
      var currentPull = 0;
      var visible = false;

      function setVisible(show) {
        if (show === visible) return;
        visible = show;
        indicator.classList.toggle('visible', show);
      }

      function reset() {
        pulling = false;
        currentPull = 0;
        setVisible(false);
        content.style.transition = 'transform 0.25s ease';
        content.style.transform = '';
      }

      // Recargar la página no siempre restaura el scroll exactamente a 0
      // (según navegador), así que la comprobación es "casi arriba" en
      // vez de un 0 exacto — si no, el gesto deja de activarse tras la
      // primera recarga.
      function atTop() {
        return window.scrollY <= 2;
      }

      document.addEventListener('touchstart', function (e) {
        // Por si el gesto anterior se quedó a medias (p. ej. un
        // touchcancel que el navegador no siempre dispara con claridad),
        // se arranca siempre desde un estado limpio.
        reset();
        if (atTop() && !document.getElementById('sheet-overlay').classList.contains('open')) {
          startY = e.touches[0].clientY;
          pulling = true;
          content.style.transition = 'none';
        }
      }, { passive: true });

      document.addEventListener('touchmove', function (e) {
        if (!pulling) return;
        var diff = e.touches[0].clientY - startY;
        if (diff <= 0 || !atTop()) {
          reset();
          return;
        }
        currentPull = Math.min(diff, maxPull);
        content.style.transform = 'translateY(' + currentPull + 'px)';
        setVisible(currentPull > revealAt);
        icon.style.transform = 'rotate(' + (currentPull * 2) + 'deg)';
      }, { passive: true });

      function onTouchEnd() {
        if (!pulling) return;
        var pulledEnough = currentPull >= threshold;
        pulling = false;
        content.style.transition = 'transform 0.25s ease';
        if (pulledEnough) {
          indicator.classList.add('spinning');
          icon.style.transform = '';
          location.reload();
        } else {
          setVisible(false);
          content.style.transform = '';
        }
        currentPull = 0;
      }

      document.addEventListener('touchend', onTouchEnd);
      document.addEventListener('touchcancel', onTouchEnd);
    })();
  </script>
</body>
</html>`;
}

// ── Estilos de la página de añadir / editar ─────────────────────────
function addStyles() {
    return `
  main { max-width: 1180px; margin: 0 auto; padding: 28px 24px 40px; }
  .page-title { font: 400 2.6rem/1 var(--font-display); letter-spacing: 0.04em; margin: 0 0 6px; }
  .page-sub { color: var(--text-dim); margin: 0 0 26px; }
  .step { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 24px; margin-bottom: 20px; }
  .step-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
  .step-num { width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
    font: 400 1.15rem/1 var(--font-display); background: var(--accent-soft); color: var(--accent); border: 1px solid rgba(255,61,87,0.35); flex-shrink: 0; }
  .step-num.done { background: var(--ok-soft); color: var(--ok); border-color: rgba(61,220,132,0.35); }
  .step-title { font: 400 1.6rem/1 var(--font-display); letter-spacing: 0.05em; margin: 0; }
  .step-head .segmented { margin-left: auto; }

  .search-big .input { min-height: 54px; font-size: 1.05rem; border-radius: 14px; }
  .picks { display: grid; grid-auto-flow: column; grid-auto-columns: 132px; gap: 16px; overflow-x: auto; padding: 4px 2px 12px; margin-top: 18px; scroll-snap-type: x mandatory; }
  .picks:empty { display: none; }
  .pick { all: unset; cursor: pointer; scroll-snap-align: start; min-width: 0; animation: fade-up 0.35s ease both; animation-delay: calc(var(--i, 0) * 30ms); }
  .pick-poster { aspect-ratio: 2/3; border-radius: 10px; overflow: hidden; background: var(--surface-2); box-shadow: 0 0 0 1px rgba(255,255,255,0.06); transition: transform 0.2s, box-shadow 0.2s; position: relative; }
  .pick-poster img { width: 100%; height: 100%; object-fit: cover; }
  .pick:hover .pick-poster, .pick:focus-visible .pick-poster { transform: translateY(-4px); box-shadow: 0 0 0 2px var(--accent), 0 0 22px -4px var(--accent-glow); }
  .pick-name { margin-top: 9px; font-weight: 600; font-size: 0.84rem; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .pick-year { font-size: 0.75rem; color: var(--text-mute); margin-top: 2px; }
  .pick-rating { position: absolute; top: 7px; right: 7px; }
  .picks-msg { margin-top: 16px; color: var(--text-dim); font-size: 0.9rem; display: flex; align-items: center; gap: 10px; }

  .film { position: relative; display: none; border-radius: 16px; overflow: hidden; isolation: isolate; border: 1px solid rgba(255,255,255,0.06); }
  .film.show { display: block; animation: fade-up 0.35s ease both; }
  .film-bg { position: absolute; inset: 0; z-index: -2; }
  .film-bg img { width: 100%; height: 100%; object-fit: cover; }
  .film-bg.fallback img { filter: blur(28px) saturate(140%); transform: scale(1.3); opacity: 0.6; }
  .film::before { content: ""; position: absolute; inset: 0; z-index: -1; background: linear-gradient(90deg, rgba(23,21,30,0.97) 0%, rgba(23,21,30,0.82) 45%, rgba(23,21,30,0.45) 100%); }
  .film-inner { display: flex; gap: 22px; padding: 22px; align-items: flex-start; }
  .film-poster { width: 120px; aspect-ratio: 2/3; object-fit: cover; border-radius: 10px; flex-shrink: 0; background: var(--surface-2); box-shadow: 0 16px 30px -10px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1); }
  .film-title { font: 400 2.3rem/0.95 var(--font-display); letter-spacing: 0.02em; margin: 2px 0 10px; }
  .film-meta { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
  .film-overview { margin: 12px 0 0; color: var(--text-dim); font-size: 0.88rem; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; max-width: 680px; }
  .film-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
  .film-video { aspect-ratio: 16 / 9; background: #000; border-top: 1px solid rgba(255,255,255,0.06); }
  .film-video:empty { display: none; }
  .film-video iframe { width: 100%; height: 100%; border: 0; display: block; }

  .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
  .toolbar .grow { flex: 1 1 240px; }
  .toolbar .select { width: auto; min-width: 170px; }
  .subbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .subbar .label { font-size: 0.8rem; color: var(--text-mute); }
  .sorts { display: flex; gap: 6px; flex-wrap: wrap; }
  .sorts .chip { min-height: 30px; padding: 0 12px; font-size: 0.78rem; }

  .releases { display: grid; gap: 8px; }
  .release { all: unset; box-sizing: border-box; cursor: pointer; display: grid; grid-template-columns: 44px 1fr auto; gap: 14px; align-items: center;
    padding: 12px 14px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 12px; transition: border-color 0.15s, background 0.15s; animation: fade-up 0.3s ease both; animation-delay: calc(var(--i, 0) * 20ms); }
  .release:hover { border-color: var(--line-strong); background: #15131c; }
  .release:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .release.selected { border-color: var(--accent); background: linear-gradient(90deg, var(--accent-soft), transparent 70%); box-shadow: 0 0 0 1px var(--accent), 0 0 24px -10px var(--accent-glow); }
  .release-thumb { width: 44px; height: 64px; border-radius: 7px; overflow: hidden; background: var(--surface-2); display: flex; align-items: center; justify-content: center; color: var(--text-mute); }
  .release-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .release-main { min-width: 0; }
  .release-title { font-size: 0.86rem; font-weight: 500; line-height: 1.35; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .release-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
  .release-meta { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 7px; font-size: 0.78rem; color: var(--text-dim); }
  .release-meta .seeds { display: inline-flex; align-items: center; gap: 3px; font-weight: 600; }
  .seeds.hot { color: var(--ok); }
  .seeds.warm { color: var(--gold); }
  .seeds.cold { color: var(--err); }
  .release-go { display: inline-flex; align-items: center; justify-content: center; min-width: 84px; height: 34px; padding: 0 12px; border-radius: 999px;
    font: 600 0.8rem var(--font-body); color: var(--text-dim); border: 1px solid var(--line-strong); gap: 6px; }
  .release:hover .release-go { color: var(--text); border-color: var(--text-mute); }
  .release.selected .release-go { background: var(--accent); border-color: var(--accent); color: #fff; }
  .release-go.err { color: var(--err); border-color: rgba(255,107,129,0.4); }
  .empty-box { padding: 34px 16px; text-align: center; color: var(--text-dim); font-size: 0.9rem; border: 1px dashed var(--line-strong); border-radius: 12px; }
  .empty-box .icon { margin: 0 auto 10px; color: var(--text-mute); }
  .skeleton-row { height: 90px; border-radius: 12px; }

  .savebar[hidden] { display: none; }
  .savebar { animation: fade-up 0.25s ease both; }
  .savebar { position: sticky; bottom: 16px; z-index: 50; margin-top: 8px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
    padding: 14px 16px 14px 20px; border-radius: 18px; background: rgba(31,28,40,0.88); backdrop-filter: saturate(160%) blur(18px); -webkit-backdrop-filter: saturate(160%) blur(18px);
    border: 1px solid var(--line-strong); box-shadow: 0 20px 50px -14px rgba(0,0,0,0.85); }
  .save-summary { flex: 1 1 220px; min-width: 0; }
  .save-summary .what { font-weight: 600; font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .save-summary .sub { font-size: 0.78rem; color: var(--text-mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rd-chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .rd-chips .label { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-mute); margin-right: 4px; }
  .rd-chips .chip { position: relative; }
  .save-note { width: 100%; margin: -4px 0 0; font-size: 0.74rem; color: var(--text-mute); }
  .save-note.local { color: var(--gold); }

  @media (max-width: 760px) {
    main { padding: 18px 14px calc(var(--bottomnav-h) + var(--safe-b) + 32px); }
    body.has-savebar main { padding-bottom: calc(var(--bottomnav-h) + var(--safe-b) + 230px); }
    .page-title { font-size: 2.1rem; }
    .page-sub { font-size: 0.9rem; margin-bottom: 18px; }
    .step { padding: 18px 16px; border-radius: 18px; }
    .step-head .segmented { margin-left: 0; width: 100%; }
    .step-head .segmented button { flex: 1; justify-content: center; }
    .picks { grid-auto-columns: 108px; gap: 12px; margin: 16px -16px 0; padding: 4px 16px 12px; }
    .film-inner { gap: 16px; padding: 16px; }
    .film-poster { width: 88px; }
    .film-title { font-size: 1.8rem; }
    .film-overview { -webkit-line-clamp: 4; }
    .toolbar .select { flex: 1; }
    .toolbar .btn { flex: 1; }
    .release { grid-template-columns: 38px 1fr; gap: 12px; padding: 12px; }
    .release-thumb { width: 38px; height: 56px; }
    .release-go { grid-column: 1 / -1; width: 100%; }
    .release:not(.selected) .release-go { display: none; }
    .savebar { position: fixed; left: 10px; right: 10px; bottom: calc(var(--bottomnav-h) + var(--safe-b) + 10px); margin: 0; gap: 10px; padding: 12px 14px; }
    .savebar .btn-primary { width: 100%; }
    .save-summary { flex-basis: 100%; }
    .rd-chips .label, .sorts .label, .seg-extra { display: none; }
    .sorts { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; flex: 1 1 100%; margin: 0 -16px; padding: 2px 16px; }
    .subbar { gap: 10px; }
  }
`;
}

// ── Página de añadir / editar (ficha con portada + búsqueda) ──────
function renderAddPage({ message, editId, values }) {
    const editing = !!editId;
    const v = Object.assign({
        imdbId: "", title: "", magnet: "", poster: "", type: "movie",
        rdCache: Object.fromEntries(RD_ACCOUNTS.map((acc) => [acc.id, true])),
        prowlarrMode: true,
    }, values || {});
    const isSeries = v.type === "series";

    const manualHint = editing
        ? `Deja este campo vacío para conservar la copia actual, o pega un magnet nuevo para sustituirla.`
        : "Se extraen el infoHash y los trackers automáticamente.";

    // Ficha inicial: al editar (o al volver de un error al guardar) se
    // conoce ya la película por su id de IMDb — portada y fondo salen de
    // metahub —; al añadir de cero se rellena en cliente al elegirla.
    const knownId = editId || (/^tt[0-9]+$/.test(v.imdbId || "") ? v.imdbId : null);
    const film = knownId
        ? {
            name: v.title,
            poster: posterHd(v.poster) || `https://images.metahub.space/poster/medium/${encodeURIComponent(knownId)}/img`,
            backdrop: backdropFor(knownId),
        }
        : null;

    return `<!DOCTYPE html>
<html lang="es">
<head>
${headTags(`${editing ? "Editar" : "Añadir"} · JFuster RD`)}
<style>${themeCss()}${addStyles()}</style>
</head>
<body>
  ${renderTopBar("add")}
  <main>
    <h1 class="page-title">${editing ? "Editar película" : "Añadir al videoclub"}</h1>
    <p class="page-sub">${editing ? "Cambia la copia o vuelve a cachearla en Real-Debrid." : "Busca la película, elige la mejor copia y guárdala en el catálogo."}</p>

    ${message || ""}

    <form method="POST" action="/admin" id="main-form">
      <input type="hidden" name="action" value="save">
      <input type="hidden" name="prowlarrMode" id="prowlarrModeField" value="${v.prowlarrMode ? "1" : "0"}">
      <input type="hidden" name="imdbId" id="imdbId" value="${escapeHtml(v.imdbId)}">
      <input type="hidden" name="title" id="title-field" value="${escapeHtml(v.title)}">
      <input type="hidden" name="downloadRef" id="downloadRefField" value="">
      <input type="hidden" name="type" id="type-field" value="${isSeries ? "series" : "movie"}">

      <section class="step" id="step-film">
        <div class="step-head">
          <span class="step-num${editing ? " done" : ""}" id="step1-num">1</span>
          <h2 class="step-title">${isSeries ? "La serie" : "La película"}</h2>
          ${editing ? "" : `<div class="segmented" role="tablist" aria-label="Tipo de contenido">
            <button type="button" data-type="movie" class="${isSeries ? "" : "active"}">${icon("film", 16)} Película</button>
            <button type="button" data-type="series" class="${isSeries ? "active" : ""}">${icon("tv", 16)} Serie</button>
          </div>`}
        </div>

        <div id="film-search"${film ? ' style="display:none"' : ""}>
          <div class="input-icon search-big">
            ${icon("search", 20)}
            <input class="input" id="movieSearch" placeholder="${isSeries ? "Busca una serie..." : "Busca una película..."}" autocomplete="off" value="${film ? "" : escapeHtml(v.title)}">
          </div>
          <div class="picks" id="picks"></div>
          <div class="picks-msg" id="picks-msg" style="display:none"></div>
        </div>

        <div class="film${film ? " show" : ""}" id="film">
          <div class="film-bg" id="film-bg"><img id="film-backdrop" alt="" src="${film ? escapeHtml(film.backdrop) : ""}" onerror="this.onerror=null;this.parentNode.classList.add('fallback');this.src=document.getElementById('film-poster').src"></div>
          <div class="film-inner">
            <img class="film-poster" id="film-poster" alt="" src="${film && film.poster ? escapeHtml(film.poster) : ""}">
            <div style="min-width:0;flex:1">
              <h3 class="film-title" id="film-title">${film ? escapeHtml(film.name) : ""}</h3>
              <div class="film-meta" id="film-meta">${film ? `<span class="tag">${isSeries ? "Serie" : "Película"}</span><span class="tag ok">${icon("check", 12)} ${escapeHtml(knownId)}</span>` : ""}</div>
              <p class="film-overview" id="film-overview"></p>
              <div class="film-actions">
                <button type="button" class="btn btn-primary" id="film-trailer" style="display:none">${icon("play", 16)} Tráiler</button>
                ${editing ? "" : `<button type="button" class="btn btn-ghost" id="film-change">${icon("search", 16)} Cambiar</button>`}
              </div>
            </div>
          </div>
          <div class="film-video" id="film-video"></div>
        </div>
        <div class="hint" id="imdb-hint">${editing ? "La película no se puede cambiar al editar." : ""}</div>
      </section>

      <section class="step" id="step-copy">
        <div class="step-head">
          <span class="step-num" id="step2-num">2</span>
          <h2 class="step-title">La copia</h2>
          <div class="segmented" role="tablist" aria-label="Origen de la copia">
            <button type="button" data-mode="prowlarr" class="${v.prowlarrMode ? "active" : ""}">${icon("search", 16)} <span><span class="seg-extra">Buscar en </span>Prowlarr</span></button>
            <button type="button" data-mode="manual" class="${v.prowlarrMode ? "" : "active"}">${icon("magnet", 16)} <span><span class="seg-extra">Pegar </span>magnet</span></button>
          </div>
        </div>

        <div id="manual-panel">
          <label class="field-label" for="magnet">Magnet link</label>
          <textarea class="input" id="magnet" name="magnet" placeholder="magnet:?xt=urn:btih:..." rows="3">${escapeHtml(v.magnet)}</textarea>
          <div class="hint" id="magnet-hint">${manualHint}</div>
        </div>

        <div id="prowlarr-panel">
          <div class="toolbar">
            <div class="input-icon grow">
              ${icon("search", 18)}
              <input class="input" id="prowlarr-query" placeholder="Título a buscar..." autocomplete="off" value="${escapeHtml(v.title)}">
            </div>
            <input type="hidden" id="prowlarr-original-query" value="">
            <select class="select" id="prowlarr-indexer" aria-label="Indexer">
              <option value="">Todos los indexers</option>
              <option value="The Pirate Bay">The Pirate Bay</option>
              <option value="NOBS">NOBS</option>
              <option value="Milnueve">Milnueve</option>
            </select>
            <button type="button" id="prowlarr-search-btn" class="btn btn-ghost">${icon("search", 17)} Buscar</button>
          </div>
          <div class="subbar">
            <div class="sorts" role="toolbar" aria-label="Ordenar">
              <span class="label" style="align-self:center;margin-right:4px">Ordenar</span>
              <button type="button" class="chip active" data-sort="">Relevancia</button>
              <button type="button" class="chip" data-sort="seeders">Seeders</button>
              <button type="button" class="chip" data-sort="size">Tamaño</button>
              <button type="button" class="chip" data-sort="year">Año</button>
            </div>
            <label class="chip"><input type="checkbox" id="prowlarr-es"> 🇪🇸 Solo España</label>
          </div>
          <div class="releases" id="releases">
            <div class="empty-box">${icon("film", 28)}Elige una película arriba o escribe un título y pulsa Buscar.</div>
          </div>
        </div>
      </section>

      <div class="savebar" id="savebar"${editing || (film && v.magnet) ? "" : " hidden"}>
        <div class="save-summary">
          <div class="what" id="save-what">${v.title ? escapeHtml(v.title) : "Elige una película"}</div>
          <div class="sub" id="save-sub">${editing ? "Se conservará la copia actual" : "y una copia para poder guardar"}</div>
        </div>
        <div class="rd-chips">
          <span class="label">Cachear en</span>
          ${RD_ACCOUNTS.map((acc) => `<label class="chip"><input type="checkbox" name="rdCache${acc.id}" value="1"${v.rdCache[acc.id] ? " checked" : ""}> ${escapeHtml(acc.id)}</label>`).join("")}
        </div>
        <button type="submit" class="btn btn-primary" id="save-btn">${icon("check", 18)} Guardar y desplegar</button>
        <p class="save-note${isLocal() ? " local" : ""}">${isLocal()
            ? "Estás en local, pero guardar hace un commit real al repo y Vercel redespliega producción (~1 min)."
            : "Al guardar se hace un commit al repo y Vercel redespliega (~1 min)."}</p>
      </div>
    </form>
  </main>

  ${renderBottomNav("add")}

  <script>
    ${BFCACHE_RELOAD_SCRIPT}
    (function () {
      var editing = ${editing ? "true" : "false"};
      var manualHintText = ${JSON.stringify(manualHint)};
      var form = document.getElementById('main-form');
      var modeField = document.getElementById('prowlarrModeField');
      var imdbIdField = document.getElementById('imdbId');
      var titleField = document.getElementById('title-field');
      var typeField = document.getElementById('type-field');
      var downloadRefField = document.getElementById('downloadRefField');
      var magnetInput = document.getElementById('magnet');
      var magnetHint = document.getElementById('magnet-hint');
      var imdbHint = document.getElementById('imdb-hint');
      var saveWhat = document.getElementById('save-what');
      var saveSub = document.getElementById('save-sub');
      var saveBtn = document.getElementById('save-btn');
      var searchInput = document.getElementById('movieSearch');
      var picksEl = document.getElementById('picks');
      var picksMsg = document.getElementById('picks-msg');
      var filmSearch = document.getElementById('film-search');
      var filmEl = document.getElementById('film');
      var queryInput = document.getElementById('prowlarr-query');
      var originalQueryInput = document.getElementById('prowlarr-original-query');
      var indexerSelect = document.getElementById('prowlarr-indexer');
      var esCheckbox = document.getElementById('prowlarr-es');
      var releasesEl = document.getElementById('releases');
      var selectedRelease = null;
      var lastResults = [];
      var sortKey = '';
      var tmdbTimer = null;
      var tmdbRequest = 0;
      var searchRequest = 0;
      var lastPicks = [];
      var originalReady = Promise.resolve();

      function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }
      function contentType() { return typeField.value; }
      function prowlarrMode() { return modeField.value === '1'; }

      // ── Resumen de la barra de guardar ──
      function updateSummary() {
        var title = titleField.value;
        var hasFilm = editing || (!!title && !!imdbIdField.value);
        // La barra de guardar solo aparece con película y copia elegidas
        // (al editar, siempre: se puede guardar conservando la copia).
        var showBar = editing || (!!title && !!magnetInput.value.trim());
        document.getElementById('savebar').hidden = !showBar;
        document.body.classList.toggle('has-savebar', showBar);
        var hasCopy = !!magnetInput.value.trim();
        document.getElementById('step1-num').classList.toggle('done', hasFilm);
        document.getElementById('step2-num').classList.toggle('done', hasCopy || editing);
        saveWhat.textContent = title || 'Elige una película';
        if (selectedRelease && prowlarrMode()) {
          saveSub.textContent = (qualityOf(selectedRelease.title) || 'Copia') + ' · ' + formatSize(selectedRelease.size) + ' · ' + (selectedRelease.indexer || '');
        } else if (hasCopy) {
          saveSub.textContent = 'Magnet pegado a mano';
        } else {
          saveSub.textContent = editing ? 'Se conservará la copia actual' : 'Falta elegir una copia';
        }
      }

      // ── Tipo (película / serie) ──
      document.querySelectorAll('[data-type]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (typeField.value === btn.dataset.type) return;
          document.querySelectorAll('[data-type]').forEach(function (b) { b.classList.toggle('active', b === btn); });
          typeField.value = btn.dataset.type;
          var isSeries = btn.dataset.type === 'series';
          document.querySelector('#step-film .step-title').textContent = isSeries ? 'La serie' : 'La película';
          searchInput.placeholder = isSeries ? 'Busca una serie...' : 'Busca una película...';
          clearFilm();
          if (searchInput.value.trim().length >= 2) searchTmdb();
        });
      });

      // ── Modo de la copia (Prowlarr / manual) ──
      function applyMode(mode) {
        var isProwlarr = mode === 'prowlarr';
        modeField.value = isProwlarr ? '1' : '0';
        document.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('active', b.dataset.mode === mode); });
        document.getElementById('prowlarr-panel').style.display = isProwlarr ? 'block' : 'none';
        document.getElementById('manual-panel').style.display = isProwlarr ? 'none' : 'block';
        if (!isProwlarr) {
          downloadRefField.value = '';
          if (selectedRelease) { magnetInput.value = ''; selectedRelease = null; markSelected(null); }
          magnetHint.textContent = manualHintText;
          magnetHint.className = 'hint';
        }
        updateSummary();
      }
      document.querySelectorAll('[data-mode]').forEach(function (b) {
        b.addEventListener('click', function () { applyMode(b.dataset.mode); });
      });
      magnetInput.addEventListener('input', function () {
        if (!prowlarrMode()) downloadRefField.value = '';
        updateSummary();
      });

      // ── Búsqueda de la película en TMDB ──
      // ── Tráiler de la película elegida (clave de YouTube de TMDB) ──
      var trailerKey = null;
      var trailerBtn = document.getElementById('film-trailer');
      var filmVideo = document.getElementById('film-video');

      function setTrailer(key) {
        trailerKey = key || null;
        filmVideo.innerHTML = '';
        trailerBtn.style.display = trailerKey ? '' : 'none';
      }

      trailerBtn.addEventListener('click', function () {
        if (!trailerKey) return;
        if (filmVideo.innerHTML) { filmVideo.innerHTML = ''; return; }
        filmVideo.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(trailerKey) +
          '?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="Tráiler" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
      });

      // Datos extra por id de IMDb: título original (Prowlarr busca con el
      // título en castellano y en el original), sinopsis, año, nota y tráiler.
      function loadFilmDetails(imdbId, film) {
        return fetch('/api/movie-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imdbId: imdbId, type: contentType() }),
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            var d = data && data.details;
            if (!d || filmEl._film !== film) return d;
            setTrailer(d.trailerKey);
            return d;
          })
          .catch(function () { return null; });
      }

      function clearFilm() {
        setTrailer(null);
        imdbIdField.value = '';
        titleField.value = '';
        filmEl.classList.remove('show');
        filmSearch.style.display = '';
        imdbHint.textContent = '';
        updateSummary();
      }

      function showPicksMsg(html) {
        picksMsg.innerHTML = html;
        picksMsg.style.display = html ? 'flex' : 'none';
      }

      function renderPicks(results) {
        lastPicks = results;
        if (!results.length) { picksEl.innerHTML = ''; showPicksMsg('Sin resultados en TMDB.'); return; }
        showPicksMsg('');
        picksEl.innerHTML = results.map(function (m, i) {
          var poster = m.posterLarge || m.poster;
          return '<button type="button" class="pick" data-idx="' + i + '" style="--i:' + Math.min(i, 12) + '">' +
            '<div class="pick-poster">' + (poster ? '<img src="' + esc(poster) + '" alt="" loading="lazy">' : '') +
            (m.rating ? '<span class="tag gold pick-rating">★ ' + esc(m.rating) + '</span>' : '') + '</div>' +
            '<div class="pick-name">' + esc(m.name) + '</div>' +
            '<div class="pick-year">' + esc(m.releaseInfo || '—') + '</div></button>';
        }).join('');
        picksEl.querySelectorAll('.pick').forEach(function (el) {
          el.addEventListener('click', function () { chooseFilm(lastPicks[Number(el.dataset.idx)]); });
        });
      }

      function searchTmdb() {
        var q = searchInput.value.trim();
        if (q.length < 2) { picksEl.innerHTML = ''; showPicksMsg(''); return; }
        var id = ++tmdbRequest;
        picksEl.innerHTML = '';
        showPicksMsg('<span class="spinner"></span> Buscando en TMDB…');
        fetch('/api/movie-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: q, type: contentType() }),
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (id !== tmdbRequest) return;
            if (data.error) { showPicksMsg(esc(data.error)); return; }
            renderPicks(data.results || []);
          })
          .catch(function () { if (id === tmdbRequest) showPicksMsg('No se pudo buscar ahora mismo.'); });
      }

      if (searchInput) searchInput.addEventListener('input', function () {
        clearTimeout(tmdbTimer);
        tmdbTimer = setTimeout(searchTmdb, 350);
      });

      function setFilm(m) {
        var bg = document.getElementById('film-bg');
        var backdrop = document.getElementById('film-backdrop');
        bg.classList.toggle('fallback', !m.backdrop);
        backdrop.src = m.backdrop || m.posterLarge || m.poster || '';
        var poster = document.getElementById('film-poster');
        poster.src = m.posterLarge || m.poster || '';
        poster.style.visibility = (m.posterLarge || m.poster) ? 'visible' : 'hidden';
        document.getElementById('film-title').textContent = m.name;
        document.getElementById('film-overview').textContent = m.overview || '';
        filmEl.classList.add('show');
      }

      function setFilmMeta(extra) {
        var m = filmEl._film || {};
        document.getElementById('film-meta').innerHTML =
          '<span class="tag">' + (contentType() === 'series' ? 'Serie' : 'Película') + '</span>' +
          (m.releaseInfo ? '<span class="tag">' + esc(m.releaseInfo) + '</span>' : '') +
          (m.rating ? '<span class="tag gold">★ ' + esc(m.rating) + '</span>' : '') + (extra || '');
      }

      function chooseFilm(m) {
        filmEl._film = m;
        setFilm(m);
        filmSearch.style.display = 'none';
        titleField.value = m.name;
        imdbIdField.value = '';
        setFilmMeta('<span class="tag"><span class="spinner" style="width:11px;height:11px"></span> IMDb</span>');
        imdbHint.textContent = '';
        imdbHint.className = 'hint';
        updateSummary();

        queryInput.value = m.name;
        originalQueryInput.value = m.originalName || '';
        if (prowlarrMode()) runSearch();

        fetch('/api/movie-resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tmdbId: m.tmdbId, type: contentType() }),
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (filmEl._film !== m) return;
            if (data.error || !data.imdbId) {
              setFilmMeta('<span class="tag" style="color:var(--err)">Sin IMDb</span>');
              imdbHint.textContent = data.error || 'No se encontró el ID de IMDb para esta película.';
              imdbHint.className = 'hint err';
              return;
            }
            imdbIdField.value = data.imdbId;
            setFilmMeta('<span class="tag ok">✓ ' + esc(data.imdbId) + '</span>');
            updateSummary();
            loadFilmDetails(data.imdbId, m);
          })
          .catch(function () {
            setFilmMeta('<span class="tag" style="color:var(--err)">Sin IMDb</span>');
            imdbHint.textContent = 'No se pudo resolver el ID de IMDb.';
            imdbHint.className = 'hint err';
          });
      }

      var changeBtn = document.getElementById('film-change');
      if (changeBtn) changeBtn.addEventListener('click', function () {
        clearFilm();
        searchInput.focus();
        searchInput.select();
      });

      // ── Copias en Prowlarr ──
      function formatSize(bytes) {
        if (!bytes) return '—';
        var gb = bytes / (1024 * 1024 * 1024);
        return gb >= 1 ? gb.toFixed(2) + ' GB' : (bytes / (1024 * 1024)).toFixed(0) + ' MB';
      }

      function qualityOf(title) {
        var t = String(title || '').toLowerCase();
        if (/2160p|4k|uhd/.test(t)) return '4K';
        if (/1080p/.test(t)) return '1080p';
        if (/720p/.test(t)) return '720p';
        if (/480p|dvdrip|xvid|screener/.test(t)) return 'SD';
        return '';
      }

      function releaseTags(r) {
        var t = String(r.title || '').toLowerCase();
        var tags = [];
        var q = qualityOf(t);
        if (q) tags.push('<span class="tag ' + (q === '4K' ? 'gold' : q === '1080p' ? 'accent' : '') + '">' + q + '</span>');
        if (/remux/.test(t)) tags.push('<span class="tag">Remux</span>');
        else if (/bluray|blu-ray|bdrip|brrip/.test(t)) tags.push('<span class="tag">BluRay</span>');
        else if (/web-dl|webdl|webrip|web /.test(t)) tags.push('<span class="tag">WEB</span>');
        if (/hdr|dolby.vision/.test(t)) tags.push('<span class="tag gold">HDR</span>');
        if (/x265|hevc|h265|h.265/.test(t)) tags.push('<span class="tag">x265</span>');
        if (r.isSpainSpanish) tags.push('<span class="tag ok">🇪🇸 Castellano</span>');
        if (r.contentType) tags.push('<span class="tag">' + esc(r.contentType) + '</span>');
        return tags.join('');
      }

      function seedClass(n) { return n == null ? '' : n >= 20 ? 'hot' : n >= 5 ? 'warm' : 'cold'; }

      function visibleResults() {
        var list = esCheckbox.checked ? lastResults.filter(function (r) { return r.isSpainSpanish; }) : lastResults.slice();
        if (!sortKey) return list;
        return list.sort(function (a, b) {
          var av = a[sortKey], bv = b[sortKey];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return bv - av;
        });
      }

      function markSelected(row) {
        releasesEl.querySelectorAll('.release').forEach(function (el) {
          el.classList.toggle('selected', el === row);
          var go = el.querySelector('.release-go');
          go.classList.remove('err');
          go.innerHTML = el === row ? '✓ Elegida' : 'Elegir';
        });
      }

      function renderReleases() {
        var list = visibleResults();
        if (!list.length) {
          releasesEl.innerHTML = '<div class="empty-box">Sin resultados' + (esCheckbox.checked ? ' en castellano de España' : '') + '.</div>';
          return;
        }
        releasesEl.innerHTML = list.map(function (r, i) {
          var idx = lastResults.indexOf(r);
          var isSel = selectedRelease === r;
          return '<button type="button" class="release' + (isSel ? ' selected' : '') + '" data-idx="' + idx + '" style="--i:' + Math.min(i, 15) + '">' +
            '<div class="release-thumb">' + (r.poster ? '<img src="' + esc(r.poster) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '</div>' +
            '<div class="release-main">' +
              '<div class="release-title">' + esc(r.title) + '</div>' +
              '<div class="release-tags">' + releaseTags(r) + '</div>' +
              '<div class="release-meta">' +
                '<span>' + formatSize(r.size) + '</span>' +
                '<span class="seeds ' + seedClass(r.seeders) + '">▲ ' + (r.seeders != null ? r.seeders : '—') + ' seeders</span>' +
                (r.year ? '<span>' + esc(r.year) + '</span>' : '') +
                '<span>' + esc(r.indexer || '') + '</span>' +
              '</div>' +
            '</div>' +
            '<span class="release-go">' + (isSel ? '✓ Elegida' : 'Elegir') + '</span>' +
          '</button>';
        }).join('');

        releasesEl.querySelectorAll('.release').forEach(function (row) {
          row.addEventListener('click', function () { pickRelease(row, lastResults[Number(row.dataset.idx)]); });
        });
      }

      function applyRelease(row, r, magnet) {
        selectedRelease = r;
        magnetInput.value = magnet;
        // Si hay downloadRef, al guardar se sube el .torrent real a
        // Real-Debrid en vez de un magnet (más fiable en trackers
        // privados, donde a veces RD no consigue negociar metadatos).
        downloadRefField.value = r.downloadRef || '';
        markSelected(row);
        updateSummary();
      }

      function pickRelease(row, r) {
        if (r.magnet) { applyRelease(row, r, r.magnet); return; }
        // Sin magnet directo: hay que descargar el .torrent y calcular
        // el hash, solo para este resultado (no se hizo al buscar).
        var go = row.querySelector('.release-go');
        go.style.display = 'inline-flex';
        go.innerHTML = '<span class="spinner"></span>';
        fetch('/api/prowlarr-resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ downloadRef: r.downloadRef }),
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            go.style.display = '';
            if (data.error) { go.textContent = 'Error'; go.classList.add('err'); go.title = data.error; go.style.display = 'inline-flex'; return; }
            r.magnet = data.magnet;
            applyRelease(row, r, data.magnet);
          })
          .catch(function () {
            go.textContent = 'Error'; go.classList.add('err'); go.style.display = 'inline-flex';
            go.title = 'No se pudo resolver el magnet de este resultado.';
          });
      }

      function runSearch() {
        var q = queryInput.value.trim();
        if (!q) return;
        var id = ++searchRequest;
        selectedRelease = null;
        if (prowlarrMode()) { magnetInput.value = ''; downloadRefField.value = ''; }
        updateSummary();
        releasesEl.innerHTML = '<div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>';
        originalReady.then(function () { return fetch('/api/prowlarr-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: q, scope: (contentType() === 'series' ? 'tv' : 'movie'), indexer: indexerSelect.value, originalName: originalQueryInput.value }),
        }); })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (id !== searchRequest) return;
            if (data.error) { releasesEl.innerHTML = '<div class="empty-box" style="color:var(--err)">' + esc(data.error) + '</div>'; return; }
            lastResults = data.results || [];
            renderReleases();
          })
          .catch(function () {
            if (id === searchRequest) releasesEl.innerHTML = '<div class="empty-box">No se pudo buscar ahora mismo.</div>';
          });
      }

      document.getElementById('prowlarr-search-btn').addEventListener('click', runSearch);
      queryInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
      esCheckbox.addEventListener('change', function () { if (lastResults.length) renderReleases(); });
      document.querySelectorAll('[data-sort]').forEach(function (chip) {
        chip.addEventListener('click', function () {
          document.querySelectorAll('[data-sort]').forEach(function (c) { c.classList.toggle('active', c === chip); });
          sortKey = chip.dataset.sort;
          if (lastResults.length) renderReleases();
        });
      });

      // ── Guardar ──
      form.addEventListener('submit', function (e) {
        if (!editing && !imdbIdField.value) {
          e.preventDefault();
          imdbHint.textContent = 'Elige una película de la lista antes de guardar.';
          imdbHint.className = 'hint err';
          document.getElementById('step-film').scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (!editing && !magnetInput.value.trim()) {
          e.preventDefault();
          if (prowlarrMode()) {
            saveSub.textContent = 'Elige una copia de la lista antes de guardar.';
          } else {
            magnetHint.textContent = 'Pega un magnet antes de guardar.';
            magnetHint.className = 'hint err';
            magnetInput.focus();
          }
          document.getElementById('step-copy').scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner" style="border-top-color:#fff"></span> Guardando…';
      });

      // Al editar (o al volver de un error) no se ha elegido la película en
      // TMDB, así que se piden aquí su título original — Prowlarr busca con
      // el título en castellano y en el original — y, de paso, la sinopsis.
      if (imdbIdField.value && !originalQueryInput.value) {
        originalReady = loadFilmDetails(imdbIdField.value, filmEl._film)
          .then(function (d) {
            if (!d) return;
            if (!originalQueryInput.value) originalQueryInput.value = d.originalName || '';
            if (d.overview) document.getElementById('film-overview').textContent = d.overview;
            var meta = document.getElementById('film-meta');
            if (d.year) meta.insertAdjacentHTML('beforeend', '<span class="tag">' + esc(d.year) + '</span>');
            if (d.rating) meta.insertAdjacentHTML('beforeend', '<span class="tag gold">★ ' + esc(d.rating) + '</span>');
          })
          .catch(function () {});
      }

      applyMode(prowlarrMode() ? 'prowlarr' : 'manual');
      if (!editing && !imdbIdField.value && searchInput.value.trim().length >= 2) searchTmdb();
      // Al editar, o al volver de un error con la película ya elegida (p. ej.
      // copia bloqueada en RD), se relanza la búsqueda para elegir otra.
      if ((editing || imdbIdField.value) && queryInput.value.trim() && prowlarrMode()) runSearch();
    })();
  </script>
</body>
</html>`;
}

async function readImdbStreamsFromGitHub(ghHeaders) {
    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
    const getRes = await fetch(`${apiUrl}?ref=${BRANCH}`, { headers: ghHeaders });
    if (!getRes.ok) throw new Error(`No se pudo leer el fichero actual (${getRes.status})`);
    const getData = await getRes.json();
    const data = JSON.parse(Buffer.from(getData.content, "base64").toString("utf-8"));
    return { data, sha: getData.sha, apiUrl };
}

async function writeImdbStreamsToGitHub(ghHeaders, apiUrl, data, sha, message) {
    const newContent = Buffer.from(JSON.stringify(data, null, 2) + "\n", "utf-8").toString("base64");
    const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify({ message, content: newContent, sha, branch: BRANCH }),
    });
    const raw = await putRes.text();
    if (!putRes.ok) {
        throw new Error(`Error de la API de GitHub (${putRes.status}): ${raw}`);
    }
    try {
        const body = JSON.parse(raw);
        if (!body || !body.commit || !body.commit.sha) {
            throw new Error(`GitHub no devolvió un commit (respuesta inesperada): ${raw.slice(0, 300)}`);
        }
        return body.commit.sha;
    } catch (err) {
        if (err.message && err.message.startsWith("GitHub no devolvió")) throw err;
        throw new Error(`Respuesta de GitHub no válida: ${raw.slice(0, 300)}`);
    }
}

// Texto para el aviso de guardado cuando RD rechaza dar de alta el torrent.
function rdErrorText(code) {
    if (code === "infringing_file") return "RD tiene bloqueada esta copia por derechos de autor, elige otra";
    if (code === "too_many_active_downloads") return "RD tiene demasiadas descargas activas en esta cuenta";
    return `RD rechazó la copia (${code})`;
}

// Estado de RD de cada cuenta de RD_ACCOUNTS, para pintar el progreso en
// el listado. Una sola llamada por cuenta (la lista completa de torrents),
// no una por película — así da igual cuántas películas haya.
async function fetchRdMaps() {
    const torrentsByAccount = await Promise.all(
        RD_ACCOUNTS.map((acc) => listTorrents(process.env[acc.envVar]))
    );
    const maps = {};
    RD_ACCOUNTS.forEach((acc, i) => { maps[acc.id] = torrentsByHash(torrentsByAccount[i]); });
    return maps;
}

module.exports = async (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const isAddPage = req.query.view === "add";

    if (!isAuthenticated(req, (process.env.ADMIN_PASSWORD || "").trim())) {
        let publicPath = "/admin";
        if (isAddPage) {
            publicPath = "/admin/add";
            if (req.query.edit) publicPath += `?edit=${encodeURIComponent(req.query.edit)}`;
        }
        return res.redirect(302, `/login?next=${encodeURIComponent(publicPath)}`);
    }

    if (req.method === "GET") {
        if (isAddPage) {
            const editId = req.query.edit && IMDB_STREAMS[req.query.edit] ? req.query.edit : null;
            const entry = editId ? IMDB_STREAMS[editId] : null;
            return res.status(200).send(renderAddPage({
                editId,
                values: {
                    imdbId: editId || "",
                    title: entry ? (entry.title || "") : "",
                    magnet: "",
                    poster: entry ? (entry.poster || "") : "",
                    type: entry ? (entry.type || "movie") : "movie",
                    rdCache: Object.fromEntries(RD_ACCOUNTS.map((acc) => [acc.id, true])),
                    prowlarrMode: !editId,
                },
            }));
        }
        const rdMaps = await fetchRdMaps();
        return res.status(200).send(renderListPage({ imdbStreams: IMDB_STREAMS, rdMaps }));
    }

    if (req.method !== "POST") {
        return res.status(405).send(renderListPage({
            imdbStreams: IMDB_STREAMS,
            message: '<div class="msg err">Método no permitido.</div>',
        }));
    }

    const { imdbId, magnet, title, action, prowlarrMode, downloadRef, type } = req.body || {};
    const rdCache = {};
    RD_ACCOUNTS.forEach((acc) => { rdCache[acc.id] = !!(req.body || {})["rdCache" + acc.id]; });
    const contentType = type === "series" ? "series" : "movie";

    // ── Eliminar (siempre vuelve al listado) ───────────────────
    if (action === "delete") {
        if (!process.env.GITHUB_TOKEN) {
            return res.status(500).send(renderListPage({
                imdbStreams: IMDB_STREAMS,
                message: '<div class="msg err">Falta configurar GITHUB_TOKEN en Vercel.</div>',
            }));
        }
        const ghHeaders = {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "stremio-addon-admin",
        };
        try {
            const { data: current, sha, apiUrl } = await readImdbStreamsFromGitHub(ghHeaders);
            if (!current[imdbId]) {
                return res.status(400).send(renderListPage({
                    imdbStreams: IMDB_STREAMS,
                    message: `<div class="msg err">${escapeHtml(imdbId)} no existe.</div>`,
                }));
            }
            const removedName = current[imdbId].name || current[imdbId].title || imdbId;
            delete current[imdbId];

            await writeImdbStreamsToGitHub(ghHeaders, apiUrl, current, sha, `Eliminar stream de ${imdbId} vía panel admin`);

            return res.status(200).send(renderListPage({
                imdbStreams: current,
                message: `<div class="msg ok">Eliminado "${escapeHtml(removedName)}" (${escapeHtml(imdbId)}). Vercel está redesplegando, ~1 min.</div>`,
            }));
        } catch (err) {
            return res.status(500).send(renderListPage({
                imdbStreams: IMDB_STREAMS,
                message: `<div class="msg err">${escapeHtml(err.message)}</div>`,
            }));
        }
    }

    // ── Añadir / editar (siempre vuelve a la página de añadir en caso
    // de error, para no perder lo ya escrito) ──────────────────
    const values = {
        imdbId: imdbId || "",
        title: title || "",
        magnet: magnet || "",
        type: contentType,
        rdCache,
        prowlarrMode: prowlarrMode === "1",
    };
    const editId = imdbId && IMDB_STREAMS[imdbId] ? imdbId : null;

    function addPageError(status, message) {
        return res.status(status).send(renderAddPage({ editId, values, message }));
    }

    if (!imdbId || !/^tt[0-9]+$/.test(imdbId)) {
        return addPageError(400, '<div class="msg err">ID de IMDb inválido, debe ser del tipo tt1234567.</div>');
    }

    if (!process.env.GITHUB_TOKEN) {
        return addPageError(500, '<div class="msg err">Falta configurar GITHUB_TOKEN en Vercel.</div>');
    }

    if (!title || !title.trim()) {
        return addPageError(400, '<div class="msg err">Falta el título.</div>');
    }

    const ghHeaders = {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "stremio-addon-admin",
    };

    try {
        const { data: current, sha, apiUrl } = await readImdbStreamsFromGitHub(ghHeaders);
        const existing = current[imdbId];

        let parsed;
        if (magnet && magnet.trim()) {
            try {
                parsed = parseMagnet(magnet);
            } catch (err) {
                return addPageError(400, `<div class="msg err">${escapeHtml(err.message)}</div>`);
            }
        } else if (existing) {
            parsed = { infoHash: existing.infoHash, sources: existing.sources };
        } else {
            return addPageError(400, '<div class="msg err">Falta el magnet link para dar de alta una película nueva.</div>');
        }

        // Real-Debrid va antes del commit: si RD tiene la copia bloqueada
        // por copyright, no se guarda en el catálogo (no se podría
        // reproducir por RD) y se vuelve a la página para elegir otra.
        const rdAccounts = RD_ACCOUNTS
            .filter((acc) => rdCache[acc.id])
            .map((acc) => ({ label: acc.id, key: process.env[acc.envVar] }));

        let rdNote = "";
        let rdRejected = false;
        let rdBlocked = false;
        if (rdAccounts.length > 0) {
            // Si el magnet viene de un resultado de Prowlarr, se vuelve a
            // descargar el .torrent real y se sube tal cual a RD en vez de
            // un magnet: con magnet, RD necesita que algún peer le mande
            // los metadatos antes de poder empezar, y en trackers privados
            // eso a veces no ocurre aunque el torrent esté vivo (RD lo
            // rechaza como "Invalid Magnet"). Con el .torrent ya los tiene.
            let torrentBuffer = null;
            if (downloadRef) {
                try {
                    torrentBuffer = await fetchTorrentBytes(downloadRef);
                } catch {
                    // Si falla, se sigue con el magnet como respaldo.
                }
            }

            const method = torrentBuffer ? ".torrent" : "magnet";
            const results = await Promise.all(rdAccounts.map(async (acc) => {
                if (!acc.key) return `${acc.label}: falta configurar su clave en el servidor`;
                const rdResult = await triggerRealDebridCache(acc.key, parsed.infoHash, parsed.sources, torrentBuffer);
                if (!rdResult) return `${acc.label}: no se pudo contactar con RD`;
                if (rdResult.error) {
                    rdRejected = true;
                    if (rdResult.error === "infringing_file") rdBlocked = true;
                    return `${acc.label}: ${rdErrorText(rdResult.error)}`;
                }
                return rdResult.cached
                    ? `${acc.label}: ya cacheado, listo al instante`
                    : `${acc.label}: pedido a RD, puede tardar según seeders`;
            }));
            rdNote = ` Real-Debrid (subido como ${method}) — ` + results.join(" · ") + ".";
        }

        // El bloqueo es por hash (igual para todas las cuentas): no se guarda.
        if (rdBlocked) {
            values.magnet = "";
            return addPageError(409, `<div class="msg err">No se ha guardado: Real-Debrid tiene bloqueada esta copia por derechos de autor (enviada como ${method}). Elige otra copia de la lista.</div>`);
        }

        const needsMeta = !existing || !existing.poster || !existing.name;
        const cinemeta = needsMeta ? await fetchCinemetaMeta(imdbId, contentType) : null;

        current[imdbId] = {
            infoHash: parsed.infoHash,
            sources: parsed.sources,
            title: title.trim(),
            name: (cinemeta && cinemeta.name) || (existing && existing.name) || title.trim(),
            poster: (cinemeta && cinemeta.poster) || (existing && existing.poster) || null,
            type: contentType,
        };

        const commitSha = await writeImdbStreamsToGitHub(
            ghHeaders,
            apiUrl,
            current,
            sha,
            `${existing ? "Editar" : "Añadir"} stream para ${imdbId} vía panel admin`
        );

        const posterNote = current[imdbId].poster
            ? " Póster y nombre obtenidos de Cinemeta."
            : " No se encontró póster en Cinemeta (se guardó igualmente, aparecerá sin imagen en el catálogo).";

        const commitNote = commitSha ? ` Commit <code>${escapeHtml(commitSha.slice(0, 7))}</code>.` : "";
        // Si RD rechazó la copia en alguna cuenta, el aviso sale como error:
        // la película se guarda, pero no se va a poder reproducir por RD.
        const successMsg = `<div class="msg ${rdRejected ? "err" : "ok"}">Guardado. ${escapeHtml(imdbId)} → infoHash ${escapeHtml(parsed.infoHash)}.${commitNote}${posterNote}${rdNote} Vercel está redesplegando, estará online en ~1 min.</div>`;
        // Se renderiza aquí mismo con "current" (recién escrito) en vez de
        // redirigir a /admin, que usaría IMDB_STREAMS del último build —
        // desactualizado hasta que termine el redeploy de Vercel.
        const rdMaps = await fetchRdMaps();
        return res.status(200).send(renderListPage({ imdbStreams: current, message: successMsg, rdMaps }));
    } catch (err) {
        return addPageError(500, `<div class="msg err">${escapeHtml(err.message)}</div>`);
    }
};
