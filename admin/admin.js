/* Delivery La Nonna — app del admin (web y APK, mismo código). Todo se decide en el servidor; aquí solo se muestra y se envían cambios. */
(function () {
  var L = window.LN, U = window.U, E = U.esc, $ = function (i) { return document.getElementById(i); };
  var api = function (ruta, o) { o = o || {}; o.admin = true; return L.api(ruta, o); };
  var S = { vista: 'tablero', sub: 'carta', cfg: null, platos: [], tablero: null, dash: null, dashFecha: '', clientes: null, q: '', enlaces: null,
    control: null, tiempos: null, mesas: [], menu: null, desde: '', mute: false, ultimo: -1, firma: '', errorVista: '' };
  var NOM = { tablero: 'Tablero', control: 'Control', dashboard: 'Dashboard', menu: 'Menú' };
  // Menú ☰ de arriba: cada ítem abre su propia pantalla.
  var AJUSTES = [['clave', 'Contraseña'], ['pantallas', 'Equipo y QR del día'], ['clientes', 'Clientes'], ['mesas', 'Mesas'], ['pedidos', 'Pedidos y despacho'], ['local', 'Datos del local'], ['fidelidad', 'Programa de fidelidad']];
  var TIT = { tablero: 'Tablero', control: 'Control', dashboard: 'Dashboard', menu: 'Menú', clave: 'Contraseña', pantallas: 'Equipo', clientes: 'Clientes', mesas: 'Mesas', pedidos: 'Pedidos y despacho', local: 'Datos del local', fidelidad: 'Fidelidad' };
  var IC = {
    tablero: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/></svg>',
    control: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    dashboard: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M6 3v8M9 3v8M6 7h3M7.5 11v10M16 3c-2 2-2 6 0 8v10"/></svg>',
    clientes: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c.8-3.6 3.4-5.4 7-5.4s6.2 1.8 7 5.4M17 5a3.2 3.2 0 0 1 0 6M19 14.8c1.8.8 2.8 2.4 3 5"/></svg>',
    pantallas: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    config: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>'
  };
  var webBase = function () { return window.LN_WEB_BASE || window.LN_API_BASE || location.origin; };
  var imgUrl = function (u) { return (window.LN_API_BASE || '') + '/' + u; };
  var digitos = function (s) { return String(s || '').replace(/\D/g, ''); };
  var timer = null;

  function abrirModal(html, ancho) { $('mod').className = 'modal' + (ancho ? ' ancho' : ''); $('mod').innerHTML = html; $('mbg').hidden = false; }
  function cerrarModal() { if (S.visor) { S.visor.destruir(); S.visor = null; } $('mbg').hidden = true; }
  $('mbg').addEventListener('click', function (e) { if (e.target === this) cerrarModal(); });
  var errBloque = function (t) { return '<div class="err-bloque" role="alert">' + E(t) + '</div>'; };

  /* ================= ingreso ================= */
  function pantallaLogin(msg) {
    $('raiz').innerHTML = '<div class="login"><form class="card" id="f-login" novalidate><div style="margin:0 auto 10px;display:flex;justify-content:center">' + U.logo(96) + '</div><h1 class="titulo" style="font-size:30px;color:var(--marino)">Delivery La Nonna</h1><p class="suave" style="margin:4px 0 16px;font-size:13.5px">Administración del local</p>' + (msg ? errBloque(msg) : '') + '<label class="campo" style="text-align:left">Usuario<input id="u" autocomplete="username" required></label><label class="campo" style="text-align:left">Contraseña<input id="c" type="password" autocomplete="current-password" required></label><button class="btn btn-p btn-bloque" type="submit" id="l-btn" style="margin-top:8px">Ingresar</button><div class="avance indet" id="l-av" hidden style="width:100%;margin-top:12px" role="progressbar" aria-label="Ingresando"><i></i></div><div class="avance-txt" id="l-txt" aria-live="polite"></div><div class="by">by <b>BTo Innova</b></div></form></div>';
    $('f-login').onsubmit = function (e) {
      e.preventDefault();
      $('l-btn').disabled = true; $('l-btn').textContent = 'Ingresando…'; $('l-av').hidden = false; $('l-txt').textContent = 'Verificando tus datos…';
      api('/api/admin/login', { metodo: 'POST', cuerpo: { usuario: $('u').value, clave: $('c').value } }).then(function (r) {
        if (r.ok) { var t = $('l-txt'); if (t) t.textContent = 'Cargando el panel…'; }
        if (!r.ok) { pantallaLogin(r.error); return; }
        if (L.MODO_APK) L.guardarLocal('ln_admin_token', r.data.token);
        iniciar();
      });
    };
  }
  function salir() {
    clearInterval(timer);
    api('/api/admin/logout', { metodo: 'POST' }).then(function () { L.borrarLocal('ln_admin_token'); pantallaLogin(); });
  }

  /* ================= estructura ================= */
  function armar() {
    var nav = '', bn = '';
    Object.keys(NOM).forEach(function (k) {
      nav += '<button class="nv" data-v="' + k + '">' + IC[k] + NOM[k] + '</button>';
      bn += '<button data-v="' + k + '">' + IC[k] + NOM[k] + '</button>';
    });
    $('raiz').innerHTML = '<div class="shell"><aside class="side"><div class="marca">' + U.logo(58) + '</div><div class="sub-m">Delivery La Nonna</div>' + nav + '<div class="by">by <b>BTo Innova</b></div></aside><div class="cont"><header class="hdr" id="hdr"><img class="avatar-chef sm" src="' + (window.LN_RUTA_IMG || '../img/') + 'chef-avatar.webp" alt=""><h1 class="titulo" id="tit"></h1><span id="est" class="pill pill-g">…</span><button class="btn btn-s btn-sm" id="mut" aria-pressed="false" aria-label="Sonido">🔊</button><button class="hamb" id="hamb" aria-label="Abrir menú" aria-expanded="false"><i></i><i></i><i></i></button></header><main class="pagina" id="pag" aria-live="polite"></main></div></div><nav class="bnav" style="grid-template-columns:repeat(4,1fr)">' + bn + '</nav>' +
      '<div class="ml-fondo" id="mlf" hidden></div><aside class="ml" id="ml" aria-hidden="true" aria-label="Menú"><div class="ml-cab"><img class="avatar-chef sm" src="' + (window.LN_RUTA_IMG || '../img/') + 'chef-avatar.webp" alt=""><div class="ml-quien"><strong>Administración</strong><span>Delivery La Nonna</span></div><button class="ml-x" id="mlx" aria-label="Cerrar el menú">&times;</button></div>' +
      AJUSTES.map(function (a) { return '<button class="ml-item" data-v="' + a[0] + '">' + E(a[1]) + '</button>'; }).join('') + '<button class="ml-item ml-salir" id="sal">Salir</button><div class="by" style="margin-top:14px">by <b>BTo Innova</b></div></aside>';
    document.querySelectorAll('[data-v]').forEach(function (b) { b.onclick = function () { ir(b.dataset.v); }; });
    $('mut').onclick = function () { S.mute = !S.mute; this.textContent = S.mute ? '🔇' : '🔊'; this.setAttribute('aria-pressed', S.mute); };
    $('sal').onclick = salir;
    var menu = function (abrir) { $('ml').classList.toggle('abierto', abrir); $('ml').setAttribute('aria-hidden', !abrir); $('mlf').hidden = !abrir; $('hamb').setAttribute('aria-expanded', abrir); };
    $('hamb').onclick = function () { menu(true); }; $('mlx').onclick = $('mlf').onclick = function () { menu(false); };
    document.querySelectorAll('.ml-item[data-v]').forEach(function (b) { b.addEventListener('click', function () { menu(false); }); });
  }
  function cabecera() {
    document.querySelectorAll('[data-v]').forEach(function (b) { b.classList.toggle('on', b.dataset.v === S.vista); });
    $('tit').textContent = TIT[S.vista] || '';
    var e = $('est'); if (!S.cfg) { e.className = 'pill pill-g'; e.textContent = '…'; return; }
    e.className = 'pill ' + (S.cfg.pedidos_abiertos ? 'pill-ok' : 'pill-err'); e.textContent = S.cfg.pedidos_abiertos ? 'Recibiendo pedidos' : 'Pedidos cerrados';
  }
  function pintar() {
    cabecera();
    var f = { tablero: vTablero, control: vControl, dashboard: vDash, menu: vMenu, clientes: vClientes, pantallas: vPant, clave: vClave, local: vConfig, pedidos: vConfig, mesas: vConfig, fidelidad: vConfig }[S.vista];
    var aviso = S.claveProvisoria && S.vista !== 'clave' ? '<div class="info-bloque" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:200px"><b>Tu contraseña es provisoria.</b> Cámbiala por una tuya.</span><button class="btn btn-p btn-sm" data-v="clave">Cambiar ahora</button></div>' : '';
    var y = window.scrollY; $('pag').innerHTML = aviso + f(); window.scrollTo(0, y);
    if (aviso) document.querySelector('#pag [data-v="clave"]').onclick = function () { ir('clave'); };
    S.firma = firmaActual();
  }
  function firmaActual() { return S.vista === 'tablero' ? JSON.stringify([S.tablero && [S.tablero.solicitados, S.tablero.en_cocina, S.tablero.listos].map(function (g) { return g.map(function (p) { return p.id + p.estado; }); }), S.resumen && [S.resumen.dash.ventas, S.resumen.dash.pedidos_pagados, S.resumen.hoy.map(function (i) { return [i.plato_id, i.usados, i.habilitado]; })]]) : ''; }

  /* Franja de resumen arriba del tablero: saludo, cifras del día y el menú de hoy con lo que queda. */
  function cargarResumen() {
    return Promise.all([api('/api/admin/dashboard'), api('/api/admin/menu?dias=1')]).then(function (rs) {
      if (!rs[0].ok || !rs[1].ok) return;
      S.resumen = { dash: rs[0].data, hoy: (rs[1].data.fechas[0] || { items: [] }).items };
      if (S.vista === 'tablero' && firmaActual() !== S.firma) pintar();
    });
  }
  function vResumen() {
    var r = S.resumen, h = new Date().getHours(), saludo = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    var s = '<section class="card banda" aria-label="Resumen del día"><div class="banda-hola"><img class="avatar-chef" src="' + (window.LN_RUTA_IMG || '../img/') + 'chef-avatar.webp" alt=""><div><div class="titulo saludo">' + saludo + ', chef</div><div class="suave" style="font-size:13px">' + (r ? E(U.fechaLarga(r.dash.fecha)) : '') + (S.cfg ? ' · ' + E(S.cfg.direccion) : '') + '</div></div></div>';
    if (!r) return s + '<div class="cargando" aria-busy="true"><i style="height:64px"></i></div></section>';
    var cola = S.tablero ? S.tablero.solicitados.length : 0;
    s += '<div class="banda-kpis"><div><b class="num">' + U.clp(r.dash.ventas) + '</b><span>Ventas de hoy</span></div><div><b class="num">' + r.dash.pedidos_pagados + '</b><span>Pedidos pagados</span></div><div><b class="num">' + U.clp(r.dash.ticket_promedio) + '</b><span>Ticket promedio</span></div><div><b class="num">' + cola + '</b><span>En cola</span></div></div>';
    s += '<div class="banda-menu"><b>Menú de hoy</b>' + (r.hoy.length ? r.hoy.map(function (i) {
      var p = S.platos.filter(function (x) { return x.id === i.plato_id; })[0], quedan = i.cupos == null ? null : Math.max(0, i.cupos - i.usados);
      var cls = !i.habilitado ? 'pill-err' : quedan != null && quedan <= 3 ? 'pill-warn' : 'pill-g', txt = !i.habilitado ? 'pausado' : quedan == null ? 'sin límite' : 'quedan ' + quedan + ' de ' + i.cupos;
      return '<span class="pill ' + cls + '">' + E(p ? p.nombre : 'Plato ' + i.plato_id) + ' · ' + txt + '</span>';
    }).join('') : '<span class="suave" style="font-size:13px">Aún no hay menú cargado para hoy: arma el día en Menú → Planificador semanal.</span>') + '</div>';
    return s + '</section>';
  }
  function ir(v) {
    S.vista = v; S.errorVista = ''; pintar();
    if (v === 'tablero') cargarTablero(); else if (v === 'control') cargarControl(); else if (v === 'dashboard') cargarDash(); else if (v === 'menu') cargarMenu();
    else if (v === 'clientes') cargarClientes(); else if (v === 'pantallas') cargarEnlaces();
  }
  function cargarComun() {
    return Promise.all([api('/api/admin/config'), api('/api/admin/platos')]).then(function (rs) {
      if (rs[0].status === 401) { pantallaLogin('Tu sesión terminó. Ingresa de nuevo.'); return false; }
      if (rs[0].ok) S.cfg = rs[0].data;
      if (rs[1].ok) S.platos = rs[1].data;
      return api('/api/admin/mesas').then(function (m) { if (m.ok) S.mesas = m.data; return true; });
    });
  }
  function fallo(r) { S.errorVista = r.error; if (r.status === 401) pantallaLogin('Tu sesión terminó. Ingresa de nuevo.'); else pintar(); }

  /* ================= tablero ================= */
  function cargarTablero() {
    return api('/api/admin/tablero').then(function (r) {
      if (!r.ok) { if (S.vista === 'tablero') fallo(r); return; }
      var nuevos = r.data.solicitados.length;
      if (S.ultimo >= 0 && nuevos > S.ultimo) { if (!S.mute) U.beep(); var h = $('hdr'); if (h) { h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash'); } U.toast('Nuevo pedido recibido'); }
      S.ultimo = nuevos; S.errorVista = ''; S.tablero = r.data;
      if (S.vista === 'tablero' && firmaActual() !== S.firma) pintar();
    });
  }
  function mins(iso) { return iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000)) : 0; }
  function tarjeta(p) {
    var m = mins(p.estado === 'solicitado' ? p.solicitado_en : p.estado === 'en_cocina' ? p.cocina_en : p.listo_en), cls = m < 5 ? 'v' : m < 10 ? 'a' : 'r';
    var s = '<article class="ped"><div class="cab"><span class="numP num">#' + p.numero_diario + '</span><span class="pill ' + (p.origen === 'mesa' ? 'pill-warn' : p.tipo === 'domicilio' ? 'pill-n' : 'pill-g') + '">' + (p.origen === 'mesa' ? '🍽 ' + E(p.nombre_cliente) : p.tipo === 'domicilio' ? (p.ruta_en ? '🛵 En ruta' : 'Despacho') : 'Retiro') + '</span><span class="espera ' + cls + ' num">' + m + ' min</span></div><div style="font-weight:600">' + E(p.nombre_cliente) + '</div><ul>';
    p.items.forEach(function (i) { s += '<li>' + i.cantidad + ' × ' + E(i.nombre) + '</li>' + (i.nota ? '<div class="nota">Nota: ' + E(i.nota) + '</div>' : ''); });
    s += '</ul>' + (p.notas ? '<div class="nota">Pedido: ' + E(p.notas) + '</div>' : '');
    if (p.estado === 'listo') s += '<div class="dat">Tel: ' + E(p.telefono) + (p.tipo === 'domicilio' ? '<br>' + E(p.direccion) + (p.referencia ? ' (' + E(p.referencia) + ')' : '') : '<br>Retira en el local') + '<br><b class="num">Total ' + U.clp(p.total) + '</b></div>';
    var sig = { solicitado: ['en_cocina', 'Pasar a cocina'], en_cocina: ['listo', 'Marcar listo'], listo: ['entregado', 'Marcar entregado'] }[p.estado];
    return s + '<div class="acc"><button class="btn btn-p btn-sm" data-mv="' + E(p.id) + '" data-a="' + sig[0] + '">' + sig[1] + '</button><button class="btn btn-d btn-sm" data-cancel="' + E(p.id) + '" aria-label="Cancelar pedido ' + p.numero_diario + '">Cancelar</button></div></article>';
  }
  function vTablero() {
    var t = S.tablero;
    if (!t) return S.errorVista ? errBloque(S.errorVista) : '<div class="cargando" aria-busy="true"><i></i><i></i></div>';
    var cols = [['solicitados', '1 · Solicitados'], ['en_cocina', '2 · En cocina'], ['listos', '3 · Despacho o retiro']], s = (S.errorVista ? errBloque(S.errorVista) : '') + vResumen() + '<div class="tab3">';
    cols.forEach(function (c) {
      var xs = t[c[0]];
      s += '<section class="col" aria-label="' + c[1] + '"><h2>' + c[1] + '<span class="n num">' + xs.length + '</span></h2>';
      if (c[0] === 'listos') {
        var de = xs.filter(function (p) { return p.tipo === 'domicilio'; }), re = xs.filter(function (p) { return p.tipo !== 'domicilio' && p.origen !== 'mesa'; }), me = xs.filter(function (p) { return p.origen === 'mesa'; });
        s += '<div class="suave" style="font-size:12px;font-weight:700;margin:2px 4px 6px">PARA DESPACHO (' + de.length + ')</div>' + (de.map(tarjeta).join('') || '<p class="suave" style="font-size:13px;margin:0 4px 10px">Sin pedidos.</p>') + '<div class="suave" style="font-size:12px;font-weight:700;margin:8px 4px 6px">PARA RETIRO (' + re.length + ')</div>' + (re.map(tarjeta).join('') || '<p class="suave" style="font-size:13px;margin:0 4px">Sin pedidos.</p>') + '<div class="suave" style="font-size:12px;font-weight:700;margin:8px 4px 6px">PARA LLEVAR A LA MESA (' + me.length + ')</div>' + (me.map(tarjeta).join('') || '<p class="suave" style="font-size:13px;margin:0 4px">Sin pedidos.</p>');
      } else s += xs.map(tarjeta).join('') || '<p class="suave" style="font-size:13.5px;text-align:center;padding:24px 8px">Sin pedidos en este paso.</p>';
      s += '</section>';
    });
    return s + '</div>';
  }

  /* ================= control: todos los flujos del día ================= */
  function cargarControl() {
    return Promise.all([api('/api/admin/control'), api('/api/admin/mesas/tiempos')]).then(function (rs) {
      if (!rs[0].ok) { if (S.vista === 'control') fallo(rs[0]); return; }
      S.control = rs[0].data; if (rs[1].ok) S.tiempos = rs[1].data; S.errorVista = '';
      if (S.vista === 'control' && !(document.activeElement && document.activeElement.closest('#mbg'))) pintar();
    });
  }
  function mapaMesas(mapa, admin) {
    if (!mapa || !mapa.length) return '';
    var NOMC = { verde: 'Libre', naranjo: 'Esperando / atendido', rojo: 'Demorada', lila: 'Comiendo', azul: 'Pagó · por limpiar' };
    return '<div class="card" style="margin-top:12px"><h3>Mapa de mesas</h3><div class="mapa-ley">' + ['verde', 'naranjo', 'rojo', 'lila', 'azul'].map(function (k) { return '<span class="mm-' + k + '">' + NOMC[k] + '</span>'; }).join('') + '</div>' +
      ['comedor', 'patio'].map(function (z) {
        var ms = mapa.filter(function (m) { return m.zona === z; }); if (!ms.length) return '';
        return '<div class="suave" style="font-size:12px;font-weight:700;margin:10px 0 6px">' + (z === 'patio' ? 'PATIO' : 'COMEDOR') + '</div><div class="mapa-m">' + ms.map(function (m) {
          return '<div class="mm mm-' + m.color + '" data-cmesa="' + m.id + '" role="button" tabindex="0" style="cursor:pointer" title="' + E(m.motivo || m.fase_texto || NOMC[m.color]) + '"><b>' + m.numero + '</b><small>' + (m.color === 'verde' ? 'libre' : m.color === 'azul' ? 'por limpiar · ' + m.minutos + ' min' : (m.fase_corta || '') + ' · ' + m.minutos + ' min') + (m.personas > 1 ? ' · 👥' + m.personas : '') + '</small>' + (admin && m.color === 'azul' ? '<button class="btn btn-s btn-sm" data-climpia="' + m.id + '">Limpia</button>' : '') + '</div>';
        }).join('') + '</div>';
      }).join('') + '</div>';
  }
  // Al tocar una mesa del mapa: su estado, el proceso del día momento a momento (con minutos entre pasos) y sus pedidos con acciones.
  function detalleMesa(id) {
    api('/api/admin/mesas/' + id + '/detalle').then(function (r) {
      if (!r.ok) { U.toast(r.error); return; }
      var m = r.data.mesa, hora = function (t) { return new Date(t).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }); };
      var NOMC = { verde: 'Libre', naranjo: 'Esperando / atendido', rojo: 'Demorada', lila: 'Comiendo', azul: 'Pagó · por limpiar' };
      var EST = { solicitado: 'En cola', en_cocina: 'En cocina', listo: 'Listo', entregado: 'Servido', cancelado: 'Cancelado' };
      var s = '<h3 class="titulo" style="font-size:26px;margin-bottom:4px">Mesa ' + m.numero + ' · ' + (m.zona === 'patio' ? 'Patio' : 'Comedor') + '</h3><div class="mapa-ley" style="margin-bottom:10px"><span class="mm-' + m.color + '">' + ((m.color === 'naranjo' || m.color === 'lila') && m.fase_texto ? m.fase_texto : NOMC[m.color]) + (m.color !== 'verde' ? ' · ' + m.minutos + ' min' : '') + '</span>' + (m.motivo ? '<span style="color:var(--texto)">' + E(m.motivo) + '</span>' : '') + '</div>';
      s += '<h4 style="margin:8px 0 4px">Proceso de hoy</h4>' + (r.data.momentos.length ? '<ol class="linea-t">' + r.data.momentos.map(function (x, i, arr) {
        var dif = i ? Math.round((Date.parse(x.t) - Date.parse(arr[i - 1].t)) / 60000) : null;
        return '<li><b>' + hora(x.t) + '</b> ' + E(x.que) + (x.quien ? ' · <i>' + E(x.quien) + '</i>' : '') + (dif !== null ? ' <span class="suave">(+' + dif + ' min)</span>' : '') + '</li>';
      }).join('') + '</ol>' : '<p class="suave" style="margin:0">Sin movimiento hoy.</p>');
      s += '<h4 style="margin:12px 0 4px">Pedidos</h4>' + (r.data.pedidos.map(function (p) {
        var acc = '';
        if (p.estado !== 'cancelado' && p.estado !== 'entregado') { var sig = { solicitado: ['en_cocina', 'A cocina'], en_cocina: ['listo', 'Listo'], listo: ['entregado', 'Servido'] }[p.estado]; acc += '<button class="btn btn-p btn-sm" data-cmv="' + E(p.id) + '" data-a="' + sig[0] + '">' + sig[1] + '</button> <button class="btn btn-d btn-sm" data-ccancel="' + E(p.id) + '">Cancelar</button> '; }
        if (!p.pagado && p.estado !== 'cancelado') acc += '<button class="btn btn-s btn-sm" data-ccobrar="' + E(p.id) + '">Cobrar</button>';
        return '<div class="card" style="margin-bottom:8px;padding:10px"><b>#' + p.numero + '</b> · ' + E(EST[p.estado] || p.estado) + ' · ' + U.clp(p.total) + ' · ' + (p.pagado ? 'Pagado (' + E(p.cobro_medio) + ', ' + E(p.cobrado_por) + ')' : 'Por cobrar') +
          '<div style="font-size:13.5px;margin:4px 0">' + p.items.map(function (i) { return i.cantidad + ' × ' + E(i.nombre); }).join(' · ') + '</div><div class="suave" style="font-size:12.5px">Tomó: ' + E(p.mozo_toma || '—') + (p.mozo_entrega ? ' · Sirvió: ' + E(p.mozo_entrega) : '') + '</div>' + (acc ? '<div style="margin-top:6px">' + acc + '</div>' : '') + '</div>';
      }).join('') || '<p class="suave" style="margin:0">Sin pedidos hoy.</p>');
      s += '<div class="dos-col" style="margin-top:10px">' + (m.color === 'azul' ? '<button class="btn btn-p" data-climpia="' + m.id + '">Mesa limpia: disponible</button>' : m.fase === 'esperando_pedido' ? '<button class="btn btn-d" data-cliberar="' + m.id + '">Se fue sin pedir: liberar</button>' : '<span></span>') + '<button class="btn btn-s" data-act="cerrar">Cerrar</button></div>';
      abrirModal(s, true);
    });
  }
  var mn = function (v) { return v == null ? '—' : String(v).replace('.', ',') + ' min'; };
  function vControl() {
    var c = S.control;
    if (!c) return S.errorVista ? errBloque(S.errorVista) : '<div class="cargando" aria-busy="true"><i></i><i></i></div>';
    var r = c.resumen, k = function (n, t, cls) { return '<div class="kc ' + (cls || '') + '"><b class="num">' + n + '</b><span>' + t + '</span></div>'; };
    var s = (S.errorVista ? errBloque(S.errorVista) : '') + '<div class="control-k">' +
      k(r.solicitados, 'En cola') + k(r.en_cocina, 'En cocina') + k(r.pendientes_retiro, 'Pendientes de retiro') + k(r.esperando_repartidor, 'Esperando repartidor') + k(r.en_ruta, 'En ruta de envío', r.en_ruta ? 'on' : '') +
      k(r.mesas_abiertas, 'Mesas con pedido') + k(r.mesas_listas_para_llevar, 'Listos para llevar a mesa', r.mesas_listas_para_llevar ? 'on' : '') + k(r.mesas_por_cobrar, 'Mesas por cobrar') + k(r.entregados, 'Finalizados') + k(r.cancelados, 'Cancelados') + '</div>';
    s += mapaMesas(c.mapa, true);
    // dónde está cada plato
    s += '<div class="card" style="margin-top:12px"><h3>Dónde está cada plato</h3>' + (c.platos.length ? '<div class="scroll-x"><table class="tabla"><thead><tr><th>Plato</th><th>En cola</th><th>En cocina</th><th>Listo</th><th>En ruta</th><th>Entregado</th></tr></thead><tbody>' + c.platos.map(function (p) {
      return '<tr><td>' + E(p.nombre) + '</td><td class="num">' + p.cola + '</td><td class="num">' + p.cocina + '</td><td class="num">' + p.listo + '</td><td class="num">' + p.en_ruta + '</td><td class="num">' + p.entregado + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="suave" style="margin:0">Aún no hay platos pedidos hoy.</p>') + '</div>';
    // tiempos por mesa
    var t = S.tiempos;
    if (t) {
      s += '<div class="card" style="margin-top:12px"><h3>Tiempos de atención en mesas (hoy)</h3><p class="suave" style="font-size:13px;margin:0 0 8px">Promedio de cada momento: cliente sentado esperando pedido → pedido generado hasta listo (cocina) → llevarlo a la mesa → comiendo hasta que paga → limpieza → mesa libre hasta el siguiente cliente.</p>' +
        '<div class="control-k">' + [['Esperando pedido', t.promedio.esperando], ['Cocina', t.promedio.cocina], ['Llevar a la mesa', t.promedio.llevar], ['Comiendo hasta pagar', t.promedio.comiendo], ['Limpieza', t.promedio.limpieza], ['Ocupación total', t.promedio.ocupacion], ['Mesa libre', t.promedio.libre]].map(function (x) { return '<div class="kc"><b class="num" style="font-size:20px">' + mn(x[1]) + '</b><span>' + x[0] + '</span></div>'; }).join('') + '</div>';
      if (t.mesas.length) s += '<div class="scroll-x" style="margin-top:8px"><table class="tabla"><thead><tr><th>Mesa</th><th>Pedidos</th><th>Esperando</th><th>Cocina</th><th>Llevar</th><th>Comiendo</th><th>Limpieza</th><th>Ocupación</th><th>Libre</th></tr></thead><tbody>' + t.mesas.map(function (m) {
        return '<tr><td>' + m.mesa + ' · ' + (m.zona === 'patio' ? 'Patio' : 'Comedor') + '</td><td class="num">' + m.pedidos + '</td><td>' + mn(m.esperando) + '</td><td>' + mn(m.cocina) + '</td><td>' + mn(m.llevar) + '</td><td>' + mn(m.comiendo) + '</td><td>' + mn(m.limpieza) + '</td><td>' + mn(m.ocupacion) + '</td><td>' + mn(m.libre) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
      s += '</div>';
    }
    // todos los pedidos
    s += '<div class="card" style="margin-top:12px"><h3>Todos los pedidos de hoy (' + c.pedidos.length + ')</h3>';
    if (!c.pedidos.length) return s + '<p class="suave" style="margin:0">Aún no hay pedidos.</p></div>';
    s += '<div class="scroll-x"><table class="tabla"><thead><tr><th>#</th><th>Tipo</th><th>Dónde está</th><th>Platos</th><th>Personas</th><th>Total</th><th></th></tr></thead><tbody>' + c.pedidos.slice().reverse().map(function (p) {
      var tipo = p.origen === 'mesa' ? '🍽 Mesa ' + p.mesa.numero + ' · ' + (p.mesa.zona === 'patio' ? 'Patio' : 'Comedor') : p.tipo === 'domicilio' ? '🛵 Envío<br><small>' + E(p.cliente) + ' · ' + E(p.direccion) + '</small>' : '🛍 Retiro<br><small>' + E(p.cliente) + '</small>';
      var pers = [p.mozo_toma && 'Tomó: ' + E(p.mozo_toma), p.mozo_entrega && 'Sirvió: ' + E(p.mozo_entrega), p.cobrado_por && 'Cobró: ' + E(p.cobrado_por) + ' (' + E(p.cobro_medio) + ')', p.repartidor && 'Reparto: ' + E(p.repartidor)].filter(Boolean).join('<br>') || '—';
      var acc = '';
      if (p.estado !== 'cancelado' && p.estado !== 'entregado') {
        var sig = { solicitado: ['en_cocina', 'A cocina'], en_cocina: ['listo', 'Listo'], listo: ['entregado', 'Finalizar'] }[p.estado];
        acc += '<button class="btn btn-p btn-sm" data-cmv="' + E(p.id) + '" data-a="' + sig[0] + '">' + sig[1] + '</button> <button class="btn btn-d btn-sm" data-ccancel="' + E(p.id) + '">Cancelar</button>';
      }
      if (p.origen === 'mesa' && !p.pagado && p.estado !== 'cancelado') acc += ' <button class="btn btn-s btn-sm" data-ccobrar="' + E(p.id) + '">Cobrar</button>';
      return '<tr><td class="num"><b>#' + p.numero + '</b></td><td>' + tipo + '</td><td><b>' + E(p.ubicacion) + '</b></td><td>' + p.items.map(function (i) { return i.cantidad + ' × ' + E(i.nombre); }).join('<br>') + '</td><td style="font-size:13px">' + pers + '</td><td class="num">' + U.clp(p.total) + '</td><td style="white-space:nowrap">' + acc + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
    return s;
  }

  /* ================= contraseña ================= */
  function vClave() {
    return '<form class="card" id="f-clave" style="max-width:460px" novalidate><p class="suave" style="margin:0 0 8px;font-size:13.5px">Al cambiarla, las demás sesiones abiertas del administrador se cierran. Usa al menos 8 caracteres.</p>' +
      '<label class="campo">Contraseña actual<input id="k_act" type="password" autocomplete="current-password"></label>' +
      '<label class="campo">Contraseña nueva<input id="k_new" type="password" autocomplete="new-password" minlength="8" maxlength="72"></label>' +
      '<label class="campo">Repite la contraseña nueva<input id="k_rep" type="password" autocomplete="new-password" maxlength="72"></label><div id="k_err"></div>' +
      '<button class="btn btn-p" type="submit">Cambiar contraseña</button></form>';
  }
  function cambiarClave() {
    var a = $('k_act').value, n = $('k_new').value, r = $('k_rep').value, err = function (t) { $('k_err').innerHTML = errBloque(t); };
    if (!a || !n) return err('Completa la contraseña actual y la nueva.');
    if (n.length < 8) return err('La contraseña nueva debe tener al menos 8 caracteres.');
    if (n !== r) return err('Las contraseñas nuevas no coinciden.');
    api('/api/admin/clave', { metodo: 'POST', cuerpo: { actual: a, nueva: n } }).then(function (x) {
      if (!x.ok) return err(x.error);
      S.claveProvisoria = false; U.toast('Contraseña cambiada'); ir('tablero');
    });
  }

  /* ================= dashboard ================= */
  function cargarDash() {
    return api('/api/admin/dashboard' + (S.dashFecha ? '?fecha=' + encodeURIComponent(S.dashFecha) : '')).then(function (r) {
      if (!r.ok) return fallo(r);
      S.dash = r.data; S.dashFecha = r.data.fecha; S.errorVista = ''; if (S.vista === 'dashboard') pintar();
    });
  }
  function vDash() {
    var d = S.dash;
    if (!d) return S.errorVista ? errBloque(S.errorVista) : '<div class="cargando" aria-busy="true"><i></i><i></i></div>';
    var hs = Object.keys(d.por_hora).map(Number), h0 = Math.min.apply(null, [11].concat(hs)), h1 = Math.max.apply(null, [16].concat(hs));
    var hmax = Math.max.apply(null, [1].concat(hs.map(function (h) { return d.por_hora[h]; })));
    var tl = d.top_platos.slice(0, 6), tm = tl.length ? tl[0].cantidad : 1, t = d.pedidos_pagados;
    var prom = function (v) { return v == null ? '—' : v + ' min'; };
    var s = '<div class="nav-sem"><label class="campo" style="margin:0;display:flex;gap:8px;align-items:center">Fecha<input type="date" id="d_fecha" value="' + E(d.fecha) + '" style="margin:0;width:auto"></label></div>';
    s += '<div class="kpis"><div class="card kpi"><div class="l">Ventas</div><div class="v num">' + U.clp(d.ventas) + '</div></div><div class="card kpi"><div class="l">Pedidos pagados</div><div class="v num">' + t + '</div></div><div class="card kpi"><div class="l">Ticket promedio</div><div class="v num">' + U.clp(d.ticket_promedio) + '</div></div><div class="card kpi"><div class="l">Cancelados</div><div class="v num">' + d.cancelados + '</div></div></div>';
    s += '<div class="g2"><div class="card"><h3>Pedidos por hora</h3><div class="hbars" role="img" aria-label="Pedidos por hora">';
    for (var h = h0; h <= h1; h++) { var v = d.por_hora[h] || 0; s += '<div><span class="num">' + (v || '') + '</span><i style="height:' + Math.round(v / hmax * 100) + '%"></i>' + h + 'h</div>'; }
    s += '</div></div><div class="card"><h3>Retiro y despacho</h3><div class="bar"><span>Retiro en local</span><span class="t"><i style="width:' + (t ? d.retiro / t * 100 : 0) + '%"></i></span><b class="num">' + d.retiro + '</b></div><div class="bar"><span>Envío a domicilio</span><span class="t"><i style="width:' + (t ? d.domicilio / t * 100 : 0) + '%;background:var(--marino)"></i></span><b class="num">' + d.domicilio + '</b></div><div class="bar"><span>Con cuenta</span><span class="t"><i style="width:' + (t ? d.con_cuenta / t * 100 : 0) + '%;background:var(--ok)"></i></span><b class="num">' + d.con_cuenta + '</b></div>';
    s += '<h3 style="margin-top:16px">Tiempos promedio</h3><div style="display:flex;justify-content:space-between;padding:4px 0"><span>Espera en cola</span><b class="num">' + prom(d.minutos_promedio.espera_cola) + '</b></div><div style="display:flex;justify-content:space-between;padding:4px 0"><span>Preparación</span><b class="num">' + prom(d.minutos_promedio.preparacion) + '</b></div><div style="display:flex;justify-content:space-between;padding:4px 0"><span>Entrega</span><b class="num">' + prom(d.minutos_promedio.entrega) + '</b></div></div></div>';
    s += '<div class="card" style="margin-top:14px"><h3>Platos más pedidos</h3>' + (tl.map(function (p) { return '<div class="bar"><span>' + E(p.nombre) + '</span><span class="t"><i style="width:' + p.cantidad / tm * 100 + '%"></i></span><b class="num">' + p.cantidad + '</b></div>'; }).join('') || '<p class="suave">Aún no hay pedidos este día.</p>') + '</div>';
    return s;
  }

  /* ================= menú: carta y planificador ================= */
  function vMenu() {
    var s = '<div class="subtabs"><button data-sub="carta" class="' + (S.sub === 'carta' ? 'on' : '') + '">Carta completa</button><button data-sub="semana" class="' + (S.sub === 'semana' ? 'on' : '') + '">Planificador semanal</button></div>';
    if (S.errorVista) s += errBloque(S.errorVista);
    return s + (S.sub === 'carta' ? vCarta() : vSemana());
  }
  function cargarMenu() {
    cargarComun().then(function (ok) {
      if (!ok) return;
      var q = S.sub === 'semana' || S.menu ? '?dias=7' + (S.desde ? '&desde=' + S.desde : '') : '';
      return api('/api/admin/menu' + (q || '?dias=7')).then(function (r) {
        if (!r.ok) return fallo(r);
        S.menu = r.data; if (!S.desde) S.desde = r.data.hoy; S.errorVista = ''; if (S.vista === 'menu') pintar();
      });
    });
  }
  function ordenCategorias(lista) {
    var cats = (S.cfg && S.cfg.categorias || []).slice();
    lista.forEach(function (p) { if (p.categoria && cats.indexOf(p.categoria) < 0) cats.push(p.categoria); });
    cats.push('');
    return cats;
  }
  function vCarta() {
    if (!S.cfg) return '<div class="cargando" aria-busy="true"><i></i></div>';
    var s = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap"><div><b>Carta de ' + E(S.cfg.nombre_local) + '</b><div class="suave" style="font-size:13px">Activa un plato para poder ponerlo en el menú de un día. Un plato necesita precio para activarse.</div></div><button class="btn btn-p btn-sm" data-act="nuevoPlato">Agregar plato</button></div><div class="scroll-x"><table class="tabla"><thead><tr><th></th><th>Plato</th><th>Precio</th><th>En carta</th><th></th></tr></thead><tbody>';
    ordenCategorias(S.platos).forEach(function (c) {
      var g = S.platos.filter(function (p) { return (p.categoria || '') === c; });
      if (!g.length) return;
      s += '<tr class="fila-cat"><td colspan="5">' + E(c || 'Sin categoría') + ' (' + g.length + ')</td></tr>';
      g.forEach(function (p) {
        var miniatura = p.fotos.length ? imgUrl(p.fotos[0].url) : p.giro ? imgUrl(p.giro.ruta + '00.' + p.giro.ext) : '';
        s += '<tr><td>' + (miniatura ? '<img class="thumb" src="' + E(miniatura) + '" alt="" loading="lazy">' : '<div class="thumb-ph">sin foto</div>') + '</td><td><b>' + E(p.nombre) + '</b>' + (p.destacado ? ' <span class="pill pill-n">Destacado</span>' : '') + (p.giro ? ' <span class="pill pill-g">360°</span>' : '') + '<div class="suave" style="font-size:12.5px">' + E(p.descripcion) + '</div></td><td><input type="number" min="0" step="100" data-precio="' + p.id + '" value="' + p.precio + '" aria-label="Precio de ' + E(p.nombre) + '"></td><td><label class="sw"><input type="checkbox" data-activo="' + p.id + '" ' + (p.activo ? 'checked' : '') + ' aria-label="En carta: ' + E(p.nombre) + '"><i></i></label></td><td><button class="btn btn-s btn-sm" data-act="editar" data-id="' + p.id + '">Editar</button></td></tr>';
      });
    });
    return s + '</tbody></table></div></div>';
  }
  function modalPlato(id) {
    var p = id ? S.platos.filter(function (x) { return x.id === +id; })[0] : { id: 0, nombre: '', descripcion: '', categoria: '', precio: 0, etiquetas_dieteticas: '', tiempo_preparacion: null, destacado: false, activo: false, fotos: [] };
    if (!p) return;
    var cats = (S.cfg.categorias || []).slice(); if (p.categoria && cats.indexOf(p.categoria) < 0) cats.push(p.categoria);
    var s = '<h3 class="titulo" style="font-size:26px;margin-bottom:8px">' + (p.id ? 'Editar plato' : 'Agregar plato') + '</h3><form id="f-plato" data-id="' + p.id + '" novalidate><label class="campo">Nombre<input id="p_nombre" value="' + E(p.nombre) + '" maxlength="80"></label><label class="campo">Descripción<input id="p_desc" value="' + E(p.descripcion) + '" maxlength="300"></label><div class="dos-col"><label class="campo">Categoría<select id="p_cat"><option value="">Sin categoría</option>' + cats.map(function (c) { return '<option ' + (c === p.categoria ? 'selected' : '') + '>' + E(c) + '</option>'; }).join('') + '</select></label><label class="campo">Precio (CLP)<input id="p_precio" type="number" min="0" step="100" value="' + p.precio + '"></label></div><div class="dos-col"><label class="campo">Etiquetas (separadas por coma)<input id="p_etq" value="' + E(p.etiquetas_dieteticas) + '" maxlength="120" placeholder="Sin gluten, Vegetariano"></label><label class="campo">Preparación (min)<input id="p_tiempo" type="number" min="0" value="' + (p.tiempo_preparacion == null ? '' : p.tiempo_preparacion) + '"></label></div><label class="chk-l"><input type="checkbox" id="p_dest" ' + (p.destacado ? 'checked' : '') + '> Plato destacado</label><label class="chk-l"><input type="checkbox" id="p_activo" ' + (p.activo ? 'checked' : '') + '> En la carta vigente (requiere precio)</label><div id="p_err"></div>';
    if (p.id) {
      s += '<div class="campo" style="margin-bottom:0">Fotos (hasta 3)</div><div class="fotos-edit" id="p_fotos">' + p.fotos.map(function (f) { return '<figure><img src="' + E(imgUrl(f.url)) + '" alt=""><button type="button" data-act="borrarFoto" data-id="' + p.id + '" data-foto="' + f.id + '" aria-label="Borrar foto">×</button></figure>'; }).join('') + '</div>';
      s += p.fotos.length < 3 ? '<label class="btn btn-s btn-sm" style="margin-bottom:10px">Subir foto<input type="file" id="p_file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden></label><span class="suave" style="font-size:12.5px"> Se comprime en tu teléfono antes de subirla.</span>' : '<p class="suave" style="font-size:12.5px">Llegaste al máximo de 3 fotos.</p>';
      s += '<div class="campo" style="margin:14px 0 0">Vista 360°</div>' + (p.giro
        ? '<div id="g_visor"></div><div class="dos-col"><label class="btn btn-s btn-sm">Volver a grabar<input type="file" id="g_file" accept="video/*" capture="environment" hidden></label><button type="button" class="btn btn-d btn-sm" data-act="borrarGiro" data-id="' + p.id + '">Quitar 360°</button></div>'
        : '<p class="suave" style="font-size:12.5px;margin:4px 0 8px">Pon el plato en una mesa con buena luz y graba un video de 6 a 12 segundos dando <b>una vuelta lenta</b> alrededor, siempre a la misma distancia. Tu teléfono saca los cuadros y sube solo esas fotos, no el video.</p><label class="btn btn-s btn-sm">Grabar giro 360°<input type="file" id="g_file" accept="video/*" capture="environment" hidden></label>') + '<div id="g_prog"></div>';
    } else s += '<p class="suave" style="font-size:12.5px">Guarda el plato para poder agregarle fotos.</p>';
    s += '<div class="dos-col" style="margin-top:8px"><button type="button" class="btn btn-s" data-act="cerrar">Cerrar</button><button type="submit" class="btn btn-p">Guardar</button></div></form>';
    if (S.visor) { S.visor.destruir(); S.visor = null; }
    abrirModal(s, true);
    var f = $('p_file'); if (f) f.onchange = function () { subirFoto(p.id, f.files[0]); };
    var gf = $('g_file'); if (gf) gf.onchange = function () { grabarGiro(p.id, gf.files[0]); };
    if (p.giro && window.LNGiro) S.visor = window.LNGiro.crearVisor($('g_visor'), p.giro, window.LN_API_BASE || '');
    $('f-plato').onsubmit = function (e) { e.preventDefault(); guardarPlato(p.id); };
  }
  function guardarPlato(id) {
    var cuerpo = { nombre: $('p_nombre').value, descripcion: $('p_desc').value, categoria: $('p_cat').value, precio: Number($('p_precio').value) || 0, etiquetas_dieteticas: $('p_etq').value,
      tiempo_preparacion: $('p_tiempo').value === '' ? null : Number($('p_tiempo').value), destacado: $('p_dest').checked, activo: $('p_activo').checked };
    api(id ? '/api/admin/platos/' + id : '/api/admin/platos', { metodo: id ? 'PUT' : 'POST', cuerpo: cuerpo }).then(function (r) {
      if (!r.ok) { $('p_err').innerHTML = errBloque(r.error); return; }
      U.toast('Plato guardado'); cerrarModal(); cargarMenu();
    });
  }
  /* La foto se reduce y recomprime en el teléfono (máx. 1280 px, JPEG): sube rápido y cabe en el límite del servidor. */
  function comprimir(file) {
    return new Promise(function (ok, mal) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var esc = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok(b) : mal(new Error('No se pudo comprimir la foto.')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen.')); };
      img.src = url;
    });
  }
  function subirFoto(id, file) {
    if (!file) return;
    $('p_err').innerHTML = '<div class="info-bloque">Subiendo foto…</div>';
    comprimir(file).then(function (blob) {
      return api('/api/admin/platos/' + id + '/fotos', { metodo: 'POST', crudo: blob, tipo: 'image/jpeg' });
    }).then(function (r) {
      if (!r.ok) { $('p_err').innerHTML = errBloque(r.error); return; }
      return api('/api/admin/platos').then(function (l) { if (l.ok) S.platos = l.data; modalPlato(id); U.toast('Foto agregada'); pintar(); });
    }).catch(function (e) { $('p_err').innerHTML = errBloque(e.message); });
  }
  /* Giro 360°: el teléfono saca los cuadros del video (comun/giro.js) y los sube uno a uno; "cerrar" los publica de golpe. */
  function grabarGiro(id, file) {
    if (!file || !window.LNGiro) return;
    var aviso = function (t) { var e = $('g_prog'); if (e) e.innerHTML = '<div class="info-bloque">' + E(t) + '</div>'; };
    aviso('Preparando el video…');
    window.LNGiro.extraerCuadros(file, { alProgreso: function (i, n) { aviso('Sacando cuadros del video: ' + i + ' de ' + n); } }).then(function (cuadros) {
      var i = 0;
      function siguiente() {
        if (i >= cuadros.length) return api('/api/admin/platos/' + id + '/giro/cerrar', { metodo: 'POST', cuerpo: { n: cuadros.length } });
        aviso('Subiendo cuadro ' + (i + 1) + ' de ' + cuadros.length);
        return api('/api/admin/platos/' + id + '/giro/cuadros/' + i, { metodo: 'POST', crudo: cuadros[i], tipo: 'image/jpeg' }).then(function (r) { if (!r.ok) throw new Error(r.error); i++; return siguiente(); });
      }
      return siguiente();
    }).then(function (r) {
      if (!r.ok) throw new Error(r.error);
      return api('/api/admin/platos').then(function (l) { if (l.ok) S.platos = l.data; U.toast('Vista 360° lista'); modalPlato(id); pintar(); });
    }).catch(function (e) { var el = $('g_prog'); if (el) el.innerHTML = errBloque(e.message); });
  }
  function borrarFoto(id, foto) {
    api('/api/admin/platos/' + id + '/fotos/' + foto, { metodo: 'DELETE' }).then(function (r) {
      if (!r.ok) { U.toast(r.error); return; }
      api('/api/admin/platos').then(function (l) { if (l.ok) S.platos = l.data; modalPlato(id); pintar(); });
    });
  }

  /* --- planificador semanal --- */
  function vSemana() {
    if (!S.menu || !S.cfg) return '<div class="cargando" aria-busy="true"><i></i><i></i></div>';
    var m = S.menu, activos = S.platos.filter(function (p) { return p.activo && p.precio > 0; });
    var s = '<div class="nav-sem"><button class="btn btn-s btn-sm" data-act="semAnt" ' + (S.desde <= m.hoy ? 'disabled' : '') + '>‹ Anterior</button><button class="btn btn-s btn-sm" data-act="semHoy">Hoy</button><button class="btn btn-s btn-sm" data-act="semSig">Siguiente ›</button><span class="suave" style="font-size:13px">Marca los platos de cada día y sus cupos (vacío = sin límite). El día de hoy es el que ve el cliente.</span></div>';
    if (!activos.length) return s + '<div class="info-bloque">Aún no hay platos activos con precio. Actívalos en la pestaña “Carta completa”.</div>';
    s += '<div class="card"><div class="scroll-x"><table class="tabla semana"><thead><tr><th>Plato</th>';
    m.fechas.forEach(function (f) {
      s += '<th class="' + (f.fecha === m.hoy ? 'hoy' : '') + (f.pasado ? ' pasado' : '') + '" style="text-align:center">' + E(U.fechaCorta(f.fecha)) + (f.fecha === m.hoy ? '<br><span class="pill pill-n">Hoy</span>' : '') + (f.pasado ? '' : '<br><button class="btn btn-s btn-sm" style="min-height:30px;padding:3px 8px;font-size:11.5px;margin-top:4px" data-act="copiar" data-f="' + f.fecha + '">Copiar a…</button>') + '</th>';
    });
    s += '</tr></thead><tbody>';
    ordenCategorias(activos).forEach(function (c) {
      var g = activos.filter(function (p) { return (p.categoria || '') === c; });
      if (!g.length) return;
      s += '<tr class="fila-cat"><td colspan="8">' + E(c || 'Sin categoría') + '</td></tr>';
      g.forEach(function (p) {
        s += '<tr><td style="text-align:left"><b>' + E(p.nombre) + '</b></td>';
        m.fechas.forEach(function (f) {
          var it = f.items.filter(function (x) { return x.plato_id === p.id; })[0], dis = f.pasado ? ' disabled' : '';
          s += '<td class="' + (f.fecha === m.hoy ? 'hoy' : '') + (f.pasado ? ' pasado' : '') + (it && !it.habilitado ? ' pausado' : '') + '"><div class="celda"><label class="sw"><input type="checkbox" data-hab="' + f.fecha + '|' + p.id + '" ' + (it ? 'checked' : '') + dis + ' aria-label="' + E(p.nombre) + ' el ' + E(U.fechaCorta(f.fecha)) + '"><i></i></label>';
          if (it) {
            s += '<input type="number" min="0" placeholder="Sin límite" data-cupo="' + f.fecha + '|' + p.id + '" value="' + (it.cupos == null ? '' : it.cupos) + '"' + dis + ' aria-label="Cupos de ' + E(p.nombre) + '">';
            if (it.usados) s += '<small>vendidos ' + it.usados + '</small>';
            if (!f.pasado) s += '<button class="lnk" data-act="pausar" data-k="' + f.fecha + '|' + p.id + '">' + (it.habilitado ? 'Pausar (se acabó)' : 'Reanudar') + '</button>';
            if (!it.habilitado) s += '<small>pausado</small>';
          }
          s += '</div></td>';
        });
        s += '</tr>';
      });
    });
    return s + '</tbody></table></div></div>';
  }
  function itemsDeFecha(fecha) { var f = S.menu.fechas.filter(function (x) { return x.fecha === fecha; })[0]; return f ? f.items : []; }
  function guardarDia(fecha, items) {
    api('/api/admin/menu/' + fecha, { metodo: 'PUT', cuerpo: { items: items.map(function (i) { return { plato_id: i.plato_id, cupos: i.cupos, habilitado: i.habilitado !== false }; }) } }).then(function (r) {
      if (!r.ok) { U.toast(r.error); cargarMenu(); return; }
      S.menu.fechas.forEach(function (f) { if (f.fecha === fecha) f.items = r.data.items; });
      pintar();
    });
  }
  function modalCopiar(desde) {
    var futuras = []; for (var i = 0; i < 14; i++) { var f = U.sumarDias(S.menu.hoy, i); if (f !== desde) futuras.push(f); }
    abrirModal('<h3 class="titulo" style="font-size:26px;margin-bottom:6px">Copiar menú del ' + E(U.fechaCorta(desde)) + '</h3><p class="suave" style="font-size:13.5px;margin-top:0">Reemplaza el menú de los días que marques con los mismos platos y cupos. Lo ya vendido se respeta.</p><form id="f-copiar" data-desde="' + desde + '" novalidate><div style="max-height:46vh;overflow:auto">' + futuras.map(function (f) { return '<label class="chk-l"><input type="checkbox" name="d" value="' + f + '"> ' + E(U.fechaLarga(f)) + '</label>'; }).join('') + '</div><div id="c_err"></div><div class="dos-col" style="margin-top:10px"><button type="button" class="btn btn-s" data-act="cerrar">Cancelar</button><button type="submit" class="btn btn-p">Copiar</button></div></form>');
    $('f-copiar').onsubmit = function (e) {
      e.preventDefault();
      var a = Array.prototype.map.call(document.querySelectorAll('#f-copiar input[name=d]:checked'), function (x) { return x.value; });
      if (!a.length) { $('c_err').innerHTML = errBloque('Marca al menos un día.'); return; }
      api('/api/admin/menu/copiar', { metodo: 'POST', cuerpo: { desde: desde, a: a } }).then(function (r) {
        if (!r.ok) { $('c_err').innerHTML = errBloque(r.error); return; }
        cerrarModal(); U.toast('Menú copiado a ' + a.length + ' día(s)'); cargarMenu();
      });
    };
  }

  /* ================= clientes ================= */
  function cargarClientes() {
    return api('/api/admin/clientes' + (S.q ? '?q=' + encodeURIComponent(S.q) : '')).then(function (r) {
      if (!r.ok) return fallo(r);
      S.clientes = r.data; S.errorVista = ''; if (S.vista === 'clientes') { var f = document.activeElement && document.activeElement.id === 'q_cli'; pintar(); if (f) { var i = $('q_cli'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
    });
  }
  function vClientes() {
    var s = '<div class="card lista-clientes"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><div><b>Clientes con cuenta</b><div class="suave" style="font-size:13px">El sistema registra platos, pedidos y monto de cada cliente. La regla de premios del programa la define el dueño en Configuración.</div></div><input id="q_cli" type="search" placeholder="Buscar nombre, correo o teléfono" value="' + E(S.q) + '" style="max-width:260px;border:1.5px solid var(--borde);border-radius:10px;padding:9px 12px;min-height:42px"></div>';
    if (S.errorVista) s += errBloque(S.errorVista);
    if (!S.clientes) return s + '<div class="cargando" aria-busy="true"><i></i></div></div>';
    if (!S.clientes.length) return s + '<p class="suave">' + (S.q ? 'Nadie coincide con la búsqueda.' : 'Aún no hay clientes con cuenta.') + '</p></div>';
    s += '<div class="scroll-x"><table class="tabla"><thead><tr><th>Cliente</th><th>Pedidos</th><th>Platos</th><th>Comprado</th><th>Última compra</th><th></th></tr></thead><tbody>';
    S.clientes.forEach(function (c) {
      s += '<tr><td><b>' + E(c.nombre) + '</b><small>' + E(c.email) + ' · ' + E(c.telefono) + '</small></td><td class="num">' + c.pedidos + '</td><td class="num">' + c.platos + '</td><td class="num">' + U.clp(c.monto) + '</td><td>' + (c.ultima_compra ? E(c.ultima_compra.slice(0, 10)) : '—') + '</td><td><button class="btn btn-s btn-sm" data-act="claveTemp" data-id="' + c.id + '">Clave temporal</button></td></tr>';
    });
    return s + '</tbody></table></div></div>';
  }
  function modalClaveTemp(id) {
    var c = S.clientes.filter(function (x) { return x.id === +id; })[0]; if (!c) return;
    abrirModal('<h3 class="titulo" style="font-size:26px">Clave temporal</h3><p>Para <b>' + E(c.nombre) + '</b>. Úsala solo después de verificar que es el dueño de la cuenta (por ejemplo, por WhatsApp). Se cerrarán todas sus sesiones y deberá elegir una clave propia al ingresar.</p><div id="k_res"></div><div class="dos-col"><button class="btn btn-s" data-act="cerrar">Cancelar</button><button class="btn btn-p" id="k_go">Generar clave</button></div>');
    $('k_go').onclick = function () {
      this.disabled = true;
      api('/api/admin/clientes/' + id + '/clave-temporal', { metodo: 'POST' }).then(function (r) {
        if (!r.ok) { $('k_res').innerHTML = errBloque(r.error); return; }
        var msg = 'Hola ' + c.nombre.split(' ')[0] + ', tu clave temporal de La Nonna es: ' + r.data.clave_temporal + ' . Ingresa y elige una nueva.';
        $('mod').innerHTML = '<h3 class="titulo" style="font-size:26px">Clave temporal</h3><div class="info-bloque">Se muestra <b>una sola vez</b>. Anótala o envíala ahora.</div><div class="clave-temp">' + E(r.data.clave_temporal) + '</div><div class="dos-col"><button class="btn btn-s" data-act="copiarTxt" data-t="' + E(r.data.clave_temporal) + '">Copiar clave</button><a class="btn btn-p" target="_blank" rel="noopener" href="https://wa.me/' + digitos(c.telefono) + '?text=' + encodeURIComponent(msg) + '">Abrir WhatsApp</a></div><button class="btn btn-s btn-bloque" style="margin-top:8px" data-act="cerrar">Listo</button>';
      });
    };
  }

  /* ================= pantallas compartidas ================= */
  var PASOS = [[1, 'Paso 1 · Solicitados', 'Solo mira la cola de pedidos.'], [2, 'Paso 2 · Cocina', 'Puede marcar “En cocina” y “Listo”. No ve teléfono ni dirección.'], [3, 'Paso 3 · Despacho o retiro', 'Entrega los retiros en local escaneando el QR del cliente y muestra el rótulo de salida de los envíos. Ve nombre, teléfono y dirección.'],
    [4, 'Atención en mesas (mozos)', 'Cualquier mozo toma pedidos, avisa que llegó un cliente, sirve y cobra; todo queda con su nombre. Recibe alerta cuando un plato está listo.'],
    [5, 'Repartidor delivery', 'Escanea el rótulo de cada pedido que se lleva y, al entregar, el QR del cliente. Ve dirección y teléfono.']];
  function cargarEnlaces() {
    return api('/api/admin/equipo').then(function (r) { if (!r.ok) return fallo(r); S.enlaces = r.data; S.errorVista = ''; if (S.vista === 'pantallas') pintar(); });
  }
  var hora = function (t) { return t ? new Date(t).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'; };
  function vPant() {
    var s = '<p class="suave" style="margin:0 0 12px">Cada puesto tiene su <b>QR del día</b>: el personal lo escanea con la app del equipo, escribe su nombre y le aparece solo la pantalla de su puesto. Vence a medianoche, así que cada día se escanea uno nuevo. El link sirve de respaldo para una tablet o PC que no pueda escanear.</p>';
    if (S.errorVista) s += errBloque(S.errorVista);
    var q = S.enlaces;
    if (!q) return s + '<div class="cargando" aria-busy="true"><i></i></div>';
    s += '<div class="g2">' + q.qr.map(function (x) {
      var p = PASOS.filter(function (y) { return y[0] === x.paso; })[0];
      return '<div class="card"><div class="paso-c"><div><b>' + E(x.rol) + '</b><div class="suave" style="font-size:12.5px">' + E(p ? p[2] : '') + '</div></div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p btn-sm" data-act="verQR" data-paso="' + x.paso + '">Ver QR del día</button><button class="btn btn-s btn-sm" data-act="nuevoQR" data-paso="' + x.paso + '">Cambiar QR</button></div></div>';
    }).join('') + '</div>';
    s += '<div class="card" style="margin-top:12px"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><span><b>Permitir entrar desde el navegador</b><div class="suave" style="font-size:12.5px">Apagado (recomendado): el personal solo entra con la app La Nonna Equipo, que <b>bloquea las capturas de pantalla</b>. Si lo enciendes, desde un navegador no se pueden impedir capturas: la pantalla muestra el nombre y la hora de quien la usa como marca de agua.</div></span><label class="sw"><input type="checkbox" id="eq_web" ' + (q.web_permitido ? 'checked' : '') + '><i></i></label></div></div>';
    s += '<div class="card" style="margin-top:12px"><h3>Dispositivos activos hoy</h3>' + (q.dispositivos.length ? '<div class="scroll-x"><table class="tabla"><thead><tr><th>Persona</th><th>Puesto</th><th>Entró</th><th>Último uso</th><th>Medio</th><th></th></tr></thead><tbody>' + q.dispositivos.map(function (d) {
      return '<tr><td><b>' + E(d.persona) + '</b></td><td>' + E(d.rol) + '</td><td>' + hora(d.activado_en) + '</td><td>' + hora(d.ultimo_uso) + '</td><td>' + (d.canal === 'apk' ? 'App' : 'Navegador') + ' · ' + (d.via === 'qr' ? 'QR' : 'Link') + '</td><td>' + (d.activo ? '<button class="btn btn-d btn-sm" data-act="desactivar" data-id="' + d.id + '">Desactivar</button>' : '<span class="pill pill-err">Desactivado ' + hora(d.desactivado_en) + '</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="suave" style="margin:0">Nadie ha activado su dispositivo hoy.</p>') + '</div>';
    s += '<div class="card" style="margin-top:12px"><h3>Asistencia de hoy</h3><p class="suave" style="font-size:13px;margin:0 0 6px">Solo informativo: a qué hora cada persona inició su gestión (primer escaneo) y su última actividad.</p>' + (q.asistencia.length ? '<div class="scroll-x"><table class="tabla"><thead><tr><th>Persona</th><th>Inicio</th><th>Última actividad</th><th>Puestos</th></tr></thead><tbody>' + q.asistencia.map(function (a) {
      return '<tr><td><b>' + E(a.persona) + '</b></td><td>' + hora(a.inicio) + '</td><td>' + hora(a.ultimo_uso) + '</td><td>' + E(a.roles.join(', ')) + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="suave" style="margin:0">Sin registros hoy.</p>') + '</div>';
    return s;
  }
  function dibujarQR(texto) {
    var qr = qrcode(0, 'M'); qr.addData(texto); qr.make();
    var n = qr.getModuleCount(), px = 8, borde = 2, c = document.createElement('canvas');
    c.width = c.height = (n + borde * 2) * px;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#14204A';
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (qr.isDark(r, k)) x.fillRect((k + borde) * px, (r + borde) * px, px, px);
    return c;
  }
  /* Con qué dirección se arma el link: "localhost" solo funciona en este equipo, así que se usa la del servidor en la red (o la pública si hay). */
  function direccionPublica() {
    if (window.LN_WEB_BASE) return Promise.resolve({ base: window.LN_WEB_BASE, tipo: 'config' });
    if (!/^(localhost|127\.|\[::1\])/.test(location.hostname)) return Promise.resolve({ base: location.origin, tipo: 'origen' });
    return api('/api/admin/direcciones').then(function (r) {
      var d = r.ok ? r.data : {};
      if (d.publica) return { base: d.publica.replace(/\/+$/, ''), tipo: 'publica' };
      if (d.lan && d.lan.length) return { base: d.lan[0], tipo: 'lan' };
      return { base: location.origin, tipo: 'solo-local' };
    });
  }
  function modalQRMesa(m, dir) {
    var url = dir.base + '/cliente/#mesa=' + m.codigo;
    abrirModal('<h3 class="titulo" style="font-size:26px">QR · Mesa ' + m.numero + ' (' + (m.zona === 'patio' ? 'Patio' : 'Comedor') + ')</h3><div class="info-bloque">Imprímelo y pégalo en la mesa. El cliente lo escanea y se abre La Nonna en esa mesa.</div>' + (dir.tipo === 'lan' ? '<div class="info-bloque">Este link usa la dirección de tu red (<b>' + E(dir.base) + '</b>): hoy solo abre dentro del mismo wifi. Para usarlo en las mesas hay que publicar el servidor.</div>' : '') + '<div class="qr-box" id="qr"></div><div class="linkbox" id="lk"></div><div class="dos-col"><button class="btn btn-s" id="b-copiar">Copiar link</button><a class="btn btn-s" id="b-png" download="la-nonna-mesa-' + m.numero + '.png">Descargar QR</a></div><button class="btn btn-p btn-bloque" style="margin-top:8px" data-act="cerrar">Listo</button>');
    $('lk').textContent = url;
    var c = dibujarQR(url); $('qr').appendChild(c); $('b-png').href = c.toDataURL('image/png');
    $('b-copiar').onclick = function () { U.copiar(url).then(function (ok) { U.toast(ok ? 'Link copiado' : 'Copia el link manualmente'); }); };
  }
  function modalEnlace(x, dir) {
    var url = dir.base + '/' + x.url;
    var nota = dir.tipo === 'lan' ? '<div class="info-bloque">El link usa la dirección de tu red (<b>' + E(dir.base) + '</b>): funciona en el <b>mismo wifi</b> y mientras el servidor esté encendido.</div>'
      : dir.tipo === 'solo-local' ? '<div class="err-bloque">Este link solo abre en este mismo equipo: no se encontró una dirección de red.</div>' : '';
    abrirModal('<h3 class="titulo" style="font-size:26px">QR del día · ' + E(x.rol) + '</h3><div class="info-bloque">Vale <b>solo hoy</b>. Quien lo escanee escribe su nombre y queda registrado en Dispositivos y Asistencia.</div>' + nota + '<div class="qr-box" id="qr"></div><div class="linkbox" id="lk"></div><div class="dos-col"><button class="btn btn-s" id="b-copiar">Copiar link de respaldo</button><a class="btn btn-s" id="b-png" download="la-nonna-qr-' + x.paso + '.png">Descargar QR</a></div><button class="btn btn-p btn-bloque" style="margin-top:8px" data-act="cerrar">Listo</button>');
    $('lk').textContent = url;
    var c = dibujarQR(url); $('qr').appendChild(c); $('b-png').href = c.toDataURL('image/png');
    $('b-copiar').onclick = function () { U.copiar(url).then(function (ok) { U.toast(ok ? 'Link copiado' : 'Copia el link manualmente'); }); };
  }


  /* ================= configuración ================= */
  // Ajustes: cada uno es una pantalla propia, abierta desde el menú ☰ de arriba (como en Rumbo). Cada formulario guarda solo lo suyo.
  function vConfig() {
    var c = S.cfg, sec = S.vista;
    if (!c) return S.errorVista ? errBloque(S.errorVista) : '<div class="cargando" aria-busy="true"><i></i></div>';
    var sw = function (id, on, tit, ayuda) { return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0"><span><b>' + tit + '</b>' + (ayuda ? '<div class="suave" style="font-size:12.5px">' + ayuda + '</div>' : '') + '</span><label class="sw"><input type="checkbox" id="' + id + '" ' + (on ? 'checked' : '') + '><i></i></label></div>'; };
    var s = '<form class="card" id="f-config" data-sec="' + sec + '" style="max-width:700px" novalidate>';
    if (sec === 'local') s += '<label class="campo">Nombre que ve el cliente<input id="c_nombre" value="' + E(c.nombre_local) + '" maxlength="60"></label><label class="campo">Dirección<input id="c_dir" value="' + E(c.direccion) + '" maxlength="150"></label><div class="dos-col"><label class="campo">WhatsApp (solo consultas)<input id="c_wa" value="' + E(c.whatsapp) + '" maxlength="20"></label><label class="campo">Horario<input id="c_hor" value="' + E(c.horario) + '" maxlength="200"></label></div><label class="campo">Categorías de la carta (una por línea, en el orden en que se muestran)<textarea id="c_cats" rows="6">' + E((c.categorias || []).join('\n')) + '</textarea></label>';
    else if (sec === 'pedidos') s += sw('c_ab', c.pedidos_abiertos, 'Recibir pedidos ahora', 'Si lo apagas, el cliente ve “Cerrado”.') + sw('c_de', c.despacho_activo, 'Despacho a domicilio activo', '') +
      '<div class="dos-col"><label class="campo">Costo de despacho (CLP)<input id="c_cos" type="number" min="0" step="100" value="' + c.costo_despacho + '"></label><label class="campo">Pedido mínimo para despacho (CLP)<input id="c_min" type="number" min="0" step="100" value="' + c.pedido_minimo + '"></label></div><label class="campo">Zona de despacho (texto informativo)<input id="c_zona" value="' + E(c.zona_despacho) + '" maxlength="200"></label>';
    else if (sec === 'fidelidad') s += '<p class="suave" style="font-size:13px;margin:0 0 6px">El sistema ya registra por cliente sus pedidos, platos y monto. Aquí escribes la regla que verá el cliente (por ejemplo, qué se premia y cuándo). Los premios se aplican a mano por ahora.</p>' + sw('c_fid', c.fidelidad_activa, 'Mostrar el programa a los clientes', '') + '<label class="campo">Texto del programa<textarea id="c_fidtxt" rows="4" maxlength="500">' + E(c.fidelidad_descripcion) + '</textarea></label>';
    else if (sec === 'mesas') s += '<p class="suave" style="font-size:13px;margin:0 0 6px">Escribe los números de cada zona; puedes usar rangos. Ejemplo: 1-8, 10. Una mesa que quitas queda desactivada (conserva su historial).</p><div class="dos-col"><label class="campo">Mesas del comedor<input id="c_mcom" value="' + E(rangoMesas('comedor')) + '" placeholder="1-8"></label><label class="campo">Mesas del patio<input id="c_mpat" value="' + E(rangoMesas('patio')) + '" placeholder="9-14"></label></div>' +
      sw('c_mcp', c.mesa_cliente_pide, 'El cliente puede pedir desde su mesa', 'Apagado (recomendado para empezar): el cliente que escanea el QR de la mesa solo ve el menú y su cuenta; el pedido siempre lo toma el mozo. Encendido: también puede pedir y pagar desde su teléfono.') +
      '<h3 style="margin:12px 0 4px">QR de cada mesa</h3><p class="suave" style="font-size:13px;margin:0 0 6px">Imprime el QR y pégalo en la mesa. El cliente lo escanea con la cámara del teléfono; el mozo, con la app del equipo. Si alguien se lleva uno, cámbialo y el anterior deja de servir.</p>' +
      '<div class="scroll-x"><table class="tabla"><thead><tr><th>Mesa</th><th></th></tr></thead><tbody>' + S.mesas.filter(function (m) { return m.activa; }).map(function (m) { return '<tr><td><b>' + m.numero + '</b> · ' + (m.zona === 'patio' ? 'Patio' : 'Comedor') + '</td><td style="white-space:nowrap"><button type="button" class="btn btn-p btn-sm" data-act="qrMesa" data-id="' + m.id + '">Ver QR</button> <button type="button" class="btn btn-s btn-sm" data-act="nuevoQRMesa" data-id="' + m.id + '">Cambiar</button></td></tr>'; }).join('') + '</tbody></table></div>';
    return s + '<div id="c_err"></div><button class="btn btn-p" type="submit">Guardar cambios</button></form>';
  }
  function guardarConfig() {
    var sec = $('f-config').dataset.sec, n = function (id) { return Math.max(0, Number($(id).value) || 0); }, listo = function () { U.toast('Guardado'); pintar(); };
    var falla = function (r) { $('c_err').innerHTML = errBloque(r.error); };
    if (sec === 'mesas') {
      var mesas = [], malas = [];
      [['c_mcom', 'comedor'], ['c_mpat', 'patio']].forEach(function (z) {
        $(z[0]).value.split(',').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (x) {
          var r = /^(\d+)\s*-\s*(\d+)$/.exec(x), a = r ? +r[1] : +x, b = r ? +r[2] : +x;
          if (!a || !b || b < a || b - a > 99) { malas.push(x); return; }
          for (var i = a; i <= b; i++) mesas.push({ numero: i, zona: z[1] });
        });
      });
      if (malas.length) { $('c_err').innerHTML = errBloque('No entiendo estas mesas: ' + malas.join(', ') + '. Usa números o rangos como 1-8.'); return; }
      api('/api/admin/mesas', { metodo: 'PUT', cuerpo: { mesas: mesas } }).then(function (m) {
        if (!m.ok) return falla(m); S.mesas = m.data;
        return api('/api/admin/config', { metodo: 'PUT', cuerpo: { mesa_cliente_pide: $('c_mcp').checked } }).then(function (r) { if (!r.ok) return falla(r); S.cfg = r.data; listo(); });
      });
      return;
    }
    var cuerpo = sec === 'local' ? { nombre_local: $('c_nombre').value, direccion: $('c_dir').value, whatsapp: $('c_wa').value, horario: $('c_hor').value, categorias: $('c_cats').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) }
      : sec === 'pedidos' ? { pedidos_abiertos: $('c_ab').checked, despacho_activo: $('c_de').checked, costo_despacho: n('c_cos'), pedido_minimo: n('c_min'), zona_despacho: $('c_zona').value }
      : { fidelidad_activa: $('c_fid').checked, fidelidad_descripcion: $('c_fidtxt').value };
    api('/api/admin/config', { metodo: 'PUT', cuerpo: cuerpo }).then(function (r) { if (!r.ok) return falla(r); S.cfg = r.data; listo(); });
  }
  // Mesas activas de una zona como texto con rangos: 1-8, 10
  function rangoMesas(zona) {
    var ns = S.mesas.filter(function (m) { return m.zona === zona && m.activa; }).map(function (m) { return m.numero; }).sort(function (a, b) { return a - b; }), out = [];
    for (var i = 0; i < ns.length; i++) { var j = i; while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++; out.push(j > i ? ns[i] + '-' + ns[j] : String(ns[i])); i = j; }
    return out.join(', ');
  }

  /* ================= eventos ================= */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-mv],[data-cancel],[data-sub],[data-act],[data-cmv],[data-ccancel],[data-ccobrar],[data-climpia],[data-cmesa],[data-cliberar]'); if (!t) return; var d = t.dataset;
    if (d.mv) api('/api/admin/pedidos/' + encodeURIComponent(d.mv) + '/transicion', { metodo: 'POST', cuerpo: { a: d.a } }).then(function (r) { if (!r.ok) U.toast(r.error); cargarTablero(); cargarResumen(); });
    else if (d.cancel) {
      var p = ['solicitados', 'en_cocina', 'listos'].reduce(function (a, k) { return a || (S.tablero[k].filter(function (x) { return x.id === d.cancel; })[0]); }, null); if (!p) return;
      abrirModal('<h3 class="titulo" style="font-size:26px">Cancelar pedido #' + p.numero_diario + '</h3><p>Los cupos de los platos se devuelven y, si el cliente tenía cuenta, se descuenta de su acumulado. Como el pedido ya está pagado, queda marcado como <b>reembolso pendiente</b> (se devuelve a mano).</p><label class="campo">Motivo (opcional)<input id="m_cancel" maxlength="200"></label><div class="dos-col"><button class="btn btn-s" data-act="cerrar">Volver</button><button class="btn btn-d" data-act="cancelar" data-id="' + E(p.id) + '">Cancelar pedido</button></div>');
    }
    else if (d.sub) { S.sub = d.sub; pintar(); if (S.sub === 'semana' && !S.menu) cargarMenu(); }
    else if (d.cmesa && !e.target.closest('button')) detalleMesa(+d.cmesa);
    else if (d.cliberar) api('/api/admin/mesas/' + d.cliberar + '/liberar', { metodo: 'POST' }).then(function (r) { cerrarModal(); U.toast(r.ok ? 'Mesa liberada' : r.error); cargarControl(); });
    else if (d.climpia) api('/api/admin/mesas/' + d.climpia + '/limpia', { metodo: 'POST', cuerpo: {} }).then(function (r) { cerrarModal(); U.toast(r.ok ? 'Mesa disponible' : r.error); cargarControl(); });
    else if (d.cmv) api('/api/admin/pedidos/' + encodeURIComponent(d.cmv) + '/transicion', { metodo: 'POST', cuerpo: { a: d.a } }).then(function (r) { cerrarModal(); U.toast(r.ok ? 'Pedido actualizado' : r.error); cargarControl(); });
    else if (d.ccancel) {
      var pc = S.control.pedidos.filter(function (x) { return x.id === d.ccancel; })[0]; if (!pc) return;
      abrirModal('<h3 class="titulo" style="font-size:26px">Cancelar pedido #' + pc.numero + '</h3><p>Los cupos de los platos se devuelven.</p><label class="campo">Motivo (opcional)<input id="m_cancel" maxlength="200"></label><div class="dos-col" style="margin-top:10px"><button class="btn btn-s" data-act="cerrar">Volver</button><button class="btn btn-d" data-act="cancelarC" data-id="' + E(pc.id) + '">Cancelar pedido</button></div>');
    }
    else if (d.act === 'cancelarC') api('/api/admin/pedidos/' + encodeURIComponent(d.id) + '/cancelar', { metodo: 'POST', cuerpo: { motivo: $('m_cancel') ? $('m_cancel').value : '' } }).then(function (r) { cerrarModal(); U.toast(r.ok ? 'Pedido cancelado' : r.error); cargarControl(); });
    else if (d.ccobrar) abrirModal('<h3 class="titulo" style="font-size:26px">Registrar cobro</h3><p>¿Cómo pagó el cliente?</p><div class="dos-col"><button class="btn btn-p" data-act="cobrarC" data-id="' + E(d.ccobrar) + '" data-medio="efectivo">💵 Efectivo</button><button class="btn btn-p" data-act="cobrarC" data-id="' + E(d.ccobrar) + '" data-medio="tarjeta">💳 Tarjeta (posnet)</button></div><div style="margin-top:8px"><button class="btn btn-p btn-bloque" data-act="cobrarC" data-id="' + E(d.ccobrar) + '" data-medio="transferencia">🏦 Transferencia</button></div><div style="margin-top:8px"><button class="btn btn-s btn-bloque" data-act="cerrar">Volver</button></div>');
    else if (d.act === 'cobrarC') api('/api/admin/pedidos/' + encodeURIComponent(d.id) + '/cobrar', { metodo: 'POST', cuerpo: { medio: d.medio, persona: 'admin' } }).then(function (r) { cerrarModal(); U.toast(r.ok ? 'Cobro registrado' : r.error); cargarControl(); });
    else if (d.act === 'cerrar') cerrarModal();
    else if (d.act === 'cancelar') api('/api/admin/pedidos/' + encodeURIComponent(d.id) + '/cancelar', { metodo: 'POST', cuerpo: { motivo: $('m_cancel') ? $('m_cancel').value : '' } }).then(function (r) { cerrarModal(); U.toast(r.ok ? 'Pedido cancelado, cupos devueltos' : r.error); cargarTablero(); });
    else if (d.act === 'nuevoPlato') modalPlato(0);
    else if (d.act === 'editar') modalPlato(d.id);
    else if (d.act === 'borrarFoto') borrarFoto(d.id, d.foto);
    else if (d.act === 'borrarGiro') api('/api/admin/platos/' + d.id + '/giro', { metodo: 'DELETE' }).then(function (r) { U.toast(r.ok ? 'Vista 360° quitada' : r.error); return api('/api/admin/platos'); }).then(function (l) { if (l && l.ok) S.platos = l.data; modalPlato(d.id); pintar(); });
    else if (d.act === 'semAnt') { S.desde = U.sumarDias(S.desde, -7); if (S.desde < S.menu.hoy) S.desde = S.menu.hoy; cargarMenu(); }
    else if (d.act === 'semSig') { S.desde = U.sumarDias(S.desde, 7); cargarMenu(); }
    else if (d.act === 'semHoy') { S.desde = S.menu.hoy; cargarMenu(); }
    else if (d.act === 'copiar') modalCopiar(d.f);
    else if (d.act === 'pausar') { var k = d.k.split('|'), its = itemsDeFecha(k[0]).map(function (i) { return { plato_id: i.plato_id, cupos: i.cupos, habilitado: i.plato_id === +k[1] ? !i.habilitado : i.habilitado }; }); guardarDia(k[0], its); }
    else if (d.act === 'claveTemp') modalClaveTemp(d.id);
    else if (d.act === 'copiarTxt') U.copiar(d.t).then(function (ok) { U.toast(ok ? 'Copiado' : 'Cópialo manualmente'); });
    else if (d.act === 'verQR') { var qx = S.enlaces.qr.filter(function (y) { return y.paso === +d.paso; })[0]; direccionPublica().then(function (dir) { modalEnlace(qx, dir); }); }
    else if (d.act === 'qrMesa') { var mq = S.mesas.filter(function (y) { return y.id === +d.id; })[0]; direccionPublica().then(function (dir) { modalQRMesa(mq, dir); }); }
    else if (d.act === 'nuevoQRMesa') abrirModal('<h3 class="titulo" style="font-size:26px">Cambiar QR de la mesa</h3><p>El QR impreso deja de funcionar y tendrás que imprimir el nuevo.</p><div class="dos-col"><button class="btn btn-s" data-act="cerrar">Volver</button><button class="btn btn-p" data-act="nuevoQRMesaOk" data-id="' + d.id + '">Cambiar QR</button></div>');
    else if (d.act === 'nuevoQRMesaOk') api('/api/admin/mesas/' + d.id + '/qr/nuevo', { metodo: 'POST' }).then(function (r) { cerrarModal(); if (!r.ok) { U.toast(r.error); return; } S.mesas = S.mesas.map(function (y) { return y.id === r.data.id ? r.data : y; }); direccionPublica().then(function (dir) { modalQRMesa(r.data, dir); }); });
    else if (d.act === 'nuevoQR') abrirModal('<h3 class="titulo" style="font-size:26px">Cambiar QR del día</h3><p>Úsalo si el QR se filtró o alguien no debería entrar. El QR actual deja de activar teléfonos nuevos; los que ya entraron siguen hasta que los desactives.</p><div class="dos-col"><button class="btn btn-s" data-act="cerrar">Volver</button><button class="btn btn-p" data-act="nuevoQROk" data-paso="' + d.paso + '">Cambiar QR</button></div>');
    else if (d.act === 'nuevoQROk') api('/api/admin/equipo/qr/' + d.paso + '/nuevo', { metodo: 'POST' }).then(function (r) { cerrarModal(); if (!r.ok) { U.toast(r.error); return; } cargarEnlaces(); direccionPublica().then(function (dir) { modalEnlace(r.data, dir); }); });
    else if (d.act === 'desactivar') abrirModal('<h3 class="titulo" style="font-size:26px">Desactivar dispositivo</h3><p>Esa pantalla se bloquea al instante. Para volver a entrar, la persona necesita el QR del día.</p><div class="dos-col"><button class="btn btn-s" data-act="cerrar">Volver</button><button class="btn btn-d" data-act="desactivarOk" data-id="' + d.id + '">Desactivar</button></div>');
    else if (d.act === 'desactivarOk') api('/api/admin/equipo/dispositivos/' + d.id + '/desactivar', { metodo: 'POST' }).then(function (r) { cerrarModal(); U.toast(r.ok ? 'Dispositivo desactivado' : 'No se pudo desactivar'); cargarEnlaces(); });
  });
  document.addEventListener('change', function (e) {
    var t = e.target, d = t.dataset, p;
    if (t.id === 'eq_web') { api('/api/admin/config', { metodo: 'PUT', cuerpo: { equipo_web_permitido: t.checked } }).then(function (r) { if (!r.ok) U.toast(r.error); else { S.cfg = r.data; U.toast(t.checked ? 'Navegador permitido: sin bloqueo de capturas' : 'Solo con la app'); } cargarEnlaces(); }); return; }
    if (d.precio) { p = S.platos.filter(function (x) { return x.id === +d.precio; })[0]; api('/api/admin/platos/' + d.precio, { metodo: 'PUT', cuerpo: { precio: Number(t.value) || 0 } }).then(function (r) { if (!r.ok) U.toast(r.error); else U.toast('Precio actualizado'); api('/api/admin/platos').then(function (l) { if (l.ok) S.platos = l.data; pintar(); }); }); }
    else if (d.activo) api('/api/admin/platos/' + d.activo, { metodo: 'PUT', cuerpo: { activo: t.checked } }).then(function (r) { if (!r.ok) U.toast(r.error); else U.toast(t.checked ? 'Plato activado en la carta' : 'Plato desactivado de la carta'); api('/api/admin/platos').then(function (l) { if (l.ok) S.platos = l.data; pintar(); }); });
    else if (d.hab) {
      var a = d.hab.split('|'), fecha = a[0], id = +a[1], its = itemsDeFecha(fecha).map(function (i) { return { plato_id: i.plato_id, cupos: i.cupos, habilitado: i.habilitado }; });
      if (t.checked) its.push({ plato_id: id, cupos: null, habilitado: true }); else its = its.filter(function (i) { return i.plato_id !== id; });
      guardarDia(fecha, its);
    }
    else if (d.cupo) {
      var b = d.cupo.split('|'), its2 = itemsDeFecha(b[0]).map(function (i) { return { plato_id: i.plato_id, cupos: i.plato_id === +b[1] ? (t.value === '' ? null : Math.max(0, Number(t.value))) : i.cupos, habilitado: i.habilitado }; });
      guardarDia(b[0], its2);
    }
    else if (t.id === 'd_fecha') { S.dashFecha = t.value; cargarDash(); }
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'q_cli') { S.q = e.target.value; clearTimeout(S._qt); S._qt = setTimeout(cargarClientes, 300); } });
  document.addEventListener('submit', function (e) { if (e.target.id === 'f-config') { e.preventDefault(); guardarConfig(); } if (e.target.id === 'f-clave') { e.preventDefault(); cambiarClave(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarModal(); });

  /* ================= arranque ================= */
  /* Splash: la barra avanza con lo que de verdad ya cargó (sesión → carta y config → tablero). */
  var t0 = Date.now(), ticks = 0;
  function avance(p) { var b = $('splash-avance'); if (b) { b.firstChild.style.width = p + '%'; b.setAttribute('aria-valuenow', p); } }
  function quitarSplash() {
    var s = $('splash'); if (!s || new URLSearchParams(location.search).has('fijo')) return;      // ?fijo: vista previa del splash sin que se cierre
    setTimeout(function () { s.classList.add('fuera'); setTimeout(function () { s.remove(); }, 400); }, Math.max(0, 1400 - (Date.now() - t0)));
  }
  function iniciar() {
    armar(); cabecera(); avance(55);
    cargarComun().then(function (ok) {
      if (!ok) { quitarSplash(); return; }
      api('/api/admin/yo').then(function (r) { if (r.ok) { S.claveProvisoria = !!r.data.clave_provisoria; if (S.claveProvisoria) pintar(); } });
      avance(80); pintar();
      Promise.all([cargarTablero(), cargarResumen()]).then(function () { avance(100); quitarSplash(); });
      clearInterval(timer);
      timer = setInterval(function () { ticks++; if (S.vista === 'tablero') { cargarTablero(); if (ticks % 3 === 0) cargarResumen(); } else if (S.vista === 'control') cargarControl(); }, 5000);
    });
  }
  var slogo = $('splash-logo'); if (slogo) slogo.innerHTML = U.logo(110, false);
  var splashEl = $('splash'); if (splashEl) {
    var variante = (new URLSearchParams(location.search).get('splash') || window.LN_SPLASH || 'chef');
    splashEl.setAttribute('data-variante', ['chef', 'logo', 'icono'].indexOf(variante) >= 0 ? variante : 'chef');
  }
  avance(12);
  api('/api/admin/config').then(function (r) { avance(35); if (r.ok) iniciar(); else { pantallaLogin(); avance(100); quitarSplash(); } });
  setTimeout(quitarSplash, 7000);                       // respaldo: el splash nunca se queda pegado
})();
