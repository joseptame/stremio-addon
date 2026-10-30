const { headTags, themeCss, brandMark, icon, renderTopBar, renderBottomNav } = require("../lib/ui");
const { isAuthenticated } = require("../lib/adminAuth");

// La página es pública (la usa cualquiera para instalar el addon); solo si
// quien la abre tiene sesión del panel se muestran sus barras de navegación.
function renderPage({ loggedIn }) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
${headTags("Instalar · JFuster RD")}
<style>${themeCss()}
  body { min-height: 100vh; min-height: 100dvh; padding: calc(28px + var(--safe-t)) 16px 64px; position: relative; overflow-x: hidden; }
  body::before { content: ""; position: fixed; z-index: -1; width: 70vmax; height: 70vmax; left: -25vmax; top: -35vmax; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,61,87,0.18), transparent 60%); }
  .wrap { max-width: 520px; margin: 0 auto; }
  .head { display: flex; justify-content: center; margin-bottom: 34px; }
  .card { background: rgba(23,21,30,0.85); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
    border: 1px solid var(--line-strong); border-radius: 24px; padding: 30px; box-shadow: 0 40px 80px -24px rgba(0,0,0,0.9); animation: fade-up 0.45s ease both; }
  h1 { font: 400 2.4rem/1 var(--font-display); letter-spacing: 0.04em; margin: 0 0 10px; }
  .desc { color: var(--text-dim); font-size: 0.92rem; line-height: 1.6; margin: 0 0 26px; }
  .desc strong { color: var(--text); }
  .btn-block { margin-top: 18px; min-height: 50px; }
  #result { display: none; margin-top: 26px; padding-top: 24px; border-top: 1px solid var(--line); animation: fade-up 0.3s ease both; }
  .url-row { display: flex; gap: 8px; }
  .url-row .input { flex: 1; font-family: ui-monospace, "Cascadia Code", monospace; font-size: 0.8rem; }
  .steps { display: grid; gap: 12px; margin: 26px 0 0; padding: 0; list-style: none; counter-reset: s; }
  .steps li { display: flex; gap: 12px; align-items: flex-start; font-size: 0.86rem; color: var(--text-dim); counter-increment: s; }
  .steps li::before { content: counter(s); flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
    font: 400 0.95rem/1 var(--font-display); background: var(--accent-soft); color: var(--accent); }
  @media (max-width: 480px) { .card { padding: 24px 20px; } h1 { font-size: 2rem; } }
  body.panel { padding: 0; }
  body.panel .wrap { padding: 32px 16px 64px; }
  @media (max-width: 760px) { body.panel .wrap { padding: 20px 16px calc(var(--bottomnav-h) + var(--safe-b) + 32px); } }
</style>
</head>
<body${loggedIn ? ' class="panel"' : ""}>
  ${loggedIn ? renderTopBar("install") : ""}
  <div class="wrap">
    ${loggedIn ? "" : `<div class="head">${brandMark({ href: "/configure", sub: "Addon de Stremio" })}</div>`}

    <section class="card">
      <h1>Instalar en Stremio</h1>
      <p class="desc">
        Si tienes cuenta de Real-Debrid, pega tu API key para que las películas
        se reproduzcan al instante, sin depender de seeders. Es <strong>totalmente
        opcional</strong>: sin ella, el addon funciona igual mediante P2P.
      </p>

      <label class="field-label" for="rdKey">API key de Real-Debrid (opcional)</label>
      <input class="input" id="rdKey" placeholder="Pégala aquí" autocomplete="off">
      <div class="hint">La sacas de <strong>real-debrid.com/apitoken</strong>. Nunca se guarda en nuestro servidor: solo viaja en tu propia URL de instalación.</div>

      <button id="generate" class="btn btn-primary btn-block">${icon("link", 18)} Generar enlace de instalación</button>

      <div id="result">
        <label class="field-label" for="manifestUrl">URL del manifest</label>
        <div class="url-row">
          <input class="input" id="manifestUrl" readonly>
          <button id="copy" class="btn btn-ghost">${icon("copy", 16)} Copiar</button>
        </div>
        <a id="installLink" class="btn btn-primary btn-block" href="#">${icon("download", 18)} Instalar en Stremio</a>
        <ol class="steps">
          <li>Pulsa “Instalar en Stremio” con la app abierta en este dispositivo.</li>
          <li>Si no se abre, copia la URL y pégala en Stremio → Addons → buscador.</li>
          <li>Las películas del videoclub aparecerán en tu catálogo.</li>
        </ol>
      </div>
    </section>
  </div>
  ${loggedIn ? renderBottomNav("install") : ""}

  <script>
    document.getElementById('generate').addEventListener('click', function () {
      var key = document.getElementById('rdKey').value.trim();
      var base = window.location.origin;
      var manifestUrl = key
        ? base + '/rd=' + encodeURIComponent(key) + '/manifest.json'
        : base + '/manifest.json';

      document.getElementById('manifestUrl').value = manifestUrl;
      document.getElementById('installLink').href = 'stremio://' + manifestUrl.replace(/^https?:\\/\\//, '');
      document.getElementById('result').style.display = 'block';
    });

    document.getElementById('copy').addEventListener('click', function () {
      var btn = this;
      var input = document.getElementById('manifestUrl');
      input.select();
      input.setSelectionRange(0, 99999);
      if (navigator.clipboard) navigator.clipboard.writeText(input.value).then(function () {
        var old = btn.innerHTML;
        btn.textContent = '¡Copiado!';
        setTimeout(function () { btn.innerHTML = old; }, 1400);
      });
    });
  </script>
</body>
</html>`;
}

module.exports = (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const loggedIn = isAuthenticated(req, (process.env.ADMIN_PASSWORD || "").trim());
    return res.status(200).send(renderPage({ loggedIn }));
};
