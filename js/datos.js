// Puerta de entrada a los datos. El resto de la app importa siempre desde acá y no sabe
// si atrás hay Firebase o el navegador: los dos archivos tienen las mismas funciones.
import { firebaseConfig } from './config.js';

export const modoPrueba = !firebaseConfig.projectId;

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
} = base;
