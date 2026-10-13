/* Pantalla compartida: el token viaja en el fragmento de la URL (#t=...), nunca en la ruta, y se manda por cabecera.
   El servidor decide qué datos y qué botones corresponden al paso del enlace; aquí solo se muestra.
   Pasos: 1 solicitados, 2 cocina (delivery y mesas), 3 despacho/retiro, 5 repartidor. El 4 (mesas) vive en ../mozo/. */
(function () {
  var L = window.LN, U = window.U, E = U.esc, $ = function (i) { return document.getElementById(i); };
  var TOKEN = '';                                                            // token de ESTE dispositivo (QR del día + nombre), ver comun/equipo.js
  var GRANDE = { 1: ['PEDIDOS SOLICITADOS', 'Paso 1 · cola de entrada'], 2: ['COCINA', 'Paso 2 · preparación'], 3: ['DESPACHO DELIVERY', 'Paso 3 · retiro en local y salida de envíos'], 5: ['REPARTIDOR DELIVERY', 'Lleva los pedidos y confirma la entrega con el QR del cliente'] };
  var NOMBRE = { 1: 'Paso 1 · Solicitados', 2: 'Paso 2 · Cocina', 3: 'Paso 3 · Despacho o retiro', 5: 'Repartidor' };
  var datos = null, mute = false, previo = -1, estadoRed = '', timer = null;
  var filtro = L.leerLocal('ln_cocina_filtro', 'ambos');                     // cocina: delivery / mesas / ambos
  var persona = '';


  function mins(iso) { return iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000)) : 0; }
  function visible(p) { return datos.paso !== 2 || filtro === 'ambos' || (filtro === 'mesas') === (p.origen === 'mesa'); }
  function etiqueta(p) {
    if (p.origen === 'mesa') return '<span class="pill pill-n">🍽 Mesa ' + p.mesa.numero + ' · ' + U.zonaNombre(p.mesa.zona) + '</span>';
    return '<span class="pill ' + (p.tipo === 'domicilio' ? 'pill-n' : 'pill-g') + '">' + (p.tipo === 'domicilio' ? '🛵 Despacho' : '🛍 Retiro') + '</span>';
  }
  function tarjeta(p, boton) {
    var ref = p.cocina_en && datos.paso === 2 && datos.en_cocina && datos.en_cocina.indexOf(p) >= 0 ? p.cocina_en : (datos.paso >= 3 ? p.listo_en : p.solicitado_en), mi = mins(ref), cls = mi < 5 ? 'v' : mi < 10 ? 'a' : 'r';
    var s = '<article class="t"><div class="cab"><span class="num">#' + p.numero + '</span>' + etiqueta(p) + '<span class="min ' + cls + '">' + mi + ' min</span></div>' + (p.mozo && datos.paso === 2 ? '<div class="suave" style="font-size:14px;margin:-4px 0 6px">Tomó: ' + E(p.mozo) + '</div>' : '') + '<ul>';
    p.items.forEach(function (i) { s += '<li>' + i.cantidad + ' × ' + E(i.nombre) + '</li>' + (i.nota ? '<div class="nota">Nota: ' + E(i.nota) + '</div>' : ''); });
    s += '</ul>' + (p.notas ? '<div class="nota">Pedido: ' + E(p.notas) + '</div>' : '');
    if (datos.paso >= 3) s += '<div class="dat"><b>' + E(p.nombre_cliente) + '</b> · ' + E(p.telefono) + (p.tipo === 'domicilio' ? '<br>' + E(p.direccion) + (p.referencia ? ' (' + E(p.referencia) + ')' : '') : '<br>Retira en el local') + '<br><b>' + U.clp(p.total) + '</b></div>';
    if (datos.paso === 3 && p.tipo === 'domicilio') {
      s += p.en_ruta ? '<div class="nota">🛵 En ruta con ' + E(p.ruta_por) + '</div>' : '<div class="rotulo"><div data-qr="' + E(p.codigo_ruta) + '"></div><small>Rótulo de salida · el repartidor lo escanea<br><b>' + E(p.codigo_ruta) + '</b></small></div>';
    }
    if (boton && datos.puede_mover) s += '<button class="btn btn-p" data-id="' + E(p.id) + '" data-a="' + boton[0] + '">' + boton[1] + '</button>';
    return s + '</article>';
  }
  function grupo(titulo, lista, boton) {
    lista = lista.filter(visible);
    return '<section class="grupo"><h2>' + E(titulo) + ' (' + lista.length + ')</h2>' + (lista.length ? '<div class="lista">' + lista.map(function (p) { return tarjeta(p, boton); }).join('') + '</div>' : '<div class="vacio-p">Sin pedidos.</div>') + '</section>';
  }
  function mapa(ms) {
    if (!ms || !ms.length) return '';
    var NOMC = { verde: 'Libre', naranjo: 'Esperando / atendido', rojo: 'Demorada', lila: 'Comiendo', azul: 'Pagó · por limpiar' };
    return '<section class="grupo"><h2>Mapa de mesas</h2><div class="mapa-ley">' + ['verde', 'naranjo', 'rojo', 'lila', 'azul'].map(function (k) { return '<span class="mm-' + k + '">' + NOMC[k] + '</span>'; }).join('') + '</div>' +
      U.ZONAS.map(function (z) {
        var xs = ms.filter(function (m) { return m.zona === z; }); if (!xs.length) return '';
        return '<h2 style="margin-top:12px">' + U.zonaNombre(z) + '</h2><div class="mapa-m">' + xs.map(function (m) { return '<div class="mm mm-' + m.color + '" title="' + E(m.motivo || m.fase_texto || NOMC[m.color]) + '"><b>' + m.numero + '</b><small>' + (m.color === 'verde' ? 'libre' : m.color === 'azul' ? 'por limpiar · ' + m.minutos + ' min' : (m.fase_corta || '') + ' · ' + m.minutos + ' min') + (m.personas > 1 ? ' · 👥' + m.personas : '') + '</small></div>'; }).join('') + '</div>';
      }).join('') + '</section>';
  }

  function pintar() {
    if (!datos) return;
    var cuerpo = '', n = function (a) { return (a || []).filter(visible).length; }, CONT, extra = '';
    if (datos.paso === 1) { cuerpo = grupo('En cola', datos.solicitados, null); CONT = [['En cola', n(datos.solicitados)]]; }
    else if (datos.paso === 2) {
      cuerpo = grupo('Por empezar', datos.solicitados, ['en_cocina', 'Empezar']) + grupo('En cocina', datos.en_cocina, ['listo', 'Listo']) + (filtro !== 'delivery' ? mapa(datos.mapa) : '');
      CONT = [['Por empezar', n(datos.solicitados)], ['En cocina', n(datos.en_cocina)]];
      extra = '<div class="p-filtro" role="group" aria-label="Qué pedidos ver">' + [['delivery', '🛵 Delivery'], ['mesas', '🍽 Mesas'], ['ambos', 'Ambos']].map(function (f) { return '<button data-f="' + f[0] + '" aria-pressed="' + (filtro === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>';
    } else if (datos.paso === 3) {
      cuerpo = grupo('Listos para entregar', datos.listos, null);
      CONT = [['Listos para entregar', n(datos.listos)]];
      extra = '<div class="p-filtro"><button id="escanear" class="grande">📷 Escanear QR del cliente (retiro)</button></div>';
      cuerpo = cuerpo.replace(/<button class="btn btn-p" data-id="[^"]*" data-a="entregado">Entregado<\/button>/g, '');
    } else {
      cuerpo = grupo('Para llevar', datos.para_llevar, null) + grupo('En ruta', datos.en_ruta, null);
      CONT = [['Para llevar', n(datos.para_llevar)], ['En ruta', n(datos.en_ruta)]];
      extra = '<div class="p-filtro"><button id="llevar" class="grande">📷 Escanear rótulo: me lo llevo</button><button id="entregar" class="grande">✅ Escanear QR del cliente: entregado</button></div>';
    }
    var cont = '<div class="p-cont">' + CONT.map(function (c) { return '<div class="c"><b>' + c[1] + '</b><span>' + c[0] + '</span></div>'; }).join('') + '</div>';
    var y = window.scrollY, foco = document.activeElement && document.activeElement.id === 'persona';
    $('raiz').innerHTML = '<header class="p-top" id="top"><div style="background:#fff;border-radius:10px;padding:4px 8px">' + U.logo(34, true) + '</div><h1 class="titulo">' + NOMBRE[datos.paso] + '</h1>' + (estadoRed ? '<span class="pill pill-err">' + E(estadoRed) + '</span>' : '') + '<span class="reloj" id="reloj"></span><button id="turno" title="Cerrar mi turno en este dispositivo">👤 ' + E(persona) + '</button><button id="mut" aria-pressed="' + mute + '">' + '<span class="ic">' + (mute ? '🔇' : '🔊') + '</span><span class="tx"> ' + (mute ? 'Sonido silenciado' : 'Sonido activo') + '</span>' + '</button></header><div class="p-titulo"><div class="gr">' + GRANDE[datos.paso][0] + '</div><div class="sub">' + GRANDE[datos.paso][1] + '</div></div>' + cont + extra + '<main class="p-body">' + cuerpo + '</main>';
    if (window.qrcode) Array.prototype.forEach.call(document.querySelectorAll('[data-qr]'), function (el) {
      var q = window.qrcode(0, 'M'); q.addData(el.dataset.qr); q.make(); el.innerHTML = q.createImgTag(4, 4);
    });
    window.scrollTo(0, y); reloj();
    if (foco && $('persona')) $('persona').focus();
    $('mut').onclick = function () { mute = !mute; pintar(); };
  }
  function reloj() { var r = $('reloj'); if (r) r.textContent = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  function cargar() {
    L.api('/api/pantalla', { pantalla: TOKEN }).then(function (r) {
      if (r.status === 403) { clearInterval(timer); window.LNEquipo.olvidar(arrancar); return; }
      if (!r.ok) { estadoRed = r.status === 0 ? 'Sin conexión' : 'Error del servidor'; pintar(); return; }
      if (r.data.paso === 4) { location.replace('../mozo/index.html'); return; }
      estadoRed = '';
      var cola = (r.data.solicitados || r.data.listos || r.data.para_llevar || []).length;
      if (datos && previo >= 0 && cola > previo && !mute) { U.beep(); var t = $('top'); if (t) t.classList.add('flash'); }
      previo = cola; datos = r.data;
      if (!(document.activeElement && document.activeElement.id === 'persona')) pintar();
    });
  }
  function pedirNombre() { return true; }                                      // el nombre ya viene del dispositivo activado
  function escaneo(titulo, ruta, ok) {
    window.LNEscaner.abrir(titulo, function (codigo) {
      return L.api(ruta, { metodo: 'POST', pantalla: TOKEN, cuerpo: { codigo: codigo, persona: persona } }).then(function (r) {
        if (r.ok) cargar();
        return { ok: r.ok, texto: r.ok ? ok(r.data) : r.error };
      });
    });
  }
  function arrancar(eq) { window.LNEquipo.marcaDeAgua(eq.persona); TOKEN = eq.token; persona = eq.persona; datos = null; previo = -1; clearInterval(timer); cargar(); timer = setInterval(cargar, 5000); }
  document.addEventListener('click', function (e) {
    if (e.target.closest('#turno')) { if (window.confirm('¿Cerrar tu turno en este dispositivo? Para volver a entrar hay que escanear el QR del día.')) { clearInterval(timer); window.LNEquipo.olvidar(arrancar); } return; }
    var f = e.target.closest('button[data-f]');
    if (f) { filtro = f.dataset.f; L.guardarLocal('ln_cocina_filtro', filtro); pintar(); return; }
    if (e.target.closest('#escanear')) { escaneo('Retiro en local', '/api/pantalla/escanear', function (d) { return '✓ Pedido #' + d.numero + ' entregado a ' + d.nombre; }); return; }
    if (e.target.closest('#llevar')) { if (pedirNombre()) escaneo('Me llevo el pedido', '/api/pantalla/ruta-tomar', function (d) { return '✓ Pedido #' + d.numero + ' · ' + d.direccion; }); return; }
    if (e.target.closest('#entregar')) { if (pedirNombre()) escaneo('Confirmar entrega', '/api/pantalla/escanear', function (d) { return '✓ Pedido #' + d.numero + ' entregado a ' + d.nombre; }); return; }
    var b = e.target.closest('button[data-a]'); if (!b) return;
    b.disabled = true;
    L.api('/api/pantalla/transicion', { metodo: 'POST', pantalla: TOKEN, cuerpo: { pedido_id: b.dataset.id, a: b.dataset.a } }).then(function (r) {
      if (!r.ok) U.toast(r.error);
      cargar();
    });
  });
  setInterval(reloj, 15000);
  window.LNEquipo.iniciar(arrancar);
})();
