/* La Nonna — app del cliente (web y APK, mismo código). Habla con la API real; nada de precios ni totales se decide aquí. */
(function () {
  var L = window.LN, U = window.U, E = U.esc, $ = function (i) { return document.getElementById(i); };
  var S = {
    tab: 'menu', menu: null, cargandoMenu: true, errorMenu: '', semana: null, verSemana: false,
    token: L.leerLocal('ln_c_token', ''), cliente: null, cuenta: null, historial: null, modoCuenta: 'ingreso', errCuenta: '', okCuenta: '',
    carrito: {}, tipo: 'retiro', datos: L.leerLocal('ln_c_datos', { nombre: '', tel: '', dir: '', ref: '' }), errores: {}, enviando: false,
    pedidoId: L.leerLocal('ln_c_pedido', ''), pedido: null, errorPedido: '', galeria: null, form: {},
    mesa: null, mesaInfo: null, apkUrl: '', selPago: {}
  };
  (function () {                                                         // QR de la mesa: #mesa=CODIGO
    var m = /[#&]mesa=([A-Za-z0-9]{6,30})/.exec(location.hash || ''), hoyCL = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    if (m) { S.mesa = { codigo: m[1].toUpperCase(), fecha: hoyCL }; L.guardarLocal('ln_c_mesa', S.mesa); history.replaceState(null, '', location.pathname); S.mesaRecienEscaneada = true; }
    else { var g = L.leerLocal('ln_c_mesa', null); if (g && g.fecha === hoyCL) S.mesa = g; }
  })();
  var firmaVista = '', ticks = 0;
  var ETAPAS = [['solicitado', 'Recibido'], ['en_cocina', 'En preparación'], ['listo', 'Listo'], ['entregado', 'Entregado']];
  var MSG = { solicitado: 'Recibimos tu pedido y ya está ingresado.', en_cocina: 'Estamos preparando tu pedido.', listo: 'Tu pedido está listo.', en_camino: 'Tu pedido va en camino.', entregado: 'Pedido entregado. Gracias por elegirnos.' };

  var imgUrl = function (u) { return (window.LN_API_BASE || '') + '/' + u; };
  var local = function () { return (S.menu && S.menu.local) || { nombre: 'La Nonna Restaurante', horario: '', categorias: [], fidelidad: {} }; };
  var platos = function () { return (S.menu && S.menu.platos) || []; };
  var plato = function (id) { return platos().filter(function (p) { return p.id === +id; })[0]; };
  var maxDe = function (p) { return p.disponibles == null ? 99 : p.disponibles; };
  var nItems = function () { return Object.keys(S.carrito).reduce(function (s, k) { return s + S.carrito[k].c; }, 0); };
  var subtotal = function () { return Object.keys(S.carrito).reduce(function (s, k) { var p = plato(k); return s + (p ? p.precio * S.carrito[k].c : 0); }, 0); };
  var guardarCarrito = function () { L.guardarLocal('ln_c_carrito', { fecha: S.menu && S.menu.fecha, items: S.carrito }); };
  var digitos = function (s) { return String(s || '').replace(/\D/g, ''); };

  /* ---------- carga de datos ---------- */
  function cargarMenu(silencioso) {
    if (!silencioso) { S.cargandoMenu = true; render(); }
    return L.api('/api/menu').then(function (r) {
      S.cargandoMenu = false;
      if (!r.ok) { S.errorMenu = r.error; if (!silencioso) render(); return; }
      S.errorMenu = ''; S.menu = r.data;
      var g = L.leerLocal('ln_c_carrito', null);                       // el carrito guardado solo vale el mismo día
      if (!Object.keys(S.carrito).length && g && g.fecha === r.data.fecha) S.carrito = g.items || {};
      Object.keys(S.carrito).forEach(function (k) {                    // se descartan platos que ya no están o se agotaron
        var p = plato(k);
        if (!p || p.agotado) delete S.carrito[k]; else S.carrito[k].c = Math.min(S.carrito[k].c, maxDe(p));
      });
      guardarCarrito();
      render();
    });
  }
  function cargarSemana() {
    return L.api('/api/menu/semana').then(function (r) { S.semana = r.ok ? r.data.dias : []; render(); });
  }
  function cargarCuenta() {
    if (!S.token) { S.cliente = null; S.cuenta = null; return Promise.resolve(); }
    return L.api('/api/cuenta', { bearer: S.token }).then(function (r) {
      if (r.status === 401) { cerrarSesionLocal(); return; }
      if (r.ok) { S.cuenta = r.data; S.cliente = r.data.cliente; }
      return L.api('/api/cuenta/pedidos', { bearer: S.token }).then(function (h) { if (h.ok) S.historial = h.data.pedidos; });
    }).then(function () { render(); });
  }
  function cargarPedido() {
    if (!S.pedidoId) return Promise.resolve();
    return L.api('/api/pedidos/' + encodeURIComponent(S.pedidoId)).then(function (r) {
      if (r.status === 404) { S.pedidoId = ''; S.pedido = null; L.borrarLocal('ln_c_pedido'); }
      else if (r.ok) { S.pedido = r.data; S.errorPedido = ''; }
      else S.errorPedido = r.error;
      if (S.tab === 'seguim') render();
    });
  }
  function cargarMesa() {
    if (!S.mesa) return Promise.resolve();
    return L.api('/api/mesa/' + encodeURIComponent(S.mesa.codigo)).then(function (r) {
      if (r.status === 404) { S.mesa = null; S.mesaInfo = null; L.borrarLocal('ln_c_mesa'); U.toast(r.error); }
      else if (r.ok) S.mesaInfo = r.data;
      render();
    });
  }
  var enMesaSinPedir = function () { return S.mesa && !(S.mesaInfo && S.mesaInfo.cliente_pide); };
  function bandaMesa() {
    if (!S.mesa) return '';
    var m = S.mesaInfo, cta = m ? m.cuenta.por_pagar : 0;
    var s = '<div class="mesa-banda"><div class="mb-t">🍽 Estás en la <b>Mesa ' + (m ? m.mesa.numero + ' · ' + U.zonaNombre(m.mesa.zona) : '…') + '</b></div>';
    s += enMesaSinPedir() ? '<p>Mira el menú con calma: <b>tu pedido lo toma el mozo</b>.</p>' : '<p>Puedes pedir desde aquí y pagar con la app: te lo llevamos a la mesa.</p>';
    s += '<button class="btn btn-p btn-bloque" data-act="cuentaMesa">Ver la cuenta de mi mesa' + (cta ? ' · <span class="num">' + U.clp(cta) + '</span>' : '') + '</button>';
    if (!S.cliente) s += '<div class="mb-app"><b>Llévate La Nonna en tu teléfono.</b> Crea tu cuenta y pide delivery o retiro cuando quieras; tus compras suman al programa de fidelidad.<div class="mb-acc"><button class="btn btn-s btn-sm" data-act="aCuenta">Crear mi cuenta</button>' + (!L.MODO_APK && S.apkUrl ? '<a class="btn btn-s btn-sm" href="' + E(S.apkUrl) + '">Descargar la app (Android)</a>' : '') + '</div></div>';
    return s + '<button class="mb-salir" data-act="salirMesa">No estoy en el local</button></div>';
  }
  // Identificador anónimo de este teléfono: sirve para contar cuántas personas de la mesa escanearon el QR.
  function idDispositivo() { var d = L.leerLocal('ln_c_disp', ''); if (!d) { d = 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36); L.guardarLocal('ln_c_disp', d); } return d; }
  function totalSel() { var m = S.mesaInfo, t = 0; if (!m) return 0; m.cuenta.pedidos.forEach(function (p) { p.items.forEach(function (i) { t += (S.selPago[i.item_id] || 0) * i.precio; }); }); return t; }
  function modalCuentaMesa() {
    var m = S.mesaInfo; if (!m) return;
    var c = m.cuenta, s = '<h3 class="titulo" style="font-size:26px">Cuenta · Mesa ' + m.mesa.numero + '</h3>';
    if (!c.pedidos.length) s += '<p>Tu mesa no tiene nada pendiente de pago.</p>';
    else {
      s += '<p class="sub" style="margin:0 0 8px">¿Pagan por separado? Marca solo lo tuyo con + y −.</p>';
      c.pedidos.forEach(function (p) { p.items.forEach(function (i) {
        if (!i.pendientes) { s += '<div class="lin suave"><span>' + i.cantidad + ' × ' + E(i.nombre) + '</span><span>Pagado</span></div>'; return; }
        var q = S.selPago[i.item_id] || 0;
        s += '<div class="lin" style="align-items:center"><span>' + E(i.nombre) + ' <span class="suave">(' + i.pendientes + ' por pagar · ' + U.clp(i.precio) + ' c/u)</span></span><span class="step"><button data-act="selMenos" data-id="' + i.item_id + '" ' + (q ? '' : 'disabled') + ' aria-label="Quitar">−</button><span class="num">' + q + '</span><button data-act="selMas" data-id="' + i.item_id + '" data-max="' + i.pendientes + '" ' + (q >= i.pendientes ? 'disabled' : '') + ' aria-label="Agregar">+</button></span></div>';
      }); });
      s += '<div class="lin tot"><span>Total de la mesa por pagar</span><span class="num">' + U.clp(c.por_pagar) + '</span></div>';
      s += S.cliente ? '<div class="ok-bloque" style="margin-top:8px">Pagas con tu cuenta, <b>' + E(S.cliente.nombre) + '</b>: suma a tu programa de fidelidad.</div>' : '<div class="info-bloque" style="margin-top:8px">Si <a href="#" data-act="aCuenta" style="color:inherit;font-weight:700">creas tu cuenta</a> antes de pagar, esta compra suma a tu programa de fidelidad.</div>';
      var ts = totalSel();
      if (ts) s += '<button class="btn btn-p btn-bloque" style="margin-top:10px" data-act="pagarMesa" data-sel="1">Pagar lo mío · <span class="num">' + U.clp(ts) + '</span></button>';
      s += '<button class="btn ' + (ts ? 'btn-s' : 'btn-p') + ' btn-bloque" style="margin-top:8px" data-act="pagarMesa">Pagar toda la mesa · <span class="num">' + U.clp(c.por_pagar) + '</span></button><p class="suave" style="font-size:12.5px;margin:6px 0 0">También puedes pagarle al mozo en efectivo o con tarjeta.</p>';
    }
    abrirModal(s + '<button class="btn btn-s btn-bloque" style="margin-top:8px" data-act="cerrarm">Cerrar</button>');
  }
  function pagarMesa(soloSel) {
    var items = soloSel ? Object.keys(S.selPago).filter(function (k) { return S.selPago[k] > 0; }).map(function (k) { return { item_id: +k, cantidad: S.selPago[k] }; }) : null;
    L.api('/api/mesa/' + encodeURIComponent(S.mesa.codigo) + '/pagar', { metodo: 'POST', bearer: S.token, cuerpo: { simular: 'aprobado', items: items } }).then(function (r) {
      cerrarModal(); S.selPago = {};
      U.toast(r.ok ? 'Pago aprobado: ' + U.clp(r.data.total) + (r.data.fidelidad ? ' · sumado a tu fidelidad' : '') + '. ¡Gracias!' : r.error);
      cargarMesa(); if (S.cliente) cargarCuenta();
    });
  }
  function cerrarSesionLocal() { S.token = ''; S.cliente = null; S.cuenta = null; S.historial = null; L.borrarLocal('ln_c_token'); }

  /* ---------- piezas de pantalla ---------- */
  function cabecera() {
    var l = local(), p = $('estado');
    $('nombre').textContent = l.nombre;
    if (!S.menu) { p.className = 'pill pill-g'; p.textContent = '…'; }
    else { p.className = 'pill ' + (l.pedidos_abiertos ? 'pill-ok' : 'pill-err'); p.textContent = l.pedidos_abiertos ? 'Abierto' : 'Cerrado'; }
    var n = nItems(), i = $('ins'); i.hidden = !n; i.textContent = n;
    document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === S.tab); });
  }
  function bloqueError(txt, accion) {
    return '<div class="err-bloque">' + E(txt) + (accion ? ' <button class="btn btn-s btn-sm" data-act="' + accion + '" style="margin-left:6px">Reintentar</button>' : '') + '</div>';
  }
  function pie() {
    var wa = digitos(local().whatsapp);
    return (wa ? '<a class="dudas" target="_blank" rel="noopener" href="https://wa.me/' + wa + (S.pedido && S.pedido.numero ? '?text=' + encodeURIComponent('Consulta sobre pedido #' + S.pedido.numero) : '') + '">¿Dudas? Escríbenos</a>' : '') +
      '<div class="by">by <b>BTo Innova</b></div>';
  }
  function foto(p) {
    var insignia = p.giro ? '<span class="g360">360°</span>' : '';
    if (p.fotos && p.fotos.length) return '<img src="' + E(imgUrl(p.fotos[0].url)) + '" alt="' + E(p.nombre) + '" loading="lazy">' + (p.fotos.length > 1 ? '<span class="n-fotos">' + p.fotos.length + '</span>' : '') + insignia;
    if (p.giro) return '<img src="' + E(imgUrl(p.giro.ruta + '00.' + p.giro.ext)) + '" alt="' + E(p.nombre) + '" loading="lazy">' + insignia;
    return U.platoArte(p.id, 64);
  }

  /* ---------- portada y plato destacado (el menú no se ve vacío) ---------- */
  var RUTA_IMG = function () { return window.LN_RUTA_IMG || '../img/'; };
  function hero() {
    var l = local(), ps = platos(), chips = [];
    chips.push('<span class="pill pill-n">' + ps.length + (ps.length === 1 ? ' plato hoy' : ' platos hoy') + '</span>');
    chips.push('<span class="pill pill-g">Retiro sin costo</span>');
    if (l.despacho_activo) chips.push('<span class="pill pill-g">Despacho ' + U.clp(l.costo_despacho) + '</span>');
    return '<section class="card hero" aria-label="Sobre La Nonna"><div class="hero-txt"><div class="hero-t titulo">Cocina hogareña</div>' +
      '<p>Disfruta de nuestra mesa. También llevamos el sabor a tu casa u oficina.</p>' +
      '<p><b>' + E(l.direccion || '') + '</b>' + (l.horario ? '<br>Horario: ' + E(l.horario) : '') + '</p><div class="chips">' + chips.join('') + '</div></div>' +
      '<img class="hero-chef" src="' + RUTA_IMG() + 'chef.webp" alt="El chef y dueño de La Nonna" width="279" height="374"></section>';
  }
  function destacado(abierto) {
    var p = platos().filter(function (x) { return x.destacado && !x.agotado; })[0]; if (!p) return '';
    var src = p.fotos && p.fotos.length ? imgUrl(p.fotos[0].url) : p.giro ? imgUrl(p.giro.ruta + '00.' + p.giro.ext) : ''; if (!src) return '';
    return '<article class="dest" data-act="detalle" data-id="' + p.id + '" role="button" tabindex="0" aria-label="Ver ' + E(p.nombre) + '"><img src="' + E(src) + '" alt="' + E(p.nombre) + '" loading="lazy"><div class="dest-in"><span class="pill pill-n">Plato destacado</span>' + (p.giro ? ' <span class="pill pill-g">360°</span>' : '') +
      '<h3>' + E(p.nombre) + '</h3><div class="fila"><span class="precio num">' + U.clp(p.precio) + '</span>' + (abierto ? '<button class="btn btn-p btn-sm" data-act="mas" data-id="' + p.id + '">Agregar</button>' : '') + '</div></div></article>';
  }

  /* ---------- MENÚ ---------- */
  function tarjetaPlato(p, abierto) {
    var q = (S.carrito[p.id] || { c: 0 }).c, max = maxDe(p);
    var s = '<article class="card plato' + (p.agotado ? ' ago' : '') + '"><div class="foto" data-act="detalle" data-id="' + p.id + '" role="button" tabindex="0" aria-label="Ver ' + E(p.nombre) + '">' + foto(p) + '</div><div><h3>' + E(p.nombre) + (p.destacado ? ' <span class="pill pill-n">Destacado</span>' : '') + '</h3>';
    if (p.descripcion) s += '<p>' + E(p.descripcion) + '</p>';
    if (p.etiquetas_dieteticas) s += '<div class="etq">' + p.etiquetas_dieteticas.split(',').map(function (x) { return '<span class="pill pill-g">' + E(x.trim()) + '</span>'; }).join('') + '</div>';
    s += '<div class="fila"><span class="precio num">' + U.clp(p.precio) + '</span>';
    if (p.agotado) s += '<span class="pill pill-err">Agotado</span>';
    else s += '<span class="step"><button data-act="menos" data-id="' + p.id + '" aria-label="Quitar uno" ' + (q ? '' : 'disabled') + '>−</button><span class="num" aria-live="polite">' + q + '</span><button data-act="mas" data-id="' + p.id + '" aria-label="Agregar uno" ' + (q >= max || !abierto ? 'disabled' : '') + '>+</button></span>';
    s += '</div>' + (p.disponibles != null && !p.agotado ? '<div style="margin-top:5px"><span class="pill ' + (p.disponibles <= 3 ? 'pill-warn' : 'pill-g') + '">Quedan ' + p.disponibles + '</span></div>' : '') + '</div></article>';
    return s;
  }
  function vMenu() {
    var l = local();
    if (S.cargandoMenu && !S.menu) return '<div class="cargando" aria-busy="true"><i></i><i></i><i></i></div>';
    if (!S.menu) return bloqueError(S.errorMenu || 'No pudimos cargar el menú.', 'recargar');
    var s = bandaMesa() + hero() + '<h2 class="titulo">Menú de hoy</h2><p class="sub">' + E(U.fechaLarga(S.menu.fecha)) + '</p>';
    s += destacado(l.pedidos_abiertos && !enMesaSinPedir());
    if (S.errorMenu) s += bloqueError('Sin conexión: mostrando el último menú cargado.');
    if (!l.pedidos_abiertos) s += '<div class="err-bloque"><b>El local no está recibiendo pedidos ahora.</b> Puedes revisar el menú y volver más tarde.</div>';
    var ps = platos();
    if (!ps.length) s += '<div class="vacio"><svg viewBox="0 0 24 24"><path d="M6 3v8M9 3v8M6 7h3M7.5 11v10M16 3c-2 2-2 6 0 8v10"/></svg><p>Hoy no hay menú publicado.</p></div>';
    else {
      var orden = (l.categorias || []).slice(), usados = {};
      ps.forEach(function (p) { if (p.categoria && orden.indexOf(p.categoria) < 0) orden.push(p.categoria); });
      orden.push('');
      orden.forEach(function (c) {
        var grupo = ps.filter(function (p) { return (p.categoria || '') === c && !usados[p.id]; });
        if (!grupo.length) return;
        grupo.forEach(function (p) { usados[p.id] = 1; });
        s += (c ? '<div class="cat-t">' + E(c) + '</div>' : (orden.length > 2 ? '<div class="cat-t">Otros</div>' : '')) + grupo.map(function (p) { return tarjetaPlato(p, l.pedidos_abiertos && !enMesaSinPedir()); }).join('');
      });
    }
    s += '<div class="dias-sem"><button class="btn btn-s btn-sm btn-bloque" data-act="semana">' + (S.verSemana ? 'Ocultar próximos días' : 'Ver el menú de los próximos días') + '</button>';
    if (S.verSemana) {
      if (!S.semana) s += '<p class="sub">Cargando…</p>';
      else if (!S.semana.length) s += '<p class="sub" style="margin-top:8px">Aún no hay menú publicado para los próximos días.</p>';
      else s += '<div style="margin-top:8px"><p class="sub" style="margin-bottom:6px">Solo informativo: los pedidos se hacen para el menú de hoy.</p>' + S.semana.map(function (d) { return '<details><summary>' + E(U.fechaLarga(d.fecha)) + '</summary><ul>' + d.platos.map(function (p) { return '<li>' + E(p.nombre) + '</li>'; }).join('') + '</ul></details>'; }).join('') + '</div>';
    }
    s += '</div>';
    var n = nItems();
    if (n && !enMesaSinPedir()) s += '<div class="barra"><button class="btn btn-p btn-bloque" data-act="irpedido">Ver pedido (' + n + ') · <span class="num">' + U.clp(subtotal()) + '</span></button></div>';
    return s + pie();
  }

  /* ---------- MI PEDIDO ---------- */
  function vPedido() {
    var l = local(), ids = Object.keys(S.carrito);
    if (!ids.length) return '<div class="vacio"><svg viewBox="0 0 24 24"><path d="M5 7h14l-1.5 11a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 7zM9 7a3 3 0 0 1 6 0"/></svg><p>Tu pedido está vacío.</p><button class="btn btn-p" data-act="irmenu">Volver al menú</button></div>';
    if (S.cliente) { if (!S.datos.nombre) S.datos.nombre = S.cliente.nombre; if (!S.datos.tel) S.datos.tel = S.cliente.telefono; }
    var sub = subtotal(), desp = S.tipo === 'domicilio' ? l.costo_despacho : 0, tot = sub + desp, bajoMin = S.tipo === 'domicilio' && sub < l.pedido_minimo;
    var s = '<h2 class="titulo">Mi pedido</h2><p class="sub">Revisa los platos y elige cómo recibirlos.</p>';
    s += S.cliente ? '<div class="ok-bloque">Pides con tu cuenta, <b>' + E(S.cliente.nombre) + '</b>: este pedido suma a tu historial.</div>' : '<div class="info-bloque">Puedes pedir sin cuenta. <a href="#" data-act="aCuenta" style="color:inherit;font-weight:700">Crea una cuenta</a> para guardar tus datos y acumular en el programa de fidelidad.</div>';
    s += '<div class="r-vaciar"><button class="quitar" data-act="vaciar">Vaciar pedido</button></div><div class="card" style="margin-bottom:12px">';
    ids.forEach(function (k) {
      var p = plato(k); if (!p) return;
      s += '<div class="item-c"><div class="r1"><span>' + E(p.nombre) + '</span><span class="num">' + U.clp(p.precio * S.carrito[k].c) + '</span></div><div class="r2"><span class="step"><button data-act="menos" data-id="' + k + '" aria-label="Quitar uno">−</button><span class="num" aria-live="polite">' + S.carrito[k].c + '</span><button data-act="mas" data-id="' + k + '" aria-label="Agregar uno" ' + (S.carrito[k].c >= maxDe(p) ? 'disabled' : '') + '>+</button></span><button class="quitar" data-act="quitar" data-id="' + k + '">Quitar plato</button></div><input data-nota="' + k + '" placeholder="Nota para este plato (ej. sin cebolla)" value="' + E(S.carrito[k].nota || '') + '" maxlength="120" aria-label="Nota para ' + E(p.nombre) + '"></div>';
    });
    if (S.mesa && S.mesaInfo && S.mesaInfo.cliente_pide) {
      s += '</div><div class="ok-bloque">🍽 Pedido para la <b>Mesa ' + S.mesaInfo.mesa.numero + '</b>: pagas con la app y te lo llevamos a la mesa.</div><div class="card"><div class="lin tot"><span>Total</span><span class="num">' + U.clp(sub) + '</span></div></div>';
      return s + '<div class="barra"><button class="btn btn-p btn-bloque" data-act="pagar" ' + (!l.pedidos_abiertos || S.enviando ? 'disabled' : '') + '>' + (S.enviando ? 'Creando tu pedido…' : 'Continuar al pago · <span class="num">' + U.clp(sub) + '</span>') + '</button></div>' + pie();
    }
    s += '</div><div class="seg"><button data-act="tipo" data-v="retiro" class="' + (S.tipo === 'retiro' ? 'on' : '') + '">Retiro en local<small>Sin costo</small></button><button data-act="tipo" data-v="domicilio" ' + (l.despacho_activo ? '' : 'disabled') + ' class="' + (S.tipo === 'domicilio' ? 'on' : '') + '">Envío a domicilio<small>' + (l.despacho_activo ? U.clp(l.costo_despacho) + ' · mín. ' + U.clp(l.pedido_minimo) : 'No disponible hoy') + '</small></button></div>';
    s += '<div class="card" style="margin-bottom:12px"><label class="campo">Nombre<input id="f_nombre" value="' + E(S.datos.nombre) + '" autocomplete="name" maxlength="60">' + (S.errores.nombre ? '<div class="err-txt">' + S.errores.nombre + '</div>' : '') + '</label><label class="campo">Teléfono<input id="f_tel" inputmode="tel" value="' + E(S.datos.tel) + '" placeholder="+56 9 1234 5678" autocomplete="tel">' + (S.errores.tel ? '<div class="err-txt">' + S.errores.tel + '</div>' : '') + '</label>';
    if (S.tipo === 'domicilio') s += '<label class="campo">Dirección de entrega<input id="f_dir" value="' + E(S.datos.dir) + '" maxlength="150" autocomplete="street-address">' + (S.errores.dir ? '<div class="err-txt">' + S.errores.dir + '</div>' : '') + '</label><label class="campo" style="margin:0">Referencia<input id="f_ref" value="' + E(S.datos.ref) + '" maxlength="150" placeholder="Portón, piso, conserjería"></label>';
    else s += '<p class="suave" style="margin:0;font-size:13.5px">Retiras en <b>' + E(l.direccion) + '</b>.</p>';
    s += '</div><div class="card"><div class="lin"><span>Subtotal</span><span class="num">' + U.clp(sub) + '</span></div><div class="lin"><span>Despacho</span><span class="num">' + U.clp(desp) + '</span></div><div class="lin tot"><span>Total</span><span class="num">' + U.clp(tot) + '</span></div>';
    if (bajoMin) s += '<div class="err-txt" style="margin-top:8px">El pedido mínimo para despacho es ' + U.clp(l.pedido_minimo) + '. Te faltan ' + U.clp(l.pedido_minimo - sub) + '.</div>';
    s += '</div><div class="barra"><button class="btn btn-p btn-bloque" data-act="pagar" ' + (!l.pedidos_abiertos || bajoMin || S.enviando ? 'disabled' : '') + '>' + (S.enviando ? 'Creando tu pedido…' : 'Continuar al pago · <span class="num">' + U.clp(tot) + '</span>') + '</button></div>';
    return s + pie();
  }
  function leerCampos() {
    var m = { f_nombre: 'nombre', f_tel: 'tel', f_dir: 'dir', f_ref: 'ref' };
    Object.keys(m).forEach(function (k) { var e = $(k); if (e) S.datos[m[k]] = e.value; });
  }
  function validar() {
    S.errores = {};
    if (!S.datos.nombre.trim()) S.errores.nombre = 'Escribe tu nombre.';
    if (digitos(S.datos.tel).length < 8) S.errores.tel = 'Ingresa un teléfono válido.';
    if (S.tipo === 'domicilio' && !S.datos.dir.trim()) S.errores.dir = 'Falta la dirección de entrega.';
    return !Object.keys(S.errores).length;
  }
  function crearPedido() {
    var enMesa = S.mesa && S.mesaInfo && S.mesaInfo.cliente_pide;
    leerCampos();
    if (!enMesa && !validar()) { render(); U.toast('Revisa los datos marcados'); return; }
    S.enviando = true; render();
    L.guardarLocal('ln_c_datos', S.datos);
    var items = Object.keys(S.carrito).map(function (k) { return { plato_id: +k, cantidad: S.carrito[k].c, nota: S.carrito[k].nota || '' }; });
    L.api('/api/pedidos', { metodo: 'POST', bearer: S.token, cuerpo: enMesa ? { mesa_codigo: S.mesa.codigo, nombre: S.cliente ? S.cliente.nombre : '', items: items } : { tipo: S.tipo, nombre: S.datos.nombre, telefono: S.datos.tel, direccion: S.datos.dir, referencia: S.datos.ref, items: items } }).then(function (r) {
      S.enviando = false;
      if (!r.ok) { U.toast(r.error); if (r.status === 409) cargarMenu(true); render(); return; }
      S.pedidoId = r.data.id; L.guardarLocal('ln_c_pedido', S.pedidoId); S.pedido = null;
      S.carrito = {}; guardarCarrito(); ir('seguim'); cargarPedido(); cargarMenu(true);
    });
  }

  /* ---------- SEGUIMIENTO ---------- */
  function restante(p) { return p && p.expira_en ? Math.max(0, Date.parse(p.expira_en) - Date.now()) : 0; }
  function mmss(ms) { var h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000); return (h ? h + ':' : '') + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }   // con horas: 1:05:09
  function vSeguim() {
    var p = S.pedido;
    if (!S.pedidoId) return '<div class="vacio"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><p>Aún no tienes un pedido en curso.</p><button class="btn btn-p" data-act="irmenu">Ir al menú</button></div>';
    if (!p) return S.errorPedido ? bloqueError(S.errorPedido, 'recargarPedido') : '<div class="cargando" aria-busy="true"><i></i><i></i></div>';
    // Envío a domicilio: un paso más, "En camino" (el repartidor ya lo retiró)
    var etapas = p.tipo === 'domicilio' ? ETAPAS.slice(0, 3).concat([['en_camino', 'En camino']], ETAPAS.slice(3)) : ETAPAS;
    var s = '', idx = etapas.map(function (e) { return e[0]; }).indexOf(p.en_camino ? 'en_camino' : p.estado);
    s += '<p class="sub" style="margin:0">Pedido</p><div class="nped titulo">' + (p.numero ? '#' + p.numero : 'por pagar') + '</div><div style="margin:8px 0 2px"><span class="pill pill-n">' + (p.tipo === 'domicilio' ? 'Envío a domicilio' : 'Retiro en local') + '</span></div>';
    if (p.estado === 'pendiente_pago') {
      s += '<div class="card" style="margin-top:12px;text-align:center"><div class="suave" style="font-size:13px">Falta pagar</div><div class="num" style="font-size:34px;font-weight:700">' + U.clp(p.total) + '</div><div class="cuenta num" id="cta">' + mmss(restante(p)) + '</div><p class="sub" style="margin:-4px 0 12px">Tiempo restante: pasado ese plazo el pedido se anula y se liberan los platos.</p><button class="btn btn-p btn-bloque" data-act="pagarAhora">Pagar (modo de prueba)</button><p class="sub" style="margin:8px 0 0;font-size:12px">El pago real con Mercado Pago aún no está conectado.</p></div>';
    } else if (p.estado === 'pago_fallido') {
      s += '<div class="err-bloque" style="margin-top:12px"><b>El pago no se completó a tiempo.</b> El pedido se anuló y no se cobró nada.</div>';
    } else if (p.estado === 'cancelado') {
      s += '<div class="err-bloque" style="margin-top:12px"><b>Pedido cancelado por el local.</b> Si ya pagaste, te contactaremos para el reembolso.</div>';
    } else {
      s += '<div class="pasos">' + etapas.map(function (e, i) { return '<div class="paso ' + (i < idx ? 'hecho' : i === idx ? 'act' : '') + '"><i>' + (i < idx ? '✓' : i + 1) + '</i>' + (e[0] === 'listo' ? (p.tipo === 'domicilio' ? 'Listo para enviar' : 'Listo para retirar') : e[1]) + '</div>'; }).join('') + '</div>';
      s += '<div class="card" style="margin-top:12px"><b>' + (p.en_camino ? MSG.en_camino : MSG[p.estado]) + '</b>' + (p.estado === 'listo' && !p.en_camino ? '<p class="sub" style="margin:4px 0 0">' + (p.tipo === 'domicilio' ? 'Sale en breve a tu dirección.' : 'Puedes pasar a retirarlo.') + '</p>' : '') + '</div>';
      if (p.codigo && p.estado !== 'entregado' && window.qrcode) {
        var q = window.qrcode(0, 'M'); q.addData(p.codigo); q.make();
        s += '<div class="card qr-cli" style="margin-top:12px;text-align:center"><b>Tu código de ' + (p.tipo === 'domicilio' ? 'entrega' : 'retiro') + '</b><p class="sub" style="margin:4px 0 8px">' + (p.tipo === 'domicilio' ? 'Muéstralo al repartidor cuando llegue: él lo escanea para confirmar la entrega.' : 'Muéstralo en el local al retirar: lo escanean para entregarte el pedido.') + '</p>' + q.createImgTag(6, 8) + '<div class="num" style="font-size:22px;font-weight:700;letter-spacing:3px;margin-top:6px">' + U.esc(p.codigo) + '</div></div>';
      }
    }
    s += '<div class="card" style="margin-top:12px"><h3 style="font-size:15px;margin-bottom:6px">Detalle</h3>';
    (p.items || []).forEach(function (i) { s += '<div class="lin"><span>' + i.cantidad + ' × ' + E(i.nombre) + (i.nota ? ' <span class="suave">(' + E(i.nota) + ')</span>' : '') + '</span></div>'; });
    s += '<div class="lin tot"><span>Total</span><span class="num">' + U.clp(p.total) + '</span></div></div>';
    if (['entregado', 'cancelado', 'pago_fallido'].indexOf(p.estado) >= 0) s += '<div style="margin-top:12px"><button class="btn btn-p btn-bloque" data-act="nuevo">Hacer otro pedido</button></div>';
    return s + pie();
  }
  function pagarAhora() {
    L.api('/api/pedidos/' + encodeURIComponent(S.pedidoId) + '/verificar-pago', { metodo: 'POST', cuerpo: { simular: 'aprobado' } }).then(function (r) {
      if (r.status === 501) { U.toast('El pago real aún no está disponible.'); return; }
      if (!r.ok) { U.toast(r.error); return; }
      U.toast(r.data.estado === 'solicitado' ? 'Pago aprobado. Pedido #' + r.data.numero + ' recibido' : 'Estado: ' + r.data.estado);
      cargarPedido();
    });
  }

  /* ---------- MI CUENTA ---------- */
  function vCuenta() {
    var l = local(), fid = l.fidelidad || {};
    if (!S.cliente) {
      var ing = S.modoCuenta === 'ingreso';
      var s = '<h2 class="titulo">Mi cuenta</h2><p class="sub">Opcional. Con tu cuenta guardamos tus datos, ves tu historial y acumulas en el programa de fidelidad. Tu sesión queda guardada en este dispositivo: no tendrás que ingresar de nuevo.</p>';
      s += '<div class="sub-tabs"><button data-act="modo" data-v="ingreso" class="' + (ing ? 'on' : '') + '">Ingresar</button><button data-act="modo" data-v="registro" class="' + (!ing ? 'on' : '') + '">Crear cuenta</button></div>';
      if (S.errCuenta) s += '<div class="err-bloque" role="alert">' + E(S.errCuenta) + '</div>';
      if (S.okCuenta) s += '<div class="ok-bloque">' + E(S.okCuenta) + '</div>';
      if (ing) s += '<form class="card" data-form="ingreso" novalidate><label class="campo">Correo o teléfono<input id="i_usuario" autocomplete="username" value="' + fv('i_usuario') + '" required></label><label class="campo">Contraseña<input id="i_clave" type="password" autocomplete="current-password" required></label><button class="btn btn-p btn-bloque" type="submit" ' + (S.enviando ? 'disabled' : '') + '>Ingresar</button><p class="sub" style="margin:10px 0 0;font-size:13px">¿Olvidaste tu contraseña? Escríbenos por WhatsApp y el local te entrega una clave temporal.</p></form>';
      else s += '<form class="card" data-form="registro" novalidate><label class="campo">Nombre<input id="r_nombre" autocomplete="name" maxlength="60" value="' + fv('r_nombre') + '" required></label><label class="campo">Correo<input id="r_email" type="email" autocomplete="email" value="' + fv('r_email') + '" required></label><label class="campo">Teléfono<input id="r_tel" inputmode="tel" autocomplete="tel" placeholder="+56 9 1234 5678" value="' + fv('r_tel') + '" required></label><label class="campo">Contraseña (8 caracteres o más)<input id="r_clave" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></label><label class="chk"><input type="checkbox" id="r_acepta" ' + (S.form.r_acepta ? 'checked' : '') + '><span>Acepto que La Nonna guarde mi nombre, correo, teléfono y mis compras para mi cuenta y el programa de fidelidad. Puedo pedir que borren mis datos escribiendo al local.</span></label><button class="btn btn-p btn-bloque" type="submit" ' + (S.enviando ? 'disabled' : '') + '>Crear mi cuenta</button></form>';
      return s + pie();
    }
    var c = S.cliente, a = (S.cuenta && S.cuenta.acumulado) || { pedidos: 0, platos: 0, monto: 0 };
    var s2 = '<h2 class="titulo">Mi cuenta</h2>';
    if (c.debe_cambiar_clave) s2 += '<div class="info-bloque"><b>Cambia tu contraseña temporal.</b> El local te entregó una clave provisoria: elige una propia aquí abajo.</div>';
    s2 += '<div class="card"><b>' + E(c.nombre) + '</b><div class="suave" style="font-size:13.5px">' + E(c.email) + ' · ' + E(c.telefono) + '</div><div class="acum"><div><b class="num">' + a.pedidos + '</b><span>Pedidos</span></div><div><b class="num">' + a.platos + '</b><span>Platos</span></div><div><b class="num">' + U.clp(a.monto) + '</b><span>Comprado</span></div></div>';
    s2 += fid.activa && fid.descripcion ? '<div class="info-bloque"><b>Programa de fidelidad</b><br>' + E(fid.descripcion) + '</div>' : '<div class="info-bloque">Tus compras ya se van registrando en tu cuenta. El local aún no publica las reglas de su programa de fidelidad.</div>';
    s2 += '</div>';
    if (S.errCuenta) s2 += '<div class="err-bloque" role="alert">' + E(S.errCuenta) + '</div>';
    if (S.okCuenta) s2 += '<div class="ok-bloque">' + E(S.okCuenta) + '</div>';
    s2 += '<div class="card" style="margin-top:12px"><h3 style="font-size:15px;margin-bottom:8px">Mis pedidos</h3>';
    if (!S.historial) s2 += '<p class="sub">Cargando…</p>';
    else if (!S.historial.length) s2 += '<p class="sub">Todavía no tienes pedidos en tu cuenta.</p>';
    else S.historial.forEach(function (h, i) {
      s2 += '<div class="hist"><div class="r1"><span>' + (h.numero_diario ? '#' + h.numero_diario + ' · ' : '') + E(U.fechaCorta(h.fecha_local)) + '</span><span class="num">' + U.clp(h.total) + '</span></div><small>' + h.items.map(function (x) { return x.cantidad + ' × ' + E(x.nombre); }).join(', ') + '</small>' + (h.estado === 'cancelado' ? ' <span class="pill pill-err">Cancelado</span>' : '') + '<div style="margin-top:6px"><button class="btn btn-s btn-sm" data-act="repetir" data-i="' + i + '">Repetir pedido</button></div></div>';
    });
    s2 += '</div><form class="card" data-form="clave" style="margin-top:12px" novalidate><h3 style="font-size:15px;margin-bottom:8px">Cambiar contraseña</h3><label class="campo">Contraseña actual<input id="k_actual" type="password" autocomplete="current-password"></label><label class="campo">Contraseña nueva (8 o más)<input id="k_nueva" type="password" autocomplete="new-password" minlength="8" maxlength="72"></label><button class="btn btn-s btn-bloque" type="submit">Cambiar contraseña</button></form>';
    s2 += '<div style="margin-top:12px"><button class="btn btn-d btn-bloque" data-act="salir">Cerrar sesión en este dispositivo</button></div>';
    return s2 + pie();
  }
  /* Los textos escritos se conservan si el servidor rechaza el formulario (nunca las contraseñas). */
  var CAMPOS_FORM = ['i_usuario', 'r_nombre', 'r_email', 'r_tel'];
  function recordarForm() { CAMPOS_FORM.forEach(function (id) { var e = $(id); if (e) S.form[id] = e.value; }); var a = $('r_acepta'); if (a) S.form.r_acepta = a.checked; }
  var fv = function (id) { return E(S.form[id] || ''); };
  function enviarForm(tipo) {
    recordarForm();
    S.errCuenta = ''; S.okCuenta = ''; S.enviando = true;
    var v = function (id) { var e = $(id); return e ? e.value : ''; };
    if (tipo === 'ingreso') {
      L.api('/api/cuenta/ingreso', { metodo: 'POST', cuerpo: { usuario: v('i_usuario'), clave: v('i_clave') } }).then(function (r) { S.enviando = false; sesionIniciada(r); });
    } else if (tipo === 'registro') {
      L.api('/api/cuenta/registro', { metodo: 'POST', cuerpo: { nombre: v('r_nombre'), email: v('r_email'), telefono: v('r_tel'), clave: v('r_clave'), acepta: $('r_acepta') && $('r_acepta').checked } }).then(function (r) { S.enviando = false; sesionIniciada(r); });
    } else if (tipo === 'clave') {
      L.api('/api/cuenta/clave', { metodo: 'PUT', bearer: S.token, cuerpo: { actual: v('k_actual'), nueva: v('k_nueva') } }).then(function (r) {
        S.enviando = false;
        if (r.ok) { S.okCuenta = 'Contraseña actualizada. Se cerraron tus otras sesiones.'; cargarCuenta(); } else { S.errCuenta = r.error; render(); }
      });
    }
  }
  function sesionIniciada(r) {
    if (!r.ok) { S.errCuenta = r.error; render(); return; }
    S.token = r.data.token; L.guardarLocal('ln_c_token', S.token); S.cliente = r.data.cliente;
    S.datos = { nombre: r.data.cliente.nombre, tel: r.data.cliente.telefono, dir: S.datos.dir, ref: S.datos.ref };
    L.guardarLocal('ln_c_datos', S.datos);
    S.okCuenta = '¡Listo! Tu sesión quedó guardada en este dispositivo.';
    cargarCuenta();
  }
  function salir() {
    var t = S.token; cerrarSesionLocal(); S.okCuenta = ''; S.errCuenta = ''; render();
    if (t) L.api('/api/cuenta/salir', { metodo: 'POST', bearer: t });
    U.toast('Sesión cerrada');
  }
  function repetir(i) {
    var h = S.historial && S.historial[i]; if (!h) return;
    var agregados = 0;
    h.items.forEach(function (it) {
      var p = plato(it.plato_id); if (!p || p.agotado) return;
      var cur = S.carrito[p.id] || { c: 0, nota: it.nota || '' };
      cur.c = Math.min(cur.c + it.cantidad, maxDe(p)); S.carrito[p.id] = cur; agregados++;
    });
    guardarCarrito();
    if (!agregados) { U.toast('Esos platos no están en el menú de hoy.'); return; }
    U.toast(agregados < h.items.length ? 'Agregamos los platos que están hoy en el menú.' : 'Pedido agregado.');
    ir('pedido');
  }

  /* ---------- detalle del plato y galería ---------- */
  function abrirModal(html) { $('mod').innerHTML = html; $('mbg').hidden = false; }
  function cerrarModal() { if (S.visor) { S.visor.destruir(); S.visor = null; } $('mbg').hidden = true; }
  $('mbg').addEventListener('click', function (e) { if (e.target === this) cerrarModal(); });
  function detalle(id, i) {
    var p = plato(id); if (!p) return;
    var fs = p.fotos || [], k = ((i || 0) + fs.length) % (fs.length || 1);
    var s = '<h3 class="titulo" style="font-size:26px">' + E(p.nombre) + '</h3>';
    if (p.giro) s += '<div id="visor360"></div>';
    if (fs.length) s += '<div class="galeria"><img src="' + E(imgUrl(fs[k].url)) + '" alt="' + E(p.nombre) + ' (foto ' + (k + 1) + ' de ' + fs.length + ')">' + (fs.length > 1 ? '<button class="ant" data-act="foto" data-id="' + p.id + '" data-i="' + (k - 1) + '" aria-label="Foto anterior">‹</button><button class="sig" data-act="foto" data-id="' + p.id + '" data-i="' + (k + 1) + '" aria-label="Foto siguiente">›</button>' : '') + '</div>';
    else if (!p.giro) s += '<div style="display:grid;place-items:center;margin:8px 0">' + U.platoArte(p.id, 120) + '<p class="sub">Este plato aún no tiene foto.</p></div>';
    if (p.descripcion) s += '<p>' + E(p.descripcion) + '</p>';
    s += '<div class="lin"><span class="suave">Precio</span><b class="num">' + U.clp(p.precio) + '</b></div>';
    if (p.tiempo_preparacion) s += '<div class="lin"><span class="suave">Preparación</span><span>' + p.tiempo_preparacion + ' min</span></div>';
    s += '<button class="btn btn-s btn-bloque" style="margin-top:10px" data-act="cerrarm">Cerrar</button>';
    if (S.visor) { S.visor.destruir(); S.visor = null; }
    abrirModal(s);
    if (p.giro && window.LNGiro) S.visor = window.LNGiro.crearVisor($('visor360'), p.giro, window.LN_API_BASE || '');
  }

  /* ---------- navegación y eventos ---------- */
  function render() {
    cabecera();
    var f = S.tab === 'menu' ? vMenu : S.tab === 'pedido' ? vPedido : S.tab === 'seguim' ? vSeguim : vCuenta;
    var v = $('vista'), y = v.scrollTop; v.innerHTML = f(); v.scrollTop = y;
    firmaVista = firma();
  }
  function firma() {
    if (S.tab === 'menu') return JSON.stringify([platos().map(function (p) { return [p.id, p.disponibles, p.precio]; }), local().pedidos_abiertos, S.carrito, S.verSemana, S.mesaInfo, !!S.cliente]);
    if (S.tab === 'seguim') return JSON.stringify([S.pedido && [S.pedido.estado, S.pedido.numero, S.pedido.en_camino], S.pedidoId]);
    return 'x';
  }
  function ir(t) {
    if (S.tab === 'pedido') leerCampos();
    S.tab = t; S.errCuenta = ''; S.okCuenta = ''; render(); $('vista').scrollTop = 0;
    if (t === 'seguim') cargarPedido(); if (t === 'cuenta') cargarCuenta(); if (t === 'menu') cargarMenu(true);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab],[data-act]'); if (!t) return;
    if (t.dataset.tab) { ir(t.dataset.tab); return; }
    var a = t.dataset.act, id = t.dataset.id;
    if (a === 'aCuenta') { e.preventDefault(); cerrarModal(); S.modoCuenta = 'registro'; ir('cuenta'); }
    else if (a === 'mas') { var cur = S.carrito[id] || { c: 0, nota: '' }, p = plato(id); if (p && cur.c < maxDe(p)) { cur.c++; S.carrito[id] = cur; guardarCarrito(); render(); } }
    else if (a === 'quitar') { delete S.carrito[id]; guardarCarrito(); render(); }
    else if (a === 'vaciar') { S.carrito = {}; guardarCarrito(); render(); }
    else if (a === 'menos') { if (S.carrito[id]) { S.carrito[id].c--; if (S.carrito[id].c <= 0) delete S.carrito[id]; } guardarCarrito(); render(); }
    else if (a === 'irpedido') ir('pedido');
    else if (a === 'irmenu') ir('menu');
    else if (a === 'recargar') cargarMenu();
    else if (a === 'recargarPedido') cargarPedido();
    else if (a === 'semana') { S.verSemana = !S.verSemana; if (S.verSemana && !S.semana) cargarSemana(); else render(); }
    else if (a === 'tipo') { leerCampos(); S.tipo = t.dataset.v; render(); }
    else if (a === 'pagar') crearPedido();
    else if (a === 'pagarAhora') pagarAhora();
    else if (a === 'modo') { S.modoCuenta = t.dataset.v; S.errCuenta = ''; S.okCuenta = ''; render(); }
    else if (a === 'salir') salir();
    else if (a === 'repetir') repetir(+t.dataset.i);
    else if (a === 'detalle') detalle(id, 0);
    else if (a === 'foto') detalle(id, +t.dataset.i);
    else if (a === 'cerrarm') cerrarModal();
    else if (a === 'cuentaMesa') cargarMesa().then(modalCuentaMesa);
    else if (a === 'pagarMesa') pagarMesa(!!t.dataset.sel);
    else if (a === 'selMas') { S.selPago[id] = Math.min(+t.dataset.max, (S.selPago[id] || 0) + 1); modalCuentaMesa(); }
    else if (a === 'selMenos') { S.selPago[id] = Math.max(0, (S.selPago[id] || 0) - 1); modalCuentaMesa(); }
    else if (a === 'salirMesa') { S.mesa = null; S.mesaInfo = null; L.borrarLocal('ln_c_mesa'); render(); }
    else if (a === 'nuevo') { S.pedidoId = ''; S.pedido = null; L.borrarLocal('ln_c_pedido'); ir('menu'); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.act === 'detalle') { e.preventDefault(); detalle(e.target.dataset.id, 0); }
    if (e.key === 'Escape') cerrarModal();
  });
  document.addEventListener('input', function (e) { var n = e.target.dataset && e.target.dataset.nota; if (n && S.carrito[n]) { S.carrito[n].nota = e.target.value; guardarCarrito(); } });
  document.addEventListener('submit', function (e) { var f = e.target.dataset && e.target.dataset.form; if (f) { e.preventDefault(); enviarForm(f); } });

  /* ---------- ciclo de actualización ---------- */
  setInterval(function () {
    ticks++;
    var cta = $('cta'); if (cta && S.pedido) { var r = restante(S.pedido); cta.textContent = mmss(r); if (!r) cargarPedido(); }
    var activo = S.pedidoId && S.pedido && ['entregado', 'cancelado', 'pago_fallido'].indexOf(S.pedido.estado) < 0;
    if (S.tab === 'seguim' && activo && ticks % 5 === 0) cargarPedido();
    if (S.tab === 'menu' && ticks % 20 === 0) { cargarMenu(true); cargarMesa(); }
    if (S.tab !== 'pedido' && S.tab !== 'cuenta' && firma() !== firmaVista) render();
  }, 1000);

  /* ---------- arranque ---------- */
  $('logo').innerHTML = U.logo(30, true);
  $('splash-logo').innerHTML = U.logo(150, false);
  var inicio = Date.now();
  function quitarSplash() { var s = $('splash'); s.classList.add('fuera'); setTimeout(function () { s.remove(); }, 400); }
  /* La barra de avance del splash se mueve con lo que de verdad ya cargó: menú, cuenta y pedido en curso. */
  function avance(pct) { var b = $('splash-avance'); if (b) { b.firstChild.style.width = pct + '%'; b.setAttribute('aria-valuenow', pct); } }
  var hechos = 0, paso = function () { hechos++; avance(10 + Math.round(hechos / 3 * 90)); };
  avance(10);
  // Escaneó el QR de la mesa: avisa que llegó (la mesa queda ocupada y el mozo lo ve). Una vez por escaneo.
  (S.mesa && S.mesaRecienEscaneada ? L.api('/api/mesa/' + encodeURIComponent(S.mesa.codigo) + '/llegada', { metodo: 'POST', cuerpo: { dispositivo: idDispositivo() } }) : Promise.resolve()).then(cargarMesa);
  fetch((window.LN_API_BASE || '') + '/apk/version-cliente.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) { if (v && v.url) { S.apkUrl = (window.LN_API_BASE || '') + v.url; render(); } }).catch(function () { /* sin app publicada */ });
  Promise.all([cargarMenu().then(paso), cargarCuenta().then(paso), cargarPedido().then(paso)]).then(function () { setTimeout(quitarSplash, Math.max(0, 1300 - (Date.now() - inicio))); });
  setTimeout(function () { if ($('splash')) quitarSplash(); }, 4000);
  render();
})();
