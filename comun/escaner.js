/* Lector de QR para el personal: cámara (BarcodeDetector, Chrome/Android) y, siempre, escribir el código a mano (8 caracteres).
   LNEscaner.abrir(titulo, enviar): enviar(codigo) devuelve una promesa { ok, texto }; el lector queda abierto para escanear otro. */
(function (w) {
  var E = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function limpiar(t) { t = String(t || '').trim(); var a = /[#&?]a=([A-Za-z0-9]{6,30})/.exec(t), m = a || /[A-Za-z0-9]{8,30}$/.exec(t); return m ? (m[1] || m[0]).toUpperCase() : t.toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  function abrir(titulo, enviar, opciones) {
    var soloCamara = !!(opciones && opciones.soloCamara);
    var fondo = document.createElement('div');
    fondo.className = 'modal-bg';
    fondo.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><h3 class="titulo" style="font-size:26px;margin:0 0 8px">' + E(titulo) + '</h3>' +
      '<video id="esc-v" playsinline muted style="width:100%;max-height:44vh;background:#000;border-radius:12px;display:none"></video>' +
      '<p class="suave" id="esc-aviso" style="font-size:13.5px;margin:8px 0"></p>' +
      '<div id="esc-res" role="status" aria-live="polite" style="font-weight:700;margin:6px 0;min-height:22px"></div>' +
      (soloCamara ? '' : '<label class="campo">Código (si la cámara no lo lee)<input id="esc-c" maxlength="12" autocapitalize="characters" autocomplete="off" placeholder="Ej. K7M2QX9A"></label>') +
      '<div style="display:flex;gap:8px;margin-top:8px">' + (soloCamara ? '' : '<button class="btn btn-p" id="esc-ok" style="flex:1">Confirmar código</button>') + '<button class="btn btn-s" id="esc-x" style="flex:1">Cerrar</button></div></div>';
    document.body.appendChild(fondo);
    var q = function (i) { return fondo.querySelector('#' + i); };
    var flujo = null, activo = true, ocupado = false, ultimo = '', ts = 0;

    function resultado(r) {
      var el = q('esc-res'); el.textContent = r.texto || ''; el.style.color = r.ok ? 'var(--ok,#1a7f37)' : 'var(--err,#b3261e)';
      if (r.ok && w.navigator.vibrate) w.navigator.vibrate(80);
    }
    function mandar(codigo) {
      if (ocupado || !codigo) return;
      ocupado = true;
      enviar(codigo).then(function (r) { resultado(r); if (r.ok) q('esc-c').value = ''; }).then(function () { ocupado = false; });
    }
    function cerrar() { activo = false; if (flujo) flujo.getTracks().forEach(function (t) { t.stop(); }); fondo.remove(); }
    q('esc-x').onclick = cerrar;
    if (!soloCamara) {
      q('esc-ok').onclick = function () { mandar(limpiar(q('esc-c').value)); };
      q('esc-c').addEventListener('keydown', function (e) { if (e.key === 'Enter') q('esc-ok').click(); });
    }

    if (!('BarcodeDetector' in w) || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      q('esc-aviso').textContent = soloCamara ? 'Este teléfono no permite leer QR con la cámara.' : 'Este navegador no lee QR con la cámara. Escribe el código que aparece bajo el QR.';
      return;
    }
    var det = new w.BarcodeDetector({ formats: ['qr_code'] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (f) {
      if (!activo) { f.getTracks().forEach(function (t) { t.stop(); }); return; }
      flujo = f; var v = q('esc-v'); v.srcObject = f; v.style.display = 'block'; v.play();
      q('esc-aviso').textContent = 'Apunta la cámara al QR.';
      (function ciclo() {
        if (!activo) return;
        det.detect(v).then(function (cs) {
          if (cs.length) { var c = limpiar(cs[0].rawValue); if (c && (c !== ultimo || Date.now() - ts > 4000)) { ultimo = c; ts = Date.now(); mandar(c); } }
        }).catch(function () { /* cuadro sin imagen todavía */ }).then(function () { setTimeout(ciclo, 250); });
      })();
    }).catch(function () { q('esc-aviso').textContent = soloCamara ? 'No se pudo usar la cámara. Revisa el permiso de cámara de la app.' : 'No se pudo usar la cámara (permiso o dispositivo). Escribe el código a mano.'; });
  }
  w.LNEscaner = { abrir: abrir };
})(window);
