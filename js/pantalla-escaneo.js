// Pantalla "Escanear": primero se abre el pallet y después se escanea caja por caja.
import { escucharPallets, guardarPallet } from './datos.js';
import {
  apagarCamara,
  detectarLecturaPerdida,
  encenderCamara,
  escucharPistola,
  mantenerFoco,
  olvidarCajasVistas,
} from './lector.js';
import {
  agregarProductoConCodigo,
  buscarProducto,
  normalizarCodigo,
  productosCargados,
} from './productos.js';
import {
  avisar,
  avisarErrorDeDatos,
  cajas,
  confirmar,
  crear,
  fechaDeHoy,
  fechaParaMostrar,
  motivoDelError,
  senalError,
  senalOk,
  tablaDeItems,
  unidades,
} from './ui.js';

const CLAVE_PALLET_ABIERTO = 'registro-pallets.pallet-abierto';
const CLAVE_RESPONSABLE = 'registro-pallets.responsable';
const DURACION_VERDE_MS = 1200;

// El pallet que se está armando: { numero, fecha, responsable, lecturas }. Cada lectura es
// una caja. Se guarda en el dispositivo a cada lectura: si se recarga la página o se apaga
// el celular, el pallet sigue ahí. Sin pallet abierto vale null.
let pallet = JSON.parse(localStorage.getItem(CLAVE_PALLET_ABIERTO) ?? 'null');

let visible = true;
let camaraEncendida = false;
let codigoDesconocido = null;
let temporizadorVerde;
let anchoDeLaCamara = 0;

// Pallets ya cerrados en la fecha elegida: para saber qué número le toca al siguiente.
let palletsDeLaFecha = [];
let fechaEscuchada = null;
let dejarDeEscuchar = null;
let numeroEscritoAMano = false;

const vistaApertura = document.getElementById('vista-apertura');
const vistaEscaneo = document.getElementById('vista-escaneo');

const formularioApertura = document.getElementById('form-apertura');
const campoNumero = document.getElementById('apertura-numero');
const campoFecha = document.getElementById('apertura-fecha');
const campoResponsable = document.getElementById('apertura-responsable');
const camposDeApertura = [campoNumero, campoFecha, campoResponsable];
const mensajeApertura = document.getElementById('mensaje-apertura');

const tablero = document.getElementById('tablero');
const tituloTablero = document.getElementById('tablero-titulo');
const datosTablero = document.getElementById('tablero-datos');
const contador = document.getElementById('contador');
const contadorApagado = document.getElementById('contador-apagado');
const totalDeUnidades = document.getElementById('total-unidades');
const lecturaTitulo = document.getElementById('lectura-titulo');
const lecturaDetalle = document.getElementById('lectura-detalle');
const botonAgregarCodigo = document.getElementById('btn-agregar-codigo');
const formularioLector = document.getElementById('form-lector');
const campoLector = document.getElementById('campo-lector');
const botonDeshacer = document.getElementById('btn-deshacer');
const botonCamara = document.getElementById('btn-camara');
const marcoCamara = document.getElementById('marco-camara');
const listaItems = document.getElementById('lista-items');
const botonCerrar = document.getElementById('btn-cerrar');

const enfocarLector = mantenerFoco(campoLector, () => (
  visible && pallet !== null && !document.querySelector('dialog[open]')));

function guardarPalletAbierto() {
  if (pallet) localStorage.setItem(CLAVE_PALLET_ABIERTO, JSON.stringify(pallet));
  else localStorage.removeItem(CLAVE_PALLET_ABIERTO);
}

function agruparPorProducto(lecturas) {
  const grupos = new Map();
  for (const lectura of lecturas) {
    const grupo = grupos.get(lectura.codigoInterno) ?? { ...lectura, cajas: 0, unidades: 0 };
    grupo.cajas += 1;
    grupo.unidades += lectura.unidadesPorCaja;
    grupos.set(lectura.codigoInterno, grupo);
  }
  return [...grupos.values()];
}

const sumarUnidades = (items) => items.reduce((suma, item) => suma + item.unidades, 0);

const numeroLibre = () => Math.max(0, ...palletsDeLaFecha.map((p) => p.numero)) + 1;

const numeroOcupado = (numero) => palletsDeLaFecha.some((p) => p.numero === numero);

function completarNumeroAutomatico() {
  if (!pallet && !numeroEscritoAMano) campoNumero.value = numeroLibre();
}

function escucharPalletsDe(fecha) {
  if (fecha === fechaEscuchada) return;
  fechaEscuchada = fecha;
  palletsDeLaFecha = [];
  dejarDeEscuchar?.();
  dejarDeEscuchar = escucharPallets(fecha, (lista) => {
    palletsDeLaFecha = lista;
    completarNumeroAutomatico();
  }, avisarErrorDeDatos);
}

// Deja el formulario listo con fecha de hoy, número automático y el último responsable.
function prepararApertura() {
  numeroEscritoAMano = false;
  campoFecha.value = fechaDeHoy();
  campoResponsable.value = localStorage.getItem(CLAVE_RESPONSABLE) ?? '';
  mensajeApertura.hidden = true;
  escucharPalletsDe(campoFecha.value);
  completarNumeroAutomatico();
}

function mostrarErrorDeApertura(mensaje) {
  mensajeApertura.textContent = mensaje;
  mensajeApertura.hidden = false;
}

function abrirPallet(evento) {
  evento.preventDefault();
  const numero = Number(campoNumero.value);
  const responsable = campoResponsable.value.trim();

  if (numeroOcupado(numero)) {
    mostrarErrorDeApertura(`Ya hay un pallet ${numero} con esa fecha.`);
    return;
  }
  if (!responsable) {
    mostrarErrorDeApertura('Falta el responsable.');
    return;
  }
  // Pasa si alguien escanea una caja con el cursor en este campo.
  if (buscarProducto(responsable)) {
    mostrarErrorDeApertura('En Responsable quedó un código de caja. Escribí el nombre.');
    return;
  }

  localStorage.setItem(CLAVE_RESPONSABLE, responsable);
  pallet = { numero, fecha: campoFecha.value, responsable, lecturas: [] };
  guardarPalletAbierto();
  mensajeApertura.hidden = true;
  pintarPantalla();
  mostrarEnTablero('espera', 'Escaneá la primera caja');
  enfocarLector();
}

// La pistola termina cada lectura con Enter. Si se escanea antes de abrir el pallet, ese
// Enter no debe abrirlo con una caja sin contar: acá solo se abre tocando el botón.
function noAbrirConEnter(evento) {
  if (evento.key !== 'Enter') return;
  evento.preventDefault();
  if (evento.target.matches('input')) {
    camposDeApertura[camposDeApertura.indexOf(evento.target) + 1]?.focus();
  }
}

function filaItem(item) {
  return crear('li', { class: 'item' },
    crear('div', { class: 'fila-datos' },
      crear('strong', { class: 'codigo' }, item.codigoInterno),
      crear('span', {}, item.descripcion)),
    crear('button', {
      type: 'button',
      class: 'boton boton-secundario item-quitar',
      'aria-label': `Quitar una caja de ${item.codigoInterno}`,
      alHacerClic: () => quitarUnaCaja(item.codigoInterno),
    }, '−1'),
    crear('p', { class: 'item-cantidades' },
      crear('span', {}, cajas(item.cajas)),
      crear('span', {}, unidades(item.unidades))));
}

function pintarPantalla() {
  vistaApertura.hidden = pallet !== null;
  vistaEscaneo.hidden = pallet === null;
  if (!pallet) return;

  const items = agruparPorProducto(pallet.lecturas);
  const totalCajas = pallet.lecturas.length;
  tituloTablero.textContent = `Pallet ${pallet.numero}`;
  datosTablero.textContent = `${fechaParaMostrar(pallet.fecha)}, ${pallet.responsable}`;
  contador.textContent = totalCajas;
  contadorApagado.textContent = '8'.repeat(Math.max(3, String(totalCajas).length));
  totalDeUnidades.textContent = unidades(sumarUnidades(items));
  listaItems.replaceChildren(...items.map(filaItem));
  botonCerrar.disabled = totalCajas === 0;
  botonDeshacer.disabled = totalCajas === 0;
}

// Pinta el tablero: "ok" verde, "error" rojo, "espera" oscuro.
function mostrarEnTablero(estado, titulo, detalle = '') {
  clearTimeout(temporizadorVerde);
  codigoDesconocido = null;
  botonAgregarCodigo.hidden = true;
  lecturaTitulo.textContent = titulo;
  lecturaDetalle.textContent = detalle;

  // Pasar por "espera" y pedir una medida obliga al navegador a repetir el destello
  // aunque sean dos cajas iguales seguidas.
  tablero.dataset.estado = 'espera';
  void tablero.offsetWidth;
  tablero.dataset.estado = estado;

  if (estado === 'ok') {
    temporizadorVerde = setTimeout(() => {
      tablero.dataset.estado = 'espera';
    }, DURACION_VERDE_MS);
  }
}

function rechazarLectura(titulo, detalle) {
  mostrarEnTablero('error', titulo, detalle);
  senalError();
}

function procesarCodigo(textoLeido) {
  const codigo = normalizarCodigo(textoLeido);
  if (!codigo || !pallet) return;

  if (!productosCargados()) {
    rechazarLectura('No se sumó', 'Los productos todavía están cargando. Escaneá de nuevo.');
    return;
  }

  const producto = buscarProducto(codigo);
  if (!producto) {
    rechazarLectura('No se sumó: código desconocido', codigo);
    codigoDesconocido = codigo;
    botonAgregarCodigo.hidden = false;
    return;
  }

  // Guardamos una copia de los datos: si después se edita el producto, el pallet no cambia.
  const { codigoInterno, codigoBarras, descripcion, unidadesPorCaja } = producto;
  pallet.lecturas.push({ codigoInterno, codigoBarras, descripcion, unidadesPorCaja });
  guardarPalletAbierto();
  pintarPantalla();
  mostrarEnTablero('ok', `${codigoInterno} sumada`, descripcion);
  senalOk();
}

function deshacerUltimoEscaneo() {
  const lectura = pallet.lecturas.pop();
  if (!lectura) return;
  guardarPalletAbierto();
  pintarPantalla();
  mostrarEnTablero('espera', `Se deshizo una caja de ${lectura.codigoInterno}`, lectura.descripcion);
}

function quitarUnaCaja(codigoInterno) {
  pallet.lecturas.splice(pallet.lecturas.findLastIndex((l) => l.codigoInterno === codigoInterno), 1);
  guardarPalletAbierto();
  pintarPantalla();
  mostrarEnTablero('espera', `Se quitó una caja de ${codigoInterno}`);
}

// Después de cerrar o descartar, la pantalla vuelve a "Abrir pallet".
function terminarPallet() {
  pallet = null;
  guardarPalletAbierto();
  olvidarCajasVistas();
  if (camaraEncendida) apagarLaCamara();
  prepararApertura();
  pintarPantalla();
}

async function cerrarPallet() {
  const items = agruparPorProducto(pallet.lecturas);
  const totalCajas = pallet.lecturas.length;
  const totalUnidades = sumarUnidades(items);

  const guardar = await confirmar({
    titulo: `Resumen del pallet ${pallet.numero}`,
    detalle: `${fechaParaMostrar(pallet.fecha)}. Responsable: ${pallet.responsable}.`,
    contenido: crear('div', {},
      tablaDeItems(items),
      crear('p', { class: 'resumen-total' }, `Total: ${cajas(totalCajas)} y ${unidades(totalUnidades)}`)),
    si: 'Guardar y cerrar',
    no: 'Seguir escaneando',
  });
  if (!guardar) return;

  // Otro dispositivo pudo haber cerrado un pallet con este número mientras se armaba este.
  const palletCerrado = pallet;
  const numero = numeroOcupado(pallet.numero) ? numeroLibre() : pallet.numero;

  guardarPallet({
    numero,
    fecha: pallet.fecha,
    responsable: pallet.responsable,
    cerradoEn: new Date().toISOString(),
    totalCajas,
    totalUnidades,
    items,
  }).catch((error) => {
    // Si Firebase lo rechaza, las cajas vuelven a la pantalla en vez de perderse.
    if (pallet) pallet.lecturas.unshift(...palletCerrado.lecturas);
    else pallet = palletCerrado;
    guardarPalletAbierto();
    pintarPantalla();
    enfocarLector();
    avisar(`El pallet ${numero} no se guardó y sus cajas volvieron a la pantalla. ${motivoDelError(error)}`, 'error');
  });

  terminarPallet();
  avisar(`Pallet ${numero} cerrado: ${cajas(totalCajas)} y ${unidades(totalUnidades)}`);
}

async function descartarPallet() {
  const total = pallet.lecturas.length;
  if (total > 0) {
    const descartar = await confirmar({
      titulo: '¿Descartar este pallet?',
      detalle: `Se borran las ${cajas(total)} escaneadas y no queda registro.`,
      si: 'Descartar pallet',
      no: 'Seguir escaneando',
      peligro: true,
    });
    if (!descartar) return;
  }
  terminarPallet();
  avisar('Pallet descartado');
}

function agregarCodigoDesconocido() {
  agregarProductoConCodigo(codigoDesconocido, () => {
    mostrarEnTablero('espera', 'Producto agregado', 'Escaneá esa caja de nuevo para sumarla.');
  });
}

// En el celular, inputmode="none" evita que el teclado de pantalla tape todo mientras el
// campo tiene el foco. Este botón lo habilita para escribir un código a mano.
function escribirAMano() {
  campoLector.blur();
  campoLector.inputMode = 'text';
  campoLector.focus();
}

function volverAModoPistola() {
  if (campoLector.inputMode === 'none') return;
  campoLector.inputMode = 'none';
  campoLector.blur(); // Cierra el teclado. mantenerFoco devuelve el cursor al campo.
}

function mensajeDeCamara(error) {
  const detalle = String(error);
  if (detalle.includes('NotAllowed')) return 'Falta el permiso: permití usar la cámara en el navegador.';
  if (detalle.includes('NotFound')) return 'Este dispositivo no tiene cámara.';
  return 'No se pudo encender la cámara. Probá recargar la página.';
}

async function encenderLaCamara() {
  if (!window.isSecureContext) {
    avisar('La cámara solo funciona si la app se abre desde https o localhost. Ver README.md.', 'error');
    return;
  }
  if (typeof Html5Qrcode === 'undefined') {
    avisar('No se pudo cargar el lector de la cámara. Revisá la conexión y recargá la página.', 'error');
    return;
  }
  botonCamara.disabled = true;
  marcoCamara.hidden = false;
  try {
    await encenderCamara('camara', (codigo) => {
      if (visible && !document.querySelector('dialog[open]')) procesarCodigo(codigo);
    }, (codigo) => buscarProducto(codigo)?.codigoInterno ?? codigo);
    camaraEncendida = true;
    anchoDeLaCamara = document.documentElement.clientWidth;
    botonCamara.textContent = 'Apagar cámara';
    marcoCamara.scrollIntoView({ block: 'nearest' });
  } catch (error) {
    console.error(error);
    marcoCamara.hidden = true;
    avisar(mensajeDeCamara(error), 'error');
  }
  botonCamara.disabled = false;
  // Si mientras arrancaba se cambió de pantalla o se cerró el pallet, nadie más la apaga.
  if (camaraEncendida && (!visible || !pallet)) apagarLaCamara().catch(console.error);
}

async function apagarLaCamara() {
  camaraEncendida = false;
  botonCamara.textContent = 'Usar cámara';
  marcoCamara.hidden = true;
  await apagarCamara();
}

// html5-qrcode fija el ancho del video al encender. Si se gira el celular hay que reiniciarla:
// si no, el video queda del ancho viejo y el recuadro de lectura queda corrido.
async function reiniciarCamaraSiCambioElAncho() {
  if (!camaraEncendida || document.documentElement.clientWidth === anchoDeLaCamara) return;
  await apagarLaCamara();
  await encenderLaCamara();
}

export function iniciarPantallaEscaneo() {
  if (pallet) escucharPalletsDe(pallet.fecha);
  else prepararApertura();
  pintarPantalla();
  enfocarLector();

  formularioApertura.addEventListener('submit', abrirPallet);
  formularioApertura.addEventListener('keydown', noAbrirConEnter);
  campoNumero.addEventListener('input', () => {
    numeroEscritoAMano = true;
  });
  campoFecha.addEventListener('change', () => {
    escucharPalletsDe(campoFecha.value);
    completarNumeroAutomatico();
  });

  escucharPistola(formularioLector, campoLector, (texto) => {
    volverAModoPistola();
    procesarCodigo(texto);
  });
  campoLector.addEventListener('blur', () => {
    campoLector.inputMode = 'none';
  });
  detectarLecturaPerdida(() => {
    senalError();
    avisar(`Esa lectura no se contó: ${pallet ? 'volvé a Escanear' : 'primero abrí el pallet'}.`, 'error');
  });

  botonDeshacer.addEventListener('click', deshacerUltimoEscaneo);
  botonCamara.addEventListener('click', () => (camaraEncendida ? apagarLaCamara() : encenderLaCamara()));
  botonAgregarCodigo.addEventListener('click', agregarCodigoDesconocido);
  botonCerrar.addEventListener('click', cerrarPallet);
  document.getElementById('btn-descartar').addEventListener('click', descartarPallet);
  document.getElementById('btn-escribir').addEventListener('click', escribirAMano);
  window.addEventListener('resize', () => reiniciarCamaraSiCambioElAncho().catch(console.error));
}

export function alMostrarEscaneo() {
  visible = true;
  if (pallet) enfocarLector();
  else prepararApertura();
}

export function alOcultarEscaneo() {
  visible = false;
  if (camaraEncendida) apagarLaCamara();
}
