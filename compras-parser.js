// Lee facturas de compra (PDF o texto copiado) y saca proveedor, número, fecha, total y productos.
// Funciona sin internet: pdf.js va incluido en vendor/pdfjs.

var pdfjsPromesa = null;
function cargarPdfjs(base){
  if(!pdfjsPromesa){
    pdfjsPromesa = import(base + 'vendor/pdfjs/pdf.min.mjs').then(function(m){
      m.GlobalWorkerOptions.workerSrc = base + 'vendor/pdfjs/pdf.worker.min.mjs';
      return m;
    });
  }
  return pdfjsPromesa;
}

// PDF → páginas → filas → celdas (textos en el orden en que se ven)
export async function leerPDF(datos, opciones){
  var base = (opciones && opciones.base) || './';
  var pdfjs = await cargarPdfjs(base);
  var documento = await pdfjs.getDocument({
    data: datos instanceof Uint8Array ? datos : new Uint8Array(datos),
    cMapUrl: base + 'vendor/pdfjs/cmaps/', cMapPacked: true, isEvalSupported: false
  }).promise;
  var paginas = [];
  for(var n = 1; n <= documento.numPages; n++){
    var pagina = await documento.getPage(n);
    var contenido = await pagina.getTextContent();
    var filas = [];
    contenido.items.forEach(function(it){
      if(!it.str || !it.str.trim()) return;
      var x = it.transform[4], y = it.transform[5];
      var fila = null;
      for(var i = 0; i < filas.length; i++){ if(Math.abs(filas[i].y - y) < 3){ fila = filas[i]; break; } }
      if(!fila){ fila = { y: y, celdas: [] }; filas.push(fila); }
      fila.celdas.push({ x: x, t: it.str.trim() });
    });
    filas.sort(function(a, b){ return b.y - a.y; });
    paginas.push(filas.map(function(f){
      f.celdas.sort(function(a, b){ return a.x - b.x; });
      return f.celdas.map(function(c){ return c.t; });
    }));
  }
  try{ documento.destroy(); }catch(e){}
  return paginas;
}

// Texto pegado → una "página" de filas. Las celdas se separan por tabulación o 2+ espacios.
export function textoAPaginas(texto){
  var filas = String(texto || '').replace(/\r/g, '').split('\n').map(function(l){
    return l.split(/\t| {2,}/).map(function(c){ return c.trim(); }).filter(Boolean);
  }).filter(function(f){ return f.length; });
  return [filas];
}

// "1.530.000" → 1530000 · "20,00" → 20 · "1,275" → 1275 · "27200.50" → 27200.5
export function numeroCO(s){
  s = String(s).replace(/[$\s]/g, '');
  if(!/^\d[\d.,]*$/.test(s)) return null;
  if(/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''));
  var m = s.match(/^(\d{1,3}(?:([.,])\d{3})*)([.,])(\d{1,2})$/);
  if(m && m[2] !== m[3]) return Number(m[1].replace(/[.,]/g, '') + '.' + m[4]);
  if(/^\d+([.,]\d{1,2})?$/.test(s)) return Number(s.replace(',', '.'));
  return null;
}
function esNumero(tok){ return /^\$?\d[\d.,]*%?$/.test(tok) && tok.slice(-1) !== '%' && numeroCO(tok) != null; }
function pareceCodigo(tok){ return tok.length >= 2 && tok.length <= 30 && /[\d-]/.test(tok) && /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(tok); }

// Busca cantidad × precio = total dentro de una lista de tokens. Devuelve los índices o null.
function buscarTrio(toks){
  var nums = [];
  toks.forEach(function(t, i){ if(esNumero(t)) nums.push({ i: i, v: numeroCO(t) }); });
  for(var k = nums.length - 1; k >= 2; k--){
    var t = nums[k].v; if(t < 10) continue;
    for(var j = k - 1; j >= 1; j--){
      var p = nums[j].v; if(p < 10) continue;
      for(var i = j - 1; i >= 0; i--){
        var q = nums[i].v;
        if(q > 0 && q <= 100000 && Math.abs(q * p - t) <= Math.max(2, t * 0.002)){
          return { iq: nums[i].i, ip: nums[j].i, it: nums[k].i, q: q, p: p, t: t };
        }
      }
    }
  }
  return null;
}

function separarTokens(celdas){
  var toks = [];
  celdas.forEach(function(c){
    // las fechas no son números de la tabla
    c.replace(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g, ' ').split(/\s+/).forEach(function(t){ if(t) toks.push(t); });
  });
  return toks;
}

function armarLinea(pre, trio){
  var codigo = '';
  var resto = pre.slice();
  // número de renglón (1, 2, 3…) antes del código
  if(resto.length > 2 && /^\d{1,3}$/.test(resto[0]) && pareceCodigo(resto[1])) resto.shift();
  if(resto.length > 1 && pareceCodigo(resto[0])) codigo = resto.shift();
  var descripcion = resto.join(' ').replace(/\s+/g, ' ').trim();
  return { codigo: codigo.toUpperCase(), descripcion: descripcion, cantidad: trio.q, precio: trio.p, subtotal: trio.t };
}

function tituloPropio(s){
  if(s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s.-])([a-záéíóúñ])/g, function(m, a, b){ return a + b.toUpperCase(); })
    .replace(/\b(Sas|S\.a\.s\.?|Ltda\.?|S\.a\.?|Eu|Ci)\b/g, function(m){ return m.toUpperCase(); });
}

export function parsearFactura(paginas){
  var r = { proveedor: '', numero: '', fecha: '', total: 0, lineas: [] };
  var todas = [];
  var fechaDeFila = false; // se prefiere la fecha que está junto a la palabra "FECHA"
  paginas.forEach(function(filas, pi){ filas.forEach(function(f){ todas.push({ pag: pi, celdas: f }); }); });

  // --- Encabezado ---
  var tipos = /^(cotizaci[oó]n|factura(\s+(de\s+venta|electr[oó]nica|de\s+compra))*|remisi[oó]n|pedido|cuenta\s+de\s+cobro|orden\s+de\s+compra)$/i;
  for(var a = 0; a < Math.min(todas.length, 8) && !r.proveedor; a++){
    var c0 = todas[a].celdas.filter(function(c){ return !tipos.test(c.trim()) && /[a-záéíóúñ]{3}/i.test(c) && !/@|https?:|www\.|^nit\b|^tel/i.test(c); });
    if(c0.length) r.proveedor = tituloPropio(c0[0].replace(/\s+/g, ' ').trim()
      .replace(/\s+(cotizaci[oó]n|factura(\s+(de\s+venta|electr[oó]nica))*|remisi[oó]n|pedido)\b.*$/i, ''));
  }
  todas.forEach(function(f, ix){
    var txt = f.celdas.join(' ');
    var sig = todas[ix + 1];
    if(f.celdas.length === 1 && sig && sig.celdas.length === 1) txt += ' ' + sig.celdas[0];
    if(!r.numero){
      var mn = txt.match(/\b(?:N[UÚ]MERO|FACTURA(?:\s+(?:DE\s+VENTA|ELECTR[OÓ]NICA))*\s*(?:N[O°º]\.?)|COTIZACI[OÓ]N\s*(?:N[O°º]\.?)|N[°º]\.?|No\.)\s*:?\s*([A-Z]{0,6}[- ]?\d{2,})\b/i);
      if(mn) r.numero = mn[1].replace(/\s+/g, ' ').trim();
    }
    if(!r.fecha || (!fechaDeFila && /fecha/i.test(txt))){
      var mf = txt.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
      var mi = txt.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
      var encontrada = '';
      if(mi) encontrada = mi[1] + '-' + mi[2] + '-' + mi[3];
      else if(mf){
        var an = mf[3].length === 2 ? '20' + mf[3] : mf[3];
        var mes = Number(mf[2]), dia = Number(mf[1]);
        if(mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) encontrada = an + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
      }
      if(encontrada){ r.fecha = encontrada; if(/fecha/i.test(txt)) fechaDeFila = true; }
    }
    if(/^\s*(valor\s+)?(total(\s+(a\s+pagar|factura|general|neto))?|neto\s+a\s+pagar)\b/i.test(txt) && !/sub\s*total/i.test(txt)){
      var toksT = separarTokens([txt]).filter(esNumero);
      if(toksT.length) r.total = numeroCO(toksT[toksT.length - 1]);
    }
  });

  // --- Productos ---
  // Fila por fila: si una fila trae cantidad × precio = total, es un producto.
  var lineas = [];
  var sueltas = []; // celdas de filas sin trío (por si el texto pegado viene una celda por renglón)
  var usadasFila = 0;
  todas.forEach(function(f, idx){
    var toks = separarTokens(f.celdas);
    var trio = buscarTrio(toks);
    if(trio){
      var l = armarLinea(toks.slice(0, trio.iq), trio);
      l.pagina = f.pag; l.orden = idx;
      lineas.push(l); usadasFila++;
    }
  });

  // Texto pegado con una celda por renglón: se recorre como una sola tira.
  if(usadasFila < 2){
    var celdas = [];
    todas.forEach(function(f){ f.celdas.forEach(function(c){ celdas.push({ t: c, pag: f.pag }); }); });
    var lineasTira = [];
    var desde = 0;
    for(var k = 2; k < celdas.length; k++){
      var tr = [celdas[k - 2].t, celdas[k - 1].t, celdas[k].t];
      if(!tr.every(esNumero)) continue;
      var q = numeroCO(tr[0]), p = numeroCO(tr[1]), t = numeroCO(tr[2]);
      if(!(q > 0 && q <= 100000 && p >= 10 && Math.abs(q * p - t) <= Math.max(2, t * 0.002))) continue;
      // las 2 celdas antes de la cantidad: código y descripción
      var c1 = k - 3 >= desde ? celdas[k - 3].t : '';
      var c2 = k - 4 >= desde ? celdas[k - 4].t : '';
      var lt;
      if(c1 && pareceCodigo(c1) && !/\s/.test(c1) && (!c2 || esNumero(c1))){
        lt = { codigo: c1.toUpperCase(), descripcion: '', cantidad: q, precio: p, subtotal: t };
      } else {
        lt = { codigo: (c2 && pareceCodigo(c2)) ? c2.toUpperCase() : '', descripcion: c1, cantidad: q, precio: p, subtotal: t };
      }
      lt.pagina = celdas[k].pag; lt.orden = k;
      lineasTira.push(lt);
      desde = k + 1;
    }
    if(lineasTira.length > lineas.length) lineas = lineasTira;
  }

  // Filas repetidas (mismo código, cantidad y precio): pasa cuando la tabla sigue en la otra hoja.
  lineas.forEach(function(l, i){
    for(var j = 0; j < i; j++){
      var o = lineas[j];
      if(!o.repetida && o.codigo === l.codigo && o.cantidad === l.cantidad && o.precio === l.precio && (l.codigo || o.descripcion === l.descripcion)){
        l.repetida = true;
        if(o.descripcion) l.descripcion = o.descripcion;
        break;
      }
    }
  });
  r.lineas = lineas;
  r.suma = lineas.reduce(function(s, l){ return s + (l.repetida ? 0 : l.subtotal); }, 0);
  return r;
}

// ---------- RUT (formulario 001 de la DIAN) ----------
function dvNit(nit){
  var w = [3,7,13,17,19,23,29,37,41,43,47,53,59,67,71];
  var s = String(nit).replace(/\D/g, '').split('').reverse().reduce(function(a, d, i){ return a + Number(d) * w[i]; }, 0);
  var r = s % 11; return String(r > 1 ? 11 - r : r);
}
export { dvNit };
export function leerRUT(paginas){
  var filas = [];
  paginas.forEach(function(p){ p.forEach(function(f){ filas.push(f); }); });
  var idx = function(re){ for(var i = 0; i < filas.length; i++){ if(filas[i].some(function(c){ return re.test(c); })) return i; } return -1; };
  var despues = function(re){ var i = idx(re); return i > -1 && filas[i+1] ? filas[i+1] : []; };
  var enFila = function(re){ var i = idx(re); if(i < 0) return ''; var f = filas[i]; var k = f.findIndex(function(c){ return re.test(c); }); return f.slice(k+1).join(' ').trim(); };
  var r = {};
  // nombres
  var nom = despues(/31\.\s*Primer apellido/i);
  r.primerApellido = nom[0] || ''; r.segundoApellido = nom[1] || ''; r.primerNombre = nom[2] || ''; r.otrosNombres = nom.slice(3).join(' ');
  r.razonSocial = enFila(/35\.\s*Raz[oó]n social/i);
  // identificación
  var ident = despues(/24\.\s*Tipo de contribuyente/i);
  var celdaNum = ident.find(function(c){ return /^(\d\s){5,}\d$/.test(c); }) || '';
  r.numero = celdaNum.replace(/\s/g, '');
  r.tipoContribuyente = ident[0] || '';
  r.tipoDocumento = ident.find(function(c){ return /c[eé]dula|nit|pasaporte|extranjer/i.test(c); }) || '';
  if(!r.numero){
    var filaNit = despues(/5\.\s*N[uú]mero de Identificaci[oó]n Tributaria/i).join('');
    r.numero = filaNit.slice(0, 10);
  }
  var filaNit2 = despues(/5\.\s*N[uú]mero de Identificaci[oó]n Tributaria/i).join('');
  var dvLeido = filaNit2.indexOf(r.numero) === 0 ? filaNit2.charAt(r.numero.length) : '';
  r.dv = dvNit(r.numero);
  r.dvCoincide = !dvLeido || dvLeido === r.dv;
  // ubicación
  var ubic = despues(/38\.\s*Pa[ií]s/i);
  var nombres = ubic.filter(function(c){ return /[a-záéíóúñ]/i.test(c) && !/^colombia$/i.test(c); });
  r.departamento = nombres[0] || ''; r.municipio = nombres[1] || '';
  var codigos = [], actual = '';
  ubic.forEach(function(c){ if(/^\d$/.test(c)) actual += c; else { if(actual) codigos.push(actual); actual = ''; } });
  if(actual) codigos.push(actual);
  // codigos: [país, depto, municipio]
  r.codDepartamento = codigos[1] || ''; r.codMunicipio = (codigos[1] || '') + (codigos[2] || '');
  r.pais = 'Colombia';
  r.direccion = despues(/41\.\s*Direcci[oó]n principal/i).join(' ').trim();
  r.correo = enFila(/42\.\s*Correo/i).toLowerCase();
  var tel = enFila(/44\.\s*Tel[eé]fono 1/i).replace(/45\..*$/, '');
  r.telefono = tel.replace(/\D/g, '');
  // actividad económica (CIIU principal)
  var act = despues(/46\.\s*C[oó]digo/i).join('');
  r.ciiu = act.slice(0, 4);
  // responsabilidades
  r.responsabilidades = filas.map(function(f){ return f.join(' '); }).filter(function(t){ return /^\d{1,2}\s*-\s*\S/.test(t); });
  var mat = enFila(/77\.\s*No\.\s*Matr[ií]cula/i).replace(/\D/g, '');
  r.matricula = mat;
  r.valido = !!(r.numero && r.primerApellido && r.direccion);
  return r;
}

// ---------- Ver un PDF como imágenes (para mostrarlo dentro de la app) ----------
export async function pdfAImagenes(datos, opciones){
  var base = (opciones && opciones.base) || './';
  var escala = (opciones && opciones.escala) || 2;
  var pdfjs = await cargarPdfjs(base);
  var documento = await pdfjs.getDocument({
    data: datos instanceof Uint8Array ? datos : new Uint8Array(datos),
    cMapUrl: base + 'vendor/pdfjs/cmaps/', cMapPacked: true, isEvalSupported: false
  }).promise;
  var imagenes = [];
  for(var n = 1; n <= documento.numPages; n++){
    var pagina = await documento.getPage(n);
    var vista = pagina.getViewport({ scale: escala });
    var lienzo = document.createElement('canvas');
    lienzo.width = Math.ceil(vista.width); lienzo.height = Math.ceil(vista.height);
    var ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    await pagina.render({ canvasContext: ctx, viewport: vista }).promise;
    imagenes.push(lienzo.toDataURL('image/jpeg', 0.9));
  }
  try{ documento.destroy(); }catch(e){}
  return imagenes;
}
