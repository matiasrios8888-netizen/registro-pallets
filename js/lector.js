// Todo lo que lee códigos: la pistola y la cámara. Este archivo no sabe qué es un pallet:
// solo entrega el texto leído a la función alLeer.

// La cámara detecta los códigos a la vista varias veces por segundo. Cada caja se cuenta una
// sola vez por pasada, y la pasada termina cuando deja de ver todo código durante este tiempo.
const TIEMPO_PARA_OTRA_CAJA_MS = 1500;

// Además tiene que haber analizado estas imágenes sin código. En un celular lento pueden
// pasar 1,5 s entre dos lecturas de un código que nunca salió de la vista.
const IMAGENES_SIN_CODIGO = 3;

// La pistola funciona como un teclado: escribe el código en el campo que tiene el foco y
// presiona Enter, que envía el formulario.
export function escucharPistola(formulario, campo, alLeer) {
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const texto = campo.value;
    campo.value = '';
    alLeer(texto);
  });

  // Algunas pistolas vienen configuradas para terminar con Tab en vez de Enter.
  campo.addEventListener('keydown', (evento) => {
    if (evento.key === 'Tab' && campo.value) {
      evento.preventDefault();
      formulario.requestSubmit();
    }
  });
}

// Mantiene el cursor en el campo de la pistola: si se va, vuelve solo. Devuelve la función
// que lo vuelve a poner, para usarla cuando el campo reaparece en pantalla.
export function mantenerFoco(campo, debeTenerFoco) {
  const enfocar = () => {
    if (debeTenerFoco()) campo.focus({ preventScroll: true });
  };

  // Si la ventana de la app no está activa, la pistola escribiría en otro programa. El
  // cursor en el campo no alcanza para saberlo, por eso miramos también document.hasFocus().
  const marcarSiEstaListo = () => {
    campo.form.dataset.listo = document.hasFocus() && document.activeElement === campo;
  };

  campo.addEventListener('focus', marcarSiEstaListo);
  campo.addEventListener('blur', () => {
    marcarSiEstaListo();
    // setTimeout: primero tiene que terminar el clic que le sacó el foco.
    setTimeout(enfocar, 0);
  });
  window.addEventListener('focus', () => {
    enfocar();
    marcarSiEstaListo();
  });
  window.addEventListener('blur', marcarSiEstaListo);
  // Las ventanas de pregunta avisan con "close" al cerrarse. No sube hasta document, pero
  // con true nos enteramos igual.
  document.addEventListener('close', enfocar, true);

  return enfocar;
}

let camara = null;

// Las cajas contadas en la pasada actual. Viven afuera de encenderCamara: apagar y prender
// la cámara con una caja a la vista no la tiene que contar de nuevo.
const cajasVistas = new Set();
let ultimaDeteccion = 0;
let imagenesSinCodigo = 0;

export function olvidarCajasVistas() {
  cajasVistas.clear();
}

// claveDeCaja dice qué códigos son de la misma caja: una etiqueta puede traer dos.
export async function encenderCamara(idContenedor, alLeer, claveDeCaja) {
  const formatos = Html5QrcodeSupportedFormats;
  const nuevaCamara = new Html5Qrcode(idContenedor, {
    verbose: false,
    // Solo los formatos que pueden traer las cajas: lee más rápido y se equivoca menos.
    formatsToSupport: [
      formatos.EAN_13,
      formatos.EAN_8,
      formatos.UPC_A,
      formatos.UPC_E,
      formatos.CODE_128,
      formatos.CODE_39,
      formatos.ITF,
      formatos.QR_CODE,
    ],
    // Usa el lector del propio celular si tiene: con códigos de barras anda mucho mejor.
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
  });

  const alDetectar = (codigo) => {
    const ahora = Date.now();
    const terminoLaPasada = ahora - ultimaDeteccion >= TIEMPO_PARA_OTRA_CAJA_MS
      && imagenesSinCodigo >= IMAGENES_SIN_CODIGO;
    if (terminoLaPasada) cajasVistas.clear();
    ultimaDeteccion = ahora;
    imagenesSinCodigo = 0;

    const caja = claveDeCaja(codigo);
    if (cajasVistas.has(caja)) return;
    cajasVistas.add(caja);
    alLeer(codigo);
  };

  await nuevaCamara.start(
    { facingMode: 'environment' }, // la cámara de atrás
    {
      fps: 10,
      // Recuadro ancho y bajo, con la forma de un código de barras.
      qrbox: (ancho, alto) => ({
        width: Math.max(Math.floor(ancho * 0.9), 50),
        height: Math.max(Math.floor(alto * 0.5), 50),
      }),
    },
    alDetectar,
    () => { imagenesSinCodigo += 1; },
  );
  camara = nuevaCamara;
  // El tiempo apagada no cuenta como que dejó de ver las cajas.
  ultimaDeteccion = Date.now();
  imagenesSinCodigo = 0;
}

export async function apagarCamara() {
  if (!camara) return;
  const camaraEncendida = camara;
  camara = null;
  await camaraEncendida.stop();
  camaraEncendida.clear();
}
