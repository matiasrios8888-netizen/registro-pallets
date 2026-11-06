// Puerta de entrada a los datos. El resto de la app importa siempre desde acá y no sabe
// si atrás hay Firebase o el navegador: los dos archivos tienen las mismas funciones.
import { firebaseConfig } from './config.js';

// Con ?prueba al final de la dirección, la página publicada también abre en modo prueba: sirve
// para probar con datos inventados sin tocar la base real. En la app de Android no hay dirección
// para escribir, así que ahí no pasa.
export const modoPrueba = !firebaseConfig.projectId
  || new URLSearchParams(window.location.search).has('prueba');

// Nombre con el que algo se guarda en este dispositivo. En modo prueba es otro, para que un
// pallet de prueba nunca aparezca en la app conectada a la base, ni al revés.
export const claveLocal = (nombre) => `registro-pallets.${modoPrueba ? 'prueba.' : ''}${nombre}`;

let base;
try {
  base = await import(modoPrueba ? './datos-local.js' : './datos-firebase.js');
} catch (error) {
  // Pasa si se abre la app sin internet y no puede bajar Firebase.
  document.getElementById('error-arranque').hidden = false;
  throw error;
}

export const {
  escucharProductos,
  guardarProducto,
  borrarProducto,
  escucharPallets,
  guardarPallet,
  borrarPallet,
  // Solo con Firebase: en modo prueba no hay usuarios y quedan sin definir.
  escucharSesion,
  entrar,
  salir,
  escucharUsuario,
  guardarNombre,
} = base;
