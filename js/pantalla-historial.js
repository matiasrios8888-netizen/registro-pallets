// Pantalla "Panel" (por dentro, "historial"): los pallets cerrados de un día, que aparecen solos
// a medida que se cierran en cualquier celular. Su detalle, el total por producto y el Excel.
import { borrarPallet, escucharPallets } from './datos.js';
import { esSupervisor } from './sesion.js';
import {
  avisar,
  avisarErrorDeDatos,
  cajas,
  cajasDelItem,
  confirmar,
  crear,
  fechaDeHoy,
  fechaParaMostrar,
  tablaDeItems,
  unidades,
} from './ui.js';

// Cuánto tiempo queda marcado "Nuevo" un pallet que llegó con el Panel abierto.
const DURACION_NUEVO_MS = 10 * 60 * 1000;

let pallets = [];
let dejarDeEscuchar = null;

// La lista se vuelve a pintar con cada cambio en la base. Guardamos qué detalles están
// abiertos para que no se cierren solos mientras alguien los mira.
const detallesAbiertos = new Set();

// Para avisar cuando llega un pallet nuevo:
// - conocidos: los que ya se vieron, para no avisar dos veces.
// - propios: los que se cerraron en este dispositivo. Llegan primero como "pendientes" y ya
//   tuvieron su aviso al cerrarlos.
// - llegados: id y momento de los que llegaron con el Panel abierto, para marcarlos "Nuevo".
// - hayBase: ya llegó una lista de la base. Hasta entonces no se avisa nada: la copia guardada
//   en el dispositivo puede estar incompleta, y lo que falta no es nuevo.
const conocidos = new Set();
const propios = new Set();
const llegados = new Map();
let hayBase = false;

// Con la pestaña en segundo plano, el título cuenta los pallets que llegaron.
const TITULO = document.title;
let llegadosSinVer = 0;

const pantalla = document.getElementById('pantalla-historial');
const campoFecha = document.getElementById('fecha-historial');
const resumen = document.getElementById('resumen-dia');
const contadores = document.getElementById('contadores-dia');
const columnas = document.getElementById('columnas-pallets');
const totales = document.getElementById('totales-dia');
const tablaTotales = document.getElementById('tabla-totales');
const lista = document.getElementById('lista-pallets');
const botonExportar = document.getElementById('btn-exportar');

// Revisa qué pallets de la lista son nuevos y avisa de los que llegaron de otro dispositivo.
function anotarLlegados(listaNueva, desdeServidor) {
  const nuevos = [];
  for (const pallet of listaNueva) {
    if (pallet.pendiente) propios.add(pallet.id);
    if (conocidos.has(pallet.id)) continue;
    conocidos.add(pallet.id);
    if (hayBase && !propios.has(pallet.id) && !pantalla.hidden) nuevos.push(pallet);
  }
  if (desdeServidor) hayBase = true;
  if (nuevos.length === 0) return;

  const ahora = Date.now();
  nuevos.forEach((pallet) => llegados.set(pallet.id, ahora));
  // Para sacar la marca "Nuevo" cuando se cumple el tiempo.
  setTimeout(pintar, DURACION_NUEVO_MS + 100);
  const [primero] = nuevos;
  avisar(nuevos.length === 1
    ? `Pallet ${primero.numero} cargado en sistema: ${primero.responsable}, ${cajas(primero.totalCajas)}`
    : `${nuevos.length} pallets nuevos cargados en sistema`, 'ok');
  if (document.hidden) {
    llegadosSinVer += nuevos.length;
    document.title = `(${llegadosSinVer}) ${TITULO}`;
  }
}

// Deja de seguir la fecha anterior y empieza a seguir la que está en el campo.
function escucharFechaElegida() {
  dejarDeEscuchar?.();
  dejarDeEscuchar = null;
  pallets = [];
  conocidos.clear();
  llegados.clear();
  hayBase = false;
  pintar();
  if (!campoFecha.value) return;
  dejarDeEscuchar = escucharPallets(campoFecha.value, (listaNueva, desdeServidor) => {
    anotarLlegados(listaNueva, desdeServidor);
    pallets = [...listaNueva].sort((a, b) => a.numero - b.numero);
    pintar();
  }, avisarErrorDeDatos);
}

// Borra un pallet cerrado, después de preguntar.
async function eliminar(pallet) {
  const borrar = await confirmar({
    titulo: `¿Borrar el pallet ${pallet.numero}?`,
    detalle: `Tiene ${cajas(pallet.totalCajas)}. No se puede recuperar.`,
    si: 'Borrar pallet',
    peligro: true,
  });
  if (borrar) borrarPallet(pallet.id).catch(avisarErrorDeDatos);
}

// Llegó hace poco con el Panel abierto.
const esNuevo = (pallet) => llegados.has(pallet.id) && Date.now() - llegados.get(pallet.id) < DURACION_NUEVO_MS;

// Si el pallet ya está en la base, y si es nuevo.
function marcasDeEstado(pallet) {
  return [
    esNuevo(pallet) ? crear('span', { class: 'marca marca-nuevo' }, 'Nuevo') : '',
    pallet.pendiente
      ? crear('span', { class: 'marca marca-falta' }, 'Falta subir (sin señal)')
      : crear('span', { class: 'marca marca-subido' }, '✓ En el sistema'),
  ];
}

// Arma la tarjeta de un pallet. Tocar la cabecera muestra u oculta su detalle. En la PC la
// cabecera es una fila de tabla: por eso hora y responsable van separados.
// repetido: otro pallet del mismo día tiene este número. Pasa si dos celulares cierran casi al
// mismo tiempo, o sin señal. Solo el supervisor ve el botón para borrar.
function tarjetaPallet(pallet, repetido) {
  const hora = new Date(pallet.cerradoEn)
    .toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const codigos = [...new Set(pallet.items.map((item) => item.codigoInterno))].join(', ');
  // En la PC la columna ya dice "Cajas" y "Unidades": ahí la palabra se esconde y queda el número.
  const cifra = (texto) => {
    const [numero, ...palabra] = texto.split(' ');
    return [numero, crear('span', { class: 'palabra-cifra' }, ` ${palabra.join(' ')}`)];
  };

  const tarjeta = crear('details', { class: esNuevo(pallet) ? 'pallet pallet-nuevo' : 'pallet' },
    crear('summary', { class: 'pallet-cabecera' },
      crear('h2', {}, `Pallet ${pallet.numero}`),
      crear('span', { class: 'pallet-total pallet-cajas' }, ...cifra(cajas(pallet.totalCajas))),
      crear('span', { class: 'pallet-quien dato-suave' },
        crear('span', { class: 'pallet-responsable' }, pallet.responsable),
        crear('span', { class: 'pallet-hora' }, hora)),
      crear('span', { class: 'pallet-total pallet-unidades' }, ...cifra(unidades(pallet.totalUnidades))),
      crear('span', { class: 'pallet-productos dato-suave' }, codigos),
      crear('span', { class: 'pallet-estado' }, ...marcasDeEstado(pallet)),
      repetido ? crear('span', { class: 'pallet-repetido' }, `Hay otro pallet ${pallet.numero} este día.`) : '',
      crear('span', { class: 'pallet-ver' })),
    crear('div', { class: 'pallet-detalle' },
      tablaDeItems(pallet.items),
      esSupervisor() ? crear('button', {
        type: 'button',
        class: 'boton boton-secundario',
        alHacerClic: () => eliminar(pallet),
      }, 'Borrar pallet') : ''));

  tarjeta.open = detallesAbiertos.has(pallet.id);
  tarjeta.addEventListener('toggle', () => {
    if (tarjeta.open) detallesAbiertos.add(pallet.id);
    else detallesAbiertos.delete(pallet.id);
  });
  return tarjeta;
}

// Suma los productos de todos los pallets del día, ordenados por código: es lo que se descuenta
// de las órdenes. Suma las unidades que guardó cada pallet, sin recalcularlas: si un producto
// se editó a mitad del día, cada pallet ya tiene bien su cuenta.
function totalesPorProducto() {
  const porCodigo = new Map();
  for (const item of pallets.flatMap((pallet) => pallet.items)) {
    const total = porCodigo.get(item.codigoInterno) ?? {
      codigoInterno: item.codigoInterno, descripcion: item.descripcion, cajas: 0, cajasCont: 0, cajasUV: 0, unidades: 0,
    };
    const { cont, uv } = cajasDelItem(item);
    total.cajas += item.cajas;
    total.cajasCont += cont;
    total.cajasUV += uv;
    total.unidades += item.unidades;
    porCodigo.set(item.codigoInterno, total);
  }
  return [...porCodigo.values()].sort((a, b) => a.codigoInterno.localeCompare(b.codigoInterno));
}

// Dibuja los números del día, el total por producto y las tarjetas.
function pintar() {
  const totalCajas = pallets.reduce((suma, pallet) => suma + pallet.totalCajas, 0);
  const totalUnidades = pallets.reduce((suma, pallet) => suma + pallet.totalUnidades, 0);
  const vacio = pallets.length === 0;
  // Con pallets, el resumen lo dicen los números grandes.
  resumen.textContent = vacio ? 'No hay pallets cerrados ese día.' : '';
  resumen.hidden = !vacio;
  contadores.hidden = vacio;
  document.getElementById('cuenta-pallets').textContent = pallets.length.toLocaleString('es-AR');
  document.getElementById('cuenta-cajas').textContent = totalCajas.toLocaleString('es-AR');
  document.getElementById('cuenta-unidades').textContent = totalUnidades.toLocaleString('es-AR');
  columnas.hidden = vacio;
  botonExportar.disabled = vacio;
  totales.hidden = vacio;
  tablaTotales.replaceChildren(tablaDeItems(totalesPorProducto()));
  const numeros = pallets.map((pallet) => pallet.numero);
  const repetidos = new Set(numeros.filter((numero, i) => numeros.indexOf(numero) !== i));
  // Se muestran primero los últimos que se cerraron.
  lista.replaceChildren(...[...pallets].reverse()
    .map((pallet) => tarjetaPallet(pallet, repetidos.has(pallet.numero))));
}

// Una fila por cada producto de cada pallet: es lo más cómodo para filtrar en Excel.
// "Cargadas a mano" dice cómo se contaron las cajas que no se escanearon una por una: "8 × 5"
// son 5 filas de 8, y "40" un total escrito de una vez.
function armarFilas() {
  return pallets.flatMap((pallet) => pallet.items.map((item) => {
    const { cont, uv } = cajasDelItem(item);
    return {
      Fecha: fechaParaMostrar(pallet.fecha),
      Pallet: pallet.numero,
      Responsable: pallet.responsable,
      Código: item.codigoInterno,
      Descripción: item.descripcion,
      'Caja Cont.': cont,
      'Caja U.V': uv,
      Unidades: item.unidades,
      'Cargadas a mano': item.detalleFilas ?? '',
    };
  }));
}

// Segunda hoja del Excel: el total del día de cada producto, como la tabla de la pantalla.
function hojaPorProducto() {
  const filas = totalesPorProducto().map((total) => ({
    Fecha: fechaParaMostrar(campoFecha.value),
    Código: total.codigoInterno,
    Descripción: total.descripcion,
    'Caja Cont.': total.cajasCont,
    'Caja U.V': total.cajasUV,
    Unidades: total.unidades,
  }));
  const hoja = XLSX.utils.json_to_sheet(filas);
  const anchoDescripcion = Math.max(40, ...filas.map((fila) => fila.Descripción.length));
  hoja['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: anchoDescripcion }, { wch: 10 }, { wch: 9 }, { wch: 10 }];
  return hoja;
}

// En la app de Android no existen las descargas del navegador. El Excel se guarda adentro de
// la app y se abre el menú Compartir, para mandarlo por WhatsApp, por mail o a Archivos.
async function compartirExcelEnAndroid(libro, nombre) {
  const { Filesystem, Share } = window.Capacitor.Plugins;
  const data = XLSX.write(libro, { type: 'base64', bookType: 'xlsx' });
  const { uri } = await Filesystem.writeFile({ path: nombre, data, directory: 'CACHE' });
  await Share.share({ title: nombre, url: uri });
}

// Genera un Excel con los pallets de la fecha elegida: en la PC o el navegador del celular lo
// baja, y en la app de Android abre el menú Compartir.
function exportarExcel() {
  if (typeof XLSX === 'undefined') {
    avisar('No se pudo cargar Excel. Recargá la página.', 'error');
    return;
  }
  const filas = armarFilas();
  const hoja = XLSX.utils.json_to_sheet(filas);
  // La columna se ajusta a la descripción más larga: la celda de al lado la cortaría.
  const anchoDescripcion = Math.max(40, ...filas.map((fila) => fila.Descripción.length));
  hoja['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 22 }, { wch: 12 }, { wch: anchoDescripcion }, { wch: 10 }, { wch: 9 }, { wch: 10 }, { wch: 22 },
  ];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Pallets');
  XLSX.utils.book_append_sheet(libro, hojaPorProducto(), 'Por producto');
  const nombre = `pallets-${campoFecha.value}.xlsx`;

  if (!window.Capacitor?.isNativePlatform()) {
    XLSX.writeFile(libro, nombre);
    return;
  }
  compartirExcelEnAndroid(libro, nombre).catch((error) => {
    // Cerrar el menú Compartir sin elegir nada también llega acá, y no es un error.
    if (String(error).includes('canceled')) return;
    console.error(error);
    avisar('No se pudo generar el Excel. Probá de nuevo.', 'error');
  });
}

// Conecta el campo de fecha y el botón de Excel. Se llama una sola vez, al arrancar la app.
export function iniciarPantallaHistorial() {
  campoFecha.addEventListener('change', escucharFechaElegida);
  botonExportar.addEventListener('click', exportarExcel);
  // Al volver a mirar la pestaña, el título vuelve a ser el de siempre.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    llegadosSinVer = 0;
    document.title = TITULO;
  });
}

// Se llama al entrar a esta pantalla: siempre arranca en el día de hoy.
export function alMostrarHistorial() {
  campoFecha.value = fechaDeHoy();
  escucharFechaElegida();
}
