/* La Nonna — vista 360° de un plato por secuencia de cuadros.
   - extraerCuadros(video): en el teléfono del dueño convierte un video en ~24-32 cuadros nítidos (JPEG 720 px). No se sube el video.
   - crearVisor(contenedor, giro): en el cliente, visor que gira al arrastrar (o con las flechas) y gira solo cuando nadie lo toca.
   Es una órbita horizontal hecha con fotos en secuencia, no un modelo 3D. */
(function (w) {
  function irA(v, t) {
    return new Promise(function (ok) {
      var f = function () { v.removeEventListener('seeked', f); ok(); };
      v.addEventListener('seeked', f); v.currentTime = t; setTimeout(f, 2500);   // si el navegador no avisa, no se cuelga
    });
  }
  function aBlob(canvas, calidad) {
    return new Promise(function (ok, mal) { canvas.toBlob(function (b) { b ? ok(b) : mal(new Error('No se pudo comprimir un cuadro.')); }, 'image/jpeg', calidad); });
  }
  /* Nitidez = varianza del laplaciano sobre una copia chica en gris (más alto = más nítido): sirve para descartar cuadros movidos. */
  function nitidez(ctx, ancho, alto) {
    var d = ctx.getImageData(0, 0, ancho, alto).data, g = new Float32Array(ancho * alto), i, x, y;
    for (i = 0; i < ancho * alto; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    var s = 0, s2 = 0, n = 0;
    for (y = 1; y < alto - 1; y++) for (x = 1; x < ancho - 1; x++) {
      i = y * ancho + x; var l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - ancho] - g[i + ancho];
      s += l; s2 += l * l; n++;
    }
    var m = s / n; return s2 / n - m * m;
  }

  function extraerCuadros(archivo, o) {
    o = Object.assign({ candidatos: 32, descartar: 8, lado: 720, calidad: 0.78, alProgreso: function () {} }, o || {});
    return new Promise(function (ok, mal) {
      var url = URL.createObjectURL(archivo), v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      var fin = function () { URL.revokeObjectURL(url); };
      v.onerror = function () { fin(); mal(new Error('No se pudo leer el video. Prueba grabarlo de nuevo.')); };
      v.onloadedmetadata = function () {
        var arrancar = function () {
          if (!(v.duration >= 2)) { fin(); mal(new Error('El video es muy corto: graba entre 6 y 12 segundos.')); return; }
          procesar().then(function (r) { fin(); ok(r); }, function (e) { fin(); mal(e); });
        };
        if (!isFinite(v.duration)) {            // algunas grabaciones no traen la duración: se fuerza al final y se vuelve al inicio
          v.ontimeupdate = function () { v.ontimeupdate = null; irA(v, 0).then(arrancar); };
          v.currentTime = 1e101;
        } else arrancar();
      };
      async function procesar() {
        var dur = v.duration, t0 = dur * 0.05, t1 = dur * 0.95, W = v.videoWidth, H = v.videoHeight;
        if (!W || !H) throw new Error('El video no tiene imagen.');
        var esc = Math.min(1, o.lado / Math.max(W, H)), cw = Math.round(W * esc), ch = Math.round(H * esc);
        var grande = document.createElement('canvas'); grande.width = cw; grande.height = ch;
        var gx = grande.getContext('2d'), chico = document.createElement('canvas'); chico.width = 120; chico.height = Math.max(8, Math.round(120 * H / W));
        var cx = chico.getContext('2d', { willReadFrequently: true }), cand = [];
        for (var i = 0; i < o.candidatos; i++) {
          await irA(v, t0 + (t1 - t0) * i / (o.candidatos - 1));
          gx.drawImage(v, 0, 0, cw, ch); cx.drawImage(v, 0, 0, chico.width, chico.height);
          cand.push({ i: i, nit: nitidez(cx, chico.width, chico.height), blob: await aBlob(grande, o.calidad) });
          o.alProgreso(i + 1, o.candidatos);
        }
        // Se descartan los más movidos, pero nunca dos seguidos: así el giro no da saltos.
        var caidos = {}, cuantos = 0;
        cand.slice().sort(function (a, b) { return a.nit - b.nit; }).forEach(function (c) {
          if (cuantos >= o.descartar) return;
          if (caidos[c.i - 1] || caidos[c.i + 1] || c.i === 0 || c.i === o.candidatos - 1) return;
          caidos[c.i] = true; cuantos++;
        });
        return cand.filter(function (c) { return !caidos[c.i]; }).map(function (c) { return c.blob; });
      }
    });
  }

  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  /* giro = { n, ruta, ext } como lo entrega la API; base = LN_API_BASE ('' en web). */
  function crearVisor(cont, giro, base) {
    base = base || '';
    var n = giro.n, actual = 0, cargadas = 0, arrastrando = false, x0 = 0, inactivo = 0, timer = null;
    var urls = []; for (var k = 0; k < n; k++) urls.push(base + '/' + giro.ruta + pad2(k) + '.' + giro.ext);
    cont.innerHTML = '<div class="giro-visor" tabindex="0" role="img" aria-label="Vista 360° del plato. Arrastra o usa las flechas del teclado para girar."><img alt="" draggable="false"><div class="giro-ayuda" aria-hidden="true">Cargando…</div></div>';
    var caja = cont.firstChild, img = caja.querySelector('img'), ayuda = caja.querySelector('.giro-ayuda');
    var reducir = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function mostrar(i) { actual = ((i % n) + n) % n; img.src = urls[actual]; }
    urls.forEach(function (u) {                            // se precargan todos para que el giro sea fluido
      var p = new Image();
      p.onload = p.onerror = function () { cargadas++; if (cargadas === n) ayuda.textContent = 'Arrastra para girar'; else ayuda.textContent = 'Cargando… ' + Math.round(cargadas / n * 100) + '%'; };
      p.src = u;
    });
    img.onload = function () { if (img.naturalWidth) caja.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight; };
    mostrar(0);
    caja.addEventListener('pointerdown', function (e) { arrastrando = true; x0 = e.clientX; inactivo = 0; try { caja.setPointerCapture(e.pointerId); } catch (x) { /* sin captura */ } });
    caja.addEventListener('pointermove', function (e) {
      if (!arrastrando) return;
      var paso = Math.max(4, caja.clientWidth / n), dx = e.clientX - x0;
      if (Math.abs(dx) >= paso) { var k2 = Math.trunc(dx / paso); mostrar(actual - k2); x0 += k2 * paso; ayuda.style.opacity = 0; }
    });
    var soltar = function () { arrastrando = false; inactivo = 0; };
    caja.addEventListener('pointerup', soltar); caja.addEventListener('pointercancel', soltar);
    caja.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') { mostrar(actual + 1); inactivo = 0; e.preventDefault(); } if (e.key === 'ArrowRight') { mostrar(actual - 1); inactivo = 0; e.preventDefault(); } });
    if (!reducir) timer = setInterval(function () {        // gira solo cuando nadie lo toca (y 2,5 s después de soltarlo)
      if (arrastrando || cargadas < n) return;
      if (inactivo < 28) { inactivo++; return; }
      mostrar(actual - 1);
    }, 90);
    return { destruir: function () { clearInterval(timer); cont.innerHTML = ''; } };
  }
  w.LNGiro = { extraerCuadros: extraerCuadros, crearVisor: crearVisor };
})(window);
