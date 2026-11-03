// Pantalla "Escanear": primero se abre el pallet y después se escanea caja por caja.
import { escucharPallets, guardarPallet } from './datos.js';
import {
  apagarCamara,
  detectarLecturaPerdida,
  encenderCamara,
  escucharPistola,
  mantenerFoco,
  mensajeDeCamara,
  motivoSinCamara,
} from './lector.js';
import {
  agregarProductoConCodigo,
  buscarProducto,
  errorAlCargarProductos,
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
  notaPorFilas,
  senalError,
  senalOk,
  tablaDeItems,
  unidades,
} from './ui.js';

const CLAVE_PALLET_ABIERTO = 'registro-pallets.pallet-abierto';
const CLAVE_RESPONSABLE = 'registro-pallets.responsable';
const CLAVE_RECHAZADOS = 'registro-pallets.pallets-rechazados';
const CLAVE_MODO_CAMARA = 'registro-pallets.modo-camara';
const DURACION_VERDE_MS = 1200;
const ESPERA_ENTRE_QUITAS_MS = 400;
const ESPERA_ENTRE_TOQUES_DE_LEER_MS = 400;
const TIEMPO_PARA_LEER_MS = 8000;
const ESPERA_PARA_PEDIR_QUE_SE_ACERQUE_MS = 2000;
const ESPERA_EN_MODO_RAPIDO_MS = 2000;
const MAXIMO_CAJAS_POR_FILAS = 999;
const ALTO_BARRA_INFERIOR = 100;
const DIAS_DE_MARGEN_EN_LA_FECHA = 31;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

// El pallet que se está armando: { numero, fecha, responsable, lecturas }. Cada lectura es
// una caja. Se guarda en el dispositivo a cada lectura: si se recarga la página o se apaga
// el celular, el pallet sigue ahí. Sin pallet abierto vale null.
let pallet = JSON.parse(localStorage.getItem(CLAVE_PALLET_ABIERTO) ?? 'null');

let visible = true;
let camaraEncendida = false;
let codigoDesconocido = null;
let temporizadorVerde;
let ultimaQuita = 0;
let anchoDeLaCamara = 0;

// Hay una lectura pedida con el botón Leer mientras este temporizador no sea null.
let temporizadorLeer = null;
let ultimoToqueDeLeer = 0;

// Modo rápido: la cámara cuenta sola, sin tocar Leer.
let modoRapido = localStorage.getItem(CLAVE_MODO_CAMARA) === 'rapido';
let ultimaVezQueVioUnCodigo = 0;
let ultimaCajaContada = null;
let momentoDeLaUltimaCaja = 0;

// Contar por filas: la próxima lectura no suma, solo dice de qué producto son las cajas.
let esperandoCajaDeFilas = false;
let productoDeFilas = null;

// Pallets ya cerrados en la fecha elegida: para saber qué número le toca al siguiente.
let palletsDeLaFecha = [];
let fechaEscuchada = null;
let dejarDeEscuchar = null;
let numeroEscritoAMano = false;
let fechaSugerida = null;

const vistaApertura = document.getElementById('vista-apertura');
const vistaEscaneo = document.getElementById('vista-escaneo');

const formularioApertura = document.getElementById('form-apertura');
const campoNumero = document.getElementById('apertura-numero');
const campoFecha = document.getElementById('apertura-fecha');
const campoResponsable = document.getElementById('apertura-responsable');
const mensajeApertura = document.getElementById('mensaje-apertura');

const tablero = document.getElementById('tablero');
const tituloTablero = document.getElementById('tablero-titulo');
const datosTablero = document.getElementById('tablero-datos');
const contador = document.getElementById('contador');
const contadorApagado = document.getElementById('contador-apagado');
const totalDeUnidades = document.getElementById('total-unidades');
const etiquetaCajas = document.getElementById('etiqueta-cajas');
const lecturaTitulo = document.getElementById('lectura-titulo');
const lecturaDetalle = document.getElementById('lectura-detalle');
const botonAgregarCodigo = document.getElementById('btn-agregar-codigo');
const formularioLector = document.getElementById('form-lector');
const campoLector = document.getElementById('campo-lector');
const botonDeshacer = document.getElementById('btn-deshacer');
const botonFilas = document.getElementById('btn-filas');
const dialogoFilas = document.getElementById('dialogo-filas');
const formularioFilas = document.getElementById('form-filas');
const campoCajasPorFila = document.getElementById('filas-cajas');
const campoFilas = document.getElementById('filas-cantidad');
const cuentaDeFilas = document.getElementById('filas-cuenta');
const botonSumarFilas = document.getElementById('btn-sumar-filas');
const botonCamara = document.getElementById('btn-camara');
const marcoCamara = document.getElementById('marco-camara');
const botonLeer = document.getElementById('btn-leer');
const botonModoTocar = document.getElementById('btn-modo-tocar');
const botonModoRapido = document.getElementById('btn-modo-rapido');
const cartelAcercarse = document.getElementById('cartel-acercarse');
const avisoRapido = document.getElementById('aviso-rapido');
const resumenPallet = document.getElementById('resumen-pallet');
const listaItems = document.getElementById('lista-items');
const botonSeguirCamara = document.getElementById('btn-seguir-camara');
const botonCerrar = document.getElementById('btn-cerrar');

const enfocarLector = mantenerFoco(campoLector, () => (
  visible && pallet !== null && !document.querySelector('dialog[open]')));

// Copia el pallet abierto al dispositivo, o borra la copia si no hay ninguno.
function guardarPalletAbierto() {
  if (pallet) localStorage.setItem(CLAVE_PALLET_ABIERTO, JSON.stringify(pallet));
  else localStorage.removeItem(CLAVE_PALLET_ABIERTO);
}

// Si se editó el producto con el pallet abierto, las cajas de antes y las de después van en
// filas separadas: si no, cajas por unidades por caja no daría el total de la fila.
// Dos lecturas con la misma clave van en la misma fila.
const claveDeFila = ({ codigoInterno, descripcion, unidadesPorCaja }) => (
  `${codigoInterno}|${descripcion}|${unidadesPorCaja}`);

// Arma la guía para volver a controlar un pallet: "8 × 5" son 5 filas de 8 cajas, y "8 × 5 − 1"
// dice que después se quitó una. Un conteo de la versión anterior no guardó las filas.
function detalleDeBloques(bloques) {
  return [...bloques.values()].map(({ quedan, cajasPorFila = quedan, filas = 1 }) => {
    const quitadas = cajasPorFila * filas - quedan;
    return `${cajasPorFila} × ${filas}${quitadas > 0 ? ` − ${quitadas}` : ''}`;
  }).join(' + ');
}

// Convierte las lecturas, una por caja, en filas con sus totales de cajas y unidades.
// detalleFilas dice cómo se contaron las cajas que no se escanearon.
function agruparPorProducto(lecturas) {
  const grupos = new Map();
  for (const { bloque, cajasPorFila, filas, ...lectura } of lecturas) {
    const clave = claveDeFila(lectura);
    const grupo = grupos.get(clave) ?? { ...lectura, cajas: 0, unidades: 0, bloques: new Map() };
    grupo.cajas += 1;
    grupo.unidades += lectura.unidadesPorCaja;
    if (bloque) {
      const datos = grupo.bloques.get(bloque) ?? { cajasPorFila, filas, quedan: 0 };
      datos.quedan += 1;
      grupo.bloques.set(bloque, datos);
    }
    grupos.set(clave, grupo);
  }
  return [...grupos.values()].map(({ bloques, ...grupo }) => (
    { ...grupo, detalleFilas: detalleDeBloques(bloques) }));
}

// Suma las unidades de todas las filas.
const sumarUnidades = (items) => items.reduce((suma, item) => suma + item.unidades, 0);

// El siguiente número sin usar en la fecha: el mayor más uno.
const numeroLibre = () => Math.max(0, ...palletsDeLaFecha.map((p) => p.numero)) + 1;

// Dice si ya hay un pallet cerrado con ese número en la fecha.
const numeroOcupado = (numero) => palletsDeLaFecha.some((p) => p.numero === numero);

// Otro dispositivo pudo haber cerrado un pallet con este número mientras se armaba este.
// Devuelve el número con el que va a quedar guardado el pallet abierto.
const numeroParaCerrar = () => (numeroOcupado(pallet.numero) ? numeroLibre() : pallet.numero);

// Escribe en el tablero cómo está el pallet: al abrirlo, al recargar o al llegar de otra pestaña.
function mostrarEstadoDelPallet() {
  if (pallet.devuelto) {
    mostrarEnTablero('error', 'Este pallet no se guardó', 'Cerralo de nuevo cuando esté resuelto.');
  } else {
    mostrarEnTablero('espera', pallet.lecturas.length ? 'Escaneá la siguiente caja' : 'Escaneá la primera caja');
  }
}

// Sugiere el número libre, salvo que la persona haya escrito otro.
function completarNumeroAutomatico() {
  if (!pallet && !numeroEscritoAMano) campoNumero.value = numeroLibre();
}

// Sigue los pallets cerrados de esa fecha para mantener al día la numeración.
function escucharPalletsDe(fecha) {
  if (fecha === fechaEscuchada) return;
  fechaEscuchada = fecha;
  palletsDeLaFecha = [];
  dejarDeEscuchar?.();
  dejarDeEscuchar = escucharPallets(fecha, (lista) => {
    palletsDeLaFecha = lista;
    completarNumeroAutomatico();
    pintarPantalla();
  }, avisarErrorDeDatos);
}

// Deja el formulario listo con fecha de hoy, número automático y el último responsable.
function prepararApertura() {
  numeroEscritoAMano = false;
  fechaSugerida = fechaDeHoy();
  campoFecha.value = fechaSugerida;
  campoResponsable.value = localStorage.getItem(CLAVE_RESPONSABLE) ?? '';
  mensajeApertura.hidden = true;
  escucharPalletsDe(campoFecha.value);
  completarNumeroAutomatico();
}

// Si la app queda abierta de un día para el otro, el formulario no puede seguir proponiendo
// la fecha de ayer. Una fecha elegida a mano se respeta.
function renovarFecha() {
  const hoy = fechaDeHoy();
  if (pallet || fechaSugerida === hoy) return;
  const eraAutomatica = campoFecha.value === fechaSugerida;
  fechaSugerida = hoy;
  if (!eraAutomatica) return;
  campoFecha.value = hoy;
  escucharPalletsDe(hoy);
  completarNumeroAutomatico();
}

// Muestra un mensaje en rojo en el formulario Abrir pallet.
function mostrarErrorDeApertura(mensaje) {
  mensajeApertura.textContent = mensaje;
  mensajeApertura.hidden = false;
}

// Una lectura con el cursor en Fecha deja años como 0004.
// Dice si la fecha está a 31 días o menos de hoy, para atrás o para adelante.
function fechaCercana(fecha) {
  const distancia = Math.abs(new Date(`${fecha}T12:00`) - new Date(`${fechaDeHoy()}T12:00`));
  return distancia / MS_POR_DIA <= DIAS_DE_MARGEN_EN_LA_FECHA;
}

// Valida el formulario y abre el pallet. Si algo falla, muestra el motivo y no abre nada. Los
// campos obligatorios y el formato del número ya los controló el navegador antes de llegar acá.
function abrirPallet(evento) {
  evento.preventDefault();
  const numero = Number(campoNumero.value);
  const responsable = campoResponsable.value.trim();

  if (!fechaCercana(campoFecha.value)) {
    mostrarErrorDeApertura(`Revisá la fecha: está a más de ${DIAS_DE_MARGEN_EN_LA_FECHA} días de hoy.`);
    return;
  }
  if (numeroOcupado(numero)) {
    mostrarErrorDeApertura(`Ya hay un pallet ${numero} con esa fecha.`);
    return;
  }
  if (!responsable) {
    mostrarErrorDeApertura('Falta el responsable.');
    return;
  }
  // Pasa si alguien escanea una caja con el cursor en este campo. Cuatro cifras seguidas no
  // aparecen en un nombre, y están en cualquier código, aunque no esté en Productos.
  if (/\d{4}/.test(responsable) || buscarProducto(responsable)) {
    mostrarErrorDeApertura('En Responsable quedó un código de caja. Escribí el nombre.');
    return;
  }

  localStorage.setItem(CLAVE_RESPONSABLE, responsable);
  pallet = { numero, fecha: campoFecha.value, responsable, lecturas: [] };
  guardarPalletAbierto();
  mensajeApertura.hidden = true;
  pintarPantalla();
  mostrarEstadoDelPallet();
  enfocarLector();
  window.scrollTo(0, 0);
}

// La pistola termina cada lectura con Enter. Si se escanea antes de abrir el pallet, ese
// Enter no debe abrirlo con una caja sin contar: acá solo se abre tocando el botón.
function noAbrirConEnter(evento) {
  if (evento.key !== 'Enter') return;
  evento.preventDefault();
  senalError();
}

// Arma la fila de un producto en la lista, con su botón -1.
function filaItem(item) {
  return crear('li', { class: 'item' },
    crear('div', { class: 'fila-datos' },
      crear('strong', { class: 'codigo' }, item.codigoInterno),
      crear('span', {}, item.descripcion),
      notaPorFilas(item)),
    crear('button', {
      type: 'button',
      class: 'boton boton-secundario item-quitar',
      'aria-label': `Quitar una caja de ${item.codigoInterno}`,
      alHacerClic: () => quitarUnaCaja(item),
    }, '−1'),
    crear('p', { class: 'item-cantidades' },
      crear('span', {}, cajas(item.cajas)),
      crear('span', {}, unidades(item.unidades))));
}

// Dibuja la pantalla según el pallet: el formulario si no hay ninguno abierto, y si hay,
// tablero, lista y botones. El texto de la última lectura lo pone mostrarEnTablero.
function pintarPantalla() {
  vistaApertura.hidden = pallet !== null;
  vistaEscaneo.hidden = pallet === null;
  if (!pallet) {
    cancelarEsperaDeFilas();
    return;
  }

  const items = agruparPorProducto(pallet.lecturas);
  const totalCajas = pallet.lecturas.length;
  tituloTablero.textContent = `Pallet ${numeroParaCerrar()}`;
  datosTablero.textContent = `${fechaParaMostrar(pallet.fecha)}, ${pallet.responsable}`;
  contador.textContent = totalCajas;
  contadorApagado.textContent = '8'.repeat(Math.max(3, String(totalCajas).length));
  contador.parentElement.classList.toggle('contador-largo', totalCajas > 999);
  totalDeUnidades.textContent = unidades(sumarUnidades(items));
  etiquetaCajas.textContent = totalCajas === 1 ? 'caja' : 'cajas';
  listaItems.replaceChildren(...items.map(filaItem));
  resumenPallet.hidden = totalCajas === 0;
  resumenPallet.textContent = `Resumen: ${cajas(totalCajas)} y ${unidades(sumarUnidades(items))}`;
  if (totalCajas === 0) botonSeguirCamara.hidden = true;
  botonCerrar.disabled = totalCajas === 0;
  botonDeshacer.disabled = totalCajas === 0;
}

// Pinta el tablero: "ok" verde, "error" rojo, "espera" oscuro.
// titulo y detalle son los dos renglones de la zona de lectura.
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

  // Con la lista larga el tablero puede haber quedado arriba, fuera de la pantalla. Si no
  // entra entero, como en un celular apaisado, moverlo solo haría saltar la pantalla.
  const entraEnPantalla = tablero.offsetHeight <= window.innerHeight - ALTO_BARRA_INFERIOR;
  if (estado !== 'espera' && entraEnPantalla) tablero.scrollIntoView({ block: 'nearest' });

  if (estado === 'ok') {
    temporizadorVerde = setTimeout(() => {
      tablero.dataset.estado = 'espera';
    }, DURACION_VERDE_MS);
  }
}

// Pinta el tablero de rojo y hace sonar la alerta.
function rechazarLectura(titulo, detalle) {
  mostrarEnTablero('error', titulo, detalle);
  senalError();
}

// Atiende una lectura de la pistola o de la cámara: busca el código y suma una caja, o avisa
// en rojo por qué no la sumó.
function procesarCodigo(textoLeido) {
  const codigo = normalizarCodigo(textoLeido);
  if (!codigo || !pallet) return;

  if (pallet.devuelto) {
    rechazarLectura('No se sumó: este pallet no se guardó', 'Cerralo de nuevo antes de escanear.');
    return;
  }

  if (!productosCargados()) {
    const error = errorAlCargarProductos();
    rechazarLectura('No se sumó', error
      ? motivoDelError(error)
      : 'Los productos todavía están cargando. Escaneá de nuevo.');
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
  if (!codigoInterno || !unidadesPorCaja) {
    rechazarLectura('No se sumó', `${codigoInterno || codigo}: faltan datos en Productos.`);
    return;
  }
  if (esperandoCajaDeFilas) {
    abrirDialogoDeFilas(producto);
    return;
  }
  pallet.lecturas.push({ codigoInterno, codigoBarras, descripcion, unidadesPorCaja });
  guardarPalletAbierto();
  pintarPantalla();
  mostrarEnTablero('ok', `${codigoInterno} sumada`, descripcion);
  senalOk();
}

// Un doble toque sin querer no debe sacar dos cajas. Suena la alerta para que se note que
// ese toque no quitó nada.
function esToqueRepetido() {
  const ahora = performance.now();
  if (ahora - ultimaQuita < ESPERA_ENTRE_QUITAS_MS) {
    senalError();
    return true;
  }
  ultimaQuita = ahora;
  return false;
}

// Saca la última caja leída, sea del producto que sea. Si fue un conteo por filas lo saca
// entero, después de preguntar: un número mal escrito se corrige de una sola vez.
async function deshacerUltimoEscaneo() {
  if (esToqueRepetido()) return;
  const lectura = pallet.lecturas.at(-1);
  if (!lectura) return;
  if (lectura.bloque) {
    await deshacerConteoPorFilas(lectura);
    return;
  }
  pallet.lecturas.pop();
  guardarPalletAbierto();
  pintarPantalla();
  mostrarEnTablero('espera', 'Se deshizo una caja', lectura.codigoInterno);
}

// Saca todas las cajas que se sumaron juntas con Contar por filas.
async function deshacerConteoPorFilas({ bloque, codigoInterno }) {
  const cantidad = pallet.lecturas.filter((lectura) => lectura.bloque === bloque).length;
  const deshacer = await confirmar({
    titulo: '¿Deshacer el conteo por filas?',
    detalle: `Se saca todo junto: ${cajas(cantidad)} de ${codigoInterno}.`,
    si: 'Deshacer',
    no: 'Dejarlo',
    peligro: true,
  });
  if (!deshacer || !pallet) return;
  pallet.lecturas = pallet.lecturas.filter((lectura) => lectura.bloque !== bloque);
  guardarPalletAbierto();
  pintarPantalla();
  mostrarEnTablero('espera', 'Se deshizo el conteo por filas', `${codigoInterno}: ${cajas(cantidad)}`);
}

// Saca la última caja leída de una fila de la lista (botón -1).
function quitarUnaCaja(item) {
  if (esToqueRepetido()) return;
  const clave = claveDeFila(item);
  pallet.lecturas.splice(pallet.lecturas.findLastIndex((l) => claveDeFila(l) === clave), 1);
  guardarPalletAbierto();
  pintarPantalla();
  mostrarEnTablero('espera', 'Se quitó una caja', item.codigoInterno);
}

// Después de cerrar o descartar, la pantalla vuelve a "Abrir pallet".
// Si hay un pallet rechazado esperando, vuelve a la pantalla en este momento.
function terminarPallet() {
  pallet = null;
  guardarPalletAbierto();
  if (camaraEncendida) apagarLaCamara();
  prepararApertura();
  pintarPantalla();
  devolverPalletRechazado();
}

// Lista de pallets que la base rechazó y esperan volver a la pantalla.
const leerRechazados = () => JSON.parse(localStorage.getItem(CLAVE_RECHAZADOS) ?? '[]');

// Guarda esa lista en el dispositivo.
function guardarRechazados(lista) {
  localStorage.setItem(CLAVE_RECHAZADOS, JSON.stringify(lista));
}

// Un pallet que la base rechazó espera acá hasta que la pantalla esté libre. Nunca se mezcla
// con las cajas del pallet que se esté armando.
function devolverPalletRechazado() {
  const [rechazado, ...resto] = leerRechazados();
  if (pallet || !rechazado) return;
  guardarRechazados(resto);
  // devuelto: no suma más cajas, para que la pistola no siga cargando el pallet nuevo en este.
  pallet = { ...rechazado, devuelto: true };
  guardarPalletAbierto();
  escucharPalletsDe(pallet.fecha);
  pintarPantalla();
  mostrarEstadoDelPallet();
  senalError();
  enfocarLector();
}

// Muestra el resumen final y, si se confirma, guarda el pallet. No espera a la base: sin señal
// esa promesa no termina. Si después llega un rechazo, el .catch recupera las cajas.
async function cerrarPallet() {
  const items = agruparPorProducto(pallet.lecturas);
  const totalCajas = pallet.lecturas.length;
  const totalUnidades = sumarUnidades(items);
  const numeroPrevisto = numeroParaCerrar();
  const cambioElNumero = numeroPrevisto === pallet.numero
    ? ''
    : ` El ${pallet.numero} ya lo usó otro dispositivo.`;

  const guardar = await confirmar({
    titulo: `Resumen del pallet ${numeroPrevisto}`,
    detalle: `${fechaParaMostrar(pallet.fecha)}. Responsable: ${pallet.responsable}.${cambioElNumero}`,
    contenido: crear('div', {},
      tablaDeItems(items),
      crear('p', { class: 'resumen-total' }, `Total: ${cajas(totalCajas)} y ${unidades(totalUnidades)}`)),
    si: 'Guardar y cerrar',
    no: 'Seguir escaneando',
  });
  // pallet puede ser null: otra pestaña pudo haberlo cerrado con esta pregunta abierta.
  if (!guardar || !pallet) return;

  const palletCerrado = pallet;
  const numero = numeroParaCerrar();

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
    guardarRechazados([...leerRechazados(), { ...palletCerrado, numero }]);
    const cuando = pallet ? 'van a volver cuando termines este pallet' : 'volvieron a la pantalla';
    devolverPalletRechazado();
    avisar(`El pallet ${numero} no se guardó y sus cajas ${cuando}. ${motivoDelError(error)}`, 'error');
  });

  terminarPallet();
  avisar(`Pallet ${numero} cerrado: ${cajas(totalCajas)} y ${unidades(totalUnidades)}`);
}

// Borra el pallet abierto. Si ya tiene cajas, pregunta antes.
async function descartarPallet() {
  const total = pallet.lecturas.length;
  if (total > 0) {
    const descartar = await confirmar({
      titulo: '¿Descartar este pallet?',
      detalle: `${total === 1 ? 'Se borra la caja escaneada' : `Se borran las ${cajas(total)} escaneadas`} y no queda registro.`,
      si: 'Descartar pallet',
      no: 'Seguir escaneando',
      peligro: true,
    });
    if (!descartar) return;
  }
  terminarPallet();
  avisar('Pallet descartado');
}

// Las cajas del medio del pallet no se pueden escanear sin desarmarlo. Este botón pide una
// lectura que no suma: solo dice de qué producto son, y después se escriben las cantidades.
function alternarContarPorFilas() {
  if (esperandoCajaDeFilas) {
    cancelarEsperaDeFilas();
    mostrarEstadoDelPallet();
    return;
  }
  esperandoCajaDeFilas = true;
  ultimaVezQueVioUnCodigo = performance.now();
  botonFilas.textContent = 'Cancelar filas';
  mostrarEnTablero('espera', 'Escaneá una caja del producto', 'No se suma: solo dice qué producto es.');
}

// Deja de esperar la caja que dice el producto. Si no estaba esperando, no cambia nada.
function cancelarEsperaDeFilas() {
  esperandoCajaDeFilas = false;
  botonFilas.textContent = 'Contar por filas';
}

// Abre la ventana para escribir las cantidades de ese producto.
function abrirDialogoDeFilas(producto) {
  cancelarEsperaDeFilas();
  productoDeFilas = producto;
  document.getElementById('filas-producto').textContent = `${producto.codigoInterno}: ${producto.descripcion}`;
  campoCajasPorFila.value = '';
  campoFilas.value = '';
  pintarCuentaDeFilas();
  dialogoFilas.showModal();
  campoCajasPorFila.focus();
}

// Devuelve el número escrito en ese campo, o 0 si no es un entero mayor que cero.
const enteroDelCampo = (campo) => (/^[1-9]\d*$/.test(campo.value) ? Number(campo.value) : 0);

// Muestra la cuenta mientras se escribe. El tope frena una lectura de la pistola que cayó acá.
function pintarCuentaDeFilas() {
  const cajasPorFila = enteroDelCampo(campoCajasPorFila);
  const filas = enteroDelCampo(campoFilas);
  const total = cajasPorFila * filas;
  const valida = total > 0 && total <= MAXIMO_CAJAS_POR_FILAS;
  botonSumarFilas.disabled = !valida;
  botonSumarFilas.textContent = valida ? `Sumar ${cajas(total)}` : 'Sumar';
  if (valida) {
    const totalDeUnidadesDeFilas = unidades(total * productoDeFilas.unidadesPorCaja);
    cuentaDeFilas.textContent = `${cajasPorFila} × ${filas} = ${cajas(total)}, ${totalDeUnidadesDeFilas}`;
  } else if (total > MAXIMO_CAJAS_POR_FILAS) {
    cuentaDeFilas.textContent = `Son más de ${MAXIMO_CAJAS_POR_FILAS} cajas: revisá los números.`;
  } else {
    cuentaDeFilas.textContent = 'Escribí los dos números.';
  }
}

// Suma las cajas de una vez. Con la cámara abierta va al resumen, para revisar la cuenta.
function sumarPorFilas(evento) {
  evento.preventDefault();
  if (botonSumarFilas.disabled || !pallet) return;
  const cajasPorFila = enteroDelCampo(campoCajasPorFila);
  const filas = enteroDelCampo(campoFilas);
  const total = cajasPorFila * filas;
  const { codigoInterno, codigoBarras, descripcion, unidadesPorCaja } = productoDeFilas;
  // bloque identifica las cajas sumadas juntas, para poder deshacerlas de una vez.
  const bloque = Date.now();
  for (let i = 0; i < total; i += 1) {
    pallet.lecturas.push({ codigoInterno, codigoBarras, descripcion, unidadesPorCaja, bloque, cajasPorFila, filas });
  }
  dialogoFilas.close();
  guardarPalletAbierto();
  pintarPantalla();
  mostrarEnTablero('ok', `${cajas(total)} de ${codigoInterno}`, `Por filas: ${cajasPorFila} × ${filas}`);
  senalOk();
  if (camaraEncendida) cerrarLaCamaraYVerResumen().catch(console.error);
}

// Con la pistola, el Enter del final de una lectura no suma nada. Así, una lectura que caiga
// en esta ventana no carga cajas: el primer campo pasa al siguiente y el último avisa.
function noSumarConEnter(evento) {
  if (evento.key !== 'Enter' || !evento.target.matches('input')) return;
  evento.preventDefault();
  if (evento.target === campoCajasPorFila) campoFilas.focus();
  else senalError();
}

// Abre el formulario de producto con el código que no se encontró.
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

// Vuelve a ocultar el teclado después de escribir un código a mano.
function volverAModoPistola() {
  if (campoLector.inputMode === 'none') return;
  campoLector.inputMode = 'none';
  campoLector.blur(); // Cierra el teclado. mantenerFoco devuelve el cursor al campo.
}

// Deja el botón Leer como al principio, sin ninguna lectura pedida.
function terminarLectura() {
  clearTimeout(temporizadorLeer);
  temporizadorLeer = null;
  botonLeer.textContent = 'Leer';
  botonLeer.classList.replace('boton-tablero', 'boton-marcha');
  cartelAcercarse.hidden = true;
}

// Si la cámara no encontró ningún código a tiempo, avisa: esa caja no se contó.
function vencerLectura() {
  terminarLectura();
  if (!document.querySelector('dialog[open]')) {
    rechazarLectura('No se leyó ningún código', 'Acercá más la cámara y tocá Leer de nuevo.');
  }
}

// Todas las cajas de un producto traen el mismo código, y la cámara no sabe cuándo se pasó a la
// siguiente. Por eso cada toque pide una sola lectura, igual que un gatillazo de la pistola.
function pedirLectura() {
  // Un doble toque sin querer, con el código a la vista, contaría dos cajas.
  const ahora = performance.now();
  if (ahora - ultimoToqueDeLeer < ESPERA_ENTRE_TOQUES_DE_LEER_MS) return;
  ultimoToqueDeLeer = ahora;
  ultimaVezQueVioUnCodigo = ahora;

  clearTimeout(temporizadorLeer);
  temporizadorLeer = setTimeout(vencerLectura, TIEMPO_PARA_LEER_MS);
  botonLeer.textContent = 'Apuntá al código';
  botonLeer.classList.replace('boton-marcha', 'boton-tablero');
  mostrarEnTablero('espera', 'Apuntá al código de barras');
}

// La cámara llama a esta función con cada código que ve. Con Tocar para leer solo cuenta si hay
// una lectura pedida. En modo rápido cuenta sola, y la misma caja vuelve a contar a los 2
// segundos aunque no haya salido de la vista: es lo que avisa el cartel de ese modo.
function alVerCodigoConLaCamara(codigo) {
  const ahora = performance.now();
  ultimaVezQueVioUnCodigo = ahora;
  cartelAcercarse.hidden = true;
  if (!visible || document.querySelector('dialog[open]')) return;
  if (!modoRapido && temporizadorLeer === null && !esperandoCajaDeFilas) return;

  const caja = buscarProducto(codigo)?.codigoInterno ?? codigo;
  const esperando = caja === ultimaCajaContada && ahora - momentoDeLaUltimaCaja < ESPERA_EN_MODO_RAPIDO_MS;
  if ((modoRapido || esperandoCajaDeFilas) && esperando) return;

  ultimaCajaContada = caja;
  momentoDeLaUltimaCaja = ahora;
  terminarLectura();
  procesarCodigo(codigo);
}

// La distancia no se puede medir: si la cámara está buscando un código y hace rato que no ve
// ninguno, lo más probable es que esté lejos.
function alNoVerCodigoConLaCamara() {
  const buscandoCodigo = modoRapido || temporizadorLeer !== null || esperandoCajaDeFilas;
  const pasoElTiempo = performance.now() - ultimaVezQueVioUnCodigo >= ESPERA_PARA_PEDIR_QUE_SE_ACERQUE_MS;
  cartelAcercarse.hidden = !(buscandoCodigo && pasoElTiempo);
}

// Muestra el modo elegido: en modo rápido no hay botón Leer, y en su lugar va el aviso.
function pintarModoDeCamara() {
  botonLeer.hidden = modoRapido;
  avisoRapido.hidden = !modoRapido;
  botonModoTocar.setAttribute('aria-pressed', String(!modoRapido));
  botonModoRapido.setAttribute('aria-pressed', String(modoRapido));
}

// Cambia de modo y lo deja guardado en el dispositivo. Una lectura pedida se cancela.
function elegirModoDeCamara(rapido) {
  modoRapido = rapido;
  localStorage.setItem(CLAVE_MODO_CAMARA, rapido ? 'rapido' : 'tocar');
  ultimaVezQueVioUnCodigo = performance.now();
  terminarLectura();
  pintarModoDeCamara();
}

// Enciende la cámara. Antes revisa que la página sea segura y que la librería haya cargado.
async function encenderLaCamara() {
  const motivo = motivoSinCamara();
  if (motivo) {
    avisar(motivo, 'error');
    return;
  }
  botonCamara.disabled = true;
  botonCamara.textContent = 'Cerrar cámara';
  botonSeguirCamara.hidden = true;
  marcoCamara.hidden = false;
  // Va antes de encenderla: html5-qrcode toma en ese momento el ancho que va a tener el video.
  document.body.classList.add('con-camara');
  try {
    ultimaVezQueVioUnCodigo = performance.now();
    await encenderCamara('camara', alVerCodigoConLaCamara, alNoVerCodigoConLaCamara);
    camaraEncendida = true;
    anchoDeLaCamara = document.documentElement.clientWidth;
    // En la PC el botón está más abajo: sin esto, el contador podría quedar fuera de la pantalla.
    tablero.scrollIntoView({ block: 'start' });
  } catch (error) {
    console.error(error);
    botonCamara.textContent = 'Usar cámara';
    marcoCamara.hidden = true;
    document.body.classList.remove('con-camara');
    avisar(mensajeDeCamara(error), 'error');
  }
  botonCamara.disabled = false;
  // Si mientras arrancaba se cambió de pantalla o se cerró el pallet, nadie más la apaga.
  if (camaraEncendida && (!visible || !pallet)) apagarLaCamara().catch(console.error);
}

// Apaga la cámara y deja el botón y el recuadro como al principio.
async function apagarLaCamara() {
  camaraEncendida = false;
  if ((temporizadorLeer !== null || esperandoCajaDeFilas) && pallet) mostrarEstadoDelPallet();
  terminarLectura();
  cancelarEsperaDeFilas();
  botonCamara.textContent = 'Usar cámara';
  marcoCamara.hidden = true;
  document.body.classList.remove('con-camara');
  await apagarCamara();
}

// Con la cámara abierta solo se ve la última lectura. Al cerrarla a mano la pantalla va al
// resumen, para revisar lo contado y corregirlo con -1 antes de cerrar el pallet.
async function cerrarLaCamaraYVerResumen() {
  const cierre = apagarLaCamara();
  if (pallet?.lecturas.length) {
    botonSeguirCamara.hidden = false;
    resumenPallet.scrollIntoView({ block: 'start' });
  }
  await cierre;
}

// En la app de Android, la tecla Atrás cierra primero lo que esté abierto. Sin esto saldría
// de la app, aunque se estuviera mirando una pregunta o la pantalla de la cámara.
function escucharTeclaAtras() {
  const app = window.Capacitor?.Plugins?.App;
  app?.addListener('backButton', () => {
    const dialogo = document.querySelector('dialog[open]');
    if (dialogo) dialogo.close();
    else if (camaraEncendida) cerrarLaCamaraYVerResumen().catch(console.error);
    else app.exitApp();
  });
}

// html5-qrcode fija el ancho del video al encender. Si se gira el celular hay que reiniciarla:
// si no, el video queda del ancho viejo y el recuadro de lectura queda corrido.
async function reiniciarCamaraSiCambioElAncho() {
  if (!camaraEncendida || document.documentElement.clientWidth === anchoDeLaCamara) return;
  // Apagarla recién prendida puede fallar: igual hay que volver a encenderla.
  await apagarLaCamara().catch(console.error);
  await encenderLaCamara();
}

// Si la app está abierta en otra pestaña, las dos trabajan sobre el mismo pallet.
// evento es el "storage" del navegador, que solo les llega a las otras pestañas.
function alCambiarEnOtraPestana(evento) {
  if (evento.key !== CLAVE_PALLET_ABIERTO) return;
  pallet = JSON.parse(evento.newValue ?? 'null');
  // Una pregunta abierta se armó con el pallet de antes: contestarla ahora actuaría sobre otro.
  document.getElementById('dialogo-confirmar').close();
  dialogoFilas.close();
  if (pallet) {
    escucharPalletsDe(pallet.fecha);
  } else {
    if (camaraEncendida) apagarLaCamara();
    prepararApertura();
  }
  pintarPantalla();
  if (pallet) mostrarEstadoDelPallet();
  enfocarLector();
}

// Prepara la pantalla y conecta sus botones. Se llama una sola vez, al arrancar la app.
export function iniciarPantallaEscaneo() {
  if (pallet) escucharPalletsDe(pallet.fecha);
  else prepararApertura();
  pintarPantalla();
  if (pallet) mostrarEstadoDelPallet();
  devolverPalletRechazado();
  enfocarLector();

  formularioApertura.addEventListener('submit', abrirPallet);
  formularioApertura.addEventListener('keydown', noAbrirConEnter);
  campoNumero.addEventListener('input', () => {
    numeroEscritoAMano = campoNumero.value !== '';
    mensajeApertura.hidden = true;
  });
  campoFecha.addEventListener('change', () => {
    mensajeApertura.hidden = true;
    escucharPalletsDe(campoFecha.value);
    completarNumeroAutomatico();
  });
  // Una PC siempre prendida nunca cambia de foco; un celular suspendido frena los temporizadores.
  setInterval(renovarFecha, 60000);
  document.addEventListener('visibilitychange', renovarFecha);

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
  botonFilas.addEventListener('click', alternarContarPorFilas);
  formularioFilas.addEventListener('submit', sumarPorFilas);
  formularioFilas.addEventListener('input', pintarCuentaDeFilas);
  formularioFilas.addEventListener('keydown', noSumarConEnter);
  document.getElementById('btn-cancelar-filas').addEventListener('click', () => dialogoFilas.close());
  // En modo rápido, la caja que dijo el producto no tiene que contarse sola al cerrar la ventana.
  dialogoFilas.addEventListener('close', () => {
    momentoDeLaUltimaCaja = performance.now();
  });
  botonCamara.addEventListener('click', () => (camaraEncendida ? cerrarLaCamaraYVerResumen() : encenderLaCamara()));
  botonSeguirCamara.addEventListener('click', encenderLaCamara);
  botonLeer.addEventListener('click', pedirLectura);
  botonModoTocar.addEventListener('click', () => elegirModoDeCamara(false));
  botonModoRapido.addEventListener('click', () => elegirModoDeCamara(true));
  pintarModoDeCamara();
  botonAgregarCodigo.addEventListener('click', agregarCodigoDesconocido);
  botonCerrar.addEventListener('click', cerrarPallet);
  document.getElementById('btn-descartar').addEventListener('click', descartarPallet);
  document.getElementById('btn-escribir').addEventListener('click', escribirAMano);
  window.addEventListener('resize', () => reiniciarCamaraSiCambioElAncho().catch(console.error));
  window.addEventListener('storage', alCambiarEnOtraPestana);
  escucharTeclaAtras();
}

// Se llama al entrar a esta pantalla.
export function alMostrarEscaneo() {
  visible = true;
  if (pallet) enfocarLector();
  else renovarFecha();
}

// Se llama al ir a otra pantalla. La cámara se apaga porque nadie la estaría mirando.
export function alOcultarEscaneo() {
  visible = false;
  if (camaraEncendida) apagarLaCamara();
}
