const { createSessionCookie, clearSessionCookie, isAuthenticated } = require("../lib/adminAuth");
const { escapeHtml, headTags, themeCss } = require("../lib/ui");

function safeNext(next) {
    return next && String(next).startsWith("/") && !String(next).startsWith("//") ? next : "/admin";
}

function renderLoginPage({ error, next }) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
${headTags("Entrar · JFuster RD")}
<style>${themeCss()}
  body { min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; position: relative; overflow-x: hidden; }
  /* Fondo: focos de neón difusos + tira de película, sin mostrar el catálogo
     (la página de login es pública). */
  .stage { position: fixed; inset: 0; z-index: -1; overflow: hidden; }
  .stage::before { content: ""; position: absolute; width: 70vmax; height: 70vmax; left: -20vmax; top: -30vmax; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,61,87,0.22), transparent 60%); }
  .stage::after { content: ""; position: absolute; width: 60vmax; height: 60vmax; right: -25vmax; bottom: -30vmax; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,194,71,0.12), transparent 60%); }
  .filmstrip { position: absolute; left: -10%; right: -10%; top: 50%; height: 120px; transform: translateY(-50%) rotate(-8deg); opacity: 0.07;
    background:
      repeating-linear-gradient(90deg, #fff 0 18px, transparent 18px 34px) top / 100% 14px no-repeat,
      repeating-linear-gradient(90deg, #fff 0 18px, transparent 18px 34px) bottom / 100% 14px no-repeat,
      repeating-linear-gradient(90deg, transparent 0 8px, rgba(255,255,255,0.5) 8px 150px, transparent 150px 158px) center / 100% 76px no-repeat; }
  .login-card { width: 100%; max-width: 400px; padding: 40px 34px 34px; border-radius: 24px;
    background: rgba(23,21,30,0.82); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--line-strong); box-shadow: 0 40px 80px -24px rgba(0,0,0,0.9); animation: fade-up 0.45s ease both; }
  .login-head { text-align: center; margin-bottom: 30px; }
  .login-head img { width: 64px; height: 64px; border-radius: 16px; margin: 0 auto 16px; box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 0 40px -6px var(--accent-glow); }
  .login-head .brand-name { font-size: 2.4rem; }
  .login-head p { margin: 8px 0 0; color: var(--text-dim); font-size: 0.9rem; }
  form { display: grid; gap: 18px; }
  .password-wrap { position: relative; }
  .password-wrap .input { padding-right: 50px; }
  .toggle-password { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; border: 0; background: none;
    display: flex; align-items: center; justify-content: center; color: var(--text-mute); cursor: pointer; border-radius: 8px; }
  .toggle-password:hover { color: var(--text); }
  .remember { display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: var(--text-dim); cursor: pointer; }
  .remember input { width: 18px; height: 18px; accent-color: var(--accent); }
  .login-card .btn-primary { min-height: 50px; font-size: 0.95rem; margin-top: 4px; }
  .msg { margin-bottom: 22px; }
</style>
</head>
<body>
  <div class="stage" aria-hidden="true"><div class="filmstrip"></div></div>
  <div class="login-card">
    <div class="login-head">
      <img src="/icon.png" alt="">
      <div class="brand-name">JFUSTER <b>RD</b></div>
      <p>Entra para gestionar tu videoclub</p>
    </div>
    ${error ? `<div class="msg err">${escapeHtml(error)}</div>` : ""}
    <form method="POST" action="/login">
      <input type="hidden" name="next" value="${escapeHtml(safeNext(next))}">
      <div>
        <label class="field-label" for="username">Usuario</label>
        <input class="input" id="username" name="username" required autocomplete="username">
      </div>
      <div>
        <label class="field-label" for="password">Contraseña</label>
        <div class="password-wrap">
          <input class="input" id="password" name="password" type="password" required autocomplete="current-password">
          <button type="button" class="toggle-password" id="toggle-password" aria-label="Mostrar contraseña" aria-pressed="false">
            <svg id="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <label class="remember"><input type="checkbox" name="remember" value="1" checked> Recordarme en este dispositivo</label>
      <button type="submit" class="btn btn-primary btn-block">Entrar</button>
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
