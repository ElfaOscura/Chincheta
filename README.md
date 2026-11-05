# Chincheta

Tablero de corcho con post-its (tareas, notas, enlaces, dibujos y alertas), imágenes y un calendario con notas por día. Funciona sin internet y se instala como app.

- 🌐 **Probarla ahora:** <https://elfaoscura.github.io/Chincheta/>
- 💻 **Código:** <https://github.com/ElfaOscura/Chincheta>

Es una **PWA** hecha solo con HTML, CSS y JavaScript: sin frameworks, sin dependencias y sin paso de compilación.

## Cómo usarla

### Si solo quieres usarla

1. Abre <https://elfaoscura.github.io/Chincheta/> en Chrome o Edge (en el celular funciona también).
2. Pulsa **+ Crear nota** y empieza a pegar post-its en el tablero.
3. Opcional: instálala con el icono de instalar de la barra de direcciones, o con el botón **Instalar app** del menú ☰. Se abrirá como un programa más y funcionará sin internet.

No necesitas cuenta ni registrarte en nada.

## Dónde se guardan tus datos

**Todo se guarda en tu propio navegador, en tu dispositivo.** No hay servidor ni base de datos: Chincheta no envía tus notas a ningún sitio, y quien aloja la página no puede verlas.

Los datos viven en el almacenamiento del sitio del navegador (no en la nube ni en una carpeta que puedas ver):

| Qué | Dónde | Clave |
| --- | --- | --- |
| Post-its, alertas, eventos y ajustes (incluida la nota fijada y su ancho) | `localStorage` | `chincheta:datos:v1` |
| Preferencias de la barra superior | `localStorage` | `chincheta:ui:v1` |
| Imágenes de tu PC y dibujos | `IndexedDB` | base `chincheta-imagenes`, almacén `imagenes` |
| Idioma elegido | `localStorage` | `chincheta:lang` |
| La app para usarla sin internet | Caché del service worker | `chincheta-v13` (ver `sw.js`) |

Qué significa esto en la práctica:

- **Cada navegador y cada dirección tienen sus propios datos.** Lo que guardas en Chrome no aparece en Edge, ni en tu celular, ni en `localhost:8080` frente a `elfaoscura.github.io`. Usa siempre la misma dirección.
- **Se pueden perder** si borras los «datos de navegación» o «datos de sitios» del navegador, si usas una ventana de incógnito (se borra al cerrarla) o, en casos raros, si el navegador libera espacio. La app pide al navegador que los proteja, pero no es una garantía.
- **No se sincronizan** entre dispositivos. Para pasarlos de uno a otro o para tener una copia de seguridad, usa el respaldo (abajo).
- **El límite de espacio** lo pone el navegador (suele ser de cientos de MB), de sobra para notas, aunque las imágenes grandes pesan más.

## Qué incluye

- **Post-its:** rosa = lista de tareas, amarillo = nota, azul = lista de enlaces. En el tablero solo se ve el título; al hacer clic se abre el contenido. Se arrastran para acomodarlos y se agrandan o achican desde la esquina inferior derecha, con el ratón o con el dedo en el celular y la tableta. La interfaz se adapta al tamaño de la pantalla.
- **Progreso de tareas:** las listas de tareas muestran un anillo con el porcentaje de tareas hechas.
- **Imágenes:** desde tu PC (también puedes soltarlas sobre el tablero) o desde un enlace. En el tablero solo se ve la imagen; al hacer clic se abre con su nota.
- **Imagen en un post-it:** cualquier post-it puede llevar el enlace de una imagen, que se muestra junto al título.
- **Calendario:** haz clic en la fecha de arriba, elige un día y agrega eventos. Hay dos tipos:
  - **Evento** (lila, 🔔): se muestra ese día y termina cuando pasa la fecha.
  - **Cumpleaños** (naranja, 🎂): atemporal, se repite todos los años en la misma fecha (el 29 de febrero cae el 28 en los años no bisiestos).
- **Eventos siguientes:** junto a la fecha se ven los 3 próximos como tarjetas (día y mes arriba, título abajo). La cuarta tarjeta, **Ver listado de eventos**, abre el listado completo para editar o eliminar cualquier evento y para agregar uno nuevo.

## Nota fijada ⭐

Puedes dejar **una nota a la vez** abierta en un panel al extremo derecho, mientras sigues usando el tablero.

- **Cómo fijarla:** pasa el cursor sobre una nota y pulsa su **estrellita**, o usa la estrella dentro de la nota abierta o en el listado de notas.
- **Ancho a tu gusto:** arrastra el borde izquierdo del panel (o usa las flechas ← → con el borde enfocado). Doble clic en el borde vuelve al tamaño original. El ancho se recuerda.
- **Una sola:** si ya hay una nota fijada, Chincheta te pregunta si quieres desfijarla y cambiarla por la nueva, y te dice cuál es la actual.
- **Desfijar:** pulsa la estrella del panel; la nota vuelve al tablero al lugar donde estaba.
- Las alertas no se pueden fijar. En pantallas angostas el panel queda debajo del tablero.

## Listado de notas

Junto a **Ver listado de eventos** está **Ver listado de notas**, pensado para cuando el tablero se llena: muestra todas las notas, se filtran por texto o por tipo, y desde cada fila puedes abrirla, **verla en el tablero** (la resalta un momento) o fijarla con la estrella.

## La barra superior

- La **franja** de arriba siempre muestra la fecha, los próximos eventos, el listado de notas, las alertas y el botón amarillo **+ Crear nota**, que abre los 5 tipos de post-it (tareas, nota, enlaces, imagen y dibujo).
- El botón **☰ Menú** (a la derecha) despliega el buscador y el respaldo. Los paneles se cierran solos al usar un botón, con `Esc` o al hacer clic fuera.
- En pantallas pequeñas la franja se reorganiza: el calendario queda compacto a la izquierda, **Eventos siguientes** a su derecha y, debajo, el resto de los botones en una rejilla pequeña.
- La **flechita** centrada bajo la barra pliega la franja entera para ver el tablero más grande; se recuerda tu elección. Los atajos `/` y `Ctrl + K` la despliegan y abren el buscador.

## Alertas 🔔

- El botón **Alertas** (con borde naranja y una flechita) abre un submenú con dos opciones: **Ver alertas** y **Crear alerta**. La ventana muestra una vista u otra, con pestañas para cambiar entre ellas.
- Al crear una alerta eliges título, descripción, hora y repetición (una vez, **todos los días** o **días concretos** de Lunes a Domingo). Desde «Mis alertas» se pueden pausar, editar y eliminar.
- Cada alerta aparece en el tablero como un post-it **naranja** con campanita y una **cuenta atrás** en vivo (días, horas, minutos). La chincheta cambia de color: **verde** (falta mucho), **amarilla** (≤ 3 h), **roja** (≤ 15 min o vencida) y gris (en pausa).
- A la hora exacta suena un aviso suave, sale una **notificación del sistema** (acepta el permiso desde la ventana de alertas) y aparece una ventana con **Descartar** (si se repite, pasa al siguiente ciclo) y **Prorrogar 10 minutos**. También se puede silenciar el sonido.
- **Limitación honesta:** las alertas suenan mientras Chincheta esté abierta (en una pestaña o como app instalada, aunque esté en segundo plano). No hay servidor de notificaciones push, así que con la app cerrada no avisa; al abrirla, las alertas vencidas aparecen enseguida.

## Más post-its y utilidades

- **Enlaces con vista previa:** pega un enlace en un post-it azul y se agrega como tarjeta con icono del sitio, título y dominio. El título se deduce de la dirección; si el sitio lo permite, se reemplaza por el real (muchos sitios lo bloquean por seguridad del navegador).
- **Dibujo rápido** (verde menta): lienzo a mano alzada con ratón, dedo o lápiz; colores, grosores, goma, deshacer (Ctrl + Z) y borrar todo. En el tablero se ve su miniatura.
- **Buscador global:** barra superior, o atajos `/` y `Ctrl + K`. Filtra en vivo notas, tareas, enlaces, alertas y eventos (ignora mayúsculas y tildes); lo que no coincide se atenúa. `Enter` abre el primer resultado y `Esc` limpia.

## Idiomas 🌐

En el menú ☰ puedes elegir **Español**, **English** o **中文**. Chincheta recuerda tu elección (y al abrirla por primera vez usa el idioma de tu navegador si lo tiene). Cambia los textos, los nombres de meses y días y el formato de fechas y horas. Tus notas y eventos no se traducen: son tuyos.

## Apoyar el proyecto

Chincheta es gratis. Si te sirve y quieres apoyar su desarrollo, el menú ☰ tiene el botón **Invítame un café**, que lleva a <https://ko-fi.com/naidi_art>. Es totalmente opcional.

## El respaldo

Como los datos solo viven en tu navegador, haz respaldos de vez en cuando, y siempre antes de borrar datos del navegador o cambiar de equipo.

- **Guardar respaldo** (menú ☰) descarga un archivo `chincheta-respaldo-AAAA-MM-DD_HHMM.json` con todo: post-its, alertas, dibujos, imágenes del PC, calendario y ajustes.
- **Cargar respaldo** lo restaura en cualquier navegador o dispositivo. Reemplaza lo que haya en ese momento.

## Archivos

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | Estructura de la página y las ventanas |
| `styles.css` | Todo el aspecto (corcho, post-its, calendario) |
| `app.js` | La lógica principal de la app |
| `alerts.js` | Alertas, cuenta atrás, notificaciones y sonido |
| `dock.js` | Nota fijada a la derecha |
| `notes.js` | Listado de notas |
| `i18n.js` | Cambio de idioma: función `t()`, fechas y textos fijos |
| `i18n/es.js`, `i18n/en.js`, `i18n/zh.js` | Diccionarios de textos: español, inglés y chino |
| `draw.js` | Post-it de dibujo |
| `links.js` | Tarjetas de enlaces |
| `search.js` | Buscador global |
| `lucide.js` | Iconos [Lucide](https://lucide.dev) a color incluidos en el proyecto (funcionan sin internet) |
| `tools.js` | Menú, panel de crear nota, submenú de alertas y plegado de la barra superior |
| `manifest.json` | Datos para instalarla como app |
| `sw.js` | Guarda la app en el navegador para usarla sin internet |
| `icons/` | Iconos de la app |
| `miniatura-chincheta.jpg` | Imagen de vista previa al compartir el enlace (Open Graph) |
