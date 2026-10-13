/* Activación del personal. El teléfono (o una tablet/PC con el link de respaldo) se activa con el QR del día de su rol
   y el nombre de quien lo usa. El servidor entrega un token de ESE dispositivo, que vence a medianoche o cuando el admin
   lo desactiva; entonces la pantalla vuelve aquí y pide el QR del día otra vez.
   LNEquipo.iniciar(listo) → llama listo({ token, paso, rol, persona }). LNEquipo.olvidar() borra el dispositivo guardado. */
(function (w) {
  var L = w.LN, U = w.U, E = U.esc, CLAVE = 'ln_equipo';
  function leerCodigo(t) { var m = /[#&?]a=([A-Za-z0-9]{6,30})/.exec(String(t || '')); return (m ? m[1] : String(t || '')).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  function pantallaActivar(codigoInicial, via, listo, aviso) {
    if (window.LN_DEMO) { location.replace('../equipo/index.html'); return; }
    var raiz = document.getElementById('raiz');
    raiz.innerHTML = '<div class="eq-act"><div class="eq-logo">' + U.logo(80) + '</div><h1 class="titulo">Equipo La Nonna</h1>' +
      '<p class="eq-sub">' + (codigoInicial ? 'Escribe tu nombre para empezar tu turno.' : 'Escanea el QR del día de tu puesto. Te lo da el encargado.') + '</p>' +
      (aviso ? '<div class="eq-aviso" role="alert">' + E(aviso) + '</div>' : '') +
      '<label class="eq-campo">Tu nombre<input id="eq-n" maxlength="40" autocomplete="name" value="' + E(L.leerLocal('ln_persona', '')) + '"></label>' +
      (codigoInicial ? '' : '<button class="eq-btn" id="eq-esc">📷 Escanear QR del día</button>' + (L.MODO_APK ? '' : '<label class="eq-campo">o escribe el código<input id="eq-c" maxlength="30" autocapitalize="characters" autocomplete="off"></label>')) +
      (L.MODO_APK ? '' : '<button class="eq-btn" id="eq-ok">' + (codigoInicial ? 'Empezar' : 'Activar') + '</button>') + '<div class="eq-err" id="eq-err" role="alert"></div></div>';
    var codigo = codigoInicial;
    function activar(cod, v) {
      var nombre = document.getElementById('eq-n').value.trim(), err = document.getElementById('eq-err');
      if (nombre.length < 2) { err.textContent = 'Escribe tu nombre.'; document.getElementById('eq-n').focus(); return Promise.resolve({ ok: false, texto: 'Escribe tu nombre arriba.' }); }
      if (!cod) { err.textContent = 'Falta el código del QR del día.'; return Promise.resolve({ ok: false, texto: 'Código vacío.' }); }
      return L.api('/api/equipo/activar', { metodo: 'POST', cuerpo: { codigo: cod, persona: nombre, via: v, canal: L.MODO_APK ? 'apk' : 'web' } }).then(function (r) {
        if (!r.ok) { err.textContent = r.error; return { ok: false, texto: r.error }; }
        L.guardarLocal('ln_persona', nombre);
        L.guardarLocal(CLAVE, r.data);
        if (location.hash) history.replaceState(null, '', location.pathname);
        var m = document.querySelector('.modal-bg'); if (m) m.remove();
        listo(r.data);
        return { ok: true, texto: '✓ Activado' };
      });
    }
    if (document.getElementById('eq-ok')) document.getElementById('eq-ok').onclick = function () { activar(codigo || leerCodigo(document.getElementById('eq-c').value), via); };
    var esc = document.getElementById('eq-esc');
    if (esc) esc.onclick = function () {
      if (document.getElementById('eq-n').value.trim().length < 2) { document.getElementById('eq-err').textContent = 'Primero escribe tu nombre.'; return; }
      w.LNEscaner.abrir('QR del día', function (cod) { return activar(leerCodigo(cod), 'qr'); }, { soloCamara: L.MODO_APK });
    };
  }

  function iniciar(listo) {
    var m = /[#&]a=([A-Za-z0-9]{6,30})/.exec(location.hash || '');
    if (m && !L.MODO_APK) { pantallaActivar(m[1].toUpperCase(), 'link', listo); return; }       // en la APK un link no activa: solo el QR escaneado       // abierto desde el link de respaldo (o el QR leído por la cámara del sistema)
    var eq = L.leerLocal(CLAVE, null);
    if (eq && eq.token) { listo(eq); return; }
    pantallaActivar('', 'qr', listo);
  }
  // El servidor dijo 403: el dispositivo venció (otro día) o el admin lo desactivó.
  function olvidar(listo) { L.borrarLocal(CLAVE); pantallaActivar('', 'qr', listo, 'Este teléfono ya no está activo. Escanea el QR del día para seguir.'); }

  // Trazabilidad en el navegador (donde no se pueden bloquear las capturas): marca de agua con el nombre y la hora sobre toda la pantalla.
  function marcaDeAgua(persona) {
    if (L.MODO_APK) return;
    var m = document.getElementById('marca-agua');
    if (!m) { m = document.createElement('div'); m.id = 'marca-agua'; m.setAttribute('aria-hidden', 'true'); document.body.appendChild(m); }
    var h = new Date().toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }), t = persona + ' · ' + h, f = '';
    for (var i = 0; i < 60; i++) f += '<span>' + E(t) + '</span>';
    m.innerHTML = f;
  }
  w.LNEquipo = { iniciar: iniciar, olvidar: olvidar, leerCodigo: leerCodigo, marcaDeAgua: marcaDeAgua };
})(window);
