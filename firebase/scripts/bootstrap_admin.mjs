// Bootstrap del primer usuario admin: crea la cuenta de Firebase Authentication
// (email + contraseña provisional generada al azar) Y el documento en la
// colección `admins` que le da acceso al panel. Pensado para un solo uso, al
// arrancar el proyecto.
//
// Uso: node scripts/bootstrap_admin.mjs correo@ejemplo.com "Nombre Apellido"
//
// La contraseña generada se imprime en pantalla UNA sola vez — cámbiala desde
// el propio login del panel ("¿Olvidaste tu contraseña?") apenas entres.

import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const [, , emailArg, nombreArg] = process.argv;
if (!emailArg) {
  console.error('Uso: node scripts/bootstrap_admin.mjs correo@ejemplo.com "Nombre Apellido"');
  process.exit(1);
}
const email = emailArg.trim().toLowerCase();
const nombre = nombreArg || email;

const serviceAccount = JSON.parse(
  await readFile(new URL("./serviceAccountKey.json", import.meta.url))
);

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

function generarPassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "x") + "!A1";
}

let user;
const password = generarPassword();
try {
  user = await auth.getUserByEmail(email);
  console.log(`Ya existía una cuenta de Auth para ${email} (uid: ${user.uid}). Actualizando su contraseña...`);
  user = await auth.updateUser(user.uid, { password });
} catch {
  user = await auth.createUser({ email, password, displayName: nombre });
  console.log(`Cuenta de Auth creada para ${email} (uid: ${user.uid}).`);
}

await db.collection("admins").doc(email).set({
  email,
  nombre,
  rol: "admin",
  creado_en: new Date().toISOString(),
  creado_por: "bootstrap-script",
});

console.log("\n========================================");
console.log("  Acceso provisional al panel SINTRAOSI");
console.log("========================================");
console.log(`  Correo:      ${email}`);
console.log(`  Contraseña:  ${password}`);
console.log("========================================");
console.log("Cámbiala apenas entres (login -> ¿Olvidaste tu contraseña?).");
