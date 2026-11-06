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
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { firebaseConfig } from './config.js';

const app = initializeApp(firebaseConfig);

// persistentLocalCache es lo que permite seguir trabajando si se corta el wifi en planta.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// La sesión queda guardada en el dispositivo: se entra una sola vez. initializeAuth en vez de
// getAuth porque getAuth carga una ventana de Google para entrar con cuenta de Google, que no se
// usa y en la app de Android no anda.
const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });

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
// Crea un documento nuevo con el pallet cerrado. creadoPor dice qué usuario lo cerró: las
// reglas de la base no aceptan un pallet a nombre de otro.
export async function guardarPallet(pallet) {
  return setDoc(doc(collection(db, 'pallets')), { ...pallet, creadoPor: auth.currentUser.uid });
}

// Borra un pallet cerrado. No se puede recuperar.
export function borrarPallet(id) {
  return deleteDoc(doc(db, 'pallets', id));
}

// Las órdenes de producción de la última COOIS importada. Llama a alCambiar con
// { ordenes, importacion }: la lista de órdenes y los datos de la importación (archivo, fecha y
// quién la hizo), o null si todavía no se importó ninguna.
export function escucharCoois(alCambiar, alFallar) {
  let ordenes = null;
  let importacion;
  const avisar = () => {
    if (ordenes !== null && importacion !== undefined) alCambiar({ ordenes, importacion });
  };
  const dejarOrdenes = onSnapshot(collection(db, 'ordenes'), (r) => {
    ordenes = aLista(r);
    avisar();
  }, alFallar);
  const dejarImportacion = onSnapshot(doc(db, 'coois', 'ultima'), (d) => {
    importacion = d.data() ?? null;
    avisar();
  }, alFallar);
  return () => {
    dejarOrdenes();
    dejarImportacion();
  };
}

// El número de orden es el nombre del documento: importar de nuevo la misma orden la reemplaza.
// Firestore no acepta "/" en ese nombre.
const idDeOrden = (numero) => String(numero).replaceAll('/', '-');

// Cada escritura de un lote le pregunta a las reglas si quien importa es supervisor, y Firestore
// acepta pocas preguntas así por lote. Con lotes chicos nunca se pasa.
const ESCRITURAS_POR_LOTE = 10;

// Reemplaza las órdenes por las de una COOIS nueva: guarda las nuevas, borra las que ya no están
// (idsAnteriores) y anota la importación. Sin señal la promesa no termina: usar .catch(), no await.
export function reemplazarOrdenes(idsAnteriores, ordenes, importacion) {
  const operaciones = [];
  const nuevas = new Set(ordenes.map((orden) => idDeOrden(orden.numero)));
  for (const id of idsAnteriores) {
    if (!nuevas.has(id)) operaciones.push((lote) => lote.delete(doc(db, 'ordenes', id)));
  }
  for (const orden of ordenes) {
    operaciones.push((lote) => lote.set(doc(db, 'ordenes', idDeOrden(orden.numero)), orden));
  }
  operaciones.push((lote) => lote.set(doc(db, 'coois', 'ultima'), importacion));

  const envios = [];
  for (let i = 0; i < operaciones.length; i += ESCRITURAS_POR_LOTE) {
    const lote = writeBatch(db);
    operaciones.slice(i, i + ESCRITURAS_POR_LOTE).forEach((operacion) => operacion(lote));
    envios.push(lote.commit());
  }
  return Promise.all(envios);
}

// Inicio de sesión: estas funciones existen solo acá, en modo prueba no hay usuarios.

// Llama a alCambiar ahora y cada vez que alguien entra o sale: con { uid } o con null.
export function escucharSesion(alCambiar) {
  return onAuthStateChanged(auth, (cuenta) => alCambiar(cuenta && { uid: cuenta.uid }));
}

// Entra con correo y contraseña. Falla si están mal o si no hay internet.
export function entrar(correo, contrasena) {
  return signInWithEmailAndPassword(auth, correo, contrasena);
}

export function salir() {
  return signOut(auth);
}

// Llama a alCambiar con los datos del usuario ({ nombre, rol }), o con {} si todavía no
// guardó su nombre.
export function escucharUsuario(uid, alCambiar, alFallar) {
  return onSnapshot(doc(db, 'usuarios', uid), (d) => alCambiar(d.data() ?? {}), alFallar);
}

// merge: true cambia solo el nombre y deja el rol como está.
export function guardarNombre(uid, nombre) {
  return setDoc(doc(db, 'usuarios', uid), { nombre }, { merge: true });
}
