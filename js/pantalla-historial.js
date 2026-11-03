// Pantalla "Historial": los pallets cerrados de un día, su detalle y la exportación a Excel.
import { borrarPallet, escucharPallets } from './datos.js';
import { esSupervisor } from './sesion.js';
import {
  avisar,
  avisarErrorDeDatos,
  cajas,
  confirmar,
  crear,
  fechaDeHoy,
  fechaParaMostrar,
  tablaDeItems,
  unidades,
} from './ui.js';

let pallets = [];
let dejarDeEscuchar = null;

// La lista se vuelve a pintar con cada cambio en la base. Guardamos qué detalles están
// abiertos para que no se cierren solos mientras alguien los mira.
const detallesAbiertos = new Set();

const campoFecha = document.getElementById('fecha-historial');
const resumen = document.getElementById('resumen-dia');
const totales = document.getElementById('totales-dia');
const tablaTotales = document.getElementById('tabla-totales');
const lista = document.getElementById('lista-pallets');
const botonExportar = document.getElementById('btn-exportar');

// Deja de seguir la fecha anterior y empieza a seguir la que está en el campo.
function escucharFechaElegida() {
  dejarDeEscuchar?.();
  dejarDeEscuchar = null;
  pallets = [];
  pintar();
  if (!campoFecha.value) return;
  dejarDeEscuchar = escucharPallets(campoFecha.value, (listaNueva) => {
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

// Arma la tarjeta de un pallet. Tocar la cabecera muestra u oculta su detalle.
// repetido: otro pallet del mismo día tiene este número. Pasa si dos celulares cierran casi al
// mismo tiempo, o sin señal. Solo el supervisor ve el botón para borrar.
function tarjetaPallet(pallet, repetido) {
  const hora = new Date(pallet.cerradoEn)
    .toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  const tarjeta = crear('details', { class: 'pallet' },
    crear('summary', { class: 'pallet-cabecera' },
      crear('h2', {}, `Pallet ${pallet.numero}`),
      crear('span', { class: 'pallet-total' }, cajas(pallet.totalCajas)),
      crear('span', { class: 'dato-suave' }, `${pallet.responsable}, a las ${hora}`),
      crear('span', { class: 'pallet-total' }, unidades(pallet.totalUnidades)),
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
    const total = porCodigo.get(item.codigoInterno)
      ?? { codigoInterno: item.codigoInterno, descripcion: item.descripcion, cajas: 0, unidades: 0 };
    total.cajas += item.cajas;
    total.unidades += item.unidades;
    porCodigo.set(item.codigoInterno, total);
  }
  return [...porCodigo.values()].sort((a, b) => a.codigoInterno.localeCompare(b.codigoInterno));
}

// Dibuja el resumen del día, el total por producto y las tarjetas.
function pintar() {
  const totalCajas = pallets.reduce((suma, pallet) => suma + pallet.totalCajas, 0);
  const totalUnidades = pallets.reduce((suma, pallet) => suma + pallet.totalUnidades, 0);
  resumen.textContent = pallets.length === 0
    ? 'No hay pallets cerrados ese día.'
    : `${pallets.length} ${pallets.length === 1 ? 'pallet' : 'pallets'}: ${cajas(totalCajas)} y ${unidades(totalUnidades)}.`;
  botonExportar.disabled = pallets.length === 0;
  totales.hidden = pallets.length === 0;
  tablaTotales.replaceChildren(tablaDeItems(totalesPorProducto()));
  const numeros = pallets.map((pallet) => pallet.numero);
  const repetidos = new Set(numeros.filter((numero, i) => numeros.indexOf(numero) !== i));
  // Se muestran primero los últimos que se cerraron.
  lista.replaceChildren(...[...pallets].reverse()
    .map((pallet) => tarjetaPallet(pallet, repetidos.has(pallet.numero))));
}

// Una fila por cada producto de cada pallet: es lo más cómodo para filtrar en Excel.
function armarFilas() {
  return pallets.flatMap((pallet) => pallet.items.map((item) => ({
    Fecha: fechaParaMostrar(pallet.fecha),
    Pallet: pallet.numero,
    Responsable: pallet.responsable,
    Código: item.codigoInterno,
    Descripción: item.descripcion,
    Cajas: item.cajas,
    Unidades: item.unidades,
    'Cajas por fila × filas': item.detalleFilas ?? '',
  })));
}

// Segunda hoja del Excel: el total del día de cada producto, como la tabla de la pantalla.
function hojaPorProducto() {
  const filas = totalesPorProducto().map((total) => ({
    Fecha: fechaParaMostrar(campoFecha.value),
    Código: total.codigoInterno,
    Descripción: total.descripcion,
    Cajas: total.cajas,
    Unidades: total.unidades,
  }));
  const hoja = XLSX.utils.json_to_sheet(filas);
  const anchoDescripcion = Math.max(40, ...filas.map((fila) => fila.Descripción.length));
  hoja['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: anchoDescripcion }, { wch: 8 }, { wch: 10 }];
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
    { wch: 12 }, { wch: 8 }, { wch: 22 }, { wch: 12 }, { wch: anchoDescripcion }, { wch: 8 }, { wch: 10 }, { wch: 22 },
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
}

// Se llama al entrar a esta pantalla: siempre arranca en el día de hoy.
export function alMostrarHistorial() {
  campoFecha.value = fechaDeHoy();
  escucharFechaElegida();
}
