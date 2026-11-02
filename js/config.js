// Datos de conexión a tu proyecto de Firebase. Es el único archivo que tenés que tocar
// para conectar la app (los pasos están en README.md).
//
// Mientras "projectId" esté vacío, la app funciona en MODO PRUEBA: guarda todo en este
// navegador, sin internet ni Firebase.
//
// Estos datos NO son secretos: Firebase está pensado para que vayan en el frontend, y lo
// que protege la base son las reglas de firestore.rules. Es distinto de la API key de
// Claude, que esa sí nunca va acá.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};
