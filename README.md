# Registro de pallets

App para registrar los pallets de producto terminado escaneando cada caja, en vez de anotarlos en papel. Funciona como página web y como app de Android.

## Usarla en el celular

**Como app (APK).** Abrí este link desde el celular y bajá el archivo:

[Descargar el APK](https://github.com/matiasrios8888-netizen/registro-pallets/releases/latest/download/registro-pallets.apk)

Al abrirlo, Android va a pedir permiso para instalar apps de esta fuente. Después aceptá el permiso de cámara la primera vez que toques **Usar cámara**. Para actualizar, instalá el APK nuevo encima: el pallet abierto y los datos siguen ahí.

**Como página.** Abrí [matiasrios8888-netizen.github.io/registro-pallets](https://matiasrios8888-netizen.github.io/registro-pallets/). Solo necesita el navegador.

Mientras no esté conectado Firebase, cada celular guarda sus datos adentro de la app o del navegador. La app y la página no comparten datos entre sí. Con Firebase, todos ven los mismos pallets y productos, y cada persona entra con su usuario.

La pistola Bluetooth se vincula desde el Bluetooth del celular, como si fuera un teclado. Si al leer se abre el teclado de pantalla, desactivá **Mostrar teclado virtual** en los ajustes de teclado físico de Android.

## Estructura de carpetas y archivos

```text
Registro De Palets/
├── index.html              Las cuatro pantallas y las ventanas de pregunta
├── codigos-prueba.html     Hoja con códigos de barras para probar
├── css/
│   └── estilos.css         El diseño. Los colores están todos arriba de todo
├── fuentes/                Las letras de la app y sus licencias
├── vendor/                 Librerías incluidas: html5-qrcode, SheetJS y sus licencias
├── js/
│   ├── app.js              Arranca la app y cambia de pantalla
│   ├── lector.js           Lee los códigos: la pistola y la cámara
│   ├── pantalla-escaneo.js Abre el pallet, suma cajas, deshace y cierra
│   ├── pantalla-historial.js  Pallets de un día, su detalle y el Excel
│   ├── pantalla-ordenes.js Órdenes de producción abiertas e importar la COOIS
│   ├── coois.js            Lee el Excel de la COOIS y lo pasa a órdenes
│   ├── productos.js        Busca productos por código y maneja esa pantalla
│   ├── sesion.js           Entrar y salir, y qué puede hacer cada usuario
│   ├── datos.js            Elige dónde guardar: Firebase o este navegador
│   ├── datos-firebase.js   Guarda en Firestore
│   ├── datos-local.js      Guarda en el navegador (modo prueba)
│   ├── datos-prueba.js     Productos inventados (4, con 2 códigos cada uno) y una COOIS inventada
│   ├── config.js           Los datos de conexión a Firebase
│   └── ui.js               Herramientas comunes: sonidos, avisos y preguntas
├── android/                El proyecto de Android que genera el APK
├── scripts/preparar-www.mjs  Copia la app a www/ antes de armar el APK
├── capacitor.config.json   Nombre e identificador de la app de Android
├── package.json            Dependencias de Capacitor y comandos del APK
├── firebase.json           Dónde están las reglas de la base
└── firestore.rules         Quién puede leer y escribir en la base
```

## Probar con datos inventados (modo prueba)

Con `?prueba` al final de la dirección, la página abre en modo prueba: no pide usuario, no usa Firebase y trae productos inventados. Lo que se cargue queda solo en ese navegador, aparte de los datos de verdad. Lo avisa la franja amarilla de arriba. La app de Android siempre usa Firebase.

**En el celular o en cualquier PC:** abrí [matiasrios8888-netizen.github.io/registro-pallets/?prueba](https://matiasrios8888-netizen.github.io/registro-pallets/?prueba).

**En esta PC, con los cambios sin publicar:** hace falta un "servidor local", porque si abrís `index.html` con doble clic el navegador bloquea los archivos de JavaScript.

**1.** Abrí una terminal en la carpeta del proyecto y corré:

```bash
python -m http.server 5500
```

**2.** Abrí en el navegador `http://localhost:5500/?prueba`. Sin `?prueba` abre conectada a la base de verdad.

**3.** Completá **Responsable** y tocá **Abrir pallet**. El número y la fecha se completan solos, y los dos se pueden cambiar.

**4.** En **Productos**, tocá **Ver códigos de prueba**. Imprimí la hoja o mostrala en otra pantalla. Cada producto trae dos códigos: el de la caja contenedora y el de la unidad de venta (U.V).

**5.** Volvé a **Escanear**. Cuando diga **Lector listo** en verde, disparale con la pistola a un código. También podés escribir `KD0324` con el teclado y apretar Enter, que es lo mismo que hace la pistola.

**6.** En **Órdenes**, tocá **Bajar COOIS de prueba**: baja un Excel con 10 órdenes inventadas. Después tocá **Importar COOIS** y elegí ese archivo.

Para cortar el servidor, apretá `Ctrl + C` en la terminal.

## Averiguar qué trae el código de barras de las cajas

Abrí un pallet y escaneá una caja real. Va a aparecer en rojo "código desconocido" con el código que leyó, en mayúsculas.

- Si dice algo como `KD0324`, el código de barras trae el código interno.
- Si son 14 números, es un ITF-14, como el de las etiquetas que se probaron hasta ahora.

Tocá **Agregar a Productos**: el formulario se abre con ese código ya puesto en el campo que corresponde. Completá el resto, guardá y escaneá la caja de nuevo.

## Crear el proyecto en Firebase

Con esto los datos quedan en la nube y se comparten entre todos los celulares y PCs. Firebase guarda solo los datos y los usuarios: la página sigue en GitHub Pages.

**1. Crear el proyecto.** Entrá a [console.firebase.google.com](https://console.firebase.google.com) y tocá **Crear proyecto**. Google Analytics no hace falta. El identificador del proyecto queda en `js/config.js`, que es público: que el nombre no diga nada que no quieras mostrar.

**2. Crear la base de datos.** En el menú, entrá a **Firestore Database** y tocá **Crear base de datos**. Como ubicación elegí `southamerica-east1` (San Pablo), la más cercana; después no se puede cambiar. Elegí **modo de producción**: en el paso 5 se publican las reglas de este proyecto.

**3. Activar los usuarios.** Entrá a **Authentication**, tocá **Comenzar** y activá **Correo electrónico/contraseña**. Solo el primer interruptor. Después, en la pestaña **Configuración**, entrá a **Acciones del usuario**, destildá **Habilitar creación (registro)** y guardá. Si no, cualquiera que tenga los datos de `js/config.js` podría crearse un usuario. Desde la consola se siguen pudiendo crear.

**4. Registrar la app web.** Entrá a la rueda de **Configuración del proyecto**, bajá hasta **Tus apps** y tocá el ícono web `</>`. Ponele un nombre. No marques Hosting. Firebase te muestra un bloque `firebaseConfig`: copiá cada valor al mismo campo de [js/config.js](js/config.js). Esos datos no son secretos. Al recargar la app, la franja amarilla desaparece y pide entrar.

**5. Publicar las reglas.** Instalá la herramienta de Firebase una sola vez:

```bash
npm install -g firebase-tools
```

Iniciá sesión con tu cuenta de Google:

```bash
firebase login
```

Publicá las reglas de [firestore.rules](firestore.rules), cambiando `TU-PROJECT-ID` por el `projectId` de tu proyecto:

```bash
firebase deploy --only firestore:rules --project TU-PROJECT-ID
```

Hasta publicarlas, la base no deja leer ni escribir nada. Cada vez que cambies `firestore.rules`, corré ese mismo comando de nuevo.

**6. Crear los usuarios.** En **Authentication**, pestaña **Users**, tocá **Agregar usuario**, uno por persona. No hace falta un mail real: con `juan@pallets.local`, para entrar alcanza con escribir `juan`. La contraseña tiene que tener 6 caracteres o más. La primera vez que cada uno entra, la app le pide su nombre, que después sale como responsable de sus pallets.

**7. Elegir al supervisor.** Es el único que carga, cambia y borra productos, el único que borra pallets y el único que importa la COOIS. Los demás escanean, cierran pallets y ven el Historial. Después de que el supervisor entre por primera vez:

1. En **Authentication**, copiá su **UID de usuario**.
2. En **Firestore Database**, entrá a la colección `usuarios` y abrí el documento con ese UID.
3. Tocá **Agregar campo**: nombre `rol`, tipo `string`, valor `supervisor`.
4. Si el supervisor tiene la app abierta, se vuelve a cargar sola en unos segundos.

El valor también puede ser `administrador`, con los mismos permisos. No importan las mayúsculas ni los espacios de más: `Supervisor ` vale igual. Cualquier otra palabra deja al usuario sin esos permisos. La app muestra el rol al final de Productos: "Entraste como Juan, supervisor."

**8. Cargar los productos.** La base arranca vacía. El supervisor los carga desde **Productos** con **Escanear producto nuevo**. Los productos de prueba se cargan solo en modo prueba.

**9. Generar el APK de nuevo**, como dice la sección siguiente: el APK lleva adentro los datos de `js/config.js`.

## Generar el APK

Hacen falta Node y Android Studio, con su JDK y el SDK de Android. Instalá las dependencias una sola vez:

```bash
npm install
```

Generá el APK:

```bash
npm run apk
```

Queda en `android/app/build/outputs/apk/debug/app-debug.apk`. Cada cambio en la app necesita un APK nuevo. Para instalarlo encima sin perder datos, hay que generarlo siempre en la misma PC: cada una lo firma con su propia clave, y con otra clave Android obliga a desinstalar primero.

La cámara del navegador solo funciona si la página se abre por `https`: desde `http://192.168...` no enciende, y la app lo avisa. El APK no tiene esa limitación.

## Cómo se comporta

- **Usuarios:** con Firebase, cada persona entra una sola vez en cada dispositivo, con su usuario y su contraseña. Para entrar hace falta internet. El nombre de quien entró se completa solo como responsable, y se puede cambiar. **Salir** está al final de Productos.
- **Supervisor:** solo el supervisor (o el administrador) ve los botones para cargar, cambiar y borrar productos, el de borrar pallets y el de importar la COOIS. Si otro escanea un código desconocido, la app le dice que se lo pida al supervisor. La base también lo controla, aunque alguien saltee los botones. En modo prueba no hay usuarios y se puede todo.
- **Órdenes (COOIS):** el supervisor importa cada día la COOIS, el Excel que exporta SAP con las órdenes de producción. **Importar COOIS** abre una ventana para elegir qué columna del archivo es cada dato: número de orden, código interno, descripción, cantidades y fecha. La app deja elegidas las que reconoce por el nombre y recuerda la elección para la próxima vez. Para saber cuánto le falta a cada orden alcanza con la cantidad pendiente, o con la cantidad de la orden y la entregada. Antes de importar muestra cuántas órdenes entran y cuáles quedan afuera: las ya completas, las filas sin número o sin código, y las órdenes repetidas. También avisa los códigos que no están en Productos. Cada COOIS reemplaza a la anterior. Todos ven las órdenes de cada producto, de la más vieja a la más nueva. En **Buscar** se puede escribir una orden o un código, o escanear una caja.
- **Total por producto:** Historial suma todos los pallets del día por producto, que es lo que se descuenta de las órdenes. El Excel trae la misma tabla en una segunda hoja, **Por producto**. La primera hoja, **Pallets**, sigue con una fila por producto de cada pallet.
- **Foco:** el campo de la pistola recupera el cursor solo. Si la etiqueta dice en rojo "Tocá acá para volver a leer", la app no es la ventana activa y la pistola estaría escribiendo en otro programa.
- **Lecturas fuera de lugar:** en Historial, en Órdenes, en Productos o antes de abrir el pallet, una lectura no suma nada. Suena la alerta y un aviso dice que no se contó.
- **Teclado del celular:** ese campo no abre el teclado de pantalla, para que no tape el tablero. Para escribir un código, tocá **Escribir a mano**.
- **Abrir pallet:** solo se abre tocando el botón, nunca con Enter. El número va de 1 a 9999 y la fecha puede estar hasta 31 días antes o después de hoy. El responsable no acepta 4 cifras seguidas ni un código de producto. Esos controles frenan una lectura que cayó en el campo equivocado.
- **Productos y envases:** en Productos hay una fila por código de barras. Cada producto puede tener dos: el de la caja contenedora y el de la unidad de venta (U.V), que es la cajita o la bolsa de adentro. Las dos filas comparten el código interno y cada una dice cuántas unidades trae su envase. Un producto no puede tener dos contenedoras ni dos U.V. Si se escribe el código interno en vez de escanear, cuenta la contenedora. Los productos cargados antes de esto son contenedoras.
- **Agregar o editar producto:** solo se guarda tocando el botón. Las unidades del envase llegan hasta 100.000. Si el código de barras empieza con 1 queda marcado U.V, y si no, Contenedora, como en las etiquetas reales: se puede cambiar antes de guardar. Al escribir el código interno de un producto que ya está, la descripción se completa sola.
- **Escanear producto nuevo:** abre el formulario con la cámara prendida. Apenas lee el código de barras, suena el pitido, el número queda en su campo y la cámara se apaga. El código de barras solo trae ese número: el código interno, la descripción, el tipo de envase y sus unidades se escriben a mano una sola vez, mirando la etiqueta. Si el código ya es de otro producto, lo avisa enseguida. El botón **Leer con la cámara** hace lo mismo adentro del formulario, por ejemplo para cambiarle el código a un producto que ya existe.
- **Sin señal:** en modo prueba no hace falta internet para nada. Con Firebase, con la app ya abierta se puede seguir escaneando y cerrando pallets, y se suben solos cuando vuelve la conexión. Para abrirla de cero sí hace falta internet, porque Firebase se baja al arrancar.
- **Excel en la app de Android:** en vez de bajar el archivo, abre el menú Compartir para mandarlo por WhatsApp, por mail o guardarlo en Archivos.
- **Pallet a medio armar:** queda guardado en el dispositivo a cada lectura. Si se recarga la página o se apaga el celular, sigue ahí.
- **Dos pestañas:** las dos muestran el mismo pallet y se actualizan solas. Si cambia con una pregunta abierta en la otra pestaña, esa pregunta se cierra sola sin hacer nada.
- **De un día para el otro:** el formulario de Abrir pallet pasa solo a la fecha nueva, sin borrar lo que ya esté escrito. Una fecha elegida a mano no se toca. Un pallet ya abierto conserva su fecha.
- **Numeración:** cada fecha arranca en 1. El número se elige al abrir y no se puede repetir en la misma fecha. Si otro dispositivo cerró ese número mientras tanto, el resumen y el aviso muestran con qué número queda. Sin señal, o si dos dispositivos cierran casi al mismo tiempo, pueden quedar dos pallets con el mismo número. Historial los marca en rojo: "Hay otro pallet 3 este día".
- **Cámara:** en el celular se abre como una pantalla aparte, con el contador, el video, **Deshacer**, **Cerrar cámara** y el modo de carga. En la app de Android, la tecla Atrás también la cierra. Al cerrarla, la pantalla va al resumen del pallet, con la lista de productos y el botón **−1** para corregir antes de cerrarlo. Tiene dos modos, y cada dispositivo recuerda el último que se eligió. No lee códigos QR. Si está buscando un código y no ve ninguno durante 2 segundos, un cartel pide acercar la cámara.
- **Tocar para leer** (el modo de arranque): cada toque del botón **Leer** cuenta una caja, igual que un gatillazo de la pistola. Después de tocar, la cámara tiene 8 segundos para encontrar un código. Si lo encuentra suena el pitido; si no, avisa en rojo y no suma nada. Sin tocar Leer no cuenta nada, aunque esté viendo un código.
- **Modo rápido:** la cámara cuenta sola. Otro producto cuenta enseguida, y la misma caja vuelve a contar a los 2 segundos aunque no haya salido de la vista. Por eso un cartel lo avisa todo el tiempo que el modo está activo.
- **Pistola:** cada lectura suma una caja, aunque sea el mismo código.
- **Contenedora y U.V:** una caja contenedora suma en Cont. y una de unidad de venta en U.V. Las dos van en la misma fila del producto, con las unidades de cada una. El resumen, el Historial y el Excel las muestran en columnas separadas cuando el pallet tiene alguna U.V.
- **Modo de carga:** abajo de **Usar cámara** se elige **Caja por caja** (cada lectura suma una caja) o **Código + cantidad**. Cada dispositivo recuerda el último que se eligió.
- **Código + cantidad:** cada lectura no suma: abre la ventana **Cargar cantidad** con el producto y su envase. Ahí se escribe el total de cajas o, para las cajas del medio del pallet, las cajas por fila y la cantidad de filas, hasta 999 cajas. Antes de sumar pregunta, por ejemplo, "¿Confirmás 40 cajas = 24.000 unidades?", y **Corregir** vuelve a la ventana con lo escrito. Con la cámara, en este modo lee sola, porque leer no suma. Esas cajas no se escanearon una por una: si en el medio hay otro producto o falta una caja, la app no se entera. Por eso el resumen, el Historial y el Excel muestran cómo se cargaron, como `8 × 5` (5 filas de 8 cajas) o `40`, para poder volver a controlarlas.
- **Pallet completo:** cada producto puede tener cargadas, en Productos, las cajas que entran en un pallet completo. Si un pallet se pasa, avisa al sumar, en la lista y en el resumen. Sin ese dato no avisa nada.
- **Deshacer último escaneo** saca la última caja leída. Si lo último fue una carga a mano, pregunta y la saca entera. El botón **−1** de cada producto saca la última caja de esa fila, sea contenedora o U.V, aunque no sea la última del pallet. Entre dos toques hay que esperar 0,4 segundos: un toque antes de tiempo no quita nada y suena la alerta.
- **Pallet cerrado:** no se puede editar. En Historial se puede ver, y el supervisor lo puede borrar entero.
- **Editar un producto con el pallet abierto:** las cajas ya leídas no cambian. Las nuevas salen en otra fila, y cada fila da bien sus cuentas.

## Antes de usar datos reales

- `firestore.rules` no deja leer ni escribir nada sin entrar con un usuario. Los usuarios se crean a mano en la consola de Firebase. Con **Habilitar creación (registro)** apagado, como dice el paso 3, nadie puede crearse uno solo.
- Si la base rechaza un pallet, por ejemplo porque las reglas no se publicaron o el usuario se desactivó, aparece un aviso de error y las cajas vuelven a la pantalla, o vuelven al terminar el pallet que esté abierto. Ese pallet se muestra en rojo y no suma más cajas: hay que cerrarlo de nuevo. En un dispositivo nuevo tampoco cargan los productos, y la app muestra ese mismo motivo. Después de corregir el problema hay que recargar la página.
- Problema conocido: si un pallet se cierra sin señal, se cierra la pestaña y al volver la señal Firebase rechaza el guardado, ese pallet se pierde sin aviso. Con las reglas publicadas solo pasa si el usuario se desactiva o se borra en ese rato.
- Salir sin señal: lo que se cerró sin señal todavía no subió. Por eso la pregunta de **Salir** pide esperar a que vuelva la señal.

## Para quien corrija el código

Cada función tiene un comentario arriba que dice qué hace. La historia de commits va cambio por cambio. Las dos pantallas grandes viven en `js/pantalla-escaneo.js` y `js/pantalla-historial.js`, y todo acceso a datos pasa por `js/datos.js`.

Decisiones que no se ven a simple vista:

- Contar una caja de más sin avisar es la peor falla posible. Todas las cajas de un producto traen el mismo código y la cámara no sabe cuándo se pasó a la siguiente, así que el modo de arranque pide un toque de Leer por cada lectura. Antes contaba sola y esperaba a dejar de ver el código, pero un ITF-14 se lee solo en algunas imágenes: una caja quieta a la vista se contaba de nuevo, y con una espera que lo evitara cada caja tardaba demasiado. El modo rápido acepta ese riesgo a cambio de velocidad, con un aviso siempre a la vista y un pitido por cada caja.
- La cámara solo acepta un ITF de 14 dígitos con el dígito verificador correcto: ese formato no trae control propio, y una lectura cortada parece un código válido más corto.
- La cámara no lee QR: hay etiquetas con un QR que lleva a un certificado, y se leía en vez del código de barras.
- El campo de la pistola tiene `inputmode="none"`: sin eso, tener siempre el foco abriría el teclado del celular y taparía el tablero.
- Los formularios de abrir pallet y de producto no se envían con Enter: la pistola termina cada lectura con Enter, y una lectura en el campo equivocado no debe guardar nada.
- Los topes de número (9999), fecha (31 días) y unidades por caja (100.000) no son reglas de la fábrica: frenan una lectura que cayó en el campo equivocado.
- Nunca esperar con `await` un guardado en Firestore para seguir: sin señal esa promesa no termina hasta que vuelve la conexión, y la pantalla quedaría trabada.
- La fecha del pallet se calcula con la hora local, nunca con `toISOString()`: en Argentina (UTC-3) cambiaría de día a las 21:00.
- Los textos que vienen de un escaneo o de la base se pintan con `textContent`, nunca con `innerHTML`: un QR podría traer HTML.

Cómo probar sin equipos:

- Con `file://` no cargan los módulos: usá `python -m http.server 5500`.
- Pistola: Playwright con `page.keyboard.type` y `press('Enter')`, que genera teclas reales.
- Cámara: Chrome con `--use-fake-device-for-media-stream` y `--use-file-for-fake-video-capture=video.mjpeg`.
- Firestore sin cuenta: emulador de `firebase-tools` con un proyecto `demo-*`, en una copia con `connectFirestoreEmulator`.
