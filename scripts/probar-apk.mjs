// Prueba el APK en un emulador de Android: instala, abre la app y hace el recorrido completo.
// Lo corre el workflow "Probar APK en un emulador". Deja capturas de pantalla en capturas/.
import { mkdirSync } from 'node:fs';
import { _android as android } from 'playwright-core';

const PAQUETE = 'com.registropallets.app';
const APK = 'android/app/build/outputs/apk/debug/app-debug.apk';
const fallas = [];

// Anota el resultado de una comprobación y la muestra en el registro.
function comprobar(nombre, condicion, detalle = '') {
  console.log(`${condicion ? 'OK   ' : 'FALLA'} ${nombre} ${detalle}`);
  if (!condicion) fallas.push(nombre);
}

const esperar = (ms) => new Promise((listo) => { setTimeout(listo, ms); });

mkdirSync('capturas', { recursive: true });
const [dispositivo] = await android.devices();

// Corre un comando en el Android y devuelve su salida como texto.
const consola = async (comando) => String(await dispositivo.shell(comando));
const captura = (nombre) => dispositivo.screenshot({ path: `capturas/${nombre}.png` });

// Abre la app y devuelve la página que tiene adentro, ya lista para usar.
async function abrirApp() {
  await consola(`am start -n ${PAQUETE}/.MainActivity`);
  const vista = await dispositivo.webView({ pkg: PAQUETE });
  const pagina = await vista.page();
  await pagina.waitForSelector('#apertura-numero, #campo-lector', { state: 'attached' });
  await esperar(1500);
  return pagina;
}

// Simula una pistola Bluetooth: un teclado físico que escribe el código y aprieta Enter.
async function leerConPistola(codigo) {
  await consola(`input keyboard text ${codigo}`);
  await consola('input keyboard keyevent 66');
  await esperar(500);
}

await dispositivo.installApk(APK);
await consola(`pm grant ${PAQUETE} android.permission.CAMERA`);

let pagina = await abrirApp();
const errores = [];
pagina.on('pageerror', (error) => errores.push(error.message));
pagina.on('console', (m) => console.log('consola:', m.type(), m.text()));

const entorno = await pagina.evaluate(() => ({
  url: location.href,
  segura: window.isSecureContext,
  nativa: window.Capacitor?.isNativePlatform?.(),
  plugins: Object.keys(window.Capacitor?.Plugins ?? {}),
  camara: typeof Html5Qrcode,
  excel: typeof XLSX,
  numero: document.getElementById('apertura-numero').value,
  fecha: document.getElementById('apertura-fecha').value,
  ancho: innerWidth,
  alto: innerHeight,
  version: navigator.userAgent,
}));
console.log(entorno);
comprobar('la página es segura', entorno.segura === true, entorno.url);
comprobar('corre como app nativa', entorno.nativa === true);
comprobar('están los plugins', entorno.plugins.includes('Filesystem') && entorno.plugins.includes('Share'), entorno.plugins.join(','));
comprobar('están las librerías', entorno.camara === 'function' && entorno.excel === 'object');
comprobar('número sugerido 1', entorno.numero === '1');
await captura('1-abrir');

await pagina.locator('#apertura-responsable').fill('Prueba');
await pagina.getByRole('button', { name: 'Abrir pallet' }).click();
await esperar(800);
const lector = await pagina.evaluate(() => ({
  foco: document.activeElement.id,
  listo: document.getElementById('form-lector').dataset.listo,
}));
comprobar('el foco queda en el campo', lector.foco === 'campo-lector', JSON.stringify(lector));
comprobar('dice Lector listo', lector.listo === 'true');
const teclado = await consola('dumpsys input_method');
comprobar('no se abre el teclado de pantalla', !/mInputShown=true/.test(teclado));

await leerConPistola('KD0324');
await leerConPistola('2000324000012');
await leerConPistola('TC0110');
const contador = await pagina.locator('#contador').textContent();
comprobar('la pistola sumó 3 cajas', contador === '3', contador);
await captura('2-tres-cajas');

await leerConPistola('9999999999994');
const rojo = await pagina.evaluate(() => ({
  estado: document.getElementById('tablero').dataset.estado,
  titulo: document.getElementById('lectura-titulo').textContent,
  cajas: document.getElementById('contador').textContent,
}));
comprobar('código desconocido en rojo', rojo.estado === 'error' && rojo.cajas === '3', JSON.stringify(rojo));
await captura('3-rojo');

const barra = await pagina.evaluate(() => {
  const nav = document.querySelector('.navegacion').getBoundingClientRect();
  return { arriba: nav.top, abajo: nav.bottom, alto: innerHeight, scroll: document.documentElement.scrollHeight };
});
console.log('barra', barra);

await pagina.locator('#btn-camara').click();
await esperar(6000);
const camara = await pagina.evaluate(() => {
  const video = document.querySelector('#camara video');
  const aviso = document.getElementById('aviso');
  return {
    boton: document.getElementById('btn-camara').textContent,
    ancho: video?.videoWidth,
    alto: video?.videoHeight,
    aviso: aviso.hidden ? null : aviso.textContent,
    vivas: video?.srcObject?.getVideoTracks().filter((t) => t.readyState === 'live').length,
  };
});
comprobar('la cámara enciende', camara.boton === 'Apagar cámara' && camara.vivas === 1 && camara.ancho > 0, JSON.stringify(camara));
await captura('4-camara');
await pagina.locator('#btn-camara').click();
await esperar(1000);

await pagina.getByRole('button', { name: 'Cerrar pallet' }).click();
await esperar(800);
await captura('5-resumen');
await pagina.locator('#confirmar-si').click();
await esperar(1000);
await pagina.getByRole('button', { name: 'Historial', exact: true }).click();
await esperar(800);
const resumen = await pagina.locator('#resumen-dia').textContent();
comprobar('el pallet está en Historial', resumen.includes('1 pallet: 3 cajas'), resumen);
await captura('6-historial');

await pagina.getByRole('button', { name: 'Exportar a Excel' }).click();
await esperar(4000);
const archivos = await consola(`run-as ${PAQUETE} ls cache`);
comprobar('el Excel quedó guardado', archivos.includes(`pallets-${entorno.fecha}.xlsx`), archivos.trim().replace(/\s+/g, ' '));
const ventanas = await consola('dumpsys window | grep -E "mCurrentFocus|mFocusedApp"');
comprobar('se abrió el menú Compartir', /chooser|resolver|intentresolver/i.test(ventanas), ventanas.trim().replace(/\s+/g, ' '));
await captura('7-compartir');
await consola('input keyevent 4');
await esperar(1500);

const avisoExcel = await pagina.evaluate(() => {
  const aviso = document.getElementById('aviso');
  return aviso.hidden ? null : aviso.textContent;
});
comprobar('cerrar Compartir no muestra error', avisoExcel === null || !avisoExcel.includes('No se pudo'), String(avisoExcel));
comprobar('sin errores de página', errores.length === 0, errores.join(' | '));

await consola(`am force-stop ${PAQUETE}`);
await esperar(1500);
pagina = await abrirApp();
const guardados = await pagina.evaluate(() => JSON.parse(localStorage.getItem('registro-pallets.v2.pallets') ?? '[]').length);
comprobar('los datos siguen al reabrir', guardados === 1, String(guardados));
await captura('8-reabierta');

await dispositivo.close();
console.log(fallas.length === 0 ? 'TODO OK' : `FALLAS: ${fallas.join(', ')}`);
process.exit(fallas.length === 0 ? 0 : 1);
