// Pantalla "Órdenes": las órdenes de producción abiertas de la última COOIS y su importación.
// Solo el supervisor importa. Cada COOIS nueva reemplaza a la anterior.
import { CAMPOS_COOIS, adivinarColumnas, armarOrdenes, leerArchivoCoois, porAntiguedad, queFaltaElegir } from './coois.js';
import { claveLocal, escucharCoois, modoPrueba, reemplazarOrdenes } from './datos.js';
import { columnasCooisDePrueba, cooisDePrueba } from './datos-prueba.js';
import { buscarProducto } from './productos.js';
import { esSupervisor, usuario } from './sesion.js';
import { avisar, avisarErrorDeDatos, crear, fechaParaMostrar, senalError, unidades } from './ui.js';

// Las columnas elegidas en la última importación, por nombre: la COOIS de cada día trae las mismas.
const CLAVE_COLUMNAS = claveLocal('columnas-coois');
const LARGO_MAXIMO_DE_EJEMPLO = 24;
const ORDENES_DE_MUESTRA = 3;

let ordenes = [];
let importacion = null;

// El archivo elegido, mientras la ventana de columnas está abierta: { nombre, encabezados, filas, ejemplos }.
let lectura = null;
// Lo que se importaría con las columnas elegidas, o null si falta elegir alguna.
let resultado = null;

const resumenCoois = document.getElementById('resumen-coois');
const lista = document.getElementById('lista-ordenes');
const buscador = document.getElementById('buscar-orden');
const campoArchivo = document.getElementById('archivo-coois');
const dialogo = document.getElementById('dialogo-coois');
const zonaColumnas = document.getElementById('coois-columnas');
const zonaResultado = document.getElementById('coois-resultado');
const botonConfirmar = document.getElementById('btn-confirmar-coois');

const formatearNumero = (numero) => numero.toLocaleString('es-AR');
const ordenesEnPalabras = (cantidad) => `${formatearNumero(cantidad)} ${cantidad === 1 ? 'orden' : 'órdenes'}`;

// El código no está en Productos: esas cajas no se pueden escanear hasta que se agregue.
const faltaEnProductos = (codigoInterno) => !buscarProducto(codigoInterno);

// Una línea con la última importación: de cuándo es, el archivo y quién la hizo.
function textoDeImportacion() {
  if (!importacion) {
    return esSupervisor() ? 'Todavía no se importó ninguna COOIS.' : 'Todavía no se importó ninguna COOIS. La importa el supervisor.';
  }
  const cuando = new Date(importacion.importadaEn);
  const dia = cuando.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = cuando.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const quien = importacion.importadaPor ? ` La importó ${importacion.importadaPor}.` : '';
  return `COOIS del ${dia} a las ${hora}, archivo ${importacion.archivo}: ${ordenesEnPalabras(ordenes.length)} abiertas.${quien}`;
}

// Tabla de órdenes: número, fecha y cuánto le falta. conCodigo agrega la columna del producto.
function tablaDeOrdenes(filas, conCodigo = false) {
  return crear('table', { class: 'tabla-ordenes' },
    crear('thead', {},
      crear('tr', {},
        crear('th', { scope: 'col' }, 'Orden'),
        conCodigo ? crear('th', { scope: 'col' }, 'Código') : '',
        crear('th', { scope: 'col' }, 'Fecha'),
        crear('th', { scope: 'col', class: 'numero' }, 'Pendiente'))),
    crear('tbody', {}, ...filas.map((orden) => crear('tr', {},
      crear('td', { class: 'codigo' }, orden.numero),
      conCodigo ? crear('td', {}, orden.codigoInterno) : '',
      crear('td', {}, orden.fecha ? fechaParaMostrar(orden.fecha) : 'Sin fecha'),
      crear('td', { class: 'numero' },
        formatearNumero(orden.pendiente),
        orden.cantidad ? crear('span', { class: 'dato-suave de-cantidad' }, `de ${formatearNumero(orden.cantidad)}`) : '')))));
}

// La tarjeta de un producto con todas sus órdenes, de la más vieja a la más nueva.
function tarjetaDeProducto(codigoInterno, delProducto) {
  const total = delProducto.reduce((suma, orden) => suma + orden.pendiente, 0);
  const descripcion = buscarProducto(codigoInterno)?.descripcion || delProducto[0].descripcion;
  return crear('section', { class: 'orden-producto' },
    crear('h2', { class: 'codigo' }, codigoInterno),
    descripcion ? crear('p', {}, descripcion) : '',
    crear('p', { class: 'dato-envase' }, `${unidades(total)} pendientes en ${ordenesEnPalabras(delProducto.length)}`),
    faltaEnProductos(codigoInterno)
      ? crear('p', { class: 'falta-producto' }, 'No está en Productos: sus cajas no se pueden escanear hasta agregarlo.')
      : '',
    tablaDeOrdenes(delProducto));
}

// Dibuja la última importación y las órdenes agrupadas por producto, aplicando Buscar.
function pintarLista() {
  resumenCoois.textContent = textoDeImportacion();
  const texto = buscador.value.trim().toUpperCase();
  // Con la pistola se puede escanear una caja: su código de barras busca las órdenes del producto.
  const filtro = (texto && buscarProducto(texto)?.codigoInterno) || texto;
  const visibles = ordenes.filter((orden) => (
    `${orden.numero} ${orden.codigoInterno} ${orden.descripcion}`.toUpperCase().includes(filtro)));

  const porProducto = new Map();
  for (const orden of [...visibles].sort(porAntiguedad)) {
    porProducto.set(orden.codigoInterno, [...(porProducto.get(orden.codigoInterno) ?? []), orden]);
  }
  const codigos = [...porProducto.keys()].sort((a, b) => a.localeCompare(b));
  lista.replaceChildren(...codigos.map((codigo) => tarjetaDeProducto(codigo, porProducto.get(codigo))));
  if (ordenes.length > 0 && visibles.length === 0) {
    lista.append(crear('p', { class: 'vacio' }, 'Ninguna orden coincide con esa búsqueda.'));
  }
  if (visibles.length > 0) {
    lista.prepend(crear('p', { class: 'ayuda-coois' },
      'Las órdenes de cada producto van de la más vieja a la más nueva: en ese orden se van a descontar.'));
  }
}

// Recuerda las columnas elegidas por su nombre, para la próxima COOIS.
function guardarColumnasElegidas(columnas) {
  const porNombre = Object.fromEntries(Object.entries(columnas).map(([clave, i]) => [clave, lectura.encabezados[i]]));
  localStorage.setItem(CLAVE_COLUMNAS, JSON.stringify(porNombre));
}

const columnasAnteriores = () => JSON.parse(localStorage.getItem(CLAVE_COLUMNAS) ?? '{}');

// Lee qué columna quedó elegida en cada lista: { clave: número de columna }.
function columnasElegidas() {
  const columnas = {};
  for (const { clave } of CAMPOS_COOIS) {
    const valor = document.getElementById(`columna-${clave}`).value;
    if (valor !== '') columnas[clave] = Number(valor);
  }
  return columnas;
}

// "Cantidad orden (6.000)": el nombre de la columna con el valor de la primera orden.
function nombreConEjemplo(encabezado, i) {
  const ejemplo = String(lectura.ejemplos[i] ?? '').trim();
  if (!ejemplo) return encabezado;
  const corto = ejemplo.length > LARGO_MAXIMO_DE_EJEMPLO ? `${ejemplo.slice(0, LARGO_MAXIMO_DE_EJEMPLO)}…` : ejemplo;
  return `${encabezado} (${corto})`;
}

// Una lista desplegable por cada dato, con las columnas del archivo.
function pintarColumnas() {
  const elegidas = adivinarColumnas(lectura.encabezados, columnasAnteriores());
  zonaColumnas.replaceChildren(...CAMPOS_COOIS.map(({ clave, nombre, obligatorio }) => {
    const desplegable = crear('select', { id: `columna-${clave}` },
      crear('option', { value: '' }, obligatorio ? 'Elegí una columna' : 'No está en el archivo'),
      ...lectura.encabezados.map((encabezado, i) => crear('option', { value: String(i) }, nombreConEjemplo(encabezado, i))));
    desplegable.value = clave in elegidas ? String(elegidas[clave]) : '';
    return crear('label', { class: 'campo', for: `columna-${clave}` }, nombre, desplegable);
  }));
}

// Muestra qué se va a importar con las columnas elegidas, y qué queda afuera.
function pintarResultado() {
  const columnas = columnasElegidas();
  const falta = queFaltaElegir(columnas);
  resultado = falta ? null : armarOrdenes(lectura.filas, columnas);
  botonConfirmar.disabled = !resultado?.ordenes.length;
  botonConfirmar.textContent = resultado?.ordenes.length ? `Importar ${ordenesEnPalabras(resultado.ordenes.length)}` : 'Importar';
  if (falta) {
    zonaResultado.replaceChildren(crear('p', { class: 'mensaje-error' }, falta));
    return;
  }

  const { ordenes: nuevas, completas, incompletas, repetidas } = resultado;
  const sinProducto = [...new Set(nuevas.map((orden) => orden.codigoInterno))].filter(faltaEnProductos);
  const sinFecha = nuevas.filter((orden) => !orden.fecha).length;
  const notas = [
    completas ? `${ordenesEnPalabras(completas)} ya ${completas === 1 ? 'completa' : 'completas'}, sin nada pendiente: no se importan.` : '',
    incompletas ? `${formatearNumero(incompletas)} ${incompletas === 1 ? 'fila' : 'filas'} sin número de orden, código o cantidad: no se importan.` : '',
    repetidas.length ? `Órdenes repetidas, se usa la primera: ${repetidas.join(', ')}.` : '',
    columnas.fecha === undefined ? 'Sin la fecha, en cada producto se descuenta primero la orden de número más bajo.' : '',
    columnas.fecha !== undefined && sinFecha ? `${ordenesEnPalabras(sinFecha)} sin fecha: van después de las que la tienen.` : '',
    sinProducto.length ? `No están en Productos: ${sinProducto.join(', ')}. Esas órdenes se importan igual, pero sus cajas no se pueden escanear hasta agregarlas.` : '',
    ordenes.length ? `Reemplaza las ${ordenesEnPalabras(ordenes.length)} de la COOIS anterior.` : '',
  ].filter(Boolean);

  zonaResultado.replaceChildren(
    crear('p', { class: 'resumen' }, nuevas.length ? `${ordenesEnPalabras(nuevas.length)} con algo pendiente.` : 'Ninguna orden tiene algo pendiente.'),
    ...notas.map((nota) => crear('p', { class: 'nota-coois' }, nota)),
    nuevas.length ? crear('p', { class: 'dato-suave' }, 'Así quedan las primeras:') : '',
    nuevas.length ? tablaDeOrdenes(nuevas.slice(0, ORDENES_DE_MUESTRA), true) : '');
}

// Lee el archivo elegido y abre la ventana para elegir las columnas.
async function alElegirArchivo() {
  const archivo = campoArchivo.files[0];
  // Así se puede volver a elegir el mismo archivo, por ejemplo después de cancelar.
  campoArchivo.value = '';
  if (!archivo) return;
  if (typeof XLSX === 'undefined') {
    avisar('No se pudo cargar Excel. Recargá la página.', 'error');
    return;
  }
  try {
    lectura = { nombre: archivo.name, ...(await leerArchivoCoois(archivo)) };
  } catch (error) {
    console.error(error);
    avisar('No se pudo leer el archivo. Tiene que ser un Excel (.xlsx o .xls) o un .csv, con los nombres de las columnas arriba.', 'error');
    return;
  }
  document.getElementById('coois-archivo').textContent =
    `${lectura.nombre}: ${formatearNumero(lectura.filas.length)} ${lectura.filas.length === 1 ? 'fila' : 'filas'}.`;
  pintarColumnas();
  pintarResultado();
  dialogo.showModal();
}

// Reemplaza las órdenes por las del archivo. Sin await: sin señal no terminaría nunca.
function importar(evento) {
  evento.preventDefault();
  if (!resultado?.ordenes.length) return;
  guardarColumnasElegidas(columnasElegidas());
  const nuevas = resultado.ordenes;
  reemplazarOrdenes(ordenes.map((orden) => orden.id), nuevas, {
    archivo: lectura.nombre,
    importadaEn: new Date().toISOString(),
    importadaPor: usuario.nombre,
    cantidad: nuevas.length,
  }).catch(avisarErrorDeDatos);
  dialogo.close();
  avisar(`Se importaron ${ordenesEnPalabras(nuevas.length)}`);
}

// Arma la COOIS inventada como un Excel, para probar la importación en modo prueba.
function bajarCooisDePrueba() {
  if (typeof XLSX === 'undefined') {
    avisar('No se pudo cargar Excel. Recargá la página.', 'error');
    return;
  }
  const columnaFecha = columnasCooisDePrueba.indexOf('Fecha inicio');
  // En Excel una fecha es la cantidad de días desde el 30/12/1899, con formato de fecha.
  const diasDesde1899 = (fecha) => (Date.parse(`${fecha}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / (24 * 60 * 60 * 1000);
  const filas = cooisDePrueba.map((fila) => fila.map((valor, i) => (i === columnaFecha ? diasDesde1899(valor) : valor)));
  const hoja = XLSX.utils.aoa_to_sheet([columnasCooisDePrueba, ...filas]);
  filas.forEach((_, i) => {
    hoja[XLSX.utils.encode_cell({ r: i + 1, c: columnaFecha })].z = 'dd/mm/yyyy';
  });
  hoja['!cols'] = columnasCooisDePrueba.map((nombre) => ({ wch: Math.max(10, nombre.length + 2) }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'COOIS');
  XLSX.writeFile(libro, 'coois-prueba.xlsx');
}

// Si alguien escanea con la ventana abierta, el Enter de la pistola no tiene que importar.
function noImportarConEnter(evento) {
  if (evento.key !== 'Enter') return;
  evento.preventDefault();
  senalError();
}

// Empieza a seguir las órdenes y conecta los botones. Se llama una sola vez, al arrancar la app.
export function iniciarPantallaOrdenes() {
  document.getElementById('btn-importar-coois').hidden = !esSupervisor();
  // La COOIS de prueba se baja como archivo: en la app de Android no hay descargas.
  document.getElementById('btn-bajar-coois-prueba').hidden = !modoPrueba || Boolean(window.Capacitor?.isNativePlatform());

  escucharCoois((datos) => {
    ordenes = datos.ordenes;
    importacion = datos.importacion;
    pintarLista();
  }, avisarErrorDeDatos);

  buscador.addEventListener('input', pintarLista);
  // Con la pistola: el texto queda seleccionado y la lectura siguiente lo reemplaza.
  buscador.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') buscador.select();
  });
  document.getElementById('btn-importar-coois').addEventListener('click', () => campoArchivo.click());
  campoArchivo.addEventListener('change', alElegirArchivo);
  document.getElementById('btn-bajar-coois-prueba').addEventListener('click', bajarCooisDePrueba);
  zonaColumnas.addEventListener('change', pintarResultado);
  document.getElementById('form-coois').addEventListener('submit', importar);
  document.getElementById('btn-cancelar-coois').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('keydown', noImportarConEnter);
  dialogo.addEventListener('close', () => {
    lectura = null;
    resultado = null;
  });
}

// Se llama al entrar a esta pantalla: los productos pueden haber cambiado desde la última vez.
export function alMostrarOrdenes() {
  pintarLista();
}
