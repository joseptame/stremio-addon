function renderPage() {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Instalar · JFuster RD</title>
<style>
  :root {
    --bg: #14121f;
    --panel: #1d1a2b;
    --panel-border: #2c2840;
    --text: #eae7f5;
    --text-dim: #9691ad;
    --accent: #7b5bf0;
    --accent-hover: #6a4adf;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    margin: 0;
    padding: 32px 16px 64px;
  }
  .wrap { max-width: 480px; margin: 0 auto; }
  header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  header img { width: 40px; height: 40px; border-radius: 8px; }
  header h1 { font-size: 1.3rem; margin: 0; }
  header p { margin: 2px 0 0; color: var(--text-dim); font-size: 0.85rem; }
  .card { background: var(--panel); border: 1px solid var(--panel-border); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .card h2 { margin: 0 0 4px; font-size: 1.05rem; }
  .card p.desc { color: var(--text-dim); font-size: 0.85rem; line-height: 1.5; margin: 0 0 16px; }
  label { display: block; margin-top: 14px; font-weight: 600; font-size: 0.9rem; }
  input {
    width: 100%; padding: 10px 12px; margin-top: 6px; font-size: 0.95rem;
    background: #100e1a; border: 1px solid var(--panel-border); border-radius: 8px; color: var(--text);
  }
  input:focus { outline: none; border-color: var(--accent); }
  input::placeholder { color: #5c5875; }
  .btn { padding: 10px 16px; font-size: 0.9rem; cursor: pointer; border: none; border-radius: 8px; font-weight: 600; }
  .btn-primary { background: var(--accent); color: white; width: 100%; margin-top: 18px; }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-secondary { background: #2c2840; color: var(--text); width: 100%; margin-top: 8px; }
  .btn-secondary:hover { background: #383253; }
  a.btn { display: block; text-align: center; text-decoration: none; }
  #result { display: none; margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--panel-border); }
  .hint { color: var(--text-dim); font-size: 0.78rem; margin-top: 6px; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <img src="/icon.png" alt="">
      <div>
        <h1>JFuster RD</h1>
        <p>Instalar en Stremio</p>
      </div>
    </header>

    <section class="card">
      <h2>Enlace de instalación</h2>
      <p class="desc">
        Si tienes cuenta de Real-Debrid, pega tu API key para que los streams
        se reproduzcan al instante (sin depender de seeders). Es totalmente
        opcional: sin ella, el addon funciona igual mediante P2P.
      </p>

      <label for="rdKey">API key de Real-Debrid (opcional)</label>
      <input id="rdKey" placeholder="pégala aquí" autocomplete="off">
      <div class="hint">La sacas de <strong>real-debrid.com/apitoken</strong>. Nunca se guarda en nuestro servidor: solo viaja en tu propia URL de instalación.</div>

      <button id="generate" class="btn btn-primary">Generar enlace de instalación</button>

      <div id="result">
        <label for="manifestUrl">URL del manifest</label>
        <input id="manifestUrl" readonly>
        <button id="copy" class="btn btn-secondary">Copiar enlace</button>
        <a id="installLink" class="btn btn-primary" href="#">Instalar en Stremio</a>
      </div>
    </section>
  </div>

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
      var input = document.getElementById('manifestUrl');
      input.select();
      input.setSelectionRange(0, 99999);
      navigator.clipboard && navigator.clipboard.writeText(input.value);
    });
  </script>
</body>
</html>`;
}

module.exports = (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(renderPage());
};
