// Carga inicial (bulk import) de firebase/data/afiliados_unificados.json a Firestore.
//
// Uso:
//   1. Descarga una clave de cuenta de servicio desde:
//      Firebase Console -> Configuración del proyecto -> Cuentas de servicio -> Generar nueva clave privada
//   2. Guarda el archivo como firebase/scripts/serviceAccountKey.json (NO lo subas a git,
//      ya está en .gitignore).
//   3. npm install firebase-admin   (dentro de firebase/)
//   4. node scripts/import_afiliados.mjs
//
// El script es idempotente: usa la cédula como ID de documento, así que se puede
// correr varias veces sin duplicar registros (sobreescribe con los mismos datos).

import { readFile } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  await readFile(new URL("./serviceAccountKey.json", import.meta.url))
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const afiliados = JSON.parse(
  await readFile(new URL("../data/afiliados_unificados.json", import.meta.url))
);

const BATCH_SIZE = 400; // límite de Firestore es 500 escrituras por batch

async function main() {
  console.log(`Importando ${afiliados.length} afiliados...`);
  let importados = 0;

  for (let i = 0; i < afiliados.length; i += BATCH_SIZE) {
    const chunk = afiliados.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const afiliado of chunk) {
      const ref = db.collection("afiliados").doc(afiliado.cedula);
      batch.set(ref, {
        ...afiliado,
        actualizado_en: new Date().toISOString(),
      });
    }
    await batch.commit();
    importados += chunk.length;
    console.log(`  ${importados}/${afiliados.length}`);
  }

  console.log("Listo. Importación completa.");
  console.log(
    "\nRecuerda crear el primer usuario admin:\n" +
      "  1. Firebase Console -> Authentication -> Add user (email + contraseña)\n" +
      "  2. Firestore -> colección 'admins' -> documento con ID = ese email en minúsculas ->\n" +
      "     campos: { email, nombre, rol: 'admin' }\n" +
      "  (o corre: node scripts/crear_admin.mjs tu@email.com \"Tu Nombre\")"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
