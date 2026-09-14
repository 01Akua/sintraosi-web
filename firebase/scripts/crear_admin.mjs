// Da de alta al primer usuario admin del panel (bootstrap).
// Los siguientes admins se pueden agregar directamente desde el panel una vez
// que exista al menos uno.
//
// Requisito: ese email ya debe existir como usuario en Firebase Authentication
// (Console -> Authentication -> Add user).
//
// Uso: node scripts/crear_admin.mjs correo@ejemplo.com "Nombre Apellido"

import { readFile } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const [, , email, nombre] = process.argv;
if (!email) {
  console.error('Uso: node scripts/crear_admin.mjs correo@ejemplo.com "Nombre Apellido"');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  await readFile(new URL("./serviceAccountKey.json", import.meta.url))
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const emailNorm = email.trim().toLowerCase();
await db.collection("admins").doc(emailNorm).set({
  email: emailNorm,
  nombre: nombre || emailNorm,
  rol: "admin",
  creado_en: new Date().toISOString(),
  creado_por: "bootstrap-script",
});

console.log(`Admin creado: ${emailNorm}`);
