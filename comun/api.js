/* La Nonna — acceso al servidor y almacenamiento seguro. Idéntico en web y en APK.
   - LN_API_BASE: '' en web (mismo dominio); en el APK la fija el build con la URL pública del servidor.
   - Admin: en web viaja una cookie httpOnly; en el APK (LN_MODO_APK) se manda Authorization: Bearer.
   - Cliente: siempre Bearer con el token de su cuenta, guardado en el dispositivo. */
(function (w) {
  var mem = {};
  /* localStorage puede lanzar SecurityError (modo privado, WebView restringido): todo pasa por estas funciones. */
  function leerLocal(k, def) { try { var v = w.localStorage.getItem(k); if (v !== null) return JSON.parse(v); } catch (e) { /* cae a memoria */ } return mem[k] !== undefined ? mem[k] : def; }
  function guardarLocal(k, v) { mem[k] = v; try { w.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* queda en memoria */ } }
  function borrarLocal(k) { delete mem[k]; try { w.localStorage.removeItem(k); } catch (e) { /* nada */ } }

  w.LN_API_BASE = w.LN_API_BASE || '';
  var MODO_APK = w.LN_MODO_APK === true || !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform());

  /* api('/api/menu') → { ok, status, data, error }  (nunca lanza: la red caída es un resultado más) */
  function api(ruta, o) {
    o = o || {};
    var h = {}, cuerpo;
    if (o.crudo !== undefined) { h['Content-Type'] = o.tipo; cuerpo = o.crudo; }
    else if (o.cuerpo !== undefined) { h['Content-Type'] = 'application/json'; cuerpo = JSON.stringify(o.cuerpo); }
    var bearer = o.bearer || (o.admin && MODO_APK ? leerLocal('ln_admin_token', '') : '');
    if (bearer) h.Authorization = 'Bearer ' + bearer;
    if (o.pantalla) h['X-Pantalla-Token'] = o.pantalla;
    return fetch(w.LN_API_BASE + ruta, { method: o.metodo || 'GET', headers: h, body: cuerpo, credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          return { ok: r.ok, status: r.status, data: d, error: r.ok ? '' : (d && d.error) || 'Error ' + r.status };
        });
      })
      .catch(function () { return { ok: false, status: 0, data: {}, error: 'Sin conexión. Revisa tu internet e intenta de nuevo.' }; });
  }
  w.LN = { api: api, leerLocal: leerLocal, guardarLocal: guardarLocal, borrarLocal: borrarLocal, MODO_APK: MODO_APK };
})(window);
