# Registro de pallets

Web app para registrar los pallets de producto terminado escaneando cada caja, en vez de anotarlos en papel.

## Estructura de carpetas y archivos

```text
Registro De Palets/
├── index.html              Las tres pantallas y las ventanas de pregunta
├── codigos-prueba.html     Hoja con códigos de barras para probar
├── css/
│   └── estilos.css         El diseño. Los colores están todos arriba de todo
├── fuentes/                La letra del contador de 7 segmentos y su licencia
├── js/
│   ├── app.js              Arranca la app y cambia de pantalla
│   ├── lector.js           Lee los códigos: la pistola y la cámara
│   ├── pantalla-escaneo.js Abre el pallet, suma cajas, deshace y cierra
│   ├── pantalla-historial.js  Pallets de un día, su detalle y el Excel
│   ├── productos.js        Busca productos por código y maneja esa pantalla
│   ├── datos.js            Elige dónde guardar: Firebase o este navegador
│   ├── datos-firebase.js   Guarda en Firestore
│   ├── datos-local.js      Guarda en el navegador (modo prueba)
│   ├── datos-prueba.js     Los 4 productos inventados
│   ├── config.js           Los datos de conexión a Firebase
│   └── ui.js               Herramientas comunes: sonidos, avisos y preguntas
├── firebase.json           Qué se publica en Firebase
└── firestore.rules         Quién puede leer y escribir en la base
```

## Probar la pantalla de escaneo (sin Firebase)

Hace falta un "servidor local": si abrís `index.html` con doble clic, el navegador bloquea los archivos de JavaScript.

**1.** Abrí una terminal en la carpeta del proyecto y corré:

```bash
python -m http.server 5500
```

**2.** Abrí en el navegador `http://localhost:5500`. Los 4 productos de prueba ya están cargados.

**3.** Completá **Responsable** y tocá **Abrir pallet**. El número y la fecha se completan solos, y los dos se pueden cambiar.

**4.** Abrí `http://localhost:5500/codigos-prueba.html` en otra pestaña e imprimí la hoja o mostrala en la pantalla del celular.

**5.** Volvé a la pestaña de la app. Cuando diga **Lector listo** en verde, disparale con la pistola a un código. También podés escribir `KD0324` con el teclado y apretar Enter, que es lo mismo que hace la pistola.

En este modo los datos quedan solo en ese navegador. Lo avisa la franja amarilla de arriba.

Para cortar el servidor, apretá `Ctrl + C` en la terminal.

## Averiguar qué trae el código de barras de las cajas

Abrí un pallet y escaneá una caja real. Va a aparecer en rojo "código desconocido" con el código que leyó, en mayúsculas.

- Si dice algo como `KD0324`, el código de barras trae el código interno.
- Si son 13 números, es un EAN.

Tocá **Agregar a Productos**: el formulario se abre con ese código ya puesto en el campo que corresponde. Completá el resto, guardá y escaneá la caja de nuevo.

## Crear el proyecto en Firebase

Con esto los datos quedan en la nube y se comparten entre todos los celulares y PCs.

**1. Crear el proyecto.** Entrá a [console.firebase.google.com](https://console.firebase.google.com) y tocá **Crear proyecto**. Google Analytics no hace falta.

**2. Crear la base de datos.** En el menú, entrá a **Firestore Database** y tocá **Crear base de datos**. Como ubicación elegí `southamerica-east1` (San Pablo), la más cercana; después no se puede cambiar. Elegí **modo de prueba**: en el paso 5 se reemplazan esas reglas por las de este proyecto.

**3. Registrar la app web.** Entrá a la rueda de **Configuración del proyecto**, bajá hasta **Tus apps** y tocá el ícono web `</>`. Ponele un nombre. No marques Hosting ahí.

**4. Copiar los datos.** Firebase te muestra un bloque `firebaseConfig`. Copiá cada valor al mismo campo de [js/config.js](js/config.js). Al recargar la app, la franja amarilla desaparece.

**5. Publicar.** Instalá la herramienta de Firebase una sola vez:

```bash
npm install -g firebase-tools
```

Iniciá sesión con tu cuenta de Google:

```bash
firebase login
```

Publicá la app y las reglas, cambiando `TU-PROJECT-ID` por el `projectId` de tu proyecto:

```bash
firebase deploy --project TU-PROJECT-ID
```

Si la primera vez dice que no encuentra el sitio, entrá a **Hosting** en la consola de Firebase, tocá **Comenzar** y volvé a correr el último comando.

Queda publicada en `https://TU-PROJECT-ID.web.app`. Cada vez que cambies algo, corré ese mismo comando de nuevo.

**6. Cargar los productos.** La base arranca vacía: entrá a **Productos** y tocá **Cargar productos de prueba**.

## Usarla en el celular

La cámara del celular solo funciona si la página se abre por `https`. Por eso hay que abrir la dirección `https://TU-PROJECT-ID.web.app` del paso anterior: desde `http://192.168...` la cámara no enciende, y la app lo avisa.

La pistola Bluetooth no necesita `https`. Vinculala desde el Bluetooth del celular, como si fuera un teclado.

## Cómo se comporta

- **Foco:** el campo de la pistola recupera el cursor solo. Si la etiqueta dice en rojo "Tocá acá para volver a leer", la app no es la ventana activa y la pistola estaría escribiendo en otro programa.
- **Lecturas fuera de lugar:** en Historial, en Productos o antes de abrir el pallet, una lectura no suma nada. Suena la alerta y un aviso dice que no se contó.
- **Teclado del celular:** ese campo no abre el teclado de pantalla, para que no tape el tablero. Para escribir un código, tocá **Escribir a mano**.
- **Abrir pallet:** solo se abre tocando el botón, nunca con Enter. El número va de 1 a 9999 y la fecha puede estar hasta 31 días antes o después de hoy. El responsable no acepta 4 cifras seguidas ni un código de producto. Esos controles frenan una lectura que cayó en el campo equivocado.
- **Agregar o editar producto:** solo se guarda tocando el botón. Unidades por caja llega hasta 100.000.
- **Sin señal:** con la app ya abierta se puede seguir escaneando y cerrando pallets. Se suben solos cuando vuelve la conexión. Para abrir la app de cero sí hace falta internet.
- **Pallet a medio armar:** queda guardado en el dispositivo a cada lectura. Si se recarga la página o se apaga el celular, sigue ahí.
- **Dos pestañas:** las dos muestran el mismo pallet y se actualizan solas. Si cambia con una pregunta abierta en la otra pestaña, esa pregunta se cierra sola sin hacer nada.
- **De un día para el otro:** el formulario de Abrir pallet pasa solo a la fecha nueva, sin borrar lo que ya esté escrito. Una fecha elegida a mano no se toca. Un pallet ya abierto conserva su fecha.
- **Numeración:** cada fecha arranca en 1. El número se elige al abrir y no se puede repetir en la misma fecha. Si otro dispositivo cerró ese número mientras tanto, el resumen y el aviso muestran con qué número queda. Sin señal, o si dos dispositivos cierran casi al mismo tiempo, pueden quedar dos pallets con el mismo número.
- **Cámara:** en cada pasada cuenta cada producto una sola vez, y cada caja contada hace un pitido. La pasada termina cuando la cámara deja de ver códigos 1,5 segundos. Si no sonó el pitido, esa caja no se contó.
- **Pistola:** cada lectura suma una caja, aunque sea el mismo código.
- **Deshacer último escaneo** saca la última caja leída. El botón **−1** de cada producto saca una caja de esa fila, aunque no sea la última. Entre dos toques hay que esperar 0,4 segundos: un toque antes de tiempo no quita nada y suena la alerta.
- **Editar un producto con el pallet abierto:** las cajas ya leídas no cambian. Las nuevas salen en otra fila, y cada fila da bien sus cuentas.

## Antes de usar datos reales

- `firestore.rules` deja la base abierta a cualquiera que tenga el link, y deja de permitir todo el 1 de febrero de 2027. Hay que agregar inicio de sesión y cambiar esas reglas.
- Si las reglas vencen, al cerrar un pallet aparece un aviso de error y las cajas vuelven a la pantalla, o vuelven al terminar el pallet que esté abierto. Ese pallet se muestra en rojo y no suma más cajas: hay que cerrarlo de nuevo. No se guarda nada hasta actualizar las reglas. En un dispositivo nuevo tampoco cargan los productos, y la app muestra ese mismo motivo. Después de corregir las reglas hay que recargar la página.
- Problema conocido: si un pallet se cierra sin señal, se cierra la pestaña y al volver la señal Firebase rechaza el guardado, ese pallet se pierde sin aviso. Solo pasa con reglas vencidas o mal escritas. Se resuelve en la etapa de Firebase.
