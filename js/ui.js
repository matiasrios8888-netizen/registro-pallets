// Herramientas de pantalla que usan todas las demás partes de la app.

// Crea un elemento HTML. Los textos se agregan como texto puro, nunca como HTML: así un
// código QR con contenido raro no puede meter nada en la página.
// atributos: alHacerClic conecta el clic y lo demás son atributos HTML. hijos: textos o
// elementos que van adentro.
export function crear(etiqueta, atributos = {}, ...hijos) {
  const elemento = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    if (nombre === 'alHacerClic') elemento.addEventListener('click', valor);
    else elemento.setAttribute(nombre, valor);
  }
  elemento.append(...hijos);
  return elemento;
}

// Números con punto de miles, como se leen acá: 28.800.
const formatearNumero = (numero) => numero.toLocaleString('es-AR');

// Texto como "1 caja" o "28 cajas".
export const cajas = (cantidad) => `${formatearNumero(cantidad)} ${cantidad === 1 ? 'caja' : 'cajas'}`;

// Texto como "1 unidad" o "28.800 unidades".
export const unidades = (cantidad) => `${formatearNumero(cantidad)} ${cantidad === 1 ? 'unidad' : 'unidades'}`;

// Fecha de hoy según la hora del dispositivo, como "2026-11-01". No usar toISOString():
// trabaja en hora universal y en Argentina cambiaría de día a las 21:00.
export function fechaDeHoy() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

// De "2026-11-01" a "01/11/2026".
export const fechaParaMostrar = (fecha) => fecha.split('-').reverse().join('/');

// Aclara cómo se contaron las cajas que no se escanearon. Vacío si se escanearon todas.
export function notaPorFilas(item) {
  const texto = item.detalleFilas ? `Por filas: ${item.detalleFilas}` : '';
  return crear('span', { class: 'nota-por-filas' }, texto);
}

// Tabla de productos de un pallet. Se usa en el resumen final y en el historial.
export function tablaDeItems(items) {
  return crear('table', { class: 'tabla-items' },
    crear('thead', {},
      crear('tr', {},
        crear('th', { scope: 'col' }, 'Código'),
        crear('th', { scope: 'col' }, 'Descripción'),
        crear('th', { scope: 'col', class: 'numero' }, 'Cajas'),
        crear('th', { scope: 'col', class: 'numero' }, 'Unidades'))),
    crear('tbody', {}, ...items.map((item) => (
      crear('tr', {},
        crear('td', { class: 'codigo' }, item.codigoInterno),
        crear('td', {}, item.descripcion, notaPorFilas(item)),
        crear('td', { class: 'numero' }, formatearNumero(item.cajas)),
        crear('td', { class: 'numero' }, formatearNumero(item.unidades)))))));
}

// Sonidos: en planta hay ruido, por eso además vibra (en celular) y cambia el color.
let audio;

// Hace sonar un tono. La frecuencia va en Hz; la duración y la demora, en segundos.
function tono(frecuencia, duracion, demora = 0) {
  audio ??= new AudioContext();
  audio.resume();
  const oscilador = audio.createOscillator();
  const volumen = audio.createGain();
  oscilador.type = 'square';
  oscilador.frequency.value = frecuencia;
  volumen.gain.value = 0.2;
  oscilador.connect(volumen).connect(audio.destination);
  oscilador.start(audio.currentTime + demora);
  oscilador.stop(audio.currentTime + demora + duracion);
}

// Un pitido agudo y una vibración corta: la lectura entró.
export function senalOk() {
  tono(1320, 0.09);
  navigator.vibrate?.(60);
}

// Dos tonos graves y dos vibraciones: hubo un problema.
export function senalError() {
  tono(220, 0.18);
  tono(220, 0.18, 0.24);
  navigator.vibrate?.([120, 80, 120]);
}

// Mensaje que aparece un rato abajo de la pantalla.
let temporizadorAviso;

// Con tipo "error" sale en rojo y dura 10 segundos; si no, 4.
export function avisar(mensaje, tipo = 'normal') {
  const aviso = document.getElementById('aviso');
  aviso.textContent = mensaje;
  aviso.dataset.tipo = tipo;
  aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => {
    aviso.hidden = true;
  }, tipo === 'error' ? 10000 : 4000);
}

// Traduce un error de la base a un mensaje claro, y lo deja en la consola para quien lo revise.
export function motivoDelError(error) {
  console.error(error);
  if (error?.code === 'permission-denied') {
    return 'Firebase no dio permiso: puede que falte publicar las reglas de firestore.rules o que tu usuario esté desactivado. Después de corregirlo, recargá la página.';
  }
  return `Falló la base de datos (${error?.code ?? error?.message ?? 'error desconocido'}).`;
}

// Muestra ese motivo en un aviso.
export function avisarErrorDeDatos(error) {
  avisar(motivoDelError(error), 'error');
}

// Pregunta con dos botones. Devuelve una promesa: true si eligió "si".
// "contenido" es opcional: un elemento para mostrar arriba de los botones, como un resumen.
export function confirmar({ titulo, detalle = '', contenido = null, si, no = 'Cancelar', peligro = false }) {
  const dialogo = document.getElementById('dialogo-confirmar');
  const botonSi = document.getElementById('confirmar-si');
  document.getElementById('confirmar-titulo').textContent = titulo;
  document.getElementById('confirmar-detalle').textContent = detalle;
  document.getElementById('confirmar-contenido').replaceChildren(...(contenido ? [contenido] : []));
  document.getElementById('confirmar-no').textContent = no;
  botonSi.textContent = si;
  botonSi.className = `boton ${peligro ? 'boton-paro' : 'boton-marcha'}`;
  dialogo.returnValue = '';
  dialogo.showModal();
  return new Promise((resolver) => {
    dialogo.addEventListener('close', () => resolver(dialogo.returnValue === 'si'), { once: true });
  });
}

// Si alguien escanea con esta pregunta abierta, el Enter de la pistola no debe contestarla.
document.getElementById('dialogo-confirmar').addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter' && !evento.defaultPrevented) {
    evento.preventDefault();
    senalError();
  }
});
