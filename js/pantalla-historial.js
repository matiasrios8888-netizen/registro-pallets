// Pantalla "Historial": los pallets cerrados de un día, su detalle y la exportación a Excel.
import { borrarPallet, escucharPallets } from './datos.js';
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
function tarjetaPallet(pallet) {
  const hora = new Date(pallet.cerradoEn)
    .toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  const tarjeta = crear('details', { class: 'pallet' },
    crear('summary', { class: 'pallet-cabecera' },
      crear('h2', {}, `Pallet ${pallet.numero}`),
      crear('span', { class: 'pallet-total' }, cajas(pallet.totalCajas)),
      crear('span', { class: 'dato-suave' }, `${pallet.responsable}, a las ${hora}`),
      crear('span', { class: 'pallet-total' }, unidades(pallet.totalUnidades)),
      crear('span', { class: 'pallet-ver' })),
    crear('div', { class: 'pallet-detalle' },
      tablaDeItems(pallet.items),
      crear('button', {
        type: 'button',
        class: 'boton boton-secundario',
        alHacerClic: () => eliminar(pallet),
      }, 'Borrar pallet')));

  tarjeta.open = detallesAbiertos.has(pallet.id);
  tarjeta.addEventListener('toggle', () => {
    if (tarjeta.open) detallesAbiertos.add(pallet.id);
    else detallesAbiertos.delete(pallet.id);
  });
  return tarjeta;
}

// Dibuja el resumen del día y las tarjetas.
function pintar() {
  const totalCajas = pallets.reduce((suma, pallet) => suma + pallet.totalCajas, 0);
  const totalUnidades = pallets.reduce((suma, pallet) => suma + pallet.totalUnidades, 0);
  resumen.textContent = pallets.length === 0
    ? 'No hay pallets cerrados ese día.'
    : `${pallets.length} ${pallets.length === 1 ? 'pallet' : 'pallets'}: ${cajas(totalCajas)} y ${unidades(totalUnidades)}.`;
  botonExportar.disabled = pallets.length === 0;
  // Se muestran primero los últimos que se cerraron.
  lista.replaceChildren(...[...pallets].reverse().map(tarjetaPallet));
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
  })));
}

// Baja un Excel con los pallets de la fecha elegida.
function exportarExcel() {
  if (typeof XLSX === 'undefined') {
    avisar('No se pudo cargar Excel. Revisá la conexión y recargá la página.', 'error');
    return;
  }
  const hoja = XLSX.utils.json_to_sheet(armarFilas());
  hoja['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 22 }, { wch: 12 }, { wch: 40 }, { wch: 8 }, { wch: 10 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Pallets');
  XLSX.writeFile(libro, `pallets-${campoFecha.value}.xlsx`);
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
