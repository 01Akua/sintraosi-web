// Borra todos los afiliados marcados es_prueba:true (los creados por
// crear_datos_prueba.mjs, o cualquier otro dado de alta como prueba desde el
// panel). No toca ningún dato real.
//
// Uso: node scripts/borrar_datos_prueba.mjs

import { readFile } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  await readFile(new URL("./serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection("afiliados").where("es_prueba", "==", true).get();
if (snap.empty) {
  console.log("No hay afiliados de prueba que borrar.");
  process.exit(0);
}

const batch = db.batch();
snap.docs.forEach((d) => batch.delete(d.ref));
await batch.commit();
console.log(`Borrados ${snap.size} afiliados de prueba.`);
