# Base de afiliados SINTRAOSI en Firebase — guía de puesta en marcha

Esta carpeta contiene todo lo necesario para migrar la base de afiliados a
Firestore y dejar el panel administrativo (`/admin.html` en la raíz del sitio)
funcionando. Ya se hizo el trabajo de limpieza/unificación de datos — lo que
falta es crear el proyecto de Firebase y cargar los datos.

## 1. Crear el proyecto de Firebase

1. Ve a https://console.firebase.google.com/ e inicia sesión con la cuenta de Google que administrará esto.
2. **Agregar proyecto** → nómbralo (ej. `sintraosi-afiliados`) → puedes desactivar Google Analytics, no se necesita.
3. Dentro del proyecto, ve a **Compilación → Firestore Database → Crear base de datos**.
   - Modo: **producción** (no "modo de prueba" — ya vamos a subir nuestras propias reglas).
   - Ubicación: `southamerica-east1` (São Paulo) o `us-central1`, cualquiera sirve; elige una y no la cambies después.
4. Ve a **Compilación → Authentication → Comenzar** → pestaña **Sign-in method** → habilita **Correo electrónico/contraseña**.
   - **No** actives "Enlace de correo electrónico" ni ningún proveedor social, no los necesitamos.

## 2. Registrar la app web y obtener el config

1. En la página principal del proyecto (ícono de engranaje → **Configuración del proyecto**), baja a **Tus apps** → clic en el ícono `</>` (Web).
2. Nombra la app (ej. "Panel SINTRAOSI"), **no** actives Firebase Hosting (ya usamos GitHub Pages).
3. Copia el objeto `firebaseConfig` que te muestra y pégalo en:
   `assets/firebase-config.js` (reemplaza los valores `TU_...`).
   - Este archivo **sí se sube a git** — la config web de Firebase no es secreta, la seguridad la dan las reglas de Firestore.

## 3. Crear el primer usuario admin

1. **Authentication → Users → Add user** → tu correo + una contraseña temporal (cámbiala luego desde "¿Olvidaste tu contraseña?" en el login del panel, o créala fuerte desde ya).
2. Descarga la clave de servicio para poder correr los scripts de este directorio:
   **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada** → guarda el archivo como:
   `firebase/scripts/serviceAccountKey.json` (ya está en `.gitignore`, nunca se sube).
3. Instala dependencias y crea tu usuario admin:
   ```bash
   cd firebase
   npm install
   node scripts/crear_admin.mjs tu@correo.com "Tu Nombre"
   ```

## 4. Publicar las reglas de seguridad

Necesitas la [Firebase CLI](https://firebase.google.com/docs/cli):
```bash
npm install -g firebase-tools
firebase login
cd firebase
firebase use --add          # selecciona el proyecto que creaste
firebase deploy --only firestore:rules
```

## 5. Importar la base de datos unificada

Los datos ya están limpios y unificados en `firebase/data/afiliados_unificados.json`
(generado por `firebase/scripts/unify_afiliados.py` a partir de la base oficial
`.xls` y el `afiliados.csv` del formulario web). Para subirlos:
```bash
cd firebase
node scripts/import_afiliados.mjs
```
Es idempotente (usa la cédula como ID de documento) — puedes correrlo de nuevo
sin duplicar nada.

## 6. Abrir el panel

Con todo lo anterior hecho, abre `admin.html` (sirviendo el sitio con un
servidor local, igual que el resto del sitio — no funciona con `file://`
directo por los `fetch()` de los partials). En producción, como ya está en
GitHub Pages, simplemente estará disponible en:
`https://01akua.github.io/sintraosi-web/admin.html`

Inicia sesión con el correo/contraseña que creaste en el paso 3.

## Agregar más miembros de junta directiva

Desde el propio panel: pestaña **Usuarios del panel**. Pero primero cada
persona necesita una cuenta de Authentication (**Authentication → Add user**
en la consola) — el panel no crea cuentas de login, solo habilita el acceso
de una cuenta que ya existe.

## Reprocesar los datos originales (si llegan actualizaciones)

Si el sindicato entrega una nueva versión del Excel oficial o hay más
envíos del formulario web, vuelve a correr:
```bash
python3 firebase/scripts/unify_afiliados.py
cd firebase && node scripts/import_afiliados.mjs
```
Revisa antes `firebase/data/reporte.json` y `firebase/data/registros_descartados.csv`
para ver qué cambió y qué se descartó por ser prueba/inválido.

## Estructura de datos (colección `afiliados`, id = cédula)

| Campo | Descripción |
|---|---|
| `canal_registro` | `"web"` (llenó el formulario del sitio) o `"presencial"` (solo está en la base oficial) |
| `estado` | `"activo"` (ya en la base oficial del sindicato) o `"pendiente_verificacion"` (solo llegó por la web, falta que junta directiva lo valide y lo pase a la base oficial) |
| `fuente` | `{ base_oficial_fila, form_id_web }` — trazabilidad al registro original |

Ver el resto de campos en cualquier documento de `firebase/data/afiliados_unificados.json`.
