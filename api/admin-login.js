const { createSessionCookie, clearSessionCookie, isAuthenticated } = require("../lib/adminAuth");

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

function safeNext(next) {
    return next && String(next).startsWith("/") && !String(next).startsWith("//") ? next : "/admin";
}

function renderLoginPage({ error, next }) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="apple-touch-icon" href="/icon.png">
<meta name="theme-color" content="#7b5bf0">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="FilmRD">
<title>Entrar · JFuster RD</title>
<style>
  :root {
    --bg: #14121f; --panel: #1d1a2b; --panel-border: #2c2840;
    --text: #eae7f5; --text-dim: #9691ad;
    --accent: #7b5bf0; --accent-hover: #6a4adf;
    --err-bg: #331b22; --err-text: #f28ba0;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
    background: var(--bg); color: var(--text); margin: 0;
    min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .login-card {
    background: var(--panel); border: 1px solid var(--panel-border); border-radius: 16px;
    padding: 40px 36px; width: 100%; max-width: 380px;
  }
  .login-card header { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 32px; }
  .login-card img { width: 48px; height: 48px; border-radius: 11px; }
  .login-card h1 { font-size: 1.2rem; margin: 0; }
  .login-card p { margin: 0; color: var(--text-dim); font-size: 0.85rem; }
  form { display: flex; flex-direction: column; }
  label { display: block; margin-top: 26px; font-weight: 600; font-size: 0.88rem; line-height: 1.3; }
  label:first-of-type { margin-top: 0; }
  input {
    display: block; width: 100%; padding: 12px 14px; margin-top: 12px; box-sizing: border-box;
    font-size: 0.95rem; background: #100e1a; border: 1px solid var(--panel-border);
    border-radius: 9px; color: var(--text);
  }
  input:focus { outline: none; border-color: var(--accent); }
  .password-wrap { position: relative; margin-top: 12px; }
  .password-wrap input { margin-top: 0; padding-right: 44px; }
  .toggle-password {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
    background: none; border: none; margin: 0; padding: 0; cursor: pointer; color: var(--text-dim);
  }
  .toggle-password:hover { color: var(--text); }
  .toggle-password svg { width: 20px; height: 20px; }
  .checkbox-label { display: flex; align-items: center; gap: 9px; font-weight: 400; margin-top: 30px; font-size: 0.88rem; }
  .checkbox-label input { width: auto; margin-top: 0; }
  button {
    width: 100%; margin-top: 10px; padding: 13px 16px; font-size: 0.95rem; font-weight: 600;
    cursor: pointer; border: none; border-radius: 9px; background: var(--accent); color: white;
  }
  button:hover { background: var(--accent-hover); }
  .msg { margin-bottom: 24px; padding: 12px 14px; border-radius: 9px; font-size: 0.85rem; line-height: 1.4; background: var(--err-bg); color: var(--err-text); }
</style>
</head>
<body>
  <div class="login-card">
    <header>
      <img src="/icon.png" alt="">
      <h1>JFuster RD</h1>
      <p>Panel de administración</p>
    </header>
    ${error ? `<div class="msg">${escapeHtml(error)}</div>` : ""}
    <form method="POST" action="/login">
      <input type="hidden" name="next" value="${escapeHtml(safeNext(next))}">
      <label for="username">Usuario</label>
      <input id="username" name="username" required autocomplete="username">
      <label for="password">Contraseña</label>
      <div class="password-wrap">
        <input id="password" name="password" type="password" required autocomplete="current-password">
        <button type="button" class="toggle-password" id="toggle-password" aria-label="Mostrar contraseña" aria-pressed="false">
          <svg id="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
      <label class="checkbox-label"><input type="checkbox" name="remember" value="1" checked> Recordarme en este dispositivo</label>
      <button type="submit">Entrar</button>
    </form>
  </div>
  <script>
    (function () {
      var input = document.getElementById('password');
      var btn = document.getElementById('toggle-password');
      var icon = document.getElementById('eye-icon');
      var eyeOpen = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/>';
      var eyeClosed = '<path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c7 0 11 7 11 7a13.2 13.2 0 0 1-3.4 3.9M6.5 6.6C3.6 8.4 1 12 1 12s4 7 11 7a10.4 10.4 0 0 0 4.2-.9"/>';
      btn.addEventListener('click', function () {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        icon.innerHTML = show ? eyeClosed : eyeOpen;
        btn.setAttribute('aria-pressed', show ? 'true' : 'false');
        btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      });
    })();
  </script>
</body>
</html>`;
}

module.exports = async (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    if (req.method === "GET") {
        if (req.query.logout === "1") {
            res.setHeader("Set-Cookie", clearSessionCookie());
            return res.redirect(302, "/login");
        }
        if (isAuthenticated(req, (process.env.ADMIN_PASSWORD || "").trim())) {
            return res.redirect(302, safeNext(req.query.next));
        }
        return res.status(200).send(renderLoginPage({ next: req.query.next }));
    }

    if (req.method !== "POST") {
        return res.status(405).send(renderLoginPage({ error: "Método no permitido." }));
    }

    const { username, password, remember, next } = req.body || {};
    const expectedUser = (process.env.ADMIN_USERNAME || "").trim();
    const expectedPass = (process.env.ADMIN_PASSWORD || "").trim();

    if (!expectedUser || !expectedPass) {
        return res.status(500).send(renderLoginPage({
            error: "Falta configurar ADMIN_USERNAME / ADMIN_PASSWORD en el servidor.",
            next,
        }));
    }

    if (username !== expectedUser || password !== expectedPass) {
        return res.status(401).send(renderLoginPage({ error: "Usuario o contraseña incorrectos.", next }));
    }

    res.setHeader("Set-Cookie", createSessionCookie(expectedPass, remember === "1"));
    return res.redirect(302, safeNext(next));
};
