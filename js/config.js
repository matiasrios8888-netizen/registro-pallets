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
  apiKey: 'AIzaSyAq8hlHhDB1e1vixbtsbre3K6dKw19_6Rw',
  authDomain: 'registro-de-palets.firebaseapp.com',
  projectId: 'registro-de-palets',
  storageBucket: 'registro-de-palets.firebasestorage.app',
  messagingSenderId: '578750266079',
  appId: '1:578750266079:web:378ed2252f02e642b1076a',
};
