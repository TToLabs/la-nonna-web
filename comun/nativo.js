/* La Nonna — comportamiento propio de la APK (no hace nada en el navegador):
   1) pide el permiso de notificaciones al abrir (cuando la app ya mostró algo, no en el splash);
   2) revisa si hay una versión nueva y ofrece actualizar con el plugin nativo ApkInstalador
      (descarga a la carpeta PRIVADA de la app, instala por FileProvider y se limpia en MainActivity.onResume).
   Lo fija el build: window.LN_APP_ID ('cliente' | 'admin'), LN_VERSION, LN_VERSION_CODE, LN_API_BASE. */
(function (w) {
  var esNativo = function () { return !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform()); };
  if (!esNativo()) return;

  function pedirPermisoNotificaciones() {
    try {
      var N = w.Capacitor.Plugins && w.Capacitor.Plugins.LocalNotifications;
      if (!N) return Promise.resolve();
      return N.checkPermissions().then(function (e) { if (e.display !== 'granted') return N.requestPermissions(); }).catch(function () { /* no bloquea el arranque */ });
    } catch (e) { return Promise.resolve(); }
  }

  function aviso(v) {
    if (document.getElementById('ln-actualizar')) return;
    var cont = document.createElement('div');
    cont.id = 'ln-actualizar'; cont.setAttribute('role', 'alertdialog'); cont.setAttribute('aria-modal', 'true');
    cont.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,18,45,.6);display:flex;align-items:flex-end;justify-content:center;font-family:Inter,system-ui,sans-serif';
    var caja = document.createElement('div');
    caja.style.cssText = 'background:#fff;color:#14204A;width:100%;max-width:460px;border-radius:18px 18px 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom))';
    caja.innerHTML = '<div style="font-family:Lobster,cursive;font-size:26px;margin-bottom:6px">Hay una versión nueva</div><div id="ln-act-txt" style="font-size:14.5px;color:#5B6779;margin-bottom:14px"></div>' +
      '<div id="ln-act-barra" style="height:8px;background:#E3E7EF;border-radius:6px;overflow:hidden;margin-bottom:14px;display:none"><i id="ln-act-prog" style="display:block;height:100%;width:0;background:#F59A1B"></i></div>' +
      '<button id="ln-act-ok" style="width:100%;min-height:50px;border:0;border-radius:10px;background:#F59A1B;color:#14204A;font-weight:700;font-size:16px;margin-bottom:8px">Actualizar ahora</button>' +
      '<button id="ln-act-no" style="width:100%;min-height:46px;border:1.5px solid #E3E7EF;border-radius:10px;background:#fff;color:#14204A;font-weight:600;font-size:15px">Más tarde</button>';
    cont.appendChild(caja); document.body.appendChild(cont);
    document.getElementById('ln-act-txt').textContent = 'Versión ' + v.version + (v.notas ? ' · ' + v.notas : '') + '. La descarga queda dentro de la app y se borra sola al terminar.';
    document.getElementById('ln-act-no').onclick = function () { cont.remove(); };
    document.getElementById('ln-act-ok').onclick = function () {
      var btn = this, P = w.Capacitor.Plugins && w.Capacitor.Plugins.ApkInstalador;
      if (!P) { window.open((w.LN_API_BASE || '') + v.url, '_system'); return; }
      btn.disabled = true; btn.textContent = 'Descargando…';
      document.getElementById('ln-act-barra').style.display = 'block';
      try { P.addListener('progreso', function (e) { document.getElementById('ln-act-prog').style.width = (e.porcentaje || 0) + '%'; }); } catch (e) { /* sin barra */ }
      P.descargarEInstalar({ url: (w.LN_API_BASE || '') + v.url }).then(function () { btn.textContent = 'Abriendo instalador…'; }, function (err) {
        btn.disabled = false; btn.textContent = 'Reintentar';
        document.getElementById('ln-act-txt').textContent = 'No se pudo descargar: ' + ((err && err.message) || 'error de red') + '.';
      });
    };
  }

  function revisarActualizacion() {
    if (!w.LN_APP_ID || !w.LN_VERSION_CODE) return;
    fetch((w.LN_API_BASE || '') + '/apk/version-' + w.LN_APP_ID + '.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) { if (v && Number(v.versionCode) > Number(w.LN_VERSION_CODE)) aviso(v); })
      .catch(function () { /* sin red o sin servidor: no molesta */ });
  }

  /* Después del splash y de que la app ya mostró algo de valor. */
  w.addEventListener('load', function () { setTimeout(function () { pedirPermisoNotificaciones().then(revisarActualizacion); }, 3500); });
})(window);
