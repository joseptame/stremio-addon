// Sistema de diseño compartido por todas las páginas HTML (panel admin,
// login e instalación): tokens de color, tipografía, componentes base
// (botones, campos, chips, barra superior, barra inferior de la PWA) e
// iconos SVG inline. Estética de "videoclub": fondo casi negro, acento
// neón rojo, títulos en letra de marquesina y las portadas como
// protagonistas.

const THEME_COLOR = "#0b0a0f";

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

// Iconos de trazo (24x24) — mismo estilo para toda la app.
const ICON_PATHS = {
    film: '<rect x="2" y="2" width="20" height="20" rx="2.5"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>',
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.35-4.35"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    library: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    magnet: '<path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15"/><path d="m5 8 4 4M12 15l4 4"/>',
    tv: '<rect x="2" y="7" width="20" height="15" rx="2"/><path d="m17 2-5 5-5-5"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    seed: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>',
    play: '<path d="M6 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L7.5 3.64A1 1 0 0 0 6 4.5Z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
};

function icon(name, size = 20) {
    return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ""}</svg>`;
}

function headTags(title) {
    return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="/icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="apple-touch-icon" href="/icon.png">
<meta name="theme-color" content="${THEME_COLOR}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="FilmRD">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<title>${escapeHtml(title)}</title>`;
}

function themeCss() {
    return `
  :root {
    --bg: #0b0a0f;
    --bg-2: #110f17;
    --surface: #17151e;
    --surface-2: #1f1c28;
    --surface-3: #292535;
    --line: #2a2634;
    --line-strong: #3a3547;
    --text: #f4f1ea;
    --text-dim: #a9a5b5;
    --text-mute: #6e6a7c;
    --accent: #ff3d57;
    --accent-hover: #ff5c72;
    --accent-soft: rgba(255, 61, 87, 0.14);
    --accent-glow: rgba(255, 61, 87, 0.45);
    --gold: #ffc247;
    --gold-soft: rgba(255, 194, 71, 0.14);
    --ok: #3ddc84;
    --ok-soft: rgba(61, 220, 132, 0.13);
    --err: #ff6b81;
    --err-soft: rgba(255, 107, 129, 0.13);
    --radius: 14px;
    --radius-sm: 10px;
    --font-display: "Bebas Neue", "Impact", "Arial Narrow", sans-serif;
    --font-body: "Inter", -apple-system, "Segoe UI", system-ui, sans-serif;
    --topbar-h: 64px;
    --bottomnav-h: 64px;
    --safe-b: env(safe-area-inset-bottom, 0px);
    --safe-t: env(safe-area-inset-top, 0px);
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  /* "clip" y no "hidden": evita el scroll horizontal sin convertir el body
     en contenedor de scroll (que rompería la barra superior sticky). */
  body { overflow-x: clip; }
  body {
    margin: 0;
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 1.45;
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    -webkit-tap-highlight-color: transparent;
  }
  a { color: inherit; }
  img { display: block; max-width: 100%; }
  .icon { flex-shrink: 0; display: block; }
  ::selection { background: var(--accent); color: #fff; }
  * { scrollbar-width: thin; scrollbar-color: var(--line-strong) transparent; }

  /* ── Botones ── */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 42px; padding: 0 18px;
    font: 600 0.9rem/1 var(--font-body); letter-spacing: 0.01em;
    border-radius: 999px; border: 1px solid transparent;
    cursor: pointer; text-decoration: none; white-space: nowrap;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.1s, color 0.15s;
  }
  .btn:active { transform: scale(0.97); }
  .btn:focus-visible, .icon-btn:focus-visible, .chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .btn-primary { background: var(--accent); color: #fff; box-shadow: 0 6px 20px -6px var(--accent-glow); }
  .btn-primary:hover { background: var(--accent-hover); box-shadow: 0 8px 26px -6px var(--accent-glow); }
  .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
  .btn-ghost { background: rgba(255, 255, 255, 0.06); color: var(--text); border-color: rgba(255, 255, 255, 0.08); backdrop-filter: blur(10px); }
  .btn-ghost:hover { background: rgba(255, 255, 255, 0.11); }
  .btn-danger { background: var(--err-soft); color: var(--err); border-color: rgba(255, 107, 129, 0.3); }
  .btn-danger:hover { background: rgba(255, 107, 129, 0.22); }
  .btn-danger.solid { background: #e23a55; color: #fff; border-color: transparent; }
  .btn-danger.solid:hover { background: #f04a64; }
  .btn-block { width: 100%; }
  .icon-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 42px; height: 42px; border-radius: 999px; border: 1px solid var(--line);
    background: var(--surface); color: var(--text-dim); cursor: pointer; text-decoration: none;
    transition: color 0.15s, background 0.15s, border-color 0.15s;
  }
  .icon-btn:hover { color: var(--text); background: var(--surface-2); border-color: var(--line-strong); }

  /* ── Campos ── */
  .field-label { display: block; font-size: 0.78rem; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 8px; }
  .input, .select, textarea.input {
    width: 100%; min-height: 46px; padding: 0 16px;
    font: 500 0.95rem var(--font-body); color: var(--text);
    background: var(--bg-2); border: 1px solid var(--line); border-radius: var(--radius-sm);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  textarea.input { padding: 12px 16px; min-height: 92px; resize: vertical; font-family: ui-monospace, "Cascadia Code", monospace; font-size: 0.82rem; }
  .input::placeholder { color: var(--text-mute); }
  .input:focus, .select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .input[readonly] { color: var(--text-dim); }
  .select { appearance: none; -webkit-appearance: none; padding-right: 40px; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a9a5b5' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 14px center; }
  .input-icon { position: relative; }
  .input-icon > .icon { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--text-mute); pointer-events: none; }
  .input-icon > .input { padding-left: 44px; }
  .hint { font-size: 0.8rem; color: var(--text-mute); margin-top: 8px; }
  .hint.err { color: var(--err); }
  .hint.warn { color: var(--gold); }
  .hint a { color: inherit; text-decoration: underline; }

  /* ── Chips y segmentados ── */
  .chip {
    display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 14px;
    font: 600 0.82rem/1 var(--font-body); color: var(--text-dim);
    background: var(--surface); border: 1px solid var(--line); border-radius: 999px;
    cursor: pointer; user-select: none; white-space: nowrap; transition: all 0.15s;
  }
  .chip:hover { color: var(--text); border-color: var(--line-strong); }
  .chip.active, .chip:has(input:checked) { color: #fff; background: var(--accent-soft); border-color: var(--accent); }
  .chip input { position: absolute; opacity: 0; pointer-events: none; }
  .chip .count { color: var(--text-mute); font-weight: 500; }
  .chip.active .count { color: rgba(255,255,255,0.7); }
  .segmented { display: inline-flex; padding: 4px; gap: 4px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 999px; }
  .segmented button {
    display: inline-flex; align-items: center; gap: 7px; min-height: 36px; padding: 0 16px; border: 0; border-radius: 999px;
    font: 600 0.85rem var(--font-body); color: var(--text-dim); background: transparent; cursor: pointer; transition: all 0.15s;
  }
  .segmented button:hover { color: var(--text); }
  .segmented button.active { background: var(--surface-3); color: var(--text); box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset; }

  /* ── Etiquetas pequeñas ── */
  .tag {
    display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px;
    font: 700 0.68rem/1 var(--font-body); letter-spacing: 0.04em; text-transform: uppercase;
    border-radius: 6px; background: var(--surface-3); color: var(--text-dim); white-space: nowrap;
  }
  .tag.accent { background: var(--accent-soft); color: #ff8494; }
  .tag.gold { background: var(--gold-soft); color: var(--gold); }
  .tag.ok { background: var(--ok-soft); color: var(--ok); }

  /* ── Marca ── */
  .brand { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; }
  .brand img { width: 36px; height: 36px; border-radius: 9px; box-shadow: 0 0 0 1px rgba(255,255,255,0.08); }
  .brand-name {
    font-family: var(--font-display); font-size: 1.65rem; letter-spacing: 0.06em; line-height: 1;
    color: #fff; text-shadow: 0 0 6px var(--accent-glow), 0 0 18px rgba(255, 61, 87, 0.25);
  }
  .brand-name b { color: var(--accent); font-weight: 400; }
  .brand-sub { display: block; font: 600 0.62rem/1 var(--font-body); letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-mute); margin-top: 3px; }
  .env-badge { font: 700 0.62rem/1 var(--font-body); letter-spacing: 0.12em; text-transform: uppercase; padding: 5px 8px; border-radius: 6px; background: var(--gold-soft); color: var(--gold); border: 1px solid rgba(255,194,71,0.3); }

  /* ── Barra superior ── */
  .topbar {
    position: sticky; top: 0; z-index: 60;
    padding-top: var(--safe-t);
    background: linear-gradient(to bottom, rgba(11,10,15,0.92), rgba(11,10,15,0.78));
    backdrop-filter: saturate(160%) blur(16px); -webkit-backdrop-filter: saturate(160%) blur(16px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .topbar-inner { max-width: 1400px; margin: 0 auto; height: var(--topbar-h); padding: 0 24px; display: flex; align-items: center; gap: 20px; }
  .topbar-nav { display: flex; gap: 4px; margin-left: 12px; }
  .topbar-nav a { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px; border-radius: 999px; font-weight: 600; font-size: 0.88rem; color: var(--text-dim); text-decoration: none; transition: all 0.15s; }
  .topbar-nav a:hover { color: var(--text); background: rgba(255,255,255,0.05); }
  .topbar-nav a.active { color: var(--text); background: rgba(255,255,255,0.08); }
  .topbar-spacer { flex: 1; }
  .topbar-actions { display: flex; align-items: center; gap: 10px; }
  .accounts-menu { position: relative; }
  .accounts-panel { position: absolute; right: 0; top: calc(100% + 10px); z-index: 80; width: 310px; max-width: calc(100vw - 32px);
    padding: 14px; border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); box-shadow: 0 18px 50px rgba(0,0,0,0.6); }
  .accounts-panel[hidden] { display: none; }
  .accounts-panel-title { margin-bottom: 10px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-mute); }
  .acc-row { padding: 10px 12px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.03); border: 1px solid var(--line); }
  .acc-row + .acc-row { margin-top: 8px; }
  .acc-row.warn { border-color: rgba(255,107,129,0.45); background: var(--err-soft); }
  .acc-row.off { opacity: 0.6; }
  .acc-row-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 0.88rem; }
  .acc-row-days { font-weight: 700; color: var(--ok); }
  .acc-row.warn .acc-row-days { color: var(--err); }
  .acc-row.off .acc-row-days { color: var(--text-dim); }
  .acc-row-sub { margin-top: 4px; font-size: 0.76rem; color: var(--text-dim); line-height: 1.4; }
  .push-box { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
  .push-status { margin: 0 0 10px; font-size: 0.8rem; line-height: 1.45; color: var(--text-dim); }
  .push-actions { display: flex; gap: 8px; }
  .push-actions .btn { min-height: 36px; font-size: 0.82rem; }
  .push-actions [hidden] { display: none; }

  /* ── Barra inferior (móvil / PWA) ── */
  .bottomnav { display: none; }
  @media (max-width: 760px) {
    .topbar-inner { padding: 0 16px; height: 58px; }
    .topbar-nav, .topbar-actions .hide-mobile { display: none; }
    .bottomnav {
      display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 70;
      height: calc(var(--bottomnav-h) + var(--safe-b)); padding-bottom: var(--safe-b);
      background: rgba(14,13,19,0.9); backdrop-filter: saturate(160%) blur(18px); -webkit-backdrop-filter: saturate(160%) blur(18px);
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .bottomnav a, .bottomnav button {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
      font: 600 0.66rem var(--font-body); letter-spacing: 0.02em; color: var(--text-mute);
      text-decoration: none; background: none; border: 0; cursor: pointer;
    }
    .bottomnav .active { color: var(--text); }
    .bottomnav .active .icon { color: var(--accent); filter: drop-shadow(0 0 6px var(--accent-glow)); }
    .bottomnav .fab {
      width: 50px; height: 50px; margin-top: -22px; border-radius: 999px; background: var(--accent); color: #fff;
      display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px -4px var(--accent-glow), 0 0 0 5px var(--bg);
    }
    .bottomnav a.add-item { color: var(--text-dim); }
    .bottomnav .fab .icon { color: #fff !important; filter: none !important; }
    .segmented { max-width: 100%; }
    .segmented button { flex: 1 1 0; min-width: 0; justify-content: center; padding: 0 10px; font-size: 0.8rem; }
  }

  /* ── Avisos ── */
  /* Bloque y no flex: el mensaje mezcla texto con <code> y en flex cada
     trozo se convertía en una columna. */
  .msg { display: block; overflow-wrap: anywhere; padding: 14px 16px; border-radius: var(--radius-sm); font-size: 0.88rem; line-height: 1.5; margin: 0 0 20px; border: 1px solid transparent; }
  .toast { position: fixed; z-index: 90; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 14px); transform: translateX(-50%);
    width: min(520px, calc(100% - 32px)); cursor: pointer; animation: toast-in 0.25s ease-out; transition: opacity 0.3s, transform 0.3s; }
  .toast .msg { margin: 0; background: var(--surface); box-shadow: 0 12px 40px rgba(0,0,0,0.55); }
  .toast .msg.ok { background: linear-gradient(var(--ok-soft), var(--ok-soft)), var(--surface); }
  .toast .msg.err { background: linear-gradient(var(--err-soft), var(--err-soft)), var(--surface); }
  .toast-out { opacity: 0; transform: translate(-50%, -12px); }
  @keyframes toast-in { from { opacity: 0; transform: translate(-50%, -12px); } }
  .msg code { font-family: ui-monospace, monospace; background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 5px; }
  .ok { background: var(--ok-soft); color: #a6f0c6; border-color: rgba(61,220,132,0.25); }
  .err { background: var(--err-soft); color: #ffc0ca; border-color: rgba(255,107,129,0.3); }

  .spinner { width: 16px; height: 16px; flex-shrink: 0; border-radius: 50%; border: 2px solid rgba(255,255,255,0.15); border-top-color: var(--accent); animation: spin 0.7s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes shimmer { to { background-position: -200% 0; } }
  .skeleton { background: linear-gradient(90deg, var(--surface) 0%, var(--surface-2) 50%, var(--surface) 100%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
  }
`;
}

// Marca reutilizable: icono + "JFUSTER RD" en letra de marquesina.
function brandMark({ href = "/admin", sub = "Videoclub" } = {}) {
    return `<a class="brand" href="${href}">
      <img src="/icon.png" alt="">
      <span><span class="brand-name">JFUSTER <b>RD</b></span><span class="brand-sub">${escapeHtml(sub)}</span></span>
    </a>`;
}

// En `vercel dev` se avisa de que guardar/eliminar sigue escribiendo en el
// repo de GitHub (y por tanto redespliega producción), aunque la UI sea local.
function isLocal() {
    return process.env.VERCEL_ENV === "development";
}

// ── Barra superior y barra inferior (PWA) del panel ──
function renderTopBar(active) {
    const navLink = (key, href, iconName, label) =>
        `<a href="${href}" class="${active === key ? "active" : ""}">${icon(iconName, 17)} ${label}</a>`;
    return `<header class="topbar">
    <div class="topbar-inner">
      ${brandMark()}
      ${isLocal() ? `<span class="env-badge" title="Estás en vercel dev. Guardar o eliminar escribe en GitHub y redespliega producción.">Local</span>` : ""}
      <nav class="topbar-nav">
        ${navLink("library", "/admin", "library", "Biblioteca")}
        ${navLink("add", "/admin/add", "plus", "Añadir")}
        ${navLink("install", "/configure", "link", "Instalar")}
      </nav>
      <div class="topbar-spacer"></div>
      <div class="topbar-actions">
        ${active === "add" ? "" : `<a class="btn btn-primary hide-mobile" href="/admin/add">${icon("plus", 18)} Añadir película</a>`}
        <div class="accounts-menu">
          <button type="button" class="icon-btn" id="accounts-btn" title="Cuentas de Real-Debrid" aria-label="Cuentas de Real-Debrid" aria-expanded="false" aria-controls="accounts-panel">${icon("user", 18)}</button>
          <div class="accounts-panel" id="accounts-panel" hidden>
            <div class="accounts-panel-title">Cuentas de Real-Debrid</div>
            <div id="accounts-list"><span class="spinner"></span></div>
            ${process.env.VAPID_PUBLIC_KEY ? `<div class="push-box">
              <div class="accounts-panel-title">Notificaciones</div>
              <p class="push-status" id="push-status">Te aviso en este dispositivo cuando aparezcan copias de tu lista de deseos o termine una descarga.</p>
              <div class="push-actions">
                <button type="button" class="btn btn-primary" id="push-btn">🔔 Activar</button>
                <button type="button" class="btn btn-ghost" id="push-test" hidden>Enviar prueba</button>
              </div>
            </div>` : ""}
          </div>
        </div>
        <a class="icon-btn" href="/login?logout=1" title="Cerrar sesión" aria-label="Cerrar sesión">${icon("logout", 18)}</a>
      </div>
    </div>
  </header>
  <script>
    // Cuentas de Real-Debrid: días de premium y descargas activas. Se piden
    // a RD al abrir el panel (no en cada carga de página).
    (function () {
      var btn = document.getElementById('accounts-btn');
      var panel = document.getElementById('accounts-panel');
      var list = document.getElementById('accounts-list');
      var loaded = false;
      function row(a) {
        var el = document.createElement('div');
        var info = a.info;
        var warn = info && (!info.premium || info.daysLeft <= 7);
        el.className = 'acc-row' + (warn ? ' warn' : '') + (info ? '' : ' off');
        var days = !info ? 'Sin datos' : !info.premium ? 'Sin premium'
          : info.daysLeft === 0 ? 'Caduca hoy' : info.daysLeft === 1 ? 'Queda 1 día' : 'Quedan ' + info.daysLeft + ' días';
        var sub = !info ? 'Sin clave en este entorno o RD no responde' : [
          info.expiration ? 'Hasta el ' + new Date(info.expiration).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
          info.active != null ? info.active + (info.active === 1 ? ' descarga activa' : ' descargas activas') + (info.limit ? ' de ' + info.limit : '') : '',
        ].filter(Boolean).join(' · ');
        el.innerHTML = '<div class="acc-row-head"><b></b><span class="acc-row-days"></span></div><div class="acc-row-sub"></div>';
        el.querySelector('b').textContent = a.id;
        el.querySelector('.acc-row-days').textContent = days;
        el.querySelector('.acc-row-sub').textContent = sub;
        return el;
      }
      function load() {
        fetch('/api/movie-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'accounts' }),
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (!data.accounts) throw new Error(data.error || '');
            list.innerHTML = '';
            data.accounts.forEach(function (a) { list.appendChild(row(a)); });
            loaded = true;
          })
          .catch(function (e) { list.textContent = (e && e.message) || 'No se pudo consultar Real-Debrid.'; });
      }
      // ── Notificaciones push (ver lib/push.js y public/sw.js) ──
      // En el iPhone solo funcionan con la app instalada en la pantalla de
      // inicio (iOS 16.4+): desde una pestaña de Safari fallaría en silencio.
      var VAPID_KEY = ${JSON.stringify((process.env.VAPID_PUBLIC_KEY || "").trim())};
      var pushBtn = document.getElementById('push-btn');
      var pushTest = document.getElementById('push-test');
      var pushStatus = document.getElementById('push-status');
      var pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      var registration = pushSupported && VAPID_KEY ? navigator.serviceWorker.register('/sw.js').catch(function () { return null; }) : Promise.resolve(null);
      function api(body) {
        return fetch('/api/movie-details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          .then(function (res) { return res.json(); });
      }
      function keyBytes(b64) {
        var s = (b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
        var raw = atob(s), out = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
        return out;
      }
      function pushState(text, active) {
        pushStatus.textContent = text;
        pushBtn.hidden = !!active;
        pushTest.hidden = !active;
      }
      function refreshPush() {
        if (!pushBtn) return;
        if (!pushSupported) return pushState('Este navegador no admite notificaciones.', false), (pushBtn.hidden = true);
        registration.then(function (reg) { return reg && reg.pushManager.getSubscription(); }).then(function (sub) {
          if (sub) pushState('Activadas en este dispositivo.', true);
        });
      }
      if (pushBtn) {
        pushBtn.addEventListener('click', function () {
          var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
          if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) {
            return pushState('En el iPhone, abre la app desde el icono de la pantalla de inicio para activarlas.', false);
          }
          if (Notification.permission === 'denied') {
            return pushState(/iphone|ipad|ipod/i.test(navigator.userAgent)
              ? 'Están bloqueadas. En el iPhone: Ajustes → Notificaciones → esta app → Permitir notificaciones. Si no aparece ahí, borra la app de la pantalla de inicio, vuelve a añadirla desde Safari y pulsa Activar.'
              : 'Las notificaciones están bloqueadas para esta web. Permítelas en los ajustes del navegador (icono del candado o de la campana junto a la dirección) y vuelve a pulsar Activar.', false);
          }
          pushBtn.disabled = true;
          pushStatus.textContent = 'Acepta el permiso que te pide el navegador…';
          // Algunos navegadores no muestran la ventana y lo dejan en un icono
          // de la barra de direcciones: si a los 6 s no hay respuesta, se dice.
          var waiting = setTimeout(function () {
            pushStatus.textContent = '¿No te aparece la petición? Mira el icono de la campana junto a la barra de direcciones, o permite las notificaciones en los ajustes del navegador.';
            pushBtn.disabled = false;
          }, 6000);
          // Safari antiguo usa la versión con callback en vez de promesa.
          new Promise(function (resolve) {
            var p = Notification.requestPermission(resolve);
            if (p && p.then) p.then(resolve);
          }).then(function (perm) {
            clearTimeout(waiting);
            if (perm !== 'granted') throw new Error('No has dado permiso. Permite las notificaciones en los ajustes del navegador y vuelve a pulsar Activar.');
            pushStatus.textContent = 'Activando…';
            return registration;
          }).then(function (reg) {
            if (!reg) throw new Error('No se pudo preparar el dispositivo.');
            return reg.pushManager.getSubscription().then(function (sub) {
              return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_KEY) });
            });
          }).then(function (sub) {
            return api({ action: 'push-subscribe', subscription: sub.toJSON() });
          }).then(function (data) {
            if (data.error) throw new Error(data.error);
            pushState('Activadas en este dispositivo.', true);
          }).catch(function (e) {
            pushState(e.message || 'No se pudieron activar.', false);
          }).then(function () { pushBtn.disabled = false; });
        });
        pushTest.addEventListener('click', function () {
          pushTest.disabled = true;
          api({ action: 'push-test' }).then(function (data) {
            pushStatus.textContent = data.error ? data.error : 'Enviada a ' + data.sent + ' dispositivo' + (data.sent === 1 ? '' : 's') + '.';
          }).catch(function () { pushStatus.textContent = 'No se pudo enviar.'; })
            .then(function () { pushTest.disabled = false; });
        });
      }

      function toggle(open) {
        panel.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open && !loaded) { load(); refreshPush(); }
      }
      btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(panel.hidden); });
      panel.addEventListener('click', function (e) { e.stopPropagation(); });
      document.addEventListener('click', function () { if (!panel.hidden) toggle(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) toggle(false); });
    })();
  </script>`;
}

// Salir ya está en la barra de arriba, y el buscador de la biblioteca a la
// vista: abajo solo las tres secciones.
function renderBottomNav(active) {
    return `<nav class="bottomnav" aria-label="Navegación">
    <a href="/admin" class="${active === "library" ? "active" : ""}">${icon("library", 22)}Biblioteca</a>
    <a href="/admin/add" class="add-item ${active === "add" ? "active" : ""}" aria-label="Añadir película"><span class="fab">${icon("plus", 24)}</span></a>
    <a href="/configure" class="${active === "install" ? "active" : ""}">${icon("link", 22)}Instalar</a>
  </nav>`;
}

module.exports = { THEME_COLOR, escapeHtml, icon, headTags, themeCss, brandMark, isLocal, renderTopBar, renderBottomNav };
