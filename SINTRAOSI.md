<!-- SINTRAOSI.md — rediseño web para el sindicato SINTRAOSI -->
<!-- last_updated: 2026-09-08 | status: activo -->

# SINTRAOSI — Rediseño web

## Descripción
Cliente Korve. Rediseño exponencial del sitio web del sindicato SINTRAOSI (Sindicato de Trabajadores de la Organización Sanitas Internacional). Sitio real: https://www.sintraosi.org/

## Publicado
- Repo: https://github.com/01Akua/sintraosi-web (público)
- Live (GitHub Pages): **https://01akua.github.io/sintraosi-web/**
- Rama `main`, GitHub Pages sirviendo desde la raíz (`/`). Todo el sitio usa rutas relativas, así que funciona bien bajo el subpath `/sintraosi-web/`.

## Mobile / responsive
- Verificado con emulación de viewport angosto (iframe 375–414px de ancho) en Inicio, Regionales, Junta Directiva y Afíliate: menú hamburguesa, dropdown de Nosotros, grids colapsando a 1 columna, formulario largo apilado — todo funciona.
- Bugs reales encontrados y corregidos:
  - `regionales.html` tenía `style="grid-template-columns:repeat(3,1fr)"` **inline**, que por especificidad CSS ignoraba las media queries y dejaba 3 columnas fijas en cualquier tamaño de pantalla. Se movió a una clase `.reg-grid-3` en `styles.css` con sus propios overrides dentro de los `@media`.
  - El correo largo en el footer (`presidencia.nacional@sintraosi.org`) se cortaba en pantallas angostas por falta de salto de línea. Se agregó `overflow-wrap:break-word` global en `body` + `overflow-wrap:anywhere` en los links del footer.
  - Se agregó un breakpoint extra `@media (max-width:480px)` para achicar el header (oculta el subtítulo bajo el logo, reduce paddings) en teléfonos muy angostos.

## Estado actual
- Fase: **sitio multipágina (v4) construido, verificado en navegador y publicado en producción.** Cada sección relevante tiene su propia URL, como un sitio institucional real — ya no es una landing de una sola página. Listo para mostrarle el link al cliente.
- Done:
  - `sintraosi-v2.html` y `sintraosi-v3.html` — versiones anteriores de una sola página (landing). Se conservan como referencia histórica; **ya no son el archivo de trabajo principal.**
  - `contenido-real.md` — extracción completa (navegador) de https://www.sintraosi.org/: home, Nosotros (misión/visión/historia/junta directiva/principios/valores), Contacto, Noticias (5 items), Galería, Estados financieros, formulario de Afíliate.
  - **Arquitectura multipágina nueva** (10 páginas HTML + partials + CSS/JS compartidos):
    - `index.html` — Inicio (hero + teasers que enlazan a cada subpágina)
    - `nosotros.html` — Quiénes somos, Misión, Visión, Principios, Valores + tarjetas hub hacia Historia y Junta Directiva
    - `historia.html` — Timeline completo 2012–2013 (fundación, litigios, fallos)
    - `junta-directiva.html` — Directorio de los 9 miembros
    - `noticias.html` — Listado de noticias con filtro por regional
    - `regionales.html` — Las 5 regionales con detalle
    - `galeria.html` — Galería completa (8 fotos reales)
    - `documentos.html` — Estados financieros y documentos
    - `contacto.html` — Info de contacto + formulario
    - `afiliate.html` — Formulario de afiliación completo (15 campos reales del sitio oficial: datos personales, residencia, vinculación laboral, adjuntos de cédula/certificación laboral)
  - `partials/header.html` y `partials/footer.html` — header y footer compartidos, inyectados vía `fetch()` por `assets/main.js` en cada página. Nav con dropdown "Nosotros" (Quiénes somos / Historia / Junta directiva) y resaltado de página activa vía `<body data-page="...">`.
  - `assets/styles.css` — hoja de estilos única compartida por todas las páginas (extraída del v3, más estilos nuevos: `.page-hero` para el banner de cada subpágina, `.breadcrumb`, `.dropdown`, `.hub-grid`, formulario de afiliación).
  - `assets/main.js` — carga los partials, header con sombra al hacer scroll, menú hamburguesa mobile, botón "volver arriba", scroll-reveal, contador animado de stats (solo en Inicio), parallax del hero (solo en Inicio).
  - `assets/logo-sintraosi.png` — isotipo real del sindicato (globo + laurel + cinta "SINTRAOSI since 2012").
  - `assets/foto-1.jpg` a `foto-8.jpg` — 8 fotos reales del sindicato, distribuidas por las distintas páginas (hero, Quiénes somos, Historia, Junta Directiva, Galería completa, banda de Aliados).
  - Redes reales confirmadas por las fotos: sintraosi.org, Facebook "Sintraosi Oficial", X/Twitter "@Sintraosi_ofic" — en el footer y en Contacto.
  - `assets/logo-csi.png`, `logo-uni-global-union.png`, `logo-cut.png`, `logo-mintrabajo.png` — logos reales de aliados (recortados automáticamente de una imagen combinada que envió el usuario), reemplazan los badges de texto en la banda de Aliados del Inicio. Se muestran en tarjetas blancas sobre el fondo verde.
  - **Tipografía cambiada de Poppins a Fraunces** (serif) para todos los encabezados en las 10 páginas — look más editorial/institucional, menos genérico. Cuerpo sigue en Inter, etiquetas/mono en IBM Plex Mono.
  - Foto de fondo del hero de Inicio aclarada: overlay oscuro reducido + `filter: brightness(1.18) saturate(1.12)` sobre la imagen.
- Pendiente:
  1. Completar Noticias/Galería si el cliente confirma que hay más ítems detrás del "Cargar más" / "Ver todas" del sitio real.
  2. Conseguir las URLs reales de Facebook/X para los íconos del footer (hoy apuntan a "#").
  3. Conectar los formularios (contacto/afiliación) a un backend o servicio real cuando pase de prototipo a producción.
  4. El sitio usa `fetch()` para los partials — necesita servirse desde un servidor local (no funciona abriendo el `.html` directo con `file://`). Al pasar a producción con hosting real (GitHub Pages ya lo hace) esto no es un problema.

## Alcance del proyecto
- Es un **prototipo** (no producción todavía) para mostrarle al cliente una versión muy superior a la actual.
- El contenido debe ser el real del sindicato, no inventado — se extrae de la página oficial.
- El diseño visual (paleta, tipografía, composición) se puede mejorar libremente respecto al sitio original; el texto no.

## Decisiones
<!-- Append-only. [FECHA] Decisión — Razón -->
- [2026-08-29] Paleta azul en vez de rojo/dorado/verde — Sector salud, asociación visual estándar (confianza, limpieza, institucional). [SUPERSEDIDO — ver siguiente decisión]
- [2026-08-29] Extracción de texto será palabra por palabra desde sintraosi.org — El cliente es un sindicato real, el contenido debe ser fiel, no genérico.
- [2026-08-29] Migración de landing de una página (v2/v3) a sitio multipágina — El usuario señaló que no es una landing sino la web completa de una organización sindical, y cada sección relevante (Nosotros, Historia, Junta Directiva, Noticias, Regionales, Galería, Documentos, Contacto, Afíliate) debía tener su propia subpágina para verse formal y organizado, como un sitio institucional real.
- [2026-08-29] Paleta cambiada de azul a verde bosque (laurel) + rojo (cinta) — El usuario no quería la paleta azul y pidió usar los colores reales de identidad del logo (globo/laurel verde + cinta roja "SINTRAOSI"). Verde bosque pasó a ser el color dominante (headers, fondos oscuros); rojo quedó reservado para CTA/acciones (botones, checkmarks).
- [2026-08-29] Header pasó de sólido a transparente con blur (`backdrop-filter`), position:fixed sobre el hero/page-hero, y solo gana fondo sólido verde al hacer scroll (clase `.scrolled` ya existente) — El usuario pidió que la barra superior se integrara con la página en vez de verse como un bloque separado.
- [2026-08-29] Repo público `01Akua/sintraosi-web` creado y publicado en GitHub Pages — El usuario pidió tener el sitio en un repo de GitHub con link público para mostrarle al cliente. Commits sin coautoría (pedido explícito del usuario).
- [2026-08-29] Bugs de responsive corregidos tras auditoría dedicada: grid con estilo inline en `regionales.html` que ignoraba media queries, y overflow de emails largos en el footer — Ver sección "Mobile / responsive" arriba para el detalle técnico.
- [2026-09-08] Badges de texto de Aliados reemplazados por logos reales (CSI, UNI Global Union, CUT, Mintrabajo) — El usuario envió los logos reales y pidió usarlos en vez de texto plano.
- [2026-09-08] Tipografía de encabezados cambiada de Poppins a Fraunces (serif) + foto del hero aclarada — El usuario pidió una tipografía "mucho más agradable" (Poppins se sentía genérica) y que la imagen de portada se viera menos oscura.

## Notas
- **Archivo de entrada actual: `index.html`** (requiere servidor local por el uso de `fetch()` para los partials — usar `python3 -m http.server` en la carpeta del proyecto, no abrir con doble clic).
- Contenido real extraído en `contenido-real.md` — usar como fuente única de verdad para todos los textos del rediseño.
- El sitio real es Wix y carga contenido de forma diferida al hacer scroll — la Galería tiene botón "Cargar más" (posible contenido adicional no capturado, solo se vio 1 item de fotos + sección "Videos").
- Decisión de contenido: se eliminaron del v2 las secciones "Casos y denuncias" y "Testimonios" porque eran inventadas (no existen en el sitio real) — se reemplazaron por Historia real (litigios 2012–2013) y una cita real extraída del texto de Historia.
