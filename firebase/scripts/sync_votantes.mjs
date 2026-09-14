// Sincroniza la colección `votantes_hash` a partir de los afiliados activos.
// El panel también mantiene esto al día automáticamente cuando se crea/edita/
// elimina un afiliado desde admin.js — este script es para la carga inicial
// (o para re-sincronizar todo de una vez si algo quedó desalineado).
//
// hash = sha256(cedula + "|" + fecha_nacimiento) — el mismo cálculo que hace
// el navegador del afiliado en votar.html. El hash no permite recuperar la
// cédula ni la fecha (es de un solo sentido), solo sirve para verificar
// "esta combinación corresponde a un afiliado activo real".
//
// Uso: node scripts/sync_votantes.mjs

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  await readFile(new URL("./serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function hash(cedula, fechaNacimiento) {
  return createHash("sha256").update(`${cedula}|${fechaNacimiento}`).digest("hex");
}

const snap = await db.collection("afiliados").where("estado", "==", "activo").get();
const hashesValidos = new Set();
let sinFecha = 0;

const batchWrites = [];
snap.forEach((doc) => {
  const a = doc.data();
  if (!a.fecha_nacimiento) {
    sinFecha++;
    return;
  }
  const h = hash(a.cedula, a.fecha_nacimiento);
  hashesValidos.add(h);
  batchWrites.push(h);
});

console.log(`Afiliados activos: ${snap.size} (${sinFecha} sin fecha de nacimiento, no pueden votar hasta que se corrija).`);

// Escribir en lotes de 400
for (let i = 0; i < batchWrites.length; i += 400) {
  const batch = db.batch();
  for (const h of batchWrites.slice(i, i + 400)) {
    batch.set(db.collection("votantes_hash").doc(h), { sincronizado_en: new Date().toISOString() });
  }
  await batch.commit();
  console.log(`  ${Math.min(i + 400, batchWrites.length)}/${batchWrites.length}`);
}

// Borrar hashes que ya no corresponden a ningún afiliado activo (p.ej. alguien
// que dejó de estar activo desde la última sincronización).
const existentes = await db.collection("votantes_hash").get();
const batchDel = db.batch();
let borrados = 0;
existentes.forEach((doc) => {
  if (!hashesValidos.has(doc.id)) {
    batchDel.delete(doc.ref);
    borrados++;
  }
});
if (borrados > 0) {
  await batchDel.commit();
}

console.log(`Listo. ${batchWrites.length} habilitados para votar, ${borrados} revocados.`);
