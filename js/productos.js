// La tabla de productos: cómo se busca un producto por su código y la pantalla "Productos".
import { borrarProducto, escucharProductos, guardarProducto } from './datos.js';
import { productosDePrueba } from './datos-prueba.js';
import {
  avisar,
  avisarErrorDeDatos,
  confirmar,
  crear,
  senalError,
  unidades,
} from './ui.js';

let productos = [];
let cargados = false;
let productoEnEdicion = null;
let alGuardarFormulario = null;

const lista = document.getElementById('lista-productos');
const buscador = document.getElementById('buscar-producto');
const botonCargarPrueba = document.getElementById('btn-cargar-prueba');
const dialogo = document.getElementById('dialogo-producto');
const formulario = document.getElementById('form-producto');
const campoBarras = document.getElementById('campo-barras');
const campoInterno = document.getElementById('campo-interno');
const campoDescripcion = document.getElementById('campo-descripcion');
const campoUnidades = document.getElementById('campo-unidades');
const camposEnOrden = [campoBarras, campoInterno, campoDescripcion, campoUnidades];
const mensajeFormulario = document.getElementById('mensaje-formulario');

export const productosCargados = () => cargados;

export function normalizarCodigo(texto) {
  return String(texto ?? '').trim().toUpperCase();
}

// Algunas pistolas agregan o sacan ceros adelante de un código numérico (0779... y 779...).
// Para comparar, los ignoramos.
function claveDeBusqueda(codigo) {
  const normalizado = normalizarCodigo(codigo);
  return /^\d+$/.test(normalizado) ? normalizado.replace(/^0+/, '') : normalizado;
}

function tieneElCodigo(producto, clave) {
  return claveDeBusqueda(producto.codigoInterno) === clave
    || claveDeBusqueda(producto.codigoBarras) === clave;
}

// Busca por los dos códigos, porque todavía no sabemos cuál traen las cajas.
export function buscarProducto(codigo) {
  const clave = claveDeBusqueda(codigo);
  return clave ? productos.find((producto) => tieneElCodigo(producto, clave)) : undefined;
}

function productoQueYaUsa(codigo, idPropio) {
  const clave = claveDeBusqueda(codigo);
  if (!clave) return undefined;
  return productos.find((p) => p.id !== idPropio && tieneElCodigo(p, clave));
}

function abrirFormulario(producto) {
  productoEnEdicion = producto.id ? producto : null;
  document.getElementById('titulo-formulario').textContent =
    productoEnEdicion ? 'Editar producto' : 'Agregar producto';
  campoBarras.value = producto.codigoBarras ?? '';
  campoInterno.value = producto.codigoInterno ?? '';
  campoDescripcion.value = producto.descripcion ?? '';
  campoUnidades.value = producto.unidadesPorCaja ?? '';
  mensajeFormulario.hidden = true;
  dialogo.showModal();
  // Deja el cursor en el primer campo que falta completar.
  camposEnOrden.find((campo) => !campo.value)?.focus();
}

// Se usa cuando se escanea una caja que no está en la tabla: el formulario se abre con el
// código ya puesto en el campo que corresponde.
export function agregarProductoConCodigo(codigo, alGuardar) {
  alGuardarFormulario = alGuardar;
  const pareceCodigoDeBarras = /^(\d{8}|\d{12,14})$/.test(codigo);
  abrirFormulario(pareceCodigoDeBarras ? { codigoBarras: codigo } : { codigoInterno: codigo });
}

function mostrarErrorDeFormulario(mensaje) {
  mensajeFormulario.textContent = mensaje;
  mensajeFormulario.hidden = false;
}

function guardarFormulario(evento) {
  evento.preventDefault();
  const id = productoEnEdicion?.id;
  const datos = {
    codigoBarras: normalizarCodigo(campoBarras.value),
    codigoInterno: normalizarCodigo(campoInterno.value),
    descripcion: campoDescripcion.value.trim(),
    unidadesPorCaja: Number(campoUnidades.value),
  };

  // required acepta un campo con solo espacios, y recién acá quedan vacíos.
  if (!datos.codigoInterno || !datos.descripcion) {
    mostrarErrorDeFormulario('Faltan el código interno o la descripción.');
    return;
  }

  // Dos productos con el mismo código harían que la búsqueda elija cualquiera de los dos.
  const repetido = productoQueYaUsa(datos.codigoInterno, id) ?? productoQueYaUsa(datos.codigoBarras, id);
  if (repetido) {
    mostrarErrorDeFormulario(`Ese código ya lo usa ${repetido.codigoInterno}: ${repetido.descripcion}.`);
    return;
  }

  guardarProducto(id ? { ...datos, id } : datos).catch(avisarErrorDeDatos);
  dialogo.close();
  if (alGuardarFormulario) alGuardarFormulario();
  else avisar(`${datos.codigoInterno} guardado`);
}

async function eliminar(producto) {
  const borrar = await confirmar({
    titulo: `¿Borrar ${producto.codigoInterno}?`,
    detalle: `${producto.descripcion}. Los pallets ya cerrados no cambian.`,
    si: 'Borrar producto',
    peligro: true,
  });
  if (borrar) borrarProducto(producto.id).catch(avisarErrorDeDatos);
}

function filaProducto(producto) {
  return crear('li', { class: 'fila-producto' },
    crear('div', { class: 'fila-datos' },
      crear('strong', { class: 'codigo' }, producto.codigoInterno),
      crear('span', {}, producto.descripcion),
      crear('span', {}, `${unidades(producto.unidadesPorCaja)} por caja`),
      crear('span', { class: 'dato-suave' },
        producto.codigoBarras ? `Código de barras ${producto.codigoBarras}` : 'Sin código de barras')),
    crear('div', { class: 'fila-botones' },
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
      }, 'Borrar')));
}

function pintarLista() {
  const filtro = buscador.value.trim().toUpperCase();
  const visibles = productos
    .filter((p) => `${p.codigoInterno} ${p.codigoBarras} ${p.descripcion}`.toUpperCase().includes(filtro))
    .sort((a, b) => a.codigoInterno.localeCompare(b.codigoInterno));

  lista.replaceChildren(...visibles.map(filaProducto));
  if (visibles.length === 0) {
    const mensaje = filtro ? 'Ningún producto coincide con esa búsqueda.' : 'Todavía no hay productos.';
    lista.append(crear('li', { class: 'vacio' }, mensaje));
  }
  botonCargarPrueba.hidden = productos.length > 0;
}

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
  const siguiente = camposEnOrden[camposEnOrden.indexOf(evento.target) + 1];
  if (siguiente) siguiente.focus();
  else senalError();
}

export function iniciarProductos() {
  escucharProductos((listaNueva) => {
    productos = listaNueva;
    cargados = true;
    pintarLista();
  }, avisarErrorDeDatos);

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
  document.getElementById('btn-cancelar-producto').addEventListener('click', () => dialogo.close());
  formulario.addEventListener('submit', guardarFormulario);
  formulario.addEventListener('keydown', pasarAlCampoSiguiente);
}
