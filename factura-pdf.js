// Generador de facturas en PDF para Casa LED.
// No usa librerías externas: escribe el PDF directamente (funciona sin internet).
// Fuentes estándar Helvetica / Helvetica-Bold (WinAnsi) y fotos JPEG incrustadas.

const W_R=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const W_B=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];

const PAGE_W = 612, PAGE_H = 792; // carta, en puntos

const ESPECIALES = { 0x20AC:128, 0x201A:130, 0x2026:133, 0x2018:145, 0x2019:146, 0x201C:147, 0x201D:148, 0x2022:149, 0x2013:150, 0x2014:151 };
function codigoWinAnsi(ch){
  const c = ch.codePointAt(0);
  if(c >= 32 && c <= 126) return c;
  if(c >= 160 && c <= 255) return c;
  if(ESPECIALES[c]) return ESPECIALES[c];
  if(c === 10 || c === 13 || c === 9) return 32;
  return 63; // '?'
}
function aCodigos(str){ return Array.from(String(str == null ? '' : str), codigoWinAnsi); }

class MiniPDF {
  constructor(){
    this.pages = [];
    this.images = [];
    this.addPage();
  }
  addPage(){ this.ops = []; this.pages.push(this.ops); }
  _y(y){ return (PAGE_H - y).toFixed(2); }
  _rgb(c){ return c.map((v) => (v/255).toFixed(3)).join(' '); }
  fill(c){ this.ops.push(this._rgb(c) + ' rg'); }
  stroke(c){ this.ops.push(this._rgb(c) + ' RG'); }
  lineWidth(w){ this.ops.push(w + ' w'); }
  rect(x, y, w, h, modo){ // modo: 'f' relleno, 'S' borde, 'B' ambos
    this.ops.push(x.toFixed(2)+' '+(PAGE_H - y - h).toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2)+' re '+(modo||'S'));
  }
  line(x1, y1, x2, y2){ this.ops.push(x1.toFixed(2)+' '+this._y(y1)+' m '+x2.toFixed(2)+' '+this._y(y2)+' l S'); }
  ancho(str, size, bold){
    const t = bold ? W_B : W_R;
    return aCodigos(str).reduce((s, c) => s + (t[c] || 556), 0) * size / 1000;
  }
  text(str, x, y, o){
    o = o || {};
    const size = o.size || 10, bold = !!o.bold;
    let tx = x;
    if(o.align === 'right') tx = x - this.ancho(str, size, bold);
    else if(o.align === 'center') tx = x - this.ancho(str, size, bold) / 2;
    const cods = aCodigos(str);
    let lit = '';
    cods.forEach((c) => {
      if(c === 40 || c === 41 || c === 92) lit += '\\' + String.fromCharCode(c);
      else if(c < 128) lit += String.fromCharCode(c);
      else lit += '\\' + c.toString(8).padStart(3, '0');
    });
    this.ops.push('BT ' + this._rgb(o.color || [17,24,39]) + ' rg /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + tx.toFixed(2) + ' ' + this._y(y) + ' Td (' + lit + ') Tj ET');
  }
  // Corta un texto en líneas que quepan en maxW; si sobra, termina en "…"
  envolver(str, maxW, size, bold, maxLineas){
    const palabras = String(str || '').split(/\s+/).filter(Boolean);
    const lineas = []; let actual = '';
    palabras.forEach((p) => {
      const prueba = actual ? actual + ' ' + p : p;
      if(this.ancho(prueba, size, bold) <= maxW || !actual) actual = prueba;
      else { lineas.push(actual); actual = p; }
    });
    if(actual) lineas.push(actual);
    if(maxLineas && lineas.length > maxLineas){
      const cortadas = lineas.slice(0, maxLineas);
      let ult = cortadas[maxLineas - 1];
      while(ult.length > 1 && this.ancho(ult + '…', size, bold) > maxW) ult = ult.slice(0, -1);
      cortadas[maxLineas - 1] = ult + '…';
      return cortadas;
    }
    return lineas;
  }
  image(img, x, y, w, h){
    if(!img) return;
    let idx = this.images.indexOf(img);
    if(idx < 0){ this.images.push(img); idx = this.images.length - 1; }
    this.ops.push('q ' + w.toFixed(2) + ' 0 0 ' + h.toFixed(2) + ' ' + x.toFixed(2) + ' ' + (PAGE_H - y - h).toFixed(2) + ' cm /Im' + idx + ' Do Q');
  }
  // Ajusta la imagen dentro de una caja conservando proporción
  imageFit(img, x, y, w, h){
    if(!img) return;
    const r = Math.min(w / img.w, h / img.h);
    const iw = img.w * r, ih = img.h * r;
    this.image(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }
  salida(){
    const enc = new TextEncoder();
    const partes = []; const offsets = []; let largo = 0;
    const push = (d) => { const b = typeof d === 'string' ? enc.encode(d) : d; partes.push(b); largo += b.length; };
    const latin1 = (s) => { const b = new Uint8Array(s.length); for(let i=0;i<s.length;i++) b[i] = s.charCodeAt(i) & 255; return b; };
    const objetos = []; // cada uno: [string|Uint8Array...]
    const nuevo = () => { objetos.push(null); return objetos.length; };
    const catalogo = nuevo(), paginasId = nuevo(), f1 = nuevo(), f2 = nuevo();
    const imgIds = this.images.map(() => nuevo());
    const pagIds = [], contIds = [];
    this.pages.forEach(() => { pagIds.push(nuevo()); contIds.push(nuevo()); });

    objetos[catalogo-1] = ['<< /Type /Catalog /Pages ' + paginasId + ' 0 R >>'];
    objetos[paginasId-1] = ['<< /Type /Pages /Kids [' + pagIds.map((i) => i + ' 0 R').join(' ') + '] /Count ' + pagIds.length + ' >>'];
    objetos[f1-1] = ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
    objetos[f2-1] = ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
    const xobj = this.images.map((im, i) => '/Im' + i + ' ' + imgIds[i] + ' 0 R').join(' ');
    this.images.forEach((im, i) => {
      objetos[imgIds[i]-1] = ['<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>\nstream\n', im.bytes, '\nendstream'];
    });
    this.pages.forEach((ops, i) => {
      objetos[pagIds[i]-1] = ['<< /Type /Page /Parent ' + paginasId + ' 0 R /MediaBox [0 0 ' + PAGE_W + ' ' + PAGE_H + '] /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> /XObject << ' + xobj + ' >> >> /Contents ' + contIds[i] + ' 0 R >>'];
      const contenido = latin1(ops.join('\n'));
      objetos[contIds[i]-1] = ['<< /Length ' + contenido.length + ' >>\nstream\n', contenido, '\nendstream'];
    });

    push('%PDF-1.4\n');
    push(new Uint8Array([37, 226, 227, 207, 211, 10]));
    objetos.forEach((partesObj, i) => {
      offsets.push(largo);
      push((i+1) + ' 0 obj\n');
      partesObj.forEach(push);
      push('\nendobj\n');
    });
    const xref = largo;
    let tabla = 'xref\n0 ' + (objetos.length + 1) + '\n0000000000 65535 f \n';
    offsets.forEach((o) => { tabla += String(o).padStart(10, '0') + ' 00000 n \n'; });
    push(tabla);
    push('trailer\n<< /Size ' + (objetos.length + 1) + ' /Root ' + catalogo + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    return new Blob(partes, { type: 'application/pdf' });
  }
}

// Carga una imagen (URL o data URL) y la convierte en JPEG RGB para el PDF.
const cacheImgs = new Map();
export function cargarImagenJPEG(url, maxPx, fondo){
  if(!url) return Promise.resolve(null);
  const clave = url + '|' + maxPx + '|' + (fondo||'');
  if(cacheImgs.has(clave)) return cacheImgs.get(clave);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try{
        const r = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * r)), h = Math.max(1, Math.round(img.naturalHeight * r));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = fondo || '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const b64 = c.toDataURL('image/jpeg', 0.86).split(',')[1];
        const bin = atob(b64); const bytes = new Uint8Array(bin.length);
        for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        resolve({ bytes, w, h });
      }catch(e){ resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  cacheImgs.set(clave, p);
  return p;
}

function cop(n){ return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); }
function fechaCorta(iso){
  try{ const d = new Date(iso); return d.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' }); }catch(e){ return ''; }
}

const NEGRO = [11, 15, 22], AZUL = [24, 100, 209], AZUL_CLARO = [232, 240, 252], GRIS = [100, 112, 128], LINEA = [205, 213, 224], ZEBRA = [246, 248, 251], ROJO = [200, 40, 40], BLANCO = [255, 255, 255];

/**
 * datos = {
 *   empresa: {nombre, nit, direccion, ciudad, telefono, email, instagram, web, notas},
 *   logoUrl, venta: {numero, fecha, tipoPago, abono, saldo, total, vendedorNombre, rutaNombre},
 *   cliente: {nombre, documento, direccion, ciudad, telefono},
 *   items: [{nombre, cantidad, precio, subtotal, imagenUrl}]
 * }
 */
export async function generarFacturaPDF(datos){
  const e = datos.empresa || {}, v = datos.venta || {}, cl = datos.cliente || {};
  const items = datos.items || [];
  const logo = await cargarImagenJPEG(datos.logoUrl, 300, '#000000');
  const fotos = await Promise.all(items.map((it) => cargarImagenJPEG(it.imagenUrl, 140, '#ffffff')));

  const pdf = new MiniPDF();
  const M = 30, ANCHO = PAGE_W - 2 * M;
  let pagina = 1;

  function encabezado(){
    // Barra superior
    pdf.fill(NEGRO); pdf.rect(0, 0, PAGE_W, 8, 'f');
    pdf.fill(AZUL); pdf.rect(0, 8, PAGE_W, 2.5, 'f');
    // Logo
    if(logo){ pdf.imageFit(logo, M, 22, 84, 84); }
    // Empresa
    const xE = M + 96;
    pdf.text((e.nombre || 'Casa LED').toUpperCase(), xE, 40, { size: 18, bold: true, color: NEGRO });
    pdf.text('Iluminación LED y accesorios para motos', xE, 54, { size: 9, color: AZUL, bold: true });
    let yE = 69;
    const lineasEmp = [
      e.nit ? 'NIT: ' + e.nit : '',
      [e.direccion, e.ciudad].filter(Boolean).join(' · '),
      e.telefono ? 'Tel / WhatsApp: ' + e.telefono : '',
      [e.email, e.instagram, e.web].filter(Boolean).join('  ·  ')
    ].filter(Boolean);
    lineasEmp.forEach((l) => { pdf.text(l, xE, yE, { size: 8.5, color: GRIS }); yE += 11; });

    // Caja de factura
    const wF = 168, xF = PAGE_W - M - wF, yF = 22;
    pdf.fill(NEGRO); pdf.rect(xF, yF, wF, 24, 'f');
    pdf.text('FACTURA DE VENTA', xF + wF / 2, yF + 16, { size: 11, bold: true, color: BLANCO, align: 'center' });
    pdf.stroke(LINEA); pdf.lineWidth(0.8);
    const filas = [
      ['N.°', String(v.numero || '')],
      ['Fecha', fechaCorta(v.fecha)],
      ['Pago', v.tipoPago === 'credito' ? 'Crédito' : 'Contado'],
      ['Asesor', v.vendedorNombre || '']
    ];
    let yR = yF + 24;
    filas.forEach((f, i) => {
      pdf.fill(i % 2 ? BLANCO : ZEBRA); pdf.rect(xF, yR, wF, 16, 'f');
      pdf.text(f[0], xF + 8, yR + 11, { size: 8.5, bold: true, color: GRIS });
      const val = pdf.envolver(f[1], wF - 66, 9, f[0] === 'N.°', 1)[0] || '';
      pdf.text(val, xF + wF - 8, yR + 11, { size: f[0] === 'N.°' ? 11 : 9, bold: f[0] === 'N.°', color: f[0] === 'N.°' ? AZUL : NEGRO, align: 'right' });
      yR += 16;
    });
    pdf.rect(xF, yF, wF, yR - yF, 'S');
    return 116;
  }

  function cajaCliente(y){
    const h = 62;
    pdf.stroke(LINEA); pdf.lineWidth(0.8);
    pdf.fill(AZUL_CLARO); pdf.rect(M, y, ANCHO, h, 'B');
    pdf.fill(AZUL); pdf.rect(M, y, 3, h, 'f');
    const col2 = M + ANCHO * 0.6;
    const fila = (etq, val, x, yy, maxW) => {
      pdf.text(etq, x, yy, { size: 7.5, bold: true, color: GRIS });
      pdf.text(pdf.envolver(val || '—', maxW, 10, false, 1)[0] || '—', x + 62, yy, { size: 10, color: NEGRO });
    };
    fila('CLIENTE', cl.nombre, M + 12, y + 17, col2 - M - 90);
    fila('DIRECCIÓN', cl.direccion, M + 12, y + 34, col2 - M - 90);
    fila('CIUDAD', cl.ciudad, M + 12, y + 51, col2 - M - 90);
    fila('NIT / CC', cl.documento, col2, y + 17, M + ANCHO - col2 - 72);
    fila('TELÉFONO', cl.telefono, col2, y + 34, M + ANCHO - col2 - 72);
    fila('RUTA', v.rutaNombre, col2, y + 51, M + ANCHO - col2 - 72);
    return y + h + 14;
  }

  // Columnas de la tabla
  const C = [
    { t: 'FOTO', w: 54, a: 'center' },
    { t: 'DESCRIPCIÓN', w: 0, a: 'left' },
    { t: 'CANT.', w: 50, a: 'center' },
    { t: 'PRECIO UNIT.', w: 86, a: 'right' },
    { t: 'TOTAL', w: 92, a: 'right' }
  ];
  C[1].w = ANCHO - C.reduce((s, c) => s + c.w, 0);
  let xs = M; C.forEach((c) => { c.x = xs; xs += c.w; });

  function cabeceraTabla(y){
    pdf.fill(NEGRO); pdf.rect(M, y, ANCHO, 20, 'f');
    C.forEach((c) => {
      const tx = c.a === 'left' ? c.x + 8 : c.a === 'right' ? c.x + c.w - 8 : c.x + c.w / 2;
      pdf.text(c.t, tx, y + 13.5, { size: 8.5, bold: true, color: BLANCO, align: c.a });
    });
    return y + 20;
  }

  function pie(){
    pdf.stroke(LINEA); pdf.lineWidth(0.6); pdf.line(M, PAGE_H - 28, PAGE_W - M, PAGE_H - 28);
    pdf.text((e.nombre || 'Casa LED') + (e.web ? ' · ' + e.web : '') + (e.instagram ? ' · ' + e.instagram : ''), M, PAGE_H - 16, { size: 7.5, color: GRIS });
    pdf.text('Página ' + pagina, PAGE_W - M, PAGE_H - 16, { size: 7.5, color: GRIS, align: 'right' });
  }

  function continuacion(){
    pdf.fill(NEGRO); pdf.rect(0, 0, PAGE_W, 4, 'f');
    pdf.text((e.nombre || 'Casa LED') + ' · Factura de venta N.° ' + (v.numero || '') + ' · ' + (cl.nombre || '') + ' (continuación)', M, 24, { size: 9, bold: true, color: GRIS });
    return 36;
  }

  let y = encabezado();
  y = cajaCliente(y);
  y = cabeceraTabla(y);

  const FILA = 36, LIMITE = PAGE_H - 44;
  items.forEach((it, i) => {
    if(y + FILA > LIMITE){
      pie(); pdf.addPage(); pagina++;
      y = cabeceraTabla(continuacion());
    }
    if(i % 2 === 1){ pdf.fill(ZEBRA); pdf.rect(M, y, ANCHO, FILA, 'f'); }
    pdf.stroke(LINEA); pdf.lineWidth(0.5); pdf.line(M, y + FILA, M + ANCHO, y + FILA);
    if(fotos[i]){
      pdf.fill(BLANCO); pdf.stroke(LINEA); pdf.rect(C[0].x + 11, y + 3, 32, 30, 'B');
      pdf.imageFit(fotos[i], C[0].x + 12, y + 4, 30, 28);
    }
    const lineas = pdf.envolver(it.nombre, C[1].w - 16, 9.5, true, 2);
    const yTxt = y + FILA / 2 - (lineas.length - 1) * 5.5 + 3.5;
    lineas.forEach((l, k) => pdf.text(l, C[1].x + 8, yTxt + k * 11, { size: 9.5, bold: true, color: NEGRO }));
    const yc = y + FILA / 2 + 3.5;
    pdf.text(String(it.cantidad), C[2].x + C[2].w / 2, yc, { size: 10, bold: true, align: 'center' });
    pdf.text(cop(it.precio), C[3].x + C[3].w - 8, yc, { size: 9.5, align: 'right', color: GRIS });
    pdf.text(cop(it.subtotal), C[4].x + C[4].w - 8, yc, { size: 10, bold: true, align: 'right' });
    y += FILA;
  });
  // borde exterior de la tabla en esta página
  y += 12;

  // Totales y notas (si no caben, nueva página)
  const credito = v.tipoPago === 'credito';
  const altoTot = credito ? 104 : 70;
  if(y + altoTot > LIMITE){ pie(); pdf.addPage(); pagina++; y = continuacion() + 6; }
  const unidades = items.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);
  const wT = 220, xT = PAGE_W - M - wT;
  const filaTot = (etq, val, yy, o) => {
    o = o || {};
    if(o.fondo){ pdf.fill(o.fondo); pdf.rect(xT, yy, wT, o.h || 22, 'f'); }
    pdf.text(etq, xT + 10, yy + (o.h ? o.h / 2 + 4 : 15), { size: o.size || 9.5, bold: true, color: o.color || GRIS });
    pdf.text(val, xT + wT - 10, yy + (o.h ? o.h / 2 + 4 : 15), { size: o.size || 10, bold: true, color: o.color || NEGRO, align: 'right' });
  };
  let yT = y;
  filaTot('SUBTOTAL', cop(v.total), yT); yT += 22;
  pdf.stroke(LINEA); pdf.line(xT, yT, xT + wT, yT);
  filaTot('TOTAL', cop(v.total), yT + 2, { fondo: NEGRO, color: BLANCO, size: 12, h: 28 }); yT += 32;
  if(credito){
    filaTot('ABONO', cop(v.abono), yT); yT += 20;
    filaTot('SALDO PENDIENTE', cop(v.saldo), yT, { fondo: [253, 236, 236], color: ROJO, h: 24 }); yT += 26;
  }

  // Caja izquierda: forma de pago y resumen
  const wL = ANCHO - wT - 14;
  pdf.stroke(LINEA); pdf.lineWidth(0.8); pdf.rect(M, y, wL, yT - y, 'S');
  pdf.text('FORMA DE PAGO', M + 10, y + 16, { size: 8, bold: true, color: GRIS });
  pdf.text(credito ? 'CRÉDITO' : 'CONTADO · PAGADO', M + 10, y + 32, { size: 13, bold: true, color: credito ? ROJO : [13, 150, 104] });
  pdf.text(items.length + ' referencia(s) · ' + unidades + ' unidad(es)', M + 10, y + 50, { size: 9, color: GRIS });

  // Notas
  let yN = Math.max(yT, y + 60) + 14;
  const notas = (e.notas || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if(notas.length){
    const lineasN = [];
    notas.forEach((n) => pdf.envolver(n, ANCHO - 24, 8.5, false).forEach((l) => lineasN.push(l)));
    const hN = 18 + lineasN.length * 11;
    if(yN + hN > LIMITE){ pie(); pdf.addPage(); pagina++; yN = continuacion() + 6; }
    pdf.stroke(LINEA); pdf.rect(M, yN, ANCHO, hN, 'S');
    pdf.text('NOTAS', M + 12, yN + 13, { size: 8, bold: true, color: AZUL });
    lineasN.forEach((l, k) => pdf.text(l, M + 12, yN + 26 + k * 11, { size: 8.5, color: GRIS }));
    yN += hN + 18;
  }
  pdf.text('¡Gracias por su compra!', PAGE_W / 2, Math.min(yN + 6, LIMITE), { size: 11, bold: true, color: AZUL, align: 'center' });
  pie();

  return pdf.salida();
}
