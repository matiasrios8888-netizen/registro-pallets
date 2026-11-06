// Leer la COOIS: la exportación de SAP con las órdenes de producción. Acá no hay nada de
// pantalla: solo se pasa el Excel a una lista de órdenes. XLSX es SheetJS, que se carga en
// index.html.

// Los datos que la app usa de cada orden. Sin número de orden ni código no hay orden. Para saber
// cuánto le falta a cada una alcanza con la cantidad pendiente, o con la cantidad de la orden y
// la entregada.
export const CAMPOS_COOIS = [
  { clave: 'numero', nombre: 'Número de orden', obligatorio: true },
  { clave: 'codigoInterno', nombre: 'Código interno', obligatorio: true },
  { clave: 'descripcion', nombre: 'Descripción' },
  { clave: 'cantidad', nombre: 'Cantidad de la orden' },
  { clave: 'entregada', nombre: 'Cantidad entregada' },
  { clave: 'pendiente', nombre: 'Cantidad pendiente' },
  { clave: 'fecha', nombre: 'Fecha de la orden' },
];

// Palabras que suelen aparecer en el nombre de cada columna, para dejarla elegida sola. Se prueban
// en este orden: "Cantidad orden" la toma la cantidad antes de que "orden" la tome como número
// de orden, y "Texto breve de material" la toma la descripción antes que el código.
const PISTAS = [
  ['entregada', /entregad|notificad|recibid/],
  ['pendiente', /pendiente|abierta|falta|resto/],
  ['cantidad', /cantidad|\bctd|\bcant\b/],
  ['fecha', /fecha|inicio|\bdate\b/],
  ['descripcion', /descripcion|texto|denominacion/],
  ['codigoInterno', /material|codigo|articulo|producto/],
  ['numero', /orden|order|\bop\b|\bof\b/],
];

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Sin mayúsculas ni tildes: "Código" y "codigo" son lo mismo.
const sinTildes = (texto) => String(texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Lee la primera hoja del archivo. Devuelve los nombres de las columnas, las filas de datos (cada
// una, una lista de valores) y la primera fila como se ve en Excel, para mostrar ejemplos.
// Falla si no es un Excel o un CSV, o si no encuentra los nombres de las columnas.
export async function leerArchivoCoois(archivo) {
  const libro = XLSX.read(await archivo.arrayBuffer());
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: '' });
  const textos = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' });
  // Algunas exportaciones traen un título arriba: los nombres de las columnas son la primera fila
  // con al menos 3 textos.
  const inicio = filas.findIndex((fila) => fila.filter((v) => typeof v === 'string' && v.trim()).length >= 3);
  if (inicio === -1) throw new Error('No se encontraron los nombres de las columnas.');
  const encabezados = filas[inicio].map((v, i) => String(v).trim() || `Columna ${XLSX.utils.encode_col(i)}`);
  const conDatos = (fila) => fila.some((v) => String(v).trim() !== '');
  return {
    encabezados,
    filas: filas.slice(inicio + 1).filter(conDatos),
    ejemplos: textos.slice(inicio + 1).find(conDatos) ?? [],
  };
}

// Elige una columna para cada dato: primero la que se eligió la vez anterior, si el archivo la
// sigue teniendo, y si no, la que tenga un nombre parecido. Devuelve { clave: número de columna }.
// anteriores: { clave: nombre de la columna } de la importación anterior.
export function adivinarColumnas(encabezados, anteriores = {}) {
  const elegidas = {};
  const usadas = new Set();
  const elegir = (clave, columna) => {
    elegidas[clave] = columna;
    usadas.add(columna);
  };
  for (const { clave } of CAMPOS_COOIS) {
    const columna = encabezados.indexOf(anteriores[clave]);
    if (columna !== -1 && !usadas.has(columna)) elegir(clave, columna);
  }
  for (const [clave, pista] of PISTAS) {
    if (clave in elegidas) continue;
    const columna = encabezados.findIndex((nombre, i) => !usadas.has(i) && pista.test(sinTildes(nombre)));
    if (columna !== -1) elegir(clave, columna);
  }
  return elegidas;
}

// Dice qué falta elegir para poder importar, o '' si está todo.
export function queFaltaElegir(columnas) {
  const faltan = CAMPOS_COOIS.filter((campo) => campo.obligatorio && columnas[campo.clave] === undefined)
    .map((campo) => campo.nombre);
  const sinCantidad = columnas.pendiente === undefined
    && (columnas.cantidad === undefined || columnas.entregada === undefined);
  return [
    faltan.length ? `Falta elegir: ${faltan.join(' y ')}.` : '',
    sinCantidad ? 'Para saber cuánto falta de cada orden, elegí la cantidad pendiente, o la cantidad de la orden y la entregada.' : '',
  ].filter(Boolean).join(' ');
}

// Un texto sin espacios alrededor. Un número de orden puede venir como número: 1000451.
const textoDeCelda = (valor) => String(valor ?? '').trim();

// Una cantidad puede venir como número o como texto: "1.200", "1.200,000" o "1,200.00". Si hay
// puntos y comas, el último que aparece separa los decimales. Si hay uno solo seguido de 3
// cifras, separa los miles: las órdenes son de unidades enteras. Devuelve NaN si no es un número.
function numeroDeCelda(valor) {
  if (typeof valor === 'number') return valor;
  const texto = String(valor ?? '').replace(/[^\d.,-]/g, '');
  if (!/\d/.test(texto)) return NaN;
  const puntos = texto.split('.').length - 1;
  const comas = texto.split(',').length - 1;
  let decimal = '';
  if (puntos && comas) decimal = texto.lastIndexOf('.') > texto.lastIndexOf(',') ? '.' : ',';
  else if (puntos + comas === 1 && !/[.,]\d{3}$/.test(texto)) decimal = puntos ? '.' : ',';
  const miles = decimal === '.' ? ',' : '.';
  const limpio = texto.replaceAll(decimal ? miles : /[.,]/g, '').replace(',', '.');
  return Number(limpio);
}

// De año, mes y día a "2026-10-20". Vacío si no es una fecha posible.
function armarFecha(anio, mes, dia) {
  const [a, m, d] = [Number(anio), Number(mes), Number(dia)];
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Una fecha de Excel es un número: los días desde el 30/12/1899. Como texto puede venir como
// "20.10.2026" (así exporta SAP), "20/10/2026" o "2026-10-20". Devuelve "2026-10-20", o vacío.
function fechaDeCelda(valor) {
  if (typeof valor === 'number' && valor > 0) {
    // Cuenta en hora universal de punta a punta: así no cambia de día por la zona horaria.
    const fecha = new Date(Date.UTC(1899, 11, 30) + Math.floor(valor) * MS_POR_DIA);
    return armarFecha(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, fecha.getUTCDate());
  }
  const texto = textoDeCelda(valor);
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return armarFecha(iso[1], iso[2], iso[3]);
  const local = texto.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/);
  if (local) return armarFecha(local[3].length === 2 ? `20${local[3]}` : local[3], local[2], local[1]);
  return '';
}

// Las órdenes de un producto se descuentan de la más vieja a la más nueva. Sin fecha, van al
// final; con la misma fecha, primero la de número más bajo.
export function porAntiguedad(a, b) {
  if (a.fecha !== b.fecha) {
    if (!a.fecha || !b.fecha) return a.fecha ? -1 : 1;
    return a.fecha < b.fecha ? -1 : 1;
  }
  return a.numero.localeCompare(b.numero, 'es', { numeric: true });
}

// Pasa las filas a órdenes con las columnas elegidas ({ clave: número de columna }).
// Solo quedan las órdenes con algo pendiente. Devuelve las órdenes y cuántas filas quedaron
// afuera y por qué.
export function armarOrdenes(filas, columnas) {
  const valor = (fila, clave) => (columnas[clave] === undefined ? '' : fila[columnas[clave]]);
  const numeroONulo = (numero) => (Number.isFinite(numero) ? numero : null);
  const resultado = { ordenes: [], completas: 0, incompletas: 0, repetidas: [] };
  const vistas = new Set();

  for (const fila of filas) {
    const numero = textoDeCelda(valor(fila, 'numero'));
    const codigoInterno = textoDeCelda(valor(fila, 'codigoInterno')).toUpperCase();
    const cantidad = numeroDeCelda(valor(fila, 'cantidad'));
    const entregada = numeroDeCelda(valor(fila, 'entregada'));
    const pendiente = columnas.pendiente === undefined ? cantidad - entregada : numeroDeCelda(valor(fila, 'pendiente'));

    if (!numero || !codigoInterno || !Number.isFinite(pendiente)) resultado.incompletas += 1;
    else if (pendiente <= 0) resultado.completas += 1;
    else if (vistas.has(numero)) resultado.repetidas.push(numero);
    else {
      vistas.add(numero);
      resultado.ordenes.push({
        numero,
        codigoInterno,
        descripcion: textoDeCelda(valor(fila, 'descripcion')),
        cantidad: numeroONulo(cantidad),
        entregada: numeroONulo(entregada),
        pendiente,
        fecha: fechaDeCelda(valor(fila, 'fecha')),
      });
    }
  }
  resultado.ordenes.sort(porAntiguedad);
  return resultado;
}
