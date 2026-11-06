// Modo prueba: guarda los datos en el navegador (localStorage), solo en este dispositivo.
// Tiene las mismas funciones que datos-firebase.js.
import { productosDePrueba } from './datos-prueba.js';

// No usa claveLocal() de datos.js: este archivo se carga desde ahí, y se esperarían el uno al
// otro. Es lo mismo, porque este archivo solo existe en modo prueba.
const CLAVE_PRODUCTOS = 'registro-pallets.prueba.productos';
const CLAVE_PALLETS = 'registro-pallets.prueba.pallets';
const CLAVE_ORDENES = 'registro-pallets.prueba.ordenes';
const CLAVE_IMPORTACION = 'registro-pallets.prueba.importacion-coois';

// Funciones que hay que volver a llamar cuando cambian los datos.
const oyentes = new Set();
// Les avisa a todas las pantallas que están escuchando.
const avisarCambio = () => oyentes.forEach((avisar) => avisar());

// Lee una lista guardada. Si todavía no existe, devuelve una lista vacía.
const leer = (clave) => JSON.parse(localStorage.getItem(clave) ?? '[]');

// Guarda una lista y avisa del cambio.
function escribir(clave, lista) {
  localStorage.setItem(clave, JSON.stringify(lista));
  avisarCambio();
}

// Hace lo mismo que onSnapshot de Firestore: llama ahora y cada vez que algo cambie.
// Devuelve una función para dejar de escuchar.
function escuchar(obtenerLista, alCambiar) {
  // Vuelve a leer la lista y se la pasa a quien está escuchando.
  const avisar = () => alCambiar(obtenerLista());
  oyentes.add(avisar);
  avisar();
  return () => oyentes.delete(avisar);
}

// Si la app está abierta en otra pestaña, también se entera de los cambios.
window.addEventListener('storage', avisarCambio);

// Genera un id único, como los que crea Firestore.
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// La primera vez que se abre la app ya están los productos de prueba, para probar rápido.
// Si después se borran todos, no vuelven solos: la lista vacía ya no es null.
if (localStorage.getItem(CLAVE_PRODUCTOS) === null) {
  localStorage.setItem(CLAVE_PRODUCTOS, JSON.stringify(
    productosDePrueba.map((producto) => ({ ...producto, id: nuevoId() })),
  ));
}

// Llama a alCambiar ahora y con cada cambio de productos. Devuelve la función para dejar de escuchar.
export function escucharProductos(alCambiar) {
  return escuchar(() => leer(CLAVE_PRODUCTOS), alCambiar);
}

// Crea el producto o reemplaza el que tenga el mismo id. Estas funciones son async para
// devolver una promesa, igual que las de Firestore.
export async function guardarProducto(producto) {
  const lista = leer(CLAVE_PRODUCTOS).filter((p) => p.id !== producto.id);
  lista.push({ ...producto, id: producto.id ?? nuevoId() });
  escribir(CLAVE_PRODUCTOS, lista);
}

// Borra un producto de la tabla.
export async function borrarProducto(id) {
  escribir(CLAVE_PRODUCTOS, leer(CLAVE_PRODUCTOS).filter((p) => p.id !== id));
}

// Igual que escucharProductos, para los pallets cerrados de una fecha ("2026-11-01").
export function escucharPallets(fecha, alCambiar) {
  return escuchar(() => leer(CLAVE_PALLETS).filter((p) => p.fecha === fecha), alCambiar);
}

// Agrega un pallet cerrado con un id nuevo.
export async function guardarPallet(pallet) {
  escribir(CLAVE_PALLETS, [...leer(CLAVE_PALLETS), { ...pallet, id: nuevoId() }]);
}

// Borra un pallet cerrado.
export async function borrarPallet(id) {
  escribir(CLAVE_PALLETS, leer(CLAVE_PALLETS).filter((p) => p.id !== id));
}

// Igual que en Firebase: { ordenes, importacion } de la última COOIS importada.
// En modo prueba arranca vacía, para probar la importación.
export function escucharCoois(alCambiar) {
  return escuchar(() => ({
    ordenes: leer(CLAVE_ORDENES),
    importacion: JSON.parse(localStorage.getItem(CLAVE_IMPORTACION) ?? 'null'),
  }), alCambiar);
}

// Las órdenes nuevas reemplazan a todas las anteriores. idsAnteriores no hace falta acá: está
// para tener las mismas funciones que Firebase.
export async function reemplazarOrdenes(idsAnteriores, ordenes, importacion) {
  localStorage.setItem(CLAVE_IMPORTACION, JSON.stringify(importacion));
  escribir(CLAVE_ORDENES, ordenes.map((orden) => ({ ...orden, id: String(orden.numero) })));
}
