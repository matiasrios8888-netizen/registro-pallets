// Todo lo que lee códigos: la pistola y la cámara. Este archivo no sabe qué es un pallet:
// solo entrega el texto leído a la función alLeer.

// Menos teclas que esto, o más separadas, no son una lectura: es alguien usando el teclado.
const TECLAS_DE_UNA_LECTURA = 3;
const PAUSA_MAXIMA_EN_UNA_LECTURA_MS = 300;

// La pistola funciona como un teclado: escribe el código en el campo que tiene el foco y
// presiona Enter, que envía el formulario.
// alLeer recibe el texto tal como llegó, y el campo queda vacío para la lectura siguiente.
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

// Lo que la pistola escribe fuera de un campo se pierde sin que nadie se entere, y su Enter
// activaría el botón que tenga el foco. Acá se frena ese Enter y se avisa.
// alPerderse se llama una vez por cada lectura perdida.
export function detectarLecturaPerdida(alPerderse) {
  let teclas = 0;
  let ultimaTecla = 0;
  // true: nos enteramos antes que el botón que tiene el foco.
  document.addEventListener('keydown', (evento) => {
    const ahora = performance.now();
    if (ahora - ultimaTecla > PAUSA_MAXIMA_EN_UNA_LECTURA_MS) teclas = 0;
    ultimaTecla = ahora;

    const esCaracter = evento.key.length === 1 && evento.key !== ' '
      && !evento.ctrlKey && !evento.metaKey && !evento.altKey;
    const terminaLaLectura = evento.key === 'Enter' || evento.key === 'Tab';

    if (evento.target.closest('input')) {
      teclas = 0;
    } else if (esCaracter) {
      teclas += 1;
    } else if (terminaLaLectura && teclas >= TECLAS_DE_UNA_LECTURA) {
      teclas = 0;
      evento.preventDefault();
      alPerderse();
    }
  }, true);
}

// Mantiene el cursor en el campo de la pistola: si se va, vuelve solo. Devuelve la función
// que lo vuelve a poner, para usarla cuando el campo reaparece en pantalla.
// debeTenerFoco es una función que dice si en este momento corresponde poner el cursor.
export function mantenerFoco(campo, debeTenerFoco) {
  // Vuelve a poner el cursor si corresponde, sin mover la pantalla.
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
  // con true nos enteramos igual. Al cerrarse con el cursor en un campo numérico, el navegador
  // deja el foco acá pero la selección en otro lado, y la pistola escribe sin que entre nada.
  // Sacar el foco y volver a ponerlo lo acomoda.
  document.addEventListener('close', () => {
    campo.blur();
    enfocar();
  }, true);

  return enfocar;
}

let camara = null;

// Dice por qué la cámara no puede arrancar en esta página, o null si puede.
export function motivoSinCamara() {
  if (!window.isSecureContext) {
    return 'La cámara solo funciona si la app se abre desde https o localhost. Ver README.md.';
  }
  if (typeof Html5Qrcode === 'undefined') {
    return 'No se pudo cargar el lector de la cámara. Revisá la conexión y recargá la página.';
  }
  return null;
}

// Traduce el error de encenderCamara a un mensaje claro.
export function mensajeDeCamara(error) {
  const detalle = String(error);
  if (detalle.includes('NotAllowed')) return 'Falta el permiso: permití usar la cámara en el navegador.';
  if (detalle.includes('NotFound')) return 'Este dispositivo no tiene cámara.';
  return 'No se pudo encender la cámara. Probá recargar la página.';
}

// El formato ITF no trae control propio: una lectura cortada parece un código más corto, pero
// válido. Las cajas usan ITF-14, que son 14 dígitos y el último es un dígito verificador.
function esItf14Valido(codigo) {
  if (!/^\d{14}$/.test(codigo)) return false;
  const digitos = [...codigo].map(Number);
  const verificador = digitos.pop();
  // Empezando por el primero, un dígito vale por 3 y el siguiente por 1.
  const suma = digitos.reduce((total, digito, i) => total + digito * (i % 2 === 0 ? 3 : 1), 0);
  return (suma + verificador) % 10 === 0;
}

// idContenedor es el id del elemento donde va el video. alLeer recibe el código cada vez que
// la cámara lo ve, varias veces por segundo: decidir cuándo cuenta le toca a la pantalla.
// alNoVer se llama con cada imagen analizada sin ningún código.
// Si la cámara no enciende, la promesa falla con ese error.
export async function encenderCamara(idContenedor, alLeer, alNoVer) {
  // Apagarla apenas prendida suelta la cámara, pero html5-qrcode puede dejar restos adentro.
  document.getElementById(idContenedor).replaceChildren();
  const formatos = Html5QrcodeSupportedFormats;
  const nuevaCamara = new Html5Qrcode(idContenedor, {
    verbose: false,
    // Solo los formatos que pueden traer las cajas: lee más rápido y se equivoca menos. QR no:
    // hay etiquetas con un QR que lleva a un certificado, y se leía en vez del código de barras.
    formatsToSupport: [
      formatos.EAN_13,
      formatos.EAN_8,
      formatos.UPC_A,
      formatos.UPC_E,
      formatos.CODE_128,
      formatos.CODE_39,
      formatos.ITF,
    ],
    // Usa el lector del propio celular si tiene: con códigos de barras anda mucho mejor.
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
  });

  // html5-qrcode llama a esta función cada vez que lee un código.
  const alDetectar = (codigo, resultado) => {
    // html5-qrcode no cancela una lectura en camino al apagar: esa ya no vale.
    if (camara !== nuevaCamara) return;
    // Una de las próximas imágenes lo lee entero. Sin esto, la caja daría "código desconocido"
    // y se podría agregar a Productos con el código cortado.
    if (resultado.result.format?.format === formatos.ITF && !esItf14Valido(codigo)) return;
    alLeer(codigo);
  };

  await nuevaCamara.start(
    { facingMode: 'environment' }, // la cámara de atrás
    {
      fps: 10,
      // Un video vertical ocuparía toda la pantalla y dejaría el tablero afuera.
      aspectRatio: 4 / 3,
      // Recuadro ancho y bajo, con la forma de un código de barras.
      qrbox: (ancho, alto) => ({
        width: Math.max(Math.floor(ancho * 0.9), 50),
        height: Math.max(Math.floor(alto * 0.5), 50),
      }),
    },
    alDetectar,
    () => alNoVer(),
  );
  camara = nuevaCamara;
}

// Apaga la cámara y saca el video de la pantalla. Si no estaba encendida, no hace nada.
export async function apagarCamara() {
  if (!camara) return;
  const camaraEncendida = camara;
  camara = null;
  await camaraEncendida.stop();
  camaraEncendida.clear();
}
