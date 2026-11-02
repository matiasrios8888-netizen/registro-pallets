// Copia a www/ los archivos de la app. Esa es la carpeta que Capacitor mete adentro del APK.
// La página web no la usa: se publica desde la raíz del proyecto.
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const ARCHIVOS_DE_LA_APP = ['index.html', 'css', 'js', 'fuentes', 'vendor'];

rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const archivo of ARCHIVOS_DE_LA_APP) {
  cpSync(archivo, `www/${archivo}`, { recursive: true });
}
console.log('www/ lista');
