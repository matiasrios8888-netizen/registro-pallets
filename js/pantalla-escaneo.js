// Pantalla "Escanear": primero se abre el pallet y después se escanea caja por caja.
import { claveLocal, escucharPallets, guardarPallet } from './datos.js';
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
import { esSupervisor, usuario } from './sesion.js';
import {
  NOMBRE_ENVASE,
  avisar,
  avisarErrorDeDatos,
  cajas,
  confirmar,
  crear,
  fechaDeHoy,
  fechaParaMostrar,
  motivoDelError,
  notaAMano,
  senalError,
  senalOk,
  tablaDeItems,
  unidades,
} from './ui.js';

const CLAVE_PALLET_ABIERTO = claveLocal('pallet-abierto');
const CLAVE_RESPONSABLE = claveLocal('responsable');
const CLAVE_RECHAZADOS = claveLocal('pallets-rechazados');
const CLAVE_MODO_CAMARA = claveLocal('modo-camara');
const CLAVE_MODO_CARGA = claveLocal('modo-carga');
const DURACION_VERDE_MS = 1200;
const ESPERA_ENTRE_QUITAS_MS = 400;
const ESPERA_ENTRE_TOQUES_DE_LEER_MS = 400;
const TIEMPO_PARA_LEER_MS = 8000;
const ESPERA_PARA_PEDIR_QUE_SE_ACERQUE_MS = 2000;
const ESPERA_EN_MODO_RAPIDO_MS = 2000;
const MAXIMO_CAJAS_A_MANO = 999;
const ALTO_BARRA_INFERIOR = 100;
const DIAS_DE_MARGEN_EN_LA_FECHA = 31;
const ESPERA_PARA_SUBIR_MS = 3000;
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

// Modo Código + cantidad: cada lectura no suma, solo dice de qué producto son las cajas, y la
// cantidad se escribe en una ventana. Queda elegido en el dispositivo, como el de la cámara.
let modoCantidad = localStorage.getItem(CLAVE_MODO_CARGA) === 'cantidad';
// El producto de la ventana de cantidad abierta.
let productoDeCantidad = null;

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
const botonCargaCajas = document.getElementById('btn-carga-cajas');
const botonCargaCantidad = document.getElementById('btn-carga-cantidad');
const dialogoCantidad = document.getElementById('dialogo-cantidad');
const formularioCantidad = document.getElementById('form-cantidad');
const campoCajas = document.getElementById('cantidad-cajas');
const campoCajasPorFila = document.getElementById('cantidad-por-fila');
const campoFilas = document.getElementById('cantidad-filas');
const ayudaCantidad = document.getElementById('cantidad-ayuda');
const cuentaDeCantidad = document.getElementById('cantidad-cuenta');
const avisoEnVentana = document.getElementById('cantidad-aviso');
const botonSumarCantidad = document.getElementById('btn-sumar-cantidad');
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

// Las lecturas de antes de que existiera la U.V no traen envase: eran contenedoras.
const esUV = (lectura) => lectura.envase === 'uv';

// Arma la guía para volver a controlar las cajas cargadas a mano: "8 × 5" son 5 filas de 8
// cajas, "40" es un total escrito de una vez, y "− 1" dice que después se quitó una. Las U.V
// lo aclaran. Un conteo de una versión anterior no guardó las filas: queda como una fila.
function detalleDeBloques(bloques) {
  return [...bloques.values()].map(({ quedan, cajasPorFila, filas, cantidad, uv }) => {
    let [texto, total] = [`${quedan} × 1`, quedan];
    if (cajasPorFila) [texto, total] = [`${cajasPorFila} × ${filas}`, cajasPorFila * filas];
    else if (cantidad) [texto, total] = [String(cantidad), cantidad];
    const quitadas = total - quedan;
    return `${texto}${quitadas > 0 ? ` − ${quitadas}` : ''}${uv ? ' U.V' : ''}`;
  }).join(' + ');
}

// Convierte las lecturas, una por caja, en una fila por producto: las contenedoras y las U.V del
// mismo código interno van juntas, con cajas y unidades de cada envase. Si se editó el producto
// con el pallet abierto y cambiaron las unidades de un envase, las cajas de después van en otra
// fila: si no, cajas por unidades por caja no daría el total. indices dice qué lecturas son de
// cada fila, y detalleFilas, cuáles se cargaron a mano.
function agruparPorProducto(lecturas) {
  const grupos = [];
  lecturas.forEach((lectura, indice) => {
    const unidadesDelEnvase = esUV(lectura) ? 'unidadesUV' : 'unidadesCont';
    let grupo = grupos.find((g) => g.codigoInterno === lectura.codigoInterno && g.descripcion === lectura.descripcion
      && (g[unidadesDelEnvase] === null || g[unidadesDelEnvase] === lectura.unidadesPorCaja));
    if (!grupo) {
      grupo = {
        codigoInterno: lectura.codigoInterno,
        descripcion: lectura.descripcion,
        cajas: 0,
        cajasCont: 0,
        cajasUV: 0,
        unidadesCont: null,
        unidadesUV: null,
        unidades: 0,
        maximoCont: 0,
        maximoUV: 0,
        indices: [],
        bloques: new Map(),
      };
      grupos.push(grupo);
    }
    grupo[unidadesDelEnvase] = lectura.unidadesPorCaja;
    grupo.cajas += 1;
    grupo.unidades += lectura.unidadesPorCaja;
    grupo.indices.push(indice);
    if (esUV(lectura)) {
      grupo.cajasUV += 1;
      grupo.maximoUV = lectura.cajasPorPallet ?? 0;
    } else {
      grupo.cajasCont += 1;
      grupo.maximoCont = lectura.cajasPorPallet ?? 0;
    }
    if (lectura.bloque) {
      const { cajasPorFila, filas, cantidad } = lectura;
      const datos = grupo.bloques.get(lectura.bloque) ?? { cajasPorFila, filas, cantidad, uv: esUV(lectura), quedan: 0 };
      datos.quedan += 1;
      grupo.bloques.set(lectura.bloque, datos);
    }
  });
  return grupos.map(({ bloques, ...grupo }) => ({ ...grupo, detalleFilas: detalleDeBloques(bloques) }));
}

// Lo que se guarda de cada fila al cerrar el pallet: sin los datos que solo usa esta pantalla.
const itemsParaGuardar = (items) => items.map(({ indices, maximoCont, maximoUV, ...item }) => item);

// Dice si las cajas de un envase pasan las que entran en un pallet completo. Sin ese dato en
// Productos no avisa. soloEnvase: mirar solo ese envase, el de la caja recién escaneada.
// Devuelve el texto del aviso, o vacío.
function avisoDeMaximo(item, soloEnvase = '') {
  const pasadas = [
    [item.cajasCont, item.maximoCont, 'contenedoras', 'contenedora'],
    [item.cajasUV, item.maximoUV, 'cajas U.V', 'uv'],
  ].find(([cantidad, maximo, , envase]) => maximo > 0 && cantidad > maximo && (!soloEnvase || soloEnvase === envase));
  if (!pasadas) return '';
  const [cantidad, maximo, nombre] = pasadas;
  return `Son ${cantidad} ${nombre} y en un pallet completo entran ${maximo}.`;
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
  } else if (modoCantidad) {
    mostrarEnTablero('espera', 'Escaneá una caja del producto', 'Después escribís cuántas cajas son.');
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

// Deja el formulario listo con fecha de hoy, número automático y el responsable: quien entró,
// o en modo prueba el último que se escribió. Se puede cambiar igual.
function prepararApertura() {
  numeroEscritoAMano = false;
  fechaSugerida = fechaDeHoy();
  campoFecha.value = fechaSugerida;
  campoResponsable.value = usuario.nombre || (localStorage.getItem(CLAVE_RESPONSABLE) ?? '');
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

// "3 cajas" si son todas contenedoras, o "3 Cont. y 2 U.V" si hay de las dos.
function textoDeCajas(item) {
  if (item.cajasUV === 0) return cajas(item.cajasCont);
  if (item.cajasCont === 0) return `${item.cajasUV} U.V`;
  return `${item.cajasCont} Cont. y ${item.cajasUV} U.V`;
}

// Arma la fila de un producto en la lista, con su botón -1, que saca su última caja.
function filaItem(item) {
  const pasado = avisoDeMaximo(item);
  return crear('li', { class: 'item' },
    crear('div', { class: 'fila-datos' },
      crear('strong', { class: 'codigo' }, item.codigoInterno),
      crear('span', {}, item.descripcion),
      notaAMano(item),
      pasado ? crear('span', { class: 'item-pasado' }, pasado) : ''),
    crear('button', {
      type: 'button',
      class: 'boton boton-secundario item-quitar',
      'aria-label': `Quitar la última caja de ${item.codigoInterno}`,
      alHacerClic: () => quitarUnaCaja(item),
    }, '−1'),
    crear('p', { class: 'item-cantidades' },
      crear('span', {}, textoDeCajas(item)),
      crear('span', {}, unidades(item.unidades))));
}

// Dibuja la pantalla según el pallet: el formulario si no hay ninguno abierto, y si hay,
// tablero, lista y botones. El texto de la última lectura lo pone mostrarEnTablero.
function pintarPantalla() {
  vistaApertura.hidden = pallet !== null;
  vistaEscaneo.hidden = pallet === null;
  if (!pallet) return;

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
    // Solo el supervisor carga productos: los demás ven a quién pedírselo.
    rechazarLectura('No se sumó: código desconocido', esSupervisor() ? codigo : `${codigo}. Pedile al supervisor que lo cargue.`);
    codigoDesconocido = codigo;
    botonAgregarCodigo.hidden = !esSupervisor();
    return;
  }

  if (!producto.codigoInterno || !producto.unidadesPorCaja) {
    rechazarLectura('No se sumó', `${producto.codigoInterno || codigo}: faltan datos en Productos.`);
    return;
  }
  if (modoCantidad) {
    abrirDialogoDeCantidad(producto);
    return;
  }
  pallet.lecturas.push(lecturaDe(producto));
  guardarPalletAbierto();
  pintarPantalla();
  // La caja se sumó igual. Si con ella se pasa de un pallet completo, el aviso va en el tablero.
  const item = agruparPorProducto(pallet.lecturas).find((i) => i.indices.includes(pallet.lecturas.length - 1));
  const titulo = `${producto.codigoInterno}${producto.envase === 'uv' ? ' U.V' : ''} sumada`;
  mostrarEnTablero('ok', titulo, avisoDeMaximo(item, esUV(producto) ? 'uv' : 'contenedora') || producto.descripcion);
  senalOk();
}

// Guardamos una copia de los datos del producto en cada caja: si después se edita el producto,
// el pallet no cambia. extra: cómo se cargó a mano, si fue así.
const lecturaDe = (producto, extra = {}) => ({
  codigoInterno: producto.codigoInterno,
  codigoBarras: producto.codigoBarras,
  descripcion: producto.descripcion,
  envase: producto.envase,
  unidadesPorCaja: producto.unidadesPorCaja,
  cajasPorPallet: producto.cajasPorPallet,
  ...extra,
});

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

// Saca la última caja leída, sea del producto que sea. Si fue una carga a mano la saca entera,
// después de preguntar: un número mal escrito se corrige de una sola vez.
async function deshacerUltimoEscaneo() {
  if (esToqueRepetido()) return;
  const lectura = pallet.lecturas.at(-1);
  if (!lectura) return;
  if (lectura.bloque) {
    await deshacerCargaAMano(lectura);
    return;
  }
  pallet.lecturas.pop();
  guardarPalletAbierto();
  pintarPantalla();
  mostrarEnTablero('espera', `Se deshizo una caja${esUV(lectura) ? ' U.V' : ''}`, lectura.codigoInterno);
}

// Saca todas las cajas que se cargaron juntas en la ventana de cantidad.
async function deshacerCargaAMano({ bloque, codigoInterno }) {
  const cantidad = pallet.lecturas.filter((lectura) => lectura.bloque === bloque).length;
  const deshacer = await confirmar({
    titulo: '¿Deshacer la carga a mano?',
    detalle: `Se saca todo junto: ${cajas(cantidad)} de ${codigoInterno}.`,
    si: 'Deshacer',
    no: 'Dejarlo',
    peligro: true,
  });
  if (!deshacer || !pallet) return;
  pallet.lecturas = pallet.lecturas.filter((lectura) => lectura.bloque !== bloque);
  guardarPalletAbierto();
  pintarPantalla();
  mostrarEnTablero('espera', 'Se deshizo la carga a mano', `${codigoInterno}: ${cajas(cantidad)}`);
}

// Saca la última caja de una fila de la lista (botón -1), sea contenedora o U.V.
function quitarUnaCaja(item) {
  if (esToqueRepetido()) return;
  const lectura = pallet.lecturas[item.indices.at(-1)];
  pallet.lecturas.splice(item.indices.at(-1), 1);
  guardarPalletAbierto();
  pintarPantalla();
  mostrarEnTablero('espera', `Se quitó una caja${esUV(lectura) ? ' U.V' : ''}`, item.codigoInterno);
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
      ...items.filter(avisoDeMaximo).map((item) => crear('p', { class: 'mensaje-error' }, `${item.codigoInterno}: ${avisoDeMaximo(item)}`)),
      crear('p', { class: 'resumen-total' }, `Total: ${cajas(totalCajas)} y ${unidades(totalUnidades)}`)),
    si: 'Guardar y cerrar',
    no: 'Seguir escaneando',
  });
  // pallet puede ser null: otra pestaña pudo haberlo cerrado con esta pregunta abierta.
  if (!guardar || !pallet) return;

  const palletCerrado = pallet;
  const numero = numeroParaCerrar();
  const totales = `${cajas(totalCajas)} y ${unidades(totalUnidades)}`;

  // Con señal la base contesta enseguida. Si no contestó a tiempo, el pallet quedó guardado en el
  // celular y Firestore lo sube solo cuando vuelve la señal: ahí sale el aviso verde.
  const avisoSinSenal = setTimeout(() => {
    avisar(`Pallet ${numero} guardado en el celular. Se carga en el sistema cuando vuelva la señal.`);
  }, ESPERA_PARA_SUBIR_MS);

  guardarPallet({
    numero,
    fecha: pallet.fecha,
    responsable: pallet.responsable,
    cerradoEn: new Date().toISOString(),
    totalCajas,
    totalUnidades,
    items: itemsParaGuardar(items),
  }).then(() => {
    clearTimeout(avisoSinSenal);
    avisar(`✓ Pallet ${numero} cargado en sistema: ${totales}`, 'ok');
  }, (error) => {
    clearTimeout(avisoSinSenal);
    // Si Firebase lo rechaza, las cajas vuelven a la pantalla en vez de perderse.
    guardarRechazados([...leerRechazados(), { ...palletCerrado, numero }]);
    const cuando = pallet ? 'van a volver cuando termines este pallet' : 'volvieron a la pantalla';
    devolverPalletRechazado();
    avisar(`El pallet ${numero} no se guardó y sus cajas ${cuando}. ${motivoDelError(error)}`, 'error');
  });

  terminarPallet();
  avisar(`Pallet ${numero} cerrado: ${totales}`);
}

// El pallet que se está armando, para no cambiar de usuario con uno abierto. null si no hay.
export const palletAbierto = () => (pallet ? { numero: pallet.numero, cajas: pallet.lecturas.length } : null);

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

// Muestra el modo de carga elegido.
function pintarModoDeCarga() {
  botonCargaCajas.setAttribute('aria-pressed', String(!modoCantidad));
  botonCargaCantidad.setAttribute('aria-pressed', String(modoCantidad));
}

// Cambia el modo de carga y lo deja guardado en el dispositivo.
function elegirModoDeCarga(cantidad) {
  modoCantidad = cantidad;
  localStorage.setItem(CLAVE_MODO_CARGA, cantidad ? 'cantidad' : 'cajas');
  pintarModoDeCarga();
  if (pallet) mostrarEstadoDelPallet();
  enfocarLector();
}

// Abre la ventana para escribir cuántas cajas de ese producto se suman. Si en Productos dice
// cuántas cajas van en cada fila del pallet, ya viene puesto: solo falta escribir las filas.
function abrirDialogoDeCantidad(producto) {
  productoDeCantidad = producto;
  document.getElementById('cantidad-producto').textContent = `${producto.codigoInterno}: ${producto.descripcion}`;
  document.getElementById('cantidad-envase').textContent =
    `${NOMBRE_ENVASE[producto.envase]} de ${unidades(producto.unidadesPorCaja)}`;
  ayudaCantidad.textContent = producto.cajasPorFila
    ? `O contalas por filas. En un pallet completo van ${producto.cajasPorFila} cajas por fila y hasta ${producto.filasPorPallet} filas:`
    : 'O contalas por filas, por ejemplo las del medio del pallet:';
  campoCajas.value = '';
  campoCajasPorFila.value = producto.cajasPorFila || '';
  campoFilas.value = '';
  pintarCuentaDeCantidad();
  dialogoCantidad.showModal();
  (producto.cajasPorFila ? campoFilas : campoCajas).focus();
}

// Devuelve el número escrito en ese campo, o 0 si no es un entero mayor que cero.
const enteroDelCampo = (campo) => (/^[1-9]\d*$/.test(campo.value) ? Number(campo.value) : 0);

// Lo que se escribió en la ventana: el total, o las filas si se usaron.
// Devuelve { total, cajasPorFila, filas }; sin filas, esos dos quedan en 0.
function cantidadEscrita() {
  const porFilas = campoCajasPorFila.value !== '' || campoFilas.value !== '';
  if (!porFilas) return { total: enteroDelCampo(campoCajas), cajasPorFila: 0, filas: 0 };
  const cajasPorFila = enteroDelCampo(campoCajasPorFila);
  const filas = enteroDelCampo(campoFilas);
  return { total: cajasPorFila * filas, cajasPorFila, filas };
}

// Avisa si se escribieron más filas de las que entran en un pallet completo, o si con las que
// se suman el pallet tendría más cajas de ese producto y envase que uno completo. No frena:
// solo avisa. filas es 0 si se escribió el total. Devuelve el texto del aviso, o vacío.
function avisoDeCantidad(producto, total, filas = 0) {
  if (filas && producto.filasPorPallet && filas > producto.filasPorPallet) {
    return `Son ${filas} filas, y en un pallet completo de ${producto.codigoInterno} entran ${producto.filasPorPallet}.`;
  }
  const maximo = producto.cajasPorPallet;
  if (!maximo) return '';
  const yaHay = pallet.lecturas.filter((l) => l.codigoInterno === producto.codigoInterno
    && esUV(l) === (producto.envase === 'uv')).length;
  if (yaHay + total <= maximo) return '';
  const nombre = producto.envase === 'uv' ? 'cajas U.V' : 'contenedoras';
  return `Con estas, el pallet tendría ${yaHay + total} ${nombre} de ${producto.codigoInterno}, y en un pallet completo entran ${maximo}.`;
}

// Muestra la cuenta mientras se escribe. El tope frena una lectura de la pistola que cayó acá.
function pintarCuentaDeCantidad() {
  const { total, cajasPorFila, filas } = cantidadEscrita();
  const valida = total > 0 && total <= MAXIMO_CAJAS_A_MANO;
  botonSumarCantidad.disabled = !valida;
  botonSumarCantidad.textContent = valida ? `Sumar ${cajas(total)}` : 'Sumar';
  const aviso = valida ? avisoDeCantidad(productoDeCantidad, total, filas) : '';
  avisoEnVentana.hidden = !aviso;
  avisoEnVentana.textContent = aviso;
  if (valida) {
    const filasEscritas = cajasPorFila ? `${cajasPorFila} × ${filas} = ` : '';
    cuentaDeCantidad.textContent = `${filasEscritas}${cajas(total)}, ${unidades(total * productoDeCantidad.unidadesPorCaja)}`;
  } else if (total > MAXIMO_CAJAS_A_MANO) {
    cuentaDeCantidad.textContent = `Son más de ${MAXIMO_CAJAS_A_MANO} cajas: revisá los números.`;
  } else if (campoCajasPorFila.value && !campoFilas.value) {
    cuentaDeCantidad.textContent = 'Escribí cuántas filas son.';
  } else {
    cuentaDeCantidad.textContent = campoCajasPorFila.value || campoFilas.value
      ? 'Escribí cajas por fila y filas.'
      : 'Escribí cuántas cajas son.';
  }
}

// El total y las filas son dos maneras de decir lo mismo: al escribir en una se borra la otra.
// Si se escribió el total y después se vuelve a las filas, vuelven las cajas por fila de Productos.
function alEscribirCantidad(evento) {
  if (evento.target === campoCajas) {
    campoCajasPorFila.value = '';
    campoFilas.value = '';
  } else {
    campoCajas.value = '';
    if (evento.target === campoFilas && campoCajasPorFila.value === '' && productoDeCantidad.cajasPorFila) {
      campoCajasPorFila.value = productoDeCantidad.cajasPorFila;
    }
  }
  pintarCuentaDeCantidad();
}

// Antes de sumar pregunta "¿Confirmás 40 cajas = 24.000 unidades?". Corregir vuelve a la
// ventana con lo escrito. Con la cámara abierta, al sumar va al resumen para revisar la cuenta.
async function sumarCantidad(evento) {
  evento.preventDefault();
  if (botonSumarCantidad.disabled || !pallet) return;
  const producto = productoDeCantidad;
  const { total, cajasPorFila, filas } = cantidadEscrita();
  const totalDeUnidades = unidades(total * producto.unidadesPorCaja);
  const aviso = avisoDeCantidad(producto, total, filas);
  dialogoCantidad.close();
  const confirmada = await confirmar({
    titulo: `¿Confirmás ${cajas(total)} = ${totalDeUnidades}?`,
    detalle: `${producto.codigoInterno}: ${producto.descripcion}, ${NOMBRE_ENVASE[producto.envase]} de ${unidades(producto.unidadesPorCaja)}.${aviso ? ` ${aviso}` : ''}`,
    si: 'Sí, sumar',
    no: 'Corregir',
  });
  // pallet puede ser null: otra pestaña pudo haberlo cerrado con esta pregunta abierta.
  if (!pallet) return;
  if (!confirmada) {
    productoDeCantidad = producto;
    dialogoCantidad.showModal();
    pintarCuentaDeCantidad();
    return;
  }
  // bloque identifica las cajas sumadas juntas, para poder deshacerlas de una vez.
  const bloque = Date.now();
  const comoSeCargo = cajasPorFila ? { bloque, cajasPorFila, filas } : { bloque, cantidad: total };
  for (let i = 0; i < total; i += 1) pallet.lecturas.push(lecturaDe(producto, comoSeCargo));
  guardarPalletAbierto();
  pintarPantalla();
  const envase = producto.envase === 'uv' ? ' U.V' : '';
  mostrarEnTablero('ok', `${cajas(total)}${envase} de ${producto.codigoInterno}`, aviso || totalDeUnidades);
  senalOk();
  if (camaraEncendida) cerrarLaCamaraYVerResumen().catch(console.error);
}

// Con la pistola, el Enter del final de una lectura no suma nada. Así, una lectura que caiga
// en esta ventana no carga cajas: Cajas por fila pasa a Filas, y los demás avisan.
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
  botonLeer.classList.replace('boton-naranja', 'boton-marcha');
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
  botonLeer.classList.replace('boton-marcha', 'boton-naranja');
  mostrarEnTablero('espera', 'Apuntá al código de barras');
}

// La cámara llama a esta función con cada código que ve. Con Tocar para leer solo cuenta si hay
// una lectura pedida. En modo rápido cuenta sola, y la misma caja vuelve a contar a los 2
// segundos aunque no haya salido de la vista: es lo que avisa el cartel de ese modo. En el modo
// Código + cantidad lee sola, porque leer no suma: abre la ventana para escribir la cantidad.
function alVerCodigoConLaCamara(codigo) {
  const ahora = performance.now();
  ultimaVezQueVioUnCodigo = ahora;
  cartelAcercarse.hidden = true;
  if (!visible || document.querySelector('dialog[open]')) return;
  if (!modoRapido && temporizadorLeer === null && !modoCantidad) return;

  const caja = buscarProducto(codigo)?.codigoInterno ?? codigo;
  const esperando = caja === ultimaCajaContada && ahora - momentoDeLaUltimaCaja < ESPERA_EN_MODO_RAPIDO_MS;
  if ((modoRapido || modoCantidad) && esperando) return;

  ultimaCajaContada = caja;
  momentoDeLaUltimaCaja = ahora;
  terminarLectura();
  procesarCodigo(codigo);
}

// La distancia no se puede medir: si la cámara está buscando un código y hace rato que no ve
// ninguno, lo más probable es que esté lejos.
function alNoVerCodigoConLaCamara() {
  const buscandoCodigo = modoRapido || temporizadorLeer !== null || modoCantidad;
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
  if (temporizadorLeer !== null && pallet) mostrarEstadoDelPallet();
  terminarLectura();
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
  dialogoCantidad.close();
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
  botonCargaCajas.addEventListener('click', () => elegirModoDeCarga(false));
  botonCargaCantidad.addEventListener('click', () => elegirModoDeCarga(true));
  pintarModoDeCarga();
  formularioCantidad.addEventListener('submit', sumarCantidad);
  formularioCantidad.addEventListener('input', alEscribirCantidad);
  formularioCantidad.addEventListener('keydown', noSumarConEnter);
  document.getElementById('btn-cancelar-cantidad').addEventListener('click', () => dialogoCantidad.close());
  // Con la cámara, la caja que dijo el producto no tiene que volver a abrir la ventana apenas
  // se cierra, ni contarse sola si se cambia a modo rápido.
  dialogoCantidad.addEventListener('close', () => {
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
