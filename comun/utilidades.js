/* La Nonna — utilidades comunes (formato de dinero, escape de HTML, avisos, sonido, arte de respaldo). */
(function (w) {
  var clp = function (n) { return '$' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIAS_L = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  /* fecha 'YYYY-MM-DD' → partes sin depender de la zona horaria del dispositivo */
  function partes(f) { var p = String(f).split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2])); return { y: p[0], m: p[1], d: p[2], dow: d.getUTCDay() }; }
  function fechaLarga(f) { var p = partes(f); return DIAS_L[p.dow] + ' ' + p.d + ' de ' + MESES[p.m - 1]; }
  function fechaCorta(f) { var p = partes(f); return DIAS[p.dow] + ' ' + p.d + '/' + p.m; }
  function sumarDias(f, n) { var p = partes(f); return new Date(Date.UTC(p.y, p.m - 1, p.d + n)).toISOString().slice(0, 10); }
  function toast(txt) {
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = txt;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }
  function beep() {
    try { var A = w.AudioContext || w.webkitAudioContext, a = new A(), o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.25); } catch (e) { /* sin audio */ }
  }
  var TONOS = [['#8B5A2B', '#D9A441'], ['#B23A2B', '#E9A055'], ['#E8C77A', '#C9803A'], ['#B8662A', '#E3C089'], ['#C9793A', '#F2D27C'], ['#7A8F3A', '#D77B3A'], ['#5B8F3A', '#D9453A'], ['#E0802A', '#F5C04A']];
  /* Ilustración de respaldo para platos sin foto (no es el plato real: es solo un marcador). */
  function platoArte(id, tam) {
    var c = TONOS[Math.abs(id) % TONOS.length], g = 'g' + Math.abs(id);
    return '<svg viewBox="0 0 120 120" width="' + tam + '" height="' + tam + '" aria-hidden="true"><defs><radialGradient id="' + g + '" cx=".35" cy=".3"><stop offset="0" stop-color="' + c[1] + '"/><stop offset="1" stop-color="' + c[0] + '"/></radialGradient></defs>' +
      '<circle cx="60" cy="60" r="56" fill="#fff" stroke="#E3E7EF" stroke-width="2"/><circle cx="60" cy="60" r="44" fill="#F4F6FA"/>' +
      '<path d="M32 62c0-16 14-28 30-26 14 2 24 12 22 26-2 14-14 22-28 20-14-2-24-8-24-20z" fill="url(#' + g + ')"/>' +
      '<circle cx="82" cy="40" r="9" fill="' + c[1] + '" opacity=".9"/><circle cx="40" cy="84" r="6" fill="' + c[0] + '" opacity=".8"/></svg>';
  }
  function logo(alto, soloCirculos) {
    var f = soloCirculos ? 'logo-circulos.webp' : 'logo-la-nonna.webp', ratio = soloCirculos ? 848 / 304 : 848 / 529;
    return '<img src="' + (w.LN_RUTA_IMG || '../img/') + f + '" alt="La Nonna" height="' + alto + '" width="' + Math.round(alto * ratio) + '" style="display:block;height:' + alto + 'px;width:auto">';
  }
  function copiar(txt) {
    try { if (navigator.clipboard) return navigator.clipboard.writeText(txt).then(function () { return true; }, function () { return false; }); } catch (e) { /* sigue */ }
    return Promise.resolve(false);
  }
  /* Zonas posibles de un local; el dueño elige cuáles tiene (Admin ☰ → Mesas). */
  var ZONAS = ['comedor', 'patio', 'piso1', 'piso2'], ZONA_NOM = { comedor: 'Comedor', patio: 'Patio', piso1: 'Primer piso', piso2: 'Segundo piso' };
  function zonaNombre(z) { return ZONA_NOM[z] || 'Comedor'; }
  /* Duraciones siempre en minutos y horas: 45 min · 2 h · 6 h 30 min (nunca "390 min"). */
  function duracion(min) {
    var v = Number(min) || 0; if (v < 60) return (Math.round(v) === v ? v : String(Math.round(v * 10) / 10).replace('.', ',')) + ' min';
    var m = Math.round(v), h = Math.floor(m / 60), r = m % 60; return h + ' h' + (r ? ' ' + r + ' min' : '');
  }
  /* Elecciones de un plato (las define el dueño): una línea por grupo, "Entrada: Ensalada, Consomé". Se elige una por unidad pedida. */
  function parseVar(t) {
    return String(t || '').split('\n').map(function (l) { var i = l.indexOf(':'); if (i < 1) return null; var o = l.slice(i + 1).split(',').map(function (x) { return x.trim(); }).filter(Boolean); return o.length ? { n: l.slice(0, i).trim(), o: o } : null; }).filter(Boolean);
  }
  function varHtml(p, c, vars) {
    var g = parseVar(p.variantes); if (!g.length || !c) return '';
    var s = '<div class="vars">';
    for (var u = 0; u < c; u++) {
      s += '<div class="vu">' + (c > 1 ? '<b>Menú ' + (u + 1) + '</b>' : '') + g.map(function (gr, gi) {
        var sel = ((vars || [])[u] || [])[gi] || 0;
        return '<label>' + esc(gr.n) + '<select data-var="' + p.id + '|' + u + '|' + gi + '">' + gr.o.map(function (o, oi) { return '<option value="' + oi + '"' + (oi === sel ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>';
      }).join('') + '</div>';
    }
    return s + '</div>';
  }
  function varNota(p, c, vars) {
    var g = parseVar(p.variantes); if (!g.length) return '';
    var out = [];
    for (var u = 0; u < c; u++) out.push((c > 1 ? (u + 1) + ') ' : '') + g.map(function (gr, gi) { return gr.n + ': ' + gr.o[((vars || [])[u] || [])[gi] || 0]; }).join(' · '));
    return out.join(' | ');
  }
  /* Guarda una elección en el mapa vars[platoId][unidad][grupo] a partir del valor "plato|unidad|grupo". */
  function varSet(mapa, clave, valor) { var k = clave.split('|'); var a = (mapa[k[0]] = mapa[k[0]] || []); a[+k[1]] = a[+k[1]] || []; a[+k[1]][+k[2]] = +valor; }
  w.U = { parseVar: parseVar, varHtml: varHtml, varNota: varNota, varSet: varSet, duracion: duracion, ZONAS: ZONAS, zonaNombre: zonaNombre, clp: clp, esc: esc, fechaLarga: fechaLarga, fechaCorta: fechaCorta, sumarDias: sumarDias, partes: partes, toast: toast, beep: beep, platoArte: platoArte, logo: logo, copiar: copiar, MESES: MESES };
})(window);
