// Inicio de sesión. Solo existe con Firebase: en modo prueba no hay usuarios y se puede todo.
//
// Cada persona tiene un usuario y una contraseña, que se crean en la consola de Firebase.
// La primera vez que entra, la app le pide el nombre, que sale como responsable de sus pallets.
// El rol "supervisor" (o "administrador", que es lo mismo) se pone a mano en la consola: es el
// único que puede cambiar productos, borrar pallets e importar la COOIS. Si cambia el rol, la app
// se vuelve a cargar sola en unos segundos.
import {
  modoPrueba,
  escucharSesion,
  entrar,
  salir,
  escucharUsuario,
  guardarNombre,
} from './datos.js';
import { avisarErrorDeDatos, confirmar } from './ui.js';

// Los usuarios no necesitan un mail real: en Firebase se crean como juan@pallets.local, y para
// entrar alcanza con escribir "juan". Un correo completo también sirve.
const DOMINIO_DE_USUARIOS = 'pallets.local';

// Quien entró. En modo prueba no hay nadie, con permiso para todo.
export const usuario = { uid: null, nombre: '', rol: modoPrueba ? 'supervisor' : '' };

// Roles con permiso para todo. firestore.rules tiene la misma lista: si cambia una, cambiar la otra.
const ROLES_DE_SUPERVISOR = ['supervisor', 'administrador'];

// El rol se escribe a mano en la consola, y un espacio de más o una mayúscula no se notan:
// "Supervisor " vale como "supervisor". Las reglas de la base hacen lo mismo.
const rolLimpio = (rol) => (typeof rol === 'string' ? rol.trim().toLowerCase() : '');

export const esSupervisor = () => ROLES_DE_SUPERVISOR.includes(usuario.rol);

const pantallaIngreso = document.getElementById('pantalla-ingreso');
const formularioIngreso = document.getElementById('form-ingreso');
const campoUsuario = document.getElementById('ingreso-usuario');
const campoContrasena = document.getElementById('ingreso-contrasena');
const mensajeIngreso = document.getElementById('mensaje-ingreso');
const botonEntrar = document.getElementById('btn-entrar');
const formularioNombre = document.getElementById('form-nombre');
const campoNombre = document.getElementById('ingreso-nombre');

const correoDe = (texto) => {
  const limpio = texto.trim().toLowerCase();
  return limpio.includes('@') ? limpio : `${limpio}@${DOMINIO_DE_USUARIOS}`;
};

// Traduce el error de Firebase a algo que se entienda.
function motivoDelIngreso(error) {
  const codigo = error?.code ?? '';
  if (codigo === 'auth/invalid-credential' || codigo === 'auth/invalid-email'
    || codigo === 'auth/user-not-found' || codigo === 'auth/wrong-password') {
    return 'Usuario o contraseña incorrectos.';
  }
  if (codigo === 'auth/network-request-failed') return 'No hay internet. Para entrar hace falta conexión.';
  if (codigo === 'auth/too-many-requests') return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
  if (codigo === 'auth/user-disabled') return 'Ese usuario está desactivado.';
  console.error(error);
  return 'No se pudo entrar. Probá de nuevo.';
}

// Muestra la pantalla de ingreso con uno de sus dos formularios, y esconde todo lo demás.
function mostrarIngreso(formulario) {
  document.body.classList.add('sin-sesion');
  document.querySelectorAll('.pantalla').forEach((seccion) => {
    seccion.hidden = seccion !== pantallaIngreso;
  });
  formularioIngreso.hidden = formulario !== formularioIngreso;
  formularioNombre.hidden = formulario !== formularioNombre;
  formulario.querySelector('input').focus();
}

async function enviarIngreso(evento) {
  evento.preventDefault();
  mensajeIngreso.hidden = true;
  botonEntrar.disabled = true;
  try {
    // No es Firestore: sin internet esta promesa falla enseguida, no queda esperando.
    await entrar(correoDe(campoUsuario.value), campoContrasena.value);
    campoContrasena.value = '';
  } catch (error) {
    mensajeIngreso.textContent = motivoDelIngreso(error);
    mensajeIngreso.hidden = false;
  }
  botonEntrar.disabled = false;
}

function enviarNombre(evento) {
  evento.preventDefault();
  const nombre = campoNombre.value.trim();
  if (!nombre) return;
  // Sin await: sin señal no terminaría nunca. Firestore avisa el cambio enseguida igual.
  guardarNombre(usuario.uid, nombre).catch(avisarErrorDeDatos);
}

// Pregunta antes de salir: volver a entrar pide usuario, contraseña e internet.
async function preguntarSiSale() {
  const sale = await confirmar({
    titulo: '¿Salir?',
    detalle: 'Para volver a entrar hacen falta tu usuario, tu contraseña e internet. Si cerraste pallets sin señal, salí recién cuando vuelva la señal.',
    si: 'Salir',
  });
  if (!sale) return;
  await salir();
  // Volver a cargar deja la app como recién abierta, sin nada del usuario anterior.
  window.location.reload();
}

// Muestra quién entró al final de Productos, con el botón para salir.
function mostrarUsuarioActual() {
  document.getElementById('sesion-actual').hidden = false;
  document.getElementById('sesion-nombre').textContent = esSupervisor()
    ? `Entraste como ${usuario.nombre}, ${usuario.rol}.`
    : `Entraste como ${usuario.nombre}.`;
  document.getElementById('btn-salir').addEventListener('click', preguntarSiSale);
}

// Espera a que alguien haya entrado y tenga nombre. En modo prueba termina enseguida.
// Mientras tanto, muestra la pantalla de ingreso.
export function iniciarSesion() {
  if (modoPrueba) return Promise.resolve();
  formularioIngreso.addEventListener('submit', enviarIngreso);
  formularioNombre.addEventListener('submit', enviarNombre);

  return new Promise((listo) => {
    let dejarDeEscucharUsuario = null;
    let yaEntro = false;
    escucharSesion((cuenta) => {
      if (yaEntro) {
        // Salió desde otra pestaña: esta también vuelve al ingreso.
        if (!cuenta) window.location.reload();
        return;
      }
      dejarDeEscucharUsuario?.();
      if (!cuenta) {
        mostrarIngreso(formularioIngreso);
        return;
      }
      usuario.uid = cuenta.uid;
      dejarDeEscucharUsuario = escucharUsuario(cuenta.uid, (datos) => {
        // La primera lectura viene de la copia guardada en el dispositivo, que puede ser vieja.
        // Si después la base trae otro rol (se cambió en la consola), se vuelve a cargar la app
        // para que muestre los botones que corresponden.
        if (yaEntro) {
          if (rolLimpio(datos.rol) !== usuario.rol) window.location.reload();
          return;
        }
        if (!datos.nombre) {
          mostrarIngreso(formularioNombre);
          return;
        }
        yaEntro = true;
        usuario.nombre = datos.nombre;
        usuario.rol = rolLimpio(datos.rol);
        // Vuelve a la pantalla de arranque, la de Escanear.
        document.body.classList.remove('sin-sesion');
        pantallaIngreso.hidden = true;
        document.getElementById('pantalla-escaneo').hidden = false;
        mostrarUsuarioActual();
        listo();
      }, avisarErrorDeDatos);
    });
  });
}
