/* DEMOSTRACIÓN de La Nonna: reemplaza al servidor por una copia en memoria dentro del navegador.
   Las pantallas son las REALES (cliente, admin, cocina, despacho, repartidor y mozo); lo que cambia es que cada llamada a /api/... se contesta
   aquí con los datos de ejemplo de datos.json (generado por scripts/generar-demo.js desde el servidor real) y los cambios se hacen sobre una copia
   en memoria: no se guarda nada, al recargar vuelve todo al inicio. Todos los nombres, precios y pedidos son inventados. */
(function (w) {
  var script = document.currentScript, RAIZ = script.src.replace(/\/[^\/]*$/, '/'), CAMINO = new URL(RAIZ).pathname.replace(/\/$/, '');
  w.LN_API_BASE = CAMINO;                                   // fotos: <raiz>/media/fotos/...; la API se intercepta aquí
  w.LN_DEMO = true;
  var D = null, S = null, pendiente = fetch(RAIZ + 'datos.json').then(function (r) { return r.json(); }).then(function (d) { D = d; S = cargarEstado(d) || iniciar(d); });
  /* El estado vive en la pestaña (sessionStorage): al pasar del cliente al admin se ve el pedido recién hecho. Cerrar la pestaña lo reinicia. */
  function cargarEstado(d) { try { var t = w.sessionStorage.getItem('ln_demo_estado'); if (t) { var e = JSON.parse(t); if (e.capturado === d.capturado) return e.S; } } catch (x) { /* sin almacenamiento */ } return null; }
  function guardarEstado() { try { w.sessionStorage.setItem('ln_demo_estado', JSON.stringify({ capturado: D.capturado, S: S })); } catch (x) { /* sin almacenamiento */ } }
  var ROLES = { 1: 'Solicitados', 2: 'Cocina', 3: 'Despacho', 4: 'Atención en mesas', 5: 'Repartidor' };
  var NOMBRES = { 1: 'Carla', 2: 'Chef Luis', 3: 'Marta', 4: 'Rosa', 5: 'Juan' };
  var clon = function (o) { return JSON.parse(JSON.stringify(o)); };
  var ahora = function () { return new Date().toISOString(); };
  var uid = function () { return 'demo-' + Math.random().toString(36).slice(2, 10); };
  var codigo = function () { return Array.apply(null, Array(8)).map(function () { return 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]; }).join(''); };

  /* ---------- fechas: todo se corre al "ahora" del visitante (los minutos transcurridos se mantienen) ---------- */
  function corrido(obj) {
    var dt = Date.now() - Date.parse(D.capturado), cap = Date.parse(D.fecha + 'T12:00:00Z'), hoyUTC = new Date(), dias;
    var hoyCL = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    dias = Math.round((Date.parse(hoyCL + 'T12:00:00Z') - cap) / 86400000);
    var txt = JSON.stringify(obj).replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d+)?)Z/g, function (m) { return new Date(Date.parse(m) + dt).toISOString(); });
    txt = txt.replace(/"(\d{4}-\d{2}-\d{2})"/g, function (m, f) { return '"' + new Date(Date.parse(f + 'T12:00:00Z') + dias * 86400000).toISOString().slice(0, 10) + '"'; });
    return JSON.parse(txt);
  }

  /* ---------- estado en memoria ---------- */
  function iniciar(d) {
    var tab = d.get['/api/admin/tablero'], filas = {};
    ['solicitados', 'en_cocina', 'listos'].forEach(function (k) { tab[k].forEach(function (r) { filas[r.id] = r; }); });
    var cod = {}, cr = {};
    (d.pantalla[4].pedidos || []).forEach(function (p) { cod[p.id] = p.codigo; });
    (d.pantalla[3].listos || []).forEach(function (p) { if (p.codigo_ruta) cr[p.id] = p.codigo_ruta; });
    var s = { pedidos: [], mapa: clon(d.get['/api/admin/control'].mapa), siguiente: 100, devs: clon(d.get['/api/admin/equipo']), cuentaMesa: {} };
    d.get['/api/admin/control'].pedidos.forEach(function (c) {
      var f = filas[c.id] || {};
      s.pedidos.push({ id: c.id, numero: c.numero, estado: c.estado, origen: c.origen, tipo: c.tipo, mesa: c.mesa, nombre_cliente: f.nombre_cliente || c.cliente || (c.mesa ? 'Mesa ' + c.mesa.numero : ''),
        telefono: f.telefono || c.telefono || '', direccion: f.direccion || c.direccion || '', referencia: f.referencia || '', notas: f.notas || '', total: c.total, items: c.items,
        pagado: c.pagado, cobrado_por: c.cobrado_por, cobro_medio: c.cobro_medio, mozo_toma: c.mozo_toma, mozo_entrega: c.mozo_entrega, repartidor: c.repartidor,
        solicitado_en: c.solicitado_en, cocina_en: f.cocina_en || null, listo_en: c.listo_en, ruta_en: c.ruta_en, entregado_en: c.entregado_en,
        codigo: cod[c.id] || f.codigo || codigo(), codigo_ruta: cr[c.id] || f.codigo_ruta || (c.tipo === 'domicilio' ? codigo() : null), cliente_id: null });
    });
    // sin timestamp de cocina en el resumen de control: se completa con el de solicitud
    s.pedidos.forEach(function (p) { if (!p.cocina_en && p.estado !== 'solicitado') p.cocina_en = p.solicitado_en; });
    return s;
  }
  var ubic = function (p) {
    if (p.estado === 'cancelado') return 'Cancelado';
    if (p.estado === 'solicitado') return 'En cola';
    if (p.estado === 'en_cocina') return 'En cocina';
    if (p.origen === 'mesa') return p.estado === 'listo' ? 'Listo: esperando al mozo' : (p.pagado ? 'Servido y cobrado' : 'Servido, por cobrar');
    if (p.tipo === 'domicilio') return p.estado === 'listo' ? (p.ruta_en ? 'En ruta con ' + p.repartidor : 'Listo: esperando repartidor') : 'Entregado por ' + (p.repartidor || '—');
    return p.estado === 'listo' ? 'Listo: pendiente de retiro' : 'Retirado';
  };
  var porId = function (id) { return S.pedidos.filter(function (p) { return p.id === id; })[0]; };
  var porCodigo = function (c, campo) { c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return S.pedidos.filter(function (p) { return p[campo] === c; })[0]; };
  var vivos = function () { return S.pedidos.filter(function (p) { return p.estado !== 'cancelado'; }); };
  var CAMPO = { en_cocina: 'cocina_en', listo: 'listo_en', entregado: 'entregado_en' };

  /* ---------- vistas derivadas (mismas formas que el servidor real) ---------- */
  function filaTablero(p) {
    return { id: p.id, numero_diario: p.numero, tipo: p.tipo, estado: p.estado, nombre_cliente: p.nombre_cliente, telefono: p.telefono, direccion: p.direccion, referencia: p.referencia,
      notas: p.notas, total: p.total, solicitado_en: p.solicitado_en, cocina_en: p.cocina_en, listo_en: p.listo_en, entregado_en: p.entregado_en, origen: p.origen, mozo_toma: p.mozo_toma,
      mozo_entrega: p.mozo_entrega, repartidor: p.repartidor, ruta_en: p.ruta_en, codigo: p.codigo, codigo_ruta: p.codigo_ruta, items: p.items };
  }
  function tablero() {
    var o = function (e) { return S.pedidos.filter(function (p) { return p.estado === e; }).sort(function (a, b) { return a.numero - b.numero; }).map(filaTablero); };
    return { solicitados: o('solicitado'), en_cocina: o('en_cocina'), listos: o('listo') };
  }
  function vista(p) {
    return { id: p.id, numero: p.numero, tipo: p.tipo, origen: p.origen, mesa: p.mesa, mozo: p.mozo_toma, notas: p.notas, solicitado_en: p.solicitado_en, cocina_en: p.cocina_en,
      items: p.items.map(function (i) { return { nombre: i.nombre, cantidad: i.cantidad, nota: i.nota || '' }; }) };
  }
  function ficha(p) {
    var v = vista(p); v.listo_en = p.listo_en; v.nombre_cliente = p.nombre_cliente; v.telefono = p.telefono; v.direccion = p.direccion; v.referencia = p.referencia;
    v.total = p.total; v.ruta_por = p.repartidor || null; v.en_ruta = !!p.ruta_en; return v;
  }
  function mapaVivo() { return clon(S.mapa); }
  function control() {
    var v = vivos(), cnt = function (f) { return v.filter(f).length; }, ps = S.pedidos.slice().sort(function (a, b) { return a.numero - b.numero; });
    var resumen = { solicitados: cnt(function (x) { return x.estado === 'solicitado'; }), en_cocina: cnt(function (x) { return x.estado === 'en_cocina'; }),
      pendientes_retiro: cnt(function (x) { return x.estado === 'listo' && x.origen === 'app' && x.tipo === 'retiro'; }),
      esperando_repartidor: cnt(function (x) { return x.estado === 'listo' && x.tipo === 'domicilio' && !x.ruta_en; }),
      en_ruta: cnt(function (x) { return x.estado === 'listo' && x.tipo === 'domicilio' && !!x.ruta_en; }),
      mesas_abiertas: cnt(function (x) { return x.origen === 'mesa' && !(x.estado === 'entregado' && x.pagado); }),
      mesas_por_cobrar: cnt(function (x) { return x.origen === 'mesa' && !x.pagado; }),
      mesas_listas_para_llevar: cnt(function (x) { return x.origen === 'mesa' && x.estado === 'listo'; }),
      entregados: cnt(function (x) { return x.estado === 'entregado'; }), cancelados: S.pedidos.length - v.length };
    var platos = {};
    v.forEach(function (x) { x.items.forEach(function (i) {
      var f = platos[i.nombre] = platos[i.nombre] || { nombre: i.nombre, cola: 0, cocina: 0, listo: 0, en_ruta: 0, entregado: 0 };
      var k = x.estado === 'solicitado' ? 'cola' : x.estado === 'en_cocina' ? 'cocina' : x.estado === 'entregado' ? 'entregado' : (x.ruta_en ? 'en_ruta' : 'listo');
      f[k] += i.cantidad; }); });
    return { fecha: D.fecha, mapa: mapaVivo(), resumen: resumen,
      pedidos: ps.map(function (p) { return { id: p.id, numero: p.numero, estado: p.estado, origen: p.origen, tipo: p.tipo, mesa: p.mesa, cliente: p.origen === 'mesa' ? null : p.nombre_cliente,
        telefono: p.origen === 'mesa' ? null : p.telefono, direccion: p.direccion, total: p.total, items: p.items, ubicacion: ubic(p), pagado: p.origen === 'mesa' ? p.pagado : true,
        cobrado_por: p.cobrado_por, cobro_medio: p.cobro_medio, mozo_toma: p.mozo_toma, mozo_entrega: p.mozo_entrega, repartidor: p.repartidor, solicitado_en: p.solicitado_en,
        listo_en: p.listo_en, ruta_en: p.ruta_en, entregado_en: p.entregado_en }; }),
      platos: Object.keys(platos).sort().map(function (k) { return platos[k]; }) };
  }
  function pantalla(paso) {
    var base = { paso: paso, puede_mover: paso !== 1 }, e = function (est) { return S.pedidos.filter(function (p) { return p.estado === est; }).sort(function (a, b) { return a.numero - b.numero; }); };
    if (paso === 1) return Object.assign(base, { solicitados: e('solicitado').map(vista) });
    if (paso === 2) return Object.assign(base, { mapa: mapaVivo(), solicitados: e('solicitado').map(vista), en_cocina: e('en_cocina').map(vista) });
    var rep = e('listo').filter(function (p) { return p.origen === 'app' && p.tipo === 'domicilio'; });
    if (paso === 5) return Object.assign(base, { para_llevar: rep.filter(function (p) { return !p.ruta_en; }).map(ficha), en_ruta: rep.filter(function (p) { return p.ruta_en; }).map(ficha) });
    if (paso === 4) {
      var mp = S.pedidos.filter(function (p) { return p.origen === 'mesa' && p.estado !== 'cancelado' && !(p.estado === 'entregado' && p.pagado); }).sort(function (a, b) { return a.numero - b.numero; });
      return Object.assign(base, { mesas: D.pantalla[4].mesas, menu: D.pantalla[4].menu, medios: ['efectivo', 'tarjeta', 'transferencia'],
        esperando: S.mapa.filter(function (m) { return m.fase === 'esperando_pedido'; }).map(function (m) { return D.pantalla[4].mesas.filter(function (x) { return x.numero === m.numero; })[0].id; }),
        mapa: mapaVivo(), pedidos: mp.map(function (p) { var v = vista(p); v.estado = p.estado; v.total = p.total; v.listo_en = p.listo_en; v.mozo_entrega = p.mozo_entrega; v.codigo = p.codigo; v.pagado = p.pagado;
          v.cobrado_por = p.cobrado_por; v.cobro_medio = p.cobro_medio; v.cuenta = p.items.map(function (i, k) { return { item_id: p.numero * 100 + k, nombre: i.nombre, precio: precio(i), cantidad: i.cantidad, pagadas: p.pagado ? i.cantidad : 0, pendientes: p.pagado ? 0 : i.cantidad }; }); return v; }) });
    }
    return Object.assign(base, { listos: e('listo').filter(function (p) { return p.origen === 'app'; }).map(function (p) { var f = ficha(p); f.codigo_ruta = p.tipo === 'domicilio' && !p.ruta_en ? p.codigo_ruta : null; return f; }) });
  }
  function precio(i) { var p = D.get['/api/menu'].platos.filter(function (x) { return x.id === i.plato_id || x.nombre === i.nombre; })[0]; return p ? p.precio : 5000; }

  /* ---------- mapa de mesas ---------- */
  function mesaMapa(num) { return S.mapa.filter(function (m) { return m.numero === num; })[0]; }
  function pintarMesa(num, color, fase, motivo, personas) {
    var m = mesaMapa(num); if (!m) return;
    m.color = color; m.fase = fase; m.motivo = motivo || ''; m.minutos = 0; m.por_qr = false; m.personas = personas == null ? m.personas : personas; m.desde = ahora();
  }
  function reevaluarMesa(num) {                                           // tras servir/cobrar: ¿sigue en atención, quedó por limpiar o libre?
    var ps = S.pedidos.filter(function (p) { return p.origen === 'mesa' && p.mesa && p.mesa.numero === num && p.estado !== 'cancelado'; });
    var abiertos = ps.filter(function (p) { return !(p.estado === 'entregado' && p.pagado); });
    if (abiertos.length) pintarMesa(num, 'naranjo', abiertos.some(function (p) { return p.estado === 'listo'; }) ? 'listo' : 'con_pedido', '', mesaMapa(num).personas);
    else if (ps.length) pintarMesa(num, 'azul', 'por_limpiar', 'Pagó: falta limpiar la mesa', 0);
    else pintarMesa(num, 'verde', 'libre', '', 0);
  }

  /* ---------- respuestas ---------- */
  function mover(p, a, quien) {
    p.estado = a; var c = CAMPO[a]; if (c) p[c] = ahora();
    if (a === 'entregado' && quien) { if (p.origen === 'mesa') p.mozo_entrega = quien; else if (p.tipo === 'domicilio') p.repartidor = p.repartidor || quien; }
    if (p.origen === 'mesa') reevaluarMesa(p.mesa.numero);
  }
  function pagarMesa(num, quien, medio) {
    var ps = S.pedidos.filter(function (p) { return p.origen === 'mesa' && p.mesa.numero === num && !p.pagado && p.estado !== 'cancelado'; }), total = 0;
    ps.forEach(function (p) { p.pagado = true; p.cobrado_por = quien; p.cobro_medio = medio; total += p.total; });
    reevaluarMesa(num); return total;
  }
  function pasoDe(h) { var t = (h && (h['X-Pantalla-Token'] || h['x-pantalla-token'])) || ''; var m = /^demo-(\d)-(.*)$/.exec(t); return m ? { paso: +m[1], persona: m[2] } : null; }
  function cuentaDeMesa(num) {
    var ps = S.pedidos.filter(function (p) { return p.origen === 'mesa' && p.mesa.numero === num && !p.pagado && p.estado !== 'cancelado'; });
    return { pedidos: ps.map(function (p) { return { numero: p.numero, estado: p.estado, total: p.total, pendiente: p.total,
      items: p.items.map(function (i, k) { return { item_id: p.numero * 100 + k, nombre: i.nombre, precio: precio(i), cantidad: i.cantidad, pendientes: i.cantidad }; }) }; }),
      por_pagar: ps.reduce(function (a, p) { return a + p.total; }, 0) };
  }
  function crearPedido(b) {
    var menu = D.get['/api/menu'].platos, items = (b.items || []).map(function (i) { var p = menu.filter(function (x) { return x.id === i.plato_id; })[0] || menu[0]; return { plato_id: p.id, nombre: p.nombre, cantidad: i.cantidad, nota: i.nota || '', precio: p.precio }; });
    var sub = items.reduce(function (a, i) { return a + i.precio * i.cantidad; }, 0), env = b.tipo === 'domicilio' ? D.get['/api/menu'].local.costo_despacho : 0;
    var p = { id: uid(), numero: null, estado: 'pendiente_pago', origen: 'app', tipo: b.tipo, mesa: null, nombre_cliente: b.nombre || 'Cliente demo', telefono: b.telefono || '', direccion: b.direccion || '',
      referencia: b.referencia || '', notas: '', total: sub + env, items: items.map(function (i) { return { plato_id: i.plato_id, nombre: i.nombre, cantidad: i.cantidad, nota: i.nota }; }), pagado: true,
      cobrado_por: null, cobro_medio: null, mozo_toma: null, mozo_entrega: null, repartidor: null, solicitado_en: null, cocina_en: null, listo_en: null, ruta_en: null, entregado_en: null,
      codigo: null, codigo_ruta: null, subtotal: sub, costo_despacho: env, propio: true, expira: new Date(Date.now() + 15 * 60000).toISOString() };
    S.pedidos.push(p); return p;
  }
  function pagarPedido(p) {                                                // paga y avanza solo, como en una cocina real (la cocina/admin también puede moverlo)
    p.numero = ++S.siguiente; p.estado = 'solicitado'; p.solicitado_en = ahora(); p.codigo = codigo(); p.codigo_ruta = p.tipo === 'domicilio' ? codigo() : null;
  }
  function avanzarPropios() {                                               // los pedidos hechos desde el cliente avanzan solos si nadie los mueve (9 s a cocina, 22 s a listo)
    S.pedidos.forEach(function (p) { if (!p.propio || !p.solicitado_en) return; var t = Date.now() - Date.parse(p.solicitado_en);
      if (p.estado === 'solicitado' && t > 9000) mover(p, 'en_cocina'); if (p.estado === 'en_cocina' && t > 22000) mover(p, 'listo'); });
  }
  function respuesta(metodo, ruta, cuerpo, persona) {
    avanzarPropios();
    var m, p, b = cuerpo || {}, quien = persona ? persona.persona : 'Demo', G = function (k) { return corrido(D.get[k]); };
    var ok = function (x) { return [200, x || { ok: true }]; };
    if (metodo === 'GET') {
      if (ruta === '/api/menu' || ruta === '/api/menu/semana' || ruta === '/api/admin/config' || ruta === '/api/admin/platos' || ruta === '/api/admin/menu' || ruta === '/api/admin/dashboard' ||
        ruta === '/api/admin/direcciones' || ruta === '/api/admin/clientes') return ok(G(ruta));
      if (ruta === '/api/admin/yo') return ok({ rol: 'admin', veAccesosSoporte: false });
      if (ruta === '/api/admin/tablero') return ok(corrido(tablero()));
      if (ruta === '/api/admin/control') return ok(corrido(control()));
      if (ruta === '/api/admin/mesas') return ok(G(ruta));
      if (ruta === '/api/admin/mesas/tiempos') return ok(G(ruta));
      if (ruta === '/api/admin/equipo') return ok(corrido(S.devs));
      if ((m = /^\/api\/admin\/mesas\/(\d+)\/detalle$/.exec(ruta))) {
        var mesa = D.get['/api/admin/mesas'].filter(function (x) { return x.id === +m[1]; })[0], est = S.mapa.filter(function (x) { return x.numero === mesa.numero; })[0];
        var ps = S.pedidos.filter(function (x) { return x.origen === 'mesa' && x.mesa && x.mesa.numero === mesa.numero; }), mo = [];
        ps.forEach(function (x) { var n = '#' + x.numero; if (x.solicitado_en) mo.push({ t: x.solicitado_en, que: 'Pedido ' + n + ' generado', quien: x.mozo_toma || '' }); if (x.listo_en) mo.push({ t: x.listo_en, que: 'Pedido ' + n + ' listo', quien: '' });
          if (x.entregado_en) mo.push({ t: x.entregado_en, que: 'Pedido ' + n + ' servido (comiendo)', quien: x.mozo_entrega || '' }); });
        mo.sort(function (a, c) { return a.t < c.t ? -1 : 1; });
        return ok(corrido({ mesa: est, momentos: mo, pedidos: ps.map(function (x) { return { id: x.id, numero: x.numero, estado: x.estado, total: x.total, items: x.items, pagado: x.pagado, mozo_toma: x.mozo_toma, mozo_entrega: x.mozo_entrega, cobrado_por: x.cobrado_por, cobro_medio: x.cobro_medio }; }) }));
      }
      if (ruta === '/api/pantalla') { if (!persona) return [403, { error: 'Este teléfono no está activo: escanea el QR del día.' }]; return ok(corrido(pantalla(persona.paso))); }
      if ((m = /^\/api\/mesa\/([A-Z0-9]+)$/i.exec(ruta))) {
        var num = Object.keys(D.mesaCodigos).filter(function (k) { return D.mesaCodigos[k] === m[1].toUpperCase(); })[0];
        if (!num) return [404, { error: 'Esta mesa no existe o su QR fue cambiado. Pide ayuda al mozo.' }];
        var info = clon(D.mesas[m[1].toUpperCase()]); info.cuenta = cuentaDeMesa(+num); return ok(info);
      }
      if ((m = /^\/api\/pedidos\/([\w-]+)$/.exec(ruta))) {
        p = porId(m[1]); if (!p) return [404, { error: 'Pedido no existe' }];
        return ok(corrido({ estado: p.estado, numero: p.numero, codigo: p.estado === 'pendiente_pago' ? null : p.codigo, tipo: p.tipo, subtotal: p.subtotal, costo_despacho: p.costo_despacho, total: p.total,
          items: p.items, expira_en: p.estado === 'pendiente_pago' ? p.expira : null }));
      }
      if (ruta === '/api/cuenta') return S.cliente ? ok({ cliente: S.cliente, resumen: { pedidos: S.misPedidos || 0, platos: 0, monto: 0 }, fidelidad: { activa: true, descripcion: D.get['/api/menu'].local.fidelidad.descripcion } }) : [401, { error: 'Inicia sesión.' }];
      if (ruta === '/api/cuenta/pedidos') return ok({ pedidos: [] });
      return [404, { error: 'No existe (demo).' }];
    }
    /* ---- POST / PUT / DELETE ---- */
    if (ruta === '/api/admin/login') return ok({ ok: true, token: 'demo-admin', rol: 'admin' });
    if (ruta === '/api/admin/logout') return ok();
    if ((m = /^\/api\/admin\/pedidos\/([\w-]+)\/transicion$/.exec(ruta))) { p = porId(m[1]); if (!p) return [404, { error: 'Pedido no existe' }]; mover(p, b.a, 'admin'); return ok({ status: 200, estado: b.a }); }
    if ((m = /^\/api\/admin\/pedidos\/([\w-]+)\/cancelar$/.exec(ruta))) { p = porId(m[1]); if (p) { p.estado = 'cancelado'; if (p.origen === 'mesa') reevaluarMesa(p.mesa.numero); } return ok({ status: 200, estado: 'cancelado' }); }
    if ((m = /^\/api\/admin\/pedidos\/([\w-]+)\/cobrar$/.exec(ruta))) { p = porId(m[1]); if (p) pagarMesa(p.mesa.numero, 'admin', b.medio); return ok({ ok: true }); }
    if ((m = /^\/api\/admin\/mesas\/(\d+)\/(limpia|liberar)$/.exec(ruta))) { var mm = D.get['/api/admin/mesas'].filter(function (x) { return x.id === +m[1]; })[0]; pintarMesa(mm.numero, 'verde', 'libre', '', 0); return ok(); }
    if ((m = /^\/api\/admin\/equipo\/dispositivos\/(\d+)\/desactivar$/.exec(ruta))) { (S.devs.dispositivos || []).forEach(function (d) { if (d.id === +m[1]) { d.activo = false; d.desactivado_en = ahora(); } }); return ok(); }
    if (/^\/api\/admin\/equipo\/qr\/\d\/nuevo$/.test(ruta)) return ok({ ok: true });
    if (/^\/api\/admin\//.test(ruta)) return ok(metodo === 'PUT' && ruta === '/api/admin/config' ? Object.assign(clon(D.get['/api/admin/config']), b) : metodo === 'PUT' && ruta === '/api/admin/mesas' ? clon(D.get['/api/admin/mesas']) : { ok: true });
    if (ruta === '/api/equipo/activar') { return [403, { error: 'En la demostración elige tu puesto en la pantalla de inicio.' }]; }
    if (ruta === '/api/pantalla/transicion') { p = porId(b.pedido_id); if (!p || !persona) return [403, { error: 'No permitido.' }]; mover(p, b.a, persona.persona); return ok({ status: 200, estado: b.a }); }
    if (ruta === '/api/pantalla/escanear') {
      p = porCodigo(b.codigo, 'codigo'); if (!p) return [404, { error: 'Código no válido.' }];
      if (p.estado === 'entregado') return [409, { error: 'Esa orden ya estaba finalizada.' }];
      if (p.estado !== 'listo') return [409, { error: 'La orden aún no está lista.' }];
      if (p.tipo === 'domicilio' && !p.ruta_en) return [409, { error: 'Primero lleva el pedido: escanea su rótulo de salida.' }];
      mover(p, 'entregado', quien); if (p.origen === 'mesa' && !p.pagado) pagarMesa(p.mesa.numero, quien, 'app');
      return ok({ ok: true, numero: p.numero, nombre: p.nombre_cliente });
    }
    if (ruta === '/api/pantalla/ruta-tomar') {
      p = porCodigo(b.codigo, 'codigo_ruta'); if (!p) return [404, { error: 'Rótulo no válido.' }];
      if (p.ruta_en) return [409, { error: 'Ese pedido ya lo lleva ' + p.repartidor + '.' }];
      if (p.estado !== 'listo') return [409, { error: 'El pedido aún no está listo.' }];
      p.ruta_en = ahora(); p.repartidor = quien; return ok({ ok: true, numero: p.numero, direccion: p.direccion });
    }
    if (ruta === '/api/pantalla/mesa-llegada') {
      var mz = D.pantalla[4].mesas.filter(function (x) { return x.id === b.mesa_id; })[0]; if (!mz) return [400, { error: 'Elige una mesa.' }];
      if (b.anular) pintarMesa(mz.numero, 'verde', 'libre', '', 0); else pintarMesa(mz.numero, 'naranjo', 'esperando_pedido', 'Esperando que tomen su pedido', 1);
      return [201, { ok: true }];
    }
    if (ruta === '/api/pantalla/mesa-pedido') {
      var me = D.pantalla[4].mesas.filter(function (x) { return x.id === b.mesa_id; })[0], menu = D.pantalla[4].menu;
      var its = (b.items || []).map(function (i) { var pl = menu.filter(function (x) { return x.id === i.plato_id; })[0]; return { plato_id: pl.id, nombre: pl.nombre, cantidad: i.cantidad, nota: i.nota || '', precio: pl.precio }; });
      var np = { id: uid(), numero: ++S.siguiente, estado: 'solicitado', origen: 'mesa', tipo: 'retiro', mesa: { numero: me.numero, zona: me.zona }, nombre_cliente: 'Mesa ' + me.numero, telefono: '', direccion: '', referencia: '',
        notas: b.notas || '', total: its.reduce(function (a, i) { return a + i.precio * i.cantidad; }, 0), items: its.map(function (i) { return { plato_id: i.plato_id, nombre: i.nombre, cantidad: i.cantidad, nota: i.nota }; }),
        pagado: false, cobrado_por: null, cobro_medio: null, mozo_toma: quien, mozo_entrega: null, repartidor: null, solicitado_en: ahora(), cocina_en: null, listo_en: null, ruta_en: null, entregado_en: null, codigo: codigo(), codigo_ruta: null };
      S.pedidos.push(np); pintarMesa(me.numero, 'naranjo', 'con_pedido', '', Math.max(1, its.length)); return [201, { id: np.id, numero: np.numero, total: np.total }];
    }
    if (ruta === '/api/pantalla/cobrar') { p = porId(b.pedido_id); if (!p) return [404, { error: 'Pedido de mesa no existe' }]; pagarMesa(p.mesa.numero, quien, b.medio); return ok({ status: 200, ok: true, completo: true }); }
    if (ruta === '/api/pantalla/mesa-limpia' || ruta === '/api/pantalla/mesa-liberar') { var mq = D.pantalla[4].mesas.filter(function (x) { return x.id === b.mesa_id; })[0]; if (mq) pintarMesa(mq.numero, 'verde', 'libre', '', 0); return ok(); }
    if ((m = /^\/api\/mesa\/([A-Z0-9]+)\/llegada$/i.exec(ruta))) {
      var nn = Object.keys(D.mesaCodigos).filter(function (k) { return D.mesaCodigos[k] === m[1].toUpperCase(); })[0]; if (!nn) return [404, { error: 'Mesa no encontrada.' }];
      var est2 = mesaMapa(+nn); if (est2.color === 'verde' || est2.color === 'azul') { pintarMesa(+nn, 'naranjo', 'esperando_pedido', 'Cliente leyendo la carta, esperando al mozo', 1); mesaMapa(+nn).por_qr = true; }
      return [201, { ok: true, ya: false, personas: 1 }];
    }
    if ((m = /^\/api\/mesa\/([A-Z0-9]+)\/pagar$/i.exec(ruta))) {
      var n3 = Object.keys(D.mesaCodigos).filter(function (k) { return D.mesaCodigos[k] === m[1].toUpperCase(); })[0]; if (!n3) return [404, { error: 'Mesa no encontrada.' }];
      var tot = pagarMesa(+n3, S.cliente ? S.cliente.nombre + ' (app)' : 'Cliente (app)', 'app'); return tot ? ok({ status: 200, ok: true, total: tot, platos: 1, fidelidad: !!S.cliente }) : [409, { error: 'La mesa no tiene nada pendiente de pago.' }];
    }
    if (ruta === '/api/pedidos') return [201, (function () { var q = crearPedido(b); return { id: q.id, subtotal: q.subtotal, costo_despacho: q.costo_despacho, total: q.total, pago_url: 'pago-sandbox.html?id=' + q.id }; })()];
    if ((m = /^\/api\/pedidos\/([\w-]+)\/verificar-pago$/.exec(ruta))) { p = porId(m[1]); if (!p) return [404, { error: 'Pedido no existe' }]; if (p.estado === 'pendiente_pago') pagarPedido(p); return ok({ estado: p.estado, numero: p.numero }); }
    if (ruta === '/api/cuenta/registro' || ruta === '/api/cuenta/ingreso') {
      S.cliente = { id: 1, nombre: b.nombre || 'Cliente demo', email: b.email || 'cliente@demo.cl', telefono: b.telefono || '+56 9 0000 0000', debe_cambiar_clave: false };
      return [201, { token: 'demo-cliente', cliente: S.cliente }];
    }
    if (ruta === '/api/cuenta/salir') { S.cliente = null; return ok(); }
    if (ruta === '/api/cuenta/clave') return ok();
    return [404, { error: 'No existe (demo).' }];
  }

  /* ---------- fetch falso ---------- */
  var fetchReal = w.fetch.bind(w);
  w.fetch = function (url, o) {
    var u = typeof url === 'string' ? url : (url && url.url) || '';
    var i = u.indexOf('/api/');
    if (i < 0) return fetchReal(url, o);
    var ruta = u.slice(i).split('?')[0], metodo = (o && o.method || 'GET').toUpperCase(), cuerpo = null;
    try { cuerpo = o && o.body ? JSON.parse(o.body) : null; } catch (e) { cuerpo = null; }
    var persona = pasoDe(o && o.headers);
    return pendiente.then(function () {
      var r = respuesta(metodo, ruta, cuerpo, persona);
      if (metodo !== 'GET') guardarEstado();
      return new Response(JSON.stringify(r[1]), { status: r[0], headers: { 'content-type': 'application/json' } });
    });
  };

  /* ---------- cinta "DEMOSTRACIÓN" (no tapa nada: esquina inferior izquierda) ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var c = document.createElement('a');
    c.href = RAIZ; c.textContent = 'DEMO · datos de ejemplo';
    c.style.cssText = 'position:fixed;left:8px;bottom:78px;z-index:2147483000;background:#14204A;color:#fff;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.5px;padding:5px 9px;border-radius:99px;text-decoration:none;opacity:.88;box-shadow:0 2px 8px rgba(0,0,0,.25)';
    c.title = 'Demostración con datos de ejemplo: no se guarda nada. Volver al inicio de la demo.';
    document.body.appendChild(c);
  });
})(window);
