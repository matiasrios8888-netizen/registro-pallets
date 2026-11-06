// La tabla de productos: cómo se busca un producto por su código y la pantalla "Productos".
import { borrarProducto, escucharProductos, guardarProducto, modoPrueba } from './datos.js';
import { productosDePrueba } from './datos-prueba.js';
import { apagarCamara, encenderCamara, mensajeDeCamara, motivoSinCamara } from './lector.js';
import { esSupervisor } from './sesion.js';
import {
  NOMBRE_ENVASE,
  avisar,
  avisarErrorDeDatos,
  cajas,
  confirmar,
  crear,
  motivoDelError,
  senalError,
  senalOk,
  unidades,
} from './ui.js';

// Cada fila de la tabla es un código de barras, y cada código es un envase del producto (ver
// NOMBRE_ENVASE). Los topes frenan una lectura de la pistola que cayó en el campo equivocado.
const UNIDADES_POR_CAJA_MAXIMAS = 100000;
const CAJAS_POR_PALLET_MAXIMAS = 9999;

let productos = [];
let cargados = false;
let errorDeCarga = null;
let productoEnEdicion = null;
let alGuardarFormulario = null;

// La cámara del formulario está prendida, o arrancando, mientras esto valga true.
let leyendo = false;
let anchoDeLaLectura = 0;
// Se pidió la cámara mientras terminaba de arrancar una que ya se había cancelado.
let volverAEncender = false;

const lista = document.getElementById('lista-productos');
const buscador = document.getElementById('buscar-producto');
const botonCargarPrueba = document.getElementById('btn-cargar-prueba');
const dialogo = document.getElementById('dialogo-producto');
const formulario = document.getElementById('form-producto');
const campoBarras = document.getElementById('campo-barras');
const campoInterno = document.getElementById('campo-interno');
const campoDescripcion = document.getElementById('campo-descripcion');
const campoUnidades = document.getElementById('campo-unidades');
const campoCajasPorPallet = document.getElementById('campo-cajas-por-pallet');
const camposEnOrden = [campoBarras, campoInterno, campoDescripcion, campoUnidades, campoCajasPorPallet];
const mensajeFormulario = document.getElementById('mensaje-formulario');
const botonLeerBarras = document.getElementById('btn-leer-barras');
const marcoLeerBarras = document.getElementById('marco-leer-barras');

// Dice si ya llegó la tabla de productos. Antes de eso no se puede buscar.
export const productosCargados = () => cargados;

// Devuelve el error de la carga, o null si no hubo.
export const errorAlCargarProductos = () => errorDeCarga;

// Deja un código sin espacios alrededor y en mayúsculas.
export function normalizarCodigo(texto) {
  return String(texto ?? '').trim().toUpperCase();
}

// Number() sola aceptaría -5, 2,5 o "Infinity", y "1.200" lo leería como 1,2.
// Devuelve el entero, o 0 si no sirve o pasa el máximo.
function enteroValido(valor, maximo) {
  const texto = String(valor ?? '').trim();
  const numero = /^\d+$/.test(texto) ? Number(texto) : 0;
  return numero <= maximo ? numero : 0;
}

// En la base va 'contenedora' o 'uv'. Uno cargado a mano en la consola puede decir "U.V" o "UV",
// y los que se cargaron antes de que existiera el envase no traen nada: son contenedoras.
function envaseValido(valor) {
  return /^u\.?\s*v\.?$/i.test(String(valor ?? '').trim()) ? 'uv' : 'contenedora';
}

// En las etiquetas reales, hasta ahora, el código de la contenedora empieza con 2 y el de la U.V
// con 1. Solo sirve para dejar marcada una opción en el formulario: se ve y se puede cambiar.
const envaseSegunCodigo = (codigo) => (/^1\d{13}$/.test(codigo) ? 'uv' : 'contenedora');

// Un producto cargado a mano desde la consola de Firebase puede traer campos que faltan o
// números guardados como texto. Acá todos quedan con la misma forma.
const productoCompleto = (producto) => ({
  ...producto,
  codigoBarras: String(producto.codigoBarras ?? ''),
  codigoInterno: String(producto.codigoInterno ?? ''),
  descripcion: String(producto.descripcion ?? ''),
  envase: envaseValido(producto.envase),
  unidadesPorCaja: enteroValido(producto.unidadesPorCaja, UNIDADES_POR_CAJA_MAXIMAS),
  // Cuántas cajas de este envase llenan un pallet. 0 si no se sabe: entonces no avisa nada.
  cajasPorPallet: enteroValido(producto.cajasPorPallet, CAJAS_POR_PALLET_MAXIMAS),
});

// Algunas pistolas agregan o sacan ceros adelante de un código numérico (0779... y 779...).
// Para comparar, los ignoramos.
function claveDeBusqueda(codigo) {
  const normalizado = normalizarCodigo(codigo);
  return /^\d+$/.test(normalizado) ? normalizado.replace(/^0+/, '') : normalizado;
}

// Busca primero por código de barras, que es de una sola fila. Si se escribió el código interno,
// que comparten la contenedora y la U.V, devuelve la contenedora: es la caja que se cuenta.
// Devuelve el producto, o undefined si no está.
export function buscarProducto(codigo) {
  const clave = claveDeBusqueda(codigo);
  if (!clave) return undefined;
  const conEseInterno = productos.filter((p) => claveDeBusqueda(p.codigoInterno) === clave);
  return productos.find((p) => claveDeBusqueda(p.codigoBarras) === clave)
    ?? conEseInterno.find((p) => p.envase === 'contenedora')
    ?? conEseInterno[0];
}

// Busca otra fila que choque con estos datos. idPropio evita encontrarse a sí misma al editar.
// Un código de barras va en una sola fila, y no puede ser el código interno de nadie. El código
// interno se repite en la contenedora y la U.V de un producto, pero no hay dos contenedoras ni
// dos U.V del mismo producto: no se sabría cuántas unidades trae.
function filaQueChoca({ codigoBarras = '', codigoInterno = '', envase }, idPropio) {
  const barras = claveDeBusqueda(codigoBarras);
  const interno = claveDeBusqueda(codigoInterno);
  return productos.find((p) => p.id !== idPropio && (
    (barras && (claveDeBusqueda(p.codigoBarras) === barras || claveDeBusqueda(p.codigoInterno) === barras))
    || (interno && claveDeBusqueda(p.codigoBarras) === interno)
    || (interno && claveDeBusqueda(p.codigoInterno) === interno && p.envase === envase)));
}

// Así se nombra una fila en los avisos: "KD0324 U.V".
const nombreDeFila = (producto) => `${producto.codigoInterno} ${NOMBRE_ENVASE[producto.envase]}`;

// Explica con qué fila choca lo que se quiso guardar.
function avisoDeRepetido(fila, datos) {
  if (claveDeBusqueda(fila.codigoInterno) === claveDeBusqueda(datos.codigoInterno) && fila.envase === datos.envase) {
    return `${nombreDeFila(fila)} ya está cargado, con el código ${fila.codigoBarras || 'sin código de barras'}. Para cambiarlo, editá esa fila.`;
  }
  return `Ese código ya lo usa ${nombreDeFila(fila)}: ${fila.descripcion}.`;
}

// Abre el formulario con esos datos. Si el producto trae id es una edición; si no, uno nuevo.
function abrirFormulario(producto) {
  productoEnEdicion = producto.id ? producto : null;
  document.getElementById('titulo-formulario').textContent =
    productoEnEdicion ? 'Editar producto' : 'Agregar producto';
  campoBarras.value = producto.codigoBarras ?? '';
  campoInterno.value = producto.codigoInterno ?? '';
  campoDescripcion.value = producto.descripcion ?? '';
  formulario.elements.envase.value = producto.envase ?? envaseSegunCodigo(campoBarras.value);
  campoUnidades.value = producto.unidadesPorCaja ?? '';
  campoCajasPorPallet.value = producto.cajasPorPallet || '';
  mensajeFormulario.hidden = true;
  // Desde Escanear el código ya vino leído, y la cámara de esa pantalla puede seguir prendida.
  botonLeerBarras.hidden = Boolean(alGuardarFormulario);
  dialogo.showModal();
  enfocarCampoQueFalta();
}

// Deja el cursor en el primer campo que falta completar.
function enfocarCampoQueFalta() {
  camposEnOrden.find((campo) => !campo.value)?.focus();
}

// Se usa cuando se escanea una caja que no está en la tabla: el formulario se abre con el
// código ya puesto en el campo que corresponde.
// alGuardar se llama después de guardar.
export function agregarProductoConCodigo(codigo, alGuardar) {
  alGuardarFormulario = alGuardar;
  const pareceCodigoDeBarras = /^(\d{8}|\d{12,14})$/.test(codigo);
  abrirFormulario(pareceCodigoDeBarras ? { codigoBarras: codigo } : { codigoInterno: codigo });
}

// Muestra un mensaje en rojo y deja el formulario abierto.
function mostrarErrorDeFormulario(mensaje) {
  mensajeFormulario.textContent = mensaje;
  mensajeFormulario.hidden = false;
}

// Apaga la cámara del formulario y deja el botón como al principio.
function apagarLectura() {
  leyendo = false;
  botonLeerBarras.textContent = 'Leer con la cámara';
  marcoLeerBarras.hidden = true;
  return apagarCamara().catch(console.error);
}

// La cámara ve el código varias veces por segundo. Al apagarla, la primera vez es la única que
// llega acá. El código de barras solo trae el número: lo demás se escribe mirando la etiqueta.
function alLeerCodigoDeBarras(codigo) {
  apagarLectura();
  campoBarras.value = normalizarCodigo(codigo);
  sugerirEnvase();
  const datos = { codigoBarras: campoBarras.value };
  const repetido = filaQueChoca(datos, productoEnEdicion?.id);
  if (repetido) {
    senalError();
    mostrarErrorDeFormulario(avisoDeRepetido(repetido, datos));
    return;
  }
  senalOk();
  enfocarCampoQueFalta();
}

// En un producto nuevo, marca el envase que suele llevar ese código. Al editar no lo toca: ya
// lo eligió alguien.
function sugerirEnvase() {
  if (!productoEnEdicion) formulario.elements.envase.value = envaseSegunCodigo(normalizarCodigo(campoBarras.value));
}

// Al cargar el segundo código de un producto que ya está, completa la descripción con la que
// ya tiene, si todavía no se escribió otra.
function completarDescripcion() {
  const interno = claveDeBusqueda(campoInterno.value);
  const mismoProducto = productos.find((p) => claveDeBusqueda(p.codigoInterno) === interno);
  if (interno && mismoProducto && !campoDescripcion.value.trim()) campoDescripcion.value = mismoProducto.descripcion;
}

// Prende la cámara adentro del formulario. Si no puede, se sigue cargando a mano.
async function encenderLectura() {
  // Todavía está arrancando la anterior. Si esa ya se canceló, porque se cerró el formulario y se
  // volvió a abrir enseguida, se vuelve a encender apenas termine de arrancar y se apague.
  if (botonLeerBarras.disabled) {
    if (!leyendo) volverAEncender = true;
    return;
  }
  const motivo = motivoSinCamara();
  if (motivo) {
    mostrarErrorDeFormulario(motivo);
    return;
  }
  mensajeFormulario.hidden = true;
  leyendo = true;
  botonLeerBarras.disabled = true;
  botonLeerBarras.textContent = 'Cerrar cámara';
  marcoLeerBarras.hidden = false;
  // Saca el cursor del campo: el teclado del celular taparía el video.
  campoBarras.blur();
  marcoLeerBarras.scrollIntoView({ block: 'nearest' });
  try {
    await encenderCamara('camara-producto', alLeerCodigoDeBarras, () => {});
    anchoDeLaLectura = document.documentElement.clientWidth;
  } catch (error) {
    console.error(error);
    apagarLectura();
    mostrarErrorDeFormulario(mensajeDeCamara(error));
    enfocarCampoQueFalta();
  }
  botonLeerBarras.disabled = false;
  // Si mientras arrancaba se cerró el formulario, nadie más la apaga.
  if (!leyendo) {
    await apagarCamara().catch(console.error);
    if (volverAEncender) {
      volverAEncender = false;
      encenderLectura();
    }
  }
}

// html5-qrcode fija el ancho del video al encender. Si se gira el celular hay que reiniciarla:
// si no, el video queda del ancho viejo y el recuadro de lectura queda corrido.
async function reiniciarLecturaSiCambioElAncho() {
  if (!leyendo || botonLeerBarras.disabled) return;
  if (document.documentElement.clientWidth === anchoDeLaLectura) return;
  await apagarLectura();
  await encenderLectura();
}

// Abre el formulario vacío con la cámara prendida, para no tener que escribir el código.
function escanearProductoNuevo() {
  alGuardarFormulario = null;
  abrirFormulario({});
  encenderLectura();
}

// Valida el formulario y guarda el producto.
function guardarFormulario(evento) {
  evento.preventDefault();
  const id = productoEnEdicion?.id;
  const datos = {
    codigoBarras: normalizarCodigo(campoBarras.value),
    codigoInterno: normalizarCodigo(campoInterno.value),
    descripcion: campoDescripcion.value.trim(),
    envase: formulario.elements.envase.value,
    unidadesPorCaja: Number(campoUnidades.value),
  };
  // Es optativo: si queda vacío no se guarda, y al cargar un pallet no se avisa si se pasa.
  const cajasPorPallet = Number(campoCajasPorPallet.value);
  if (cajasPorPallet > 0) datos.cajasPorPallet = cajasPorPallet;

  // required acepta un campo con solo espacios, y recién acá quedan vacíos.
  if (!datos.codigoInterno || !datos.descripcion) {
    mostrarErrorDeFormulario('Faltan el código interno o la descripción.');
    return;
  }

  const repetido = filaQueChoca(datos, id);
  if (repetido) {
    mostrarErrorDeFormulario(avisoDeRepetido(repetido, datos));
    return;
  }

  guardarProducto(id ? { ...datos, id } : datos).catch(avisarErrorDeDatos);
  dialogo.close();
  if (alGuardarFormulario) alGuardarFormulario();
  else avisar(`${nombreDeFila(datos)} guardado`);
}

// Borra una fila, después de preguntar.
async function eliminar(producto) {
  const borrar = await confirmar({
    titulo: `¿Borrar ${nombreDeFila(producto)}?`,
    detalle: `${producto.descripcion}. Los pallets ya cerrados no cambian.`,
    si: 'Borrar producto',
    peligro: true,
  });
  if (borrar) borrarProducto(producto.id).catch(avisarErrorDeDatos);
}

// Arma la fila de un código de barras. Los botones Editar y Borrar son solo para el supervisor.
function filaProducto(producto) {
  return crear('li', { class: 'fila-producto' },
    crear('div', { class: 'fila-datos' },
      crear('strong', { class: 'codigo' }, producto.codigoInterno),
      crear('span', {}, producto.descripcion),
      crear('span', { class: 'dato-envase' }, `${NOMBRE_ENVASE[producto.envase]} de ${unidades(producto.unidadesPorCaja)}`),
      producto.cajasPorPallet ? crear('span', {}, `Pallet completo: ${cajas(producto.cajasPorPallet)}`) : '',
      crear('span', { class: 'dato-suave' },
        producto.codigoBarras ? `Código de barras ${producto.codigoBarras}` : 'Sin código de barras')),
    esSupervisor() ? crear('div', { class: 'fila-botones' },
      crear('button', {
        type: 'button',
        class: 'boton boton-secundario',
        alHacerClic: () => {
          alGuardarFormulario = null;
          abrirFormulario(producto);
        },
      }, 'Editar'),
      crear('button', {
        type: 'button',
        class: 'boton boton-secundario',
        alHacerClic: () => eliminar(producto),
      }, 'Borrar')) : '');
}

// Dibuja la lista aplicando el texto de Buscar. Ordena por código interno, y en cada producto
// va primero la contenedora: así sus dos códigos quedan juntos.
function pintarLista() {
  const filtro = buscador.value.trim().toUpperCase();
  const visibles = productos
    .filter((p) => `${p.codigoInterno} ${p.codigoBarras} ${p.descripcion} ${NOMBRE_ENVASE[p.envase]}`
      .toUpperCase().includes(filtro))
    .sort((a, b) => a.codigoInterno.localeCompare(b.codigoInterno)
      || (a.envase === 'uv') - (b.envase === 'uv'));

  lista.replaceChildren(...visibles.map(filaProducto));
  if (visibles.length === 0) {
    const mensaje = filtro ? 'Ningún producto coincide con esa búsqueda.' : 'Todavía no hay productos.';
    lista.append(crear('li', { class: 'vacio' }, mensaje));
  }
  // Con Firebase la base es la de verdad: ahí no van productos inventados.
  botonCargarPrueba.hidden = !modoPrueba || productos.length > 0;
}

// Guarda los productos de prueba en la base: 4 productos, con 2 códigos cada uno.
function cargarProductosDePrueba() {
  productosDePrueba.forEach((producto) => guardarProducto(producto).catch(avisarErrorDeDatos));
  avisar('Productos de prueba cargados');
}

// Con la pistola, el Enter del final del código pasa al campo siguiente en vez de guardar.
// Así se puede escanear una caja adentro del formulario sin que se guarde a medias. Tampoco
// guarda en el último campo: seguir escaneando no puede guardar un producto mal cargado.
function pasarAlCampoSiguiente(evento) {
  if (evento.key !== 'Enter' || !evento.target.matches('input')) return;
  evento.preventDefault();
  const posicion = camposEnOrden.indexOf(evento.target);
  // En las opciones de envase no se escribe: si la lectura cayó ahí, se perdió.
  const siguiente = posicion === -1 ? undefined : camposEnOrden[posicion + 1];
  if (siguiente) siguiente.focus();
  else senalError();
}

// Si la tabla no carga, lo avisa y muestra el motivo en la lista.
function alFallarLaCarga(error) {
  errorDeCarga = error;
  avisarErrorDeDatos(error);
  lista.replaceChildren(crear('li', { class: 'vacio' }, motivoDelError(error)));
}

// Empieza a seguir la tabla y conecta los botones. Se llama una sola vez, al arrancar la app.
export function iniciarProductos() {
  // Solo el supervisor carga y cambia productos: los demás ven la lista, nada más.
  document.getElementById('btn-escanear-producto').hidden = !esSupervisor();
  document.getElementById('btn-nuevo-producto').hidden = !esSupervisor();
  // La hoja de códigos está en la página web, no adentro de la app de Android.
  document.getElementById('enlace-codigos-prueba').hidden = !modoPrueba || Boolean(window.Capacitor?.isNativePlatform());

  escucharProductos((listaNueva) => {
    productos = listaNueva.map(productoCompleto);
    cargados = true;
    errorDeCarga = null;
    pintarLista();
  }, alFallarLaCarga);

  buscador.addEventListener('input', pintarLista);
  // Con la pistola: el texto queda seleccionado y la lectura siguiente lo reemplaza.
  buscador.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') buscador.select();
  });
  botonCargarPrueba.addEventListener('click', cargarProductosDePrueba);
  document.getElementById('btn-nuevo-producto').addEventListener('click', () => {
    alGuardarFormulario = null;
    abrirFormulario({});
  });
  document.getElementById('btn-escanear-producto').addEventListener('click', escanearProductoNuevo);
  botonLeerBarras.addEventListener('click', () => (leyendo ? apagarLectura() : encenderLectura()));
  document.getElementById('btn-cancelar-producto').addEventListener('click', () => dialogo.close());
  formulario.addEventListener('submit', guardarFormulario);
  formulario.addEventListener('keydown', pasarAlCampoSiguiente);
  campoBarras.addEventListener('change', sugerirEnvase);
  campoInterno.addEventListener('change', completarDescripcion);
  // Sale por cualquier lado (Guardar, Cancelar, tecla Atrás): la cámara no puede quedar prendida.
  // Sin leyendo apagaría la de la pantalla Escanear, que sigue abierta atrás del formulario.
  dialogo.addEventListener('close', () => {
    volverAEncender = false;
    if (leyendo) apagarLectura();
  });
  window.addEventListener('resize', reiniciarLecturaSiCambioElAncho);
}
