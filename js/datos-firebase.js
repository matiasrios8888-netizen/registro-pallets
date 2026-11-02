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

const aLista = (resultado) => resultado.docs.map((d) => ({ ...d.data(), id: d.id }));

export function escucharProductos(alCambiar, alFallar) {
  return onSnapshot(collection(db, 'productos'), (r) => alCambiar(aLista(r)), alFallar);
}

export function guardarProducto({ id, ...datos }) {
  const referencia = id ? doc(db, 'productos', id) : doc(collection(db, 'productos'));
  return setDoc(referencia, datos);
}

export function borrarProducto(id) {
  return deleteDoc(doc(db, 'productos', id));
}

export function escucharPallets(fecha, alCambiar, alFallar) {
  const palletsDelDia = query(collection(db, 'pallets'), where('fecha', '==', fecha));
  return onSnapshot(palletsDelDia, (r) => alCambiar(aLista(r)), alFallar);
}

export function guardarPallet(pallet) {
  return setDoc(doc(collection(db, 'pallets')), pallet);
}

export function borrarPallet(id) {
  return deleteDoc(doc(db, 'pallets', id));
}
