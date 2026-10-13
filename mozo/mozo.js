/* Atención en mesas (paso 4). Cualquier mozo puede tomar, servir o cobrar: cada acción lleva el nombre de quien la hace.
   El servidor decide todo (precios, cupos, permisos); aquí solo se muestra. Alerta con sonido y vibración cuando un pedido queda listo. */
(function () {
  var L = window.LN, U = window.U, E = U.esc, $ = function (i) { return document.getElementById(i); };
  var TOKEN = '';                                                            // token de ESTE dispositivo (QR del día + nombre), ver comun/equipo.js
  var selCobro = {};
  var D = null, tab = L.leerLocal('ln_mozo_tab', 'mesas'), mesa = 0, carrito = {}, varsM = {}, notas = '', cobrando = '', mute = false, listos = null, aviso = '', red = '';
  var persona = '';
  var ETQ = { solicitado: 'En cola', en_cocina: 'En cocina', listo: 'LISTO · llévalo', entregado: 'Servido' };

  function total() { var t = 0; (D.menu || []).forEach(function (p) { t += (carrito[p.id] || 0) * p.precio; }); return t; }
  function cuantos() { var n = 0; Object.keys(carrito).forEach(function (k) { n += carrito[k]; }); return n; }
  function nombreOk() { return true; }                                        // el nombre ya viene del dispositivo activado
  function etiquetaMesa(x) { return 'Mesa ' + x.mesa.numero + ' · ' + U.zonaNombre(x.mesa.zona); }

  function vMesas() {
    var s = '';
    U.ZONAS.forEach(function (z) {
      var ms = D.mesas.filter(function (x) { return x.zona === z; });
      if (!ms.length) return;
      s += '<div class="m-zona">' + U.zonaNombre(z) + '</div><div class="m-mesas">' + ms.map(function (x) {
        var ps = D.pedidos.filter(function (p) { return p.mesa && p.mesa.numero === x.numero; }), hay = ps.length, lista = ps.some(function (p) { return p.estado === 'listo'; }), esp = D.esperando.indexOf(x.id) >= 0;
        var mp = (D.mapa || []).filter(function (q) { return q.id === x.id; })[0] || { color: 'verde', minutos: 0 };
        return '<button data-mesa="' + x.id + '" class="mm mm-' + mp.color + '" aria-pressed="' + (mesa === x.id) + '">' + x.numero + '<small>' + (mp.color === 'azul' ? 'por limpiar' : mp.color === 'verde' ? 'libre' : mp.fase_corta) + (mp.color !== 'verde' ? ' · ' + U.duracion(mp.minutos) : '') + (mp.personas > 1 ? ' · 👥' + mp.personas : '') + '</small></button>';
      }).join('') + '</div>';
    });
    if (!D.mesas.length) return '<div class="m-vacio">El local aún no cargó las mesas. Se hace en Admin → Configuración.</div>';
    if (!mesa) return s + '<p class="m-vacio">Toca una mesa para tomar su pedido.</p>';
    var mm = D.mesas.filter(function (x) { return x.id === mesa; })[0];
    var espM = D.esperando.indexOf(mesa) >= 0, mpS = (D.mapa || []).filter(function (q) { return q.id === mesa; })[0];
    if (mpS && mpS.color === 'azul') s += '<div class="m-acc" style="margin-top:14px"><button class="m-btn" data-limpia="1">🧽 Mesa limpia: queda disponible</button></div>';
    s += '<div class="m-acc" style="margin-top:14px">' + (espM ? '<button class="m-btn sec" data-liberar="1">Se fue sin pedir: liberar mesa</button><button class="m-btn sec" data-llegada="anular">Anular llegada (mesa equivocada)</button>' : '<button class="m-btn sec" data-llegada="1">🪑 Llegó cliente a la mesa</button>') + '</div>';
    s += '<div class="card-m" style="margin-top:14px"><h3>Pedido · Mesa ' + mm.numero + ' (' + U.zonaNombre(mm.zona) + ')</h3>';
    if (!D.menu.length) s += '<div class="suave">Hoy no hay platos habilitados en el menú.</div>';
    D.menu.forEach(function (p) {
      var c = carrito[p.id] || 0, agotado = p.disponibles !== null && p.disponibles <= 0;
      s += '<div class="m-plato"><div><div class="n">' + E(p.nombre) + '</div><div class="p">' + U.clp(p.precio) + (p.disponibles !== null ? ' · quedan ' + p.disponibles : '') + '</div></div><div class="m-cant"><button data-q="-1" data-p="' + p.id + '" aria-label="Quitar">−</button><b>' + c + '</b><button data-q="1" data-p="' + p.id + '"' + (agotado ? ' disabled' : '') + ' aria-label="Agregar">+</button></div></div>' + (c ? U.varHtml(p, c, varsM[p.id]) : '');
    });
    s += '<label class="campo" style="margin-top:10px">Nota para cocina (opcional)<input id="notas" maxlength="300" value="' + E(notas) + '" placeholder="Sin cebolla, alergias…"></label></div>';
    return s;
  }
  function vPedidos() {
    if (!D.pedidos.length) return '<div class="m-vacio">No hay pedidos de mesa abiertos.</div>';
    return D.pedidos.map(function (p) {
      var s = '<div class="card-m"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h3 style="margin:0">#' + p.numero + ' · ' + E(etiquetaMesa(p)) + '</h3><span class="m-estado ' + p.estado + '">' + ETQ[p.estado] + '</span></div>';
      s += '<div class="suave" style="font-size:13px;margin:4px 0">Tomó: ' + E(p.mozo || '') + (p.mozo_entrega ? ' · Sirvió: ' + E(p.mozo_entrega) : '') + '</div><ul style="margin:6px 0;padding-left:20px">' + p.items.map(function (i) { return '<li>' + i.cantidad + ' × ' + E(i.nombre) + (i.nota ? ' <i>(' + E(i.nota) + ')</i>' : '') + '</li>'; }).join('') + '</ul>';
      s += '<b>' + U.clp(p.total) + '</b> ' + (p.pagado ? '<span class="m-estado listo">Pagado · ' + E(p.cobrado_por) + ' · ' + E(p.cobro_medio) + '</span>' : '<span class="m-estado">Por cobrar</span>');
      s += '<div class="m-acc">';
      if (p.estado === 'listo') s += '<button class="m-btn" data-servir="' + E(p.id) + '">Llevado a la mesa</button>';
      if (!p.pagado) s += '<button class="m-btn sec" data-cobrar="' + E(p.id) + '">Cobrar</button>';
      s += '</div>';
      if (cobrando === p.id) {
        var pend = (p.cuenta || []).filter(function (i) { return i.pendientes > 0; }), tsel = 0;
        s += '<div class="m-cobro"><div class="suave" style="font-size:13px;margin:8px 0 4px">¿Pagan por separado? Marca lo que paga esta persona (si no marcas nada, se cobra todo lo pendiente).</div>';
        pend.forEach(function (i) { var q = selCobro[i.item_id] || 0; tsel += q * i.precio;
          s += '<div class="m-plato"><div><div class="n">' + E(i.nombre) + '</div><div class="p">' + i.pendientes + ' por cobrar · ' + U.clp(i.precio) + ' c/u</div></div><div class="m-cant"><button data-sq="-1" data-si="' + i.item_id + '" data-smax="' + i.pendientes + '">−</button><b>' + q + '</b><button data-sq="1" data-si="' + i.item_id + '" data-smax="' + i.pendientes + '">+</button></div></div>'; });
        var resto = pend.reduce(function (a, i) { return a + i.pendientes * i.precio; }, 0);
        s += '<div style="font-weight:800;margin:6px 0">' + (tsel ? 'Cobrar lo marcado: ' + U.clp(tsel) : 'Cobrar todo lo pendiente: ' + U.clp(resto)) + '</div>';
        s += '<div class="m-medios">' + D.medios.map(function (md) { return '<button data-medio="' + md + '" data-id="' + E(p.id) + '">' + { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta (posnet)', transferencia: '🏦 Transferencia' }[md] + '</button>'; }).join('') + '</div></div>';
      }
      return s + '</div>';
    }).join('');
  }
  function pintar() {
    if (!D) return;
    var foco = document.activeElement && (document.activeElement.id === 'persona' || document.activeElement.id === 'notas') ? document.activeElement.id : '';
    var y = window.scrollY;
    var nListos = D.pedidos.filter(function (p) { return p.estado === 'listo'; }).length;
    var s = '<header class="m-top"><div style="background:#fff;border-radius:10px;padding:4px 8px">' + U.logo(30, true) + '</div><h1 class="titulo">Atención en mesas</h1>' + (red ? '<span class="pill pill-err">' + E(red) + '</span>' : '') + '<button id="turno" title="Cerrar mi turno en este dispositivo">👤 ' + E(persona) + '</button><button id="escanear" aria-label="Escanear QR del cliente">📷</button><button id="mut" aria-pressed="' + mute + '" aria-label="Sonido">' + (mute ? '🔇' : '🔊') + '</button></header>';
    s += '<div class="m-banda"><b>ATENCIÓN MESAS</b><span>Toma pedidos, sirve y cobra en la mesa</span></div>';
    if (aviso) s += '<div class="m-alerta" role="alert">🔔 ' + E(aviso) + '</div>';
    s += '<div class="m-body">';
    s += '<div class="m-tabs"><button data-tab="mesas" aria-pressed="' + (tab === 'mesas') + '">Mesas</button><button data-tab="pedidos" aria-pressed="' + (tab === 'pedidos') + '">Pedidos (' + D.pedidos.length + ')' + (nListos ? ' · ' + nListos + ' listo' + (nListos > 1 ? 's' : '') : '') + '</button></div>';
    s += tab === 'mesas' ? vMesas() : vPedidos();
    s += '</div>';
    if (tab === 'mesas' && mesa) s += '<div class="m-barra"><div class="tot">' + U.clp(total()) + '<small>' + cuantos() + ' plato(s)</small></div><button class="m-btn" id="enviar"' + (cuantos() ? '' : ' disabled') + '>Enviar a cocina</button></div>';
    $('raiz').innerHTML = s;
    window.scrollTo(0, y);
    if (foco && $(foco)) { var el = $(foco); el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* sin selección */ } }
    $('mut').onclick = function () { mute = !mute; pintar(); };
  }
  function alertar(nuevos) {
    if (!nuevos.length) return;
    aviso = nuevos.map(function (p) { return etiquetaMesa(p) + ' lista'; }).join(' · ');
    if (!mute) U.beep();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
    setTimeout(function () { aviso = ''; pintar(); }, 12000);
  }
  function cargar() {
    L.api('/api/pantalla', { pantalla: TOKEN }).then(function (r) {
      if (r.status === 403) { clearInterval(timer); window.LNEquipo.olvidar(arrancar); return; }
      if (!r.ok) { red = r.status === 0 ? 'Sin conexión' : 'Error'; pintar(); return; }
      if (r.data.paso !== 4) { location.replace('../pantalla/index.html'); return; }
      red = '';
      var ahora = {}; r.data.pedidos.forEach(function (p) { if (p.estado === 'listo') ahora[p.id] = p; });
      if (listos) alertar(Object.keys(ahora).filter(function (id) { return !listos[id]; }).map(function (id) { return ahora[id]; }));
      var qr = (r.data.mapa || []).filter(function (q) { return q.por_qr; }).map(function (q) { return q.id; });
      if (D && D.mapa) { var antes = D.mapa.filter(function (q) { return q.por_qr; }).map(function (q) { return q.id; });
        var nuevas = (r.data.mapa || []).filter(function (q) { return q.por_qr && antes.indexOf(q.id) < 0; });
        if (nuevas.length) { aviso = nuevas.map(function (q) { return 'Mesa ' + q.numero + ': cliente sentado, esperando atención'; }).join(' · '); if (!mute) U.beep(); if (navigator.vibrate) navigator.vibrate([150, 80, 150]); setTimeout(function () { aviso = ''; pintar(); }, 12000); } }
      listos = ahora; D = r.data; pintar();
    });
  }
  function accion(ruta, cuerpo, ok) {
    return L.api(ruta, { metodo: 'POST', pantalla: TOKEN, cuerpo: Object.assign({ persona: persona }, cuerpo) }).then(function (r) { U.toast(r.ok ? ok : r.error); cargar(); return r; });
  }
  document.addEventListener('input', function (e) {
    if (e.target.id === 'notas') notas = e.target.value;
  });
  document.addEventListener('change', function (e) { var v = e.target.dataset && e.target.dataset.var; if (v) U.varSet(varsM, v, e.target.value); });
  document.addEventListener('click', function (e) {
    var t = e.target, b;
    if (t.closest('#turno')) { if (window.confirm('¿Cerrar tu turno en este dispositivo? Para volver a entrar hay que escanear el QR del día.')) { clearInterval(timer); window.LNEquipo.olvidar(arrancar); } return; }
    if ((b = t.closest('[data-tab]'))) { tab = b.dataset.tab; L.guardarLocal('ln_mozo_tab', tab); pintar(); return; }
    if ((b = t.closest('[data-mesa]'))) { var id = +b.dataset.mesa; if (mesa !== id) { mesa = id; carrito = {}; varsM = {}; notas = ''; } pintar(); return; }
    if (t.closest('[data-liberar]')) { if (window.confirm('¿El cliente se fue sin pedir? La mesa queda libre.')) accion('/api/pantalla/mesa-liberar', { mesa_id: mesa }, 'Mesa liberada'); return; }
    if (t.closest('[data-limpia]')) { if (nombreOk()) accion('/api/pantalla/mesa-limpia', { mesa_id: mesa }, 'Mesa disponible'); return; }
    if ((b = t.closest('[data-llegada]'))) { if (nombreOk()) accion('/api/pantalla/mesa-llegada', { mesa_id: mesa, anular: b.dataset.llegada === 'anular' }, b.dataset.llegada === 'anular' ? 'Llegada anulada' : 'Mesa esperando pedido'); return; }
    if ((b = t.closest('[data-q]'))) { var p = b.dataset.p; carrito[p] = Math.max(0, (carrito[p] || 0) + (+b.dataset.q)); if (!carrito[p]) delete carrito[p]; pintar(); return; }
    if (t.closest('#enviar')) {
      if (!nombreOk() || !cuantos()) return;
      var items = Object.keys(carrito).map(function (k) { var pl = (D.menu || []).filter(function (x) { return String(x.id) === k; })[0]; return { plato_id: +k, cantidad: carrito[k], nota: pl ? U.varNota(pl, carrito[k], varsM[k]) : '' }; });
      t.closest('#enviar').disabled = true;
      accion('/api/pantalla/mesa-pedido', { mesa_id: mesa, items: items, notas: notas }, 'Enviado a cocina').then(function (r) { if (r.ok) { carrito = {}; varsM = {}; notas = ''; mesa = 0; tab = 'pedidos'; pintar(); } else pintar(); });
      return;
    }
    if ((b = t.closest('[data-servir]'))) { if (nombreOk()) accion('/api/pantalla/transicion', { pedido_id: b.dataset.servir, a: 'entregado' }, 'Servido en la mesa'); return; }
    if ((b = t.closest('[data-cobrar]'))) { if (nombreOk()) { cobrando = cobrando === b.dataset.cobrar ? '' : b.dataset.cobrar; selCobro = {}; pintar(); } return; }
    if ((b = t.closest('[data-sq]'))) { var si = b.dataset.si; selCobro[si] = Math.max(0, Math.min(+b.dataset.smax, (selCobro[si] || 0) + (+b.dataset.sq))); pintar(); return; }
    if ((b = t.closest('[data-medio]'))) {
      var its = Object.keys(selCobro).filter(function (k) { return selCobro[k] > 0; }).map(function (k) { return { item_id: +k, cantidad: selCobro[k] }; });
      cobrando = ''; selCobro = {};
      accion('/api/pantalla/cobrar', { pedido_id: b.dataset.id, medio: b.dataset.medio, items: its }, its.length ? 'Cobro parcial registrado' : 'Cobro registrado'); return;
    }
    if (t.closest('#escanear')) {
      if (!nombreOk()) return;
      window.LNEscaner.abrir('QR del cliente (pagó en la app)', function (codigo) {
        return L.api('/api/pantalla/escanear', { metodo: 'POST', pantalla: TOKEN, cuerpo: { codigo: codigo, persona: persona } }).then(function (r) { if (r.ok) cargar(); return { ok: r.ok, texto: r.ok ? '✓ Pedido #' + r.data.numero + ' · ' + r.data.nombre + ' finalizado' : r.error }; });
      });
    }
  });
  var timer = null;
  function arrancar(eq) { window.LNEquipo.marcaDeAgua(eq.persona); TOKEN = eq.token; persona = eq.persona; D = null; listos = null; clearInterval(timer); cargar(); timer = setInterval(cargar, 4000); }
  window.LNEquipo.iniciar(arrancar);
})();
