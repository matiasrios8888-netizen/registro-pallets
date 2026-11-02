// Guarda los datos en Firestore. Tiene las mismas funciones que datos-local.js.
//
// Firestore guarda primero en el dispositivo y sube a internet cuando hay señal. Por eso las
// funciones de guardar devuelven una promesa que, sin señal, no termina hasta que vuelve la
// conexión: hay que usar .catch() y nunca await, o la pantalla queda trabada esperando.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  query,
  where,
  onSnapshot,
  setDoc,
  deleteDoc,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { firebaseConfig } from './config.js';

const app = initializeApp(firebaseConfig);

// persistentLocalCache es lo que permite seguir trabajando si se corta el wifi en planta.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// Convierte un resultado de Firestore en una lista común, con el id de cada documento.
const aLista = (resultado) => resultado.docs.map((d) => ({ ...d.data(), id: d.id }));

// Llama a alCambiar ahora y cada vez que cambia la tabla de productos, con la lista completa.
// alFallar recibe el error si Firebase no deja leer. Devuelve la función para dejar de escuchar.
export function escucharProductos(alCambiar, alFallar) {
  return onSnapshot(collection(db, 'productos'), (r) => alCambiar(aLista(r)), alFallar);
}

// Con id reemplaza ese producto; sin id crea uno nuevo.
export function guardarProducto({ id, ...datos }) {
  const referencia = id ? doc(db, 'productos', id) : doc(collection(db, 'productos'));
  return setDoc(referencia, datos);
}

// Borra un producto de la tabla. Los pallets cerrados guardan su propia copia y no cambian.
export function borrarProducto(id) {
  return deleteDoc(doc(db, 'productos', id));
}

// Igual que escucharProductos, para los pallets cerrados de una fecha ("2026-11-01").
export function escucharPallets(fecha, alCambiar, alFallar) {
  const palletsDelDia = query(collection(db, 'pallets'), where('fecha', '==', fecha));
  return onSnapshot(palletsDelDia, (r) => alCambiar(aLista(r)), alFallar);
}

// async: si un dato es inválido, setDoc falla en el momento y no con la promesa. Así ese
// error también llega al .catch de quien guarda.
// Crea un documento nuevo con el pallet cerrado.
export async function guardarPallet(pallet) {
  return setDoc(doc(collection(db, 'pallets')), pallet);
}

// Borra un pallet cerrado. No se puede recuperar.
export function borrarPallet(id) {
  return deleteDoc(doc(db, 'pallets', id));
}
