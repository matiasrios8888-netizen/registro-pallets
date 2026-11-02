// Modo prueba: guarda los datos en el navegador (localStorage), solo en este dispositivo.
// Tiene las mismas funciones que datos-firebase.js.
import { productosDePrueba } from './datos-prueba.js';

const CLAVE_PRODUCTOS = 'registro-pallets.v2.productos';
const CLAVE_PALLETS = 'registro-pallets.v2.pallets';

// Funciones que hay que volver a llamar cuando cambian los datos.
const oyentes = new Set();
const avisarCambio = () => oyentes.forEach((avisar) => avisar());

const leer = (clave) => JSON.parse(localStorage.getItem(clave) ?? '[]');

function escribir(clave, lista) {
  localStorage.setItem(clave, JSON.stringify(lista));
  avisarCambio();
}

// Hace lo mismo que onSnapshot de Firestore: llama ahora y cada vez que algo cambie.
// Devuelve una función para dejar de escuchar.
function escuchar(obtenerLista, alCambiar) {
  const avisar = () => alCambiar(obtenerLista());
  oyentes.add(avisar);
  avisar();
  return () => oyentes.delete(avisar);
}

// Si la app está abierta en otra pestaña, también se entera de los cambios.
window.addEventListener('storage', avisarCambio);

const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// La primera vez que se abre la app ya están los productos de prueba, para probar rápido.
// Si después se borran todos, no vuelven solos: la lista vacía ya no es null.
if (localStorage.getItem(CLAVE_PRODUCTOS) === null) {
  localStorage.setItem(CLAVE_PRODUCTOS, JSON.stringify(
    productosDePrueba.map((producto) => ({ ...producto, id: nuevoId() })),
  ));
}

export function escucharProductos(alCambiar) {
  return escuchar(() => leer(CLAVE_PRODUCTOS), alCambiar);
}

export async function guardarProducto(producto) {
  const lista = leer(CLAVE_PRODUCTOS).filter((p) => p.id !== producto.id);
  lista.push({ ...producto, id: producto.id ?? nuevoId() });
  escribir(CLAVE_PRODUCTOS, lista);
}

export async function borrarProducto(id) {
  escribir(CLAVE_PRODUCTOS, leer(CLAVE_PRODUCTOS).filter((p) => p.id !== id));
}

export function escucharPallets(fecha, alCambiar) {
  return escuchar(() => leer(CLAVE_PALLETS).filter((p) => p.fecha === fecha), alCambiar);
}

export async function guardarPallet(pallet) {
  escribir(CLAVE_PALLETS, [...leer(CLAVE_PALLETS), { ...pallet, id: nuevoId() }]);
}

export async function borrarPallet(id) {
  escribir(CLAVE_PALLETS, leer(CLAVE_PALLETS).filter((p) => p.id !== id));
}
