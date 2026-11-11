// Inicio de sesión. Solo existe con Firebase: en modo prueba no hay usuarios y se puede todo.
//
// Cada persona tiene un usuario y una contraseña, que se crean en la consola de Firebase.
// La primera vez que entra, la app le pide el nombre, que sale como responsable de sus pallets.
// El rol "supervisor" (o "administrador", que es lo mismo) se pone a mano en la consola: es el
// único que puede cambiar productos, borrar pallets e importar la COOIS. Si cambia el rol, la app
// se vuelve a cargar sola en unos segundos.
import {
  modoPrueba,
  claveLocal,
  escucharSesion,
  entrar,
  salir,
  esperarSubida,
  escucharUsuario,
  guardarNombre,
} from './datos.js';
import { avisar, avisarErrorDeDatos, cajas, confirmar, crear } from './ui.js';

// Los usuarios no necesitan un mail real: en Firebase se crean como juan@pallets.local, y para
// entrar alcanza con escribir "juan". Un correo completo también sirve.
const DOMINIO_DE_USUARIOS = 'pallets.local';

// Los últimos que entraron en este dispositivo, para elegirlos con un toque: [{ usuario, nombre }].
// Nunca se guarda la contraseña.
const CLAVE_RECIENTES = claveLocal('usuarios-recientes');
const MAXIMO_DE_RECIENTES = 6;

// Cuánto espera a que suba lo pendiente antes de avisar que falta subir algo.
const ESPERA_PARA_SUBIR_MS = 3000;

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
const recientes = document.getElementById('usuarios-recientes');
const botonesRecientes = document.getElementById('botones-recientes');
const botonCambiarUsuario = document.getElementById('btn-cambiar-usuario');

const correoDe = (texto) => {
  const limpio = texto.trim().toLowerCase();
  return limpio.includes('@') ? limpio : `${limpio}@${DOMINIO_DE_USUARIOS}`;
};

// Lo contrario: de "juan@pallets.local" a "juan", que es lo que se escribe para entrar.
const usuarioDe = (correo) => correo.replace(new RegExp(`@${DOMINIO_DE_USUARIOS.replace('.', '\\.')}$`), '');

function leerRecientes() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? '[]');
    return Array.isArray(lista) ? lista.filter((r) => typeof r?.usuario === 'string' && r.usuario) : [];
  } catch {
    return [];
  }
}

// Pone a quien acaba de entrar primero en la lista de recientes.
function recordarUsuario(nombreDeUsuario, nombre) {
  if (!nombreDeUsuario) return;
  const lista = [{ usuario: nombreDeUsuario, nombre }, ...leerRecientes().filter((r) => r.usuario !== nombreDeUsuario)];
  localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista.slice(0, MAXIMO_DE_RECIENTES)));
}

// Un botón por cada uno de los últimos que entraron. Tocarlo completa el usuario y deja el
// cursor en la contraseña.
function pintarRecientes() {
  const lista = leerRecientes();
  recientes.hidden = lista.length === 0;
  botonesRecientes.replaceChildren(...lista.map(({ usuario: nombreDeUsuario, nombre }) => crear('button', {
    type: 'button',
    class: 'boton boton-secundario',
    alHacerClic: () => {
      campoUsuario.value = nombreDeUsuario;
      mensajeIngreso.hidden = true;
      campoContrasena.focus();
    },
  }, nombre || nombreDeUsuario)));
}

// app.js conecta estas dos funciones de la pantalla Escanear: este archivo no puede importarlas,
// porque pantalla-escaneo.js ya importa este. palletAbierto devuelve { numero, cajas } o null.
let palletAbierto = () => null;
let irAlPallet = () => {};
export function conectarConEscaneo(funciones) {
  ({ palletAbierto, irAlPallet } = funciones);
}

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
  if (formulario === formularioIngreso) pintarRecientes();
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

// Sale para que entre otra persona. Antes revisa dos cosas:
// - Que no haya un pallet abierto: quedaría a nombre de quien sale y lo cerraría otro.
// - Que haya subido todo lo cerrado sin señal: lo que falta subir queda en la cola de quien lo
//   cerró, y con otra persona adentro no sube.
async function cambiarDeUsuario() {
  const abierto = palletAbierto();
  if (abierto) {
    const ir = await confirmar({
      titulo: `Tenés abierto el pallet ${abierto.numero}`,
      detalle: `${abierto.cajas > 0 ? `Tiene ${cajas(abierto.cajas)}.` : 'Todavía no tiene cajas.'} Cerralo o descartalo antes de cambiar de usuario, así no queda a nombre de otra persona.`,
      si: 'Ir al pallet',
    });
    if (ir) irAlPallet();
    return;
  }

  botonCambiarUsuario.disabled = true;
  // Con señal termina enseguida. Sin señal tarda unos segundos: que se vea que está haciendo algo.
  const aviso = setTimeout(() => avisar('Revisando que todo esté subido…'), 300);
  const subioTodo = await esperarSubida(ESPERA_PARA_SUBIR_MS);
  clearTimeout(aviso);
  botonCambiarUsuario.disabled = false;

  const sale = subioTodo
    ? await confirmar({
      titulo: '¿Cambiar de usuario?',
      detalle: 'Para volver a entrar hacen falta el usuario, la contraseña e internet.',
      si: 'Cambiar de usuario',
    })
    : await confirmar({
      titulo: 'Falta subir lo que cerraste sin señal',
      detalle: `Si salís ahora, se sube recién cuando ${usuario.nombre} vuelva a entrar en este celular. Mejor esperá a tener señal y probá de nuevo.`,
      si: 'Salir igual',
      no: 'Esperar',
      peligro: true,
    });
  if (!sale) return;
  await salir();
  // Volver a cargar deja la app como recién abierta, sin nada del usuario anterior.
  window.location.reload();
}

// Muestra quién entró en la barra de arriba, con el botón para cambiar de usuario.
function mostrarUsuarioActual() {
  document.getElementById('barra-usuario').hidden = false;
  document.getElementById('sesion-nombre').textContent = esSupervisor()
    ? `Entraste como ${usuario.nombre}, ${usuario.rol}.`
    : `Entraste como ${usuario.nombre}.`;
  botonCambiarUsuario.addEventListener('click', cambiarDeUsuario);
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
        recordarUsuario(usuarioDe(cuenta.correo), datos.nombre);
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
