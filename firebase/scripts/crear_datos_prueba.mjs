// Crea un lote de afiliados de prueba (es_prueba: true) para poder ver cómo
// funcionan los porcentajes y gráficos del panel sin tocar los datos reales.
// Todos quedan marcados es_prueba:true, así el panel los excluye de las
// estadísticas y de la tabla por defecto (hay un checkbox "Mostrar registros
// de prueba" para verlos).
//
// Uso: node scripts/crear_datos_prueba.mjs

import { readFile } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  await readFile(new URL("./serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const nombres = [
  ["Prueba", "Uno"], ["Prueba", "Dos"], ["Prueba", "Tres"], ["Prueba", "Cuatro"],
  ["Prueba", "Cinco"], ["Prueba", "Seis"], ["Prueba", "Siete"], ["Prueba", "Ocho"],
  ["Prueba", "Nueve"], ["Prueba", "Diez"], ["Prueba", "Once"], ["Prueba", "Doce"],
];

// Mezcla deliberadamente distinta a la real (37% web / 63% presencial,
// 91% activo / 9% pendiente) para que el contraste se note en los gráficos.
const combos = [
  ["web", "activo"], ["web", "activo"], ["web", "activo"], ["web", "pendiente_verificacion"],
  ["web", "pendiente_verificacion"], ["web", "pendiente_verificacion"], ["web", "pendiente_verificacion"],
  ["presencial", "activo"], ["presencial", "activo"], ["presencial", "activo"], ["presencial", "activo"],
  ["presencial", "pendiente_verificacion"],
];

const empresas = ["Clínica Colsanitas S.A.", "EPS Sanitas", "Centros médicos Keralty", "Colsanitas Keralty"];
const ciudades = ["Bogotá", "Medellín", "Cali", "Bucaramanga", "Sogamoso"];

const batch = db.batch();
nombres.forEach(([n, a], i) => {
  const cedula = `9${String(900000000 + i).slice(1)}`;
  const [canal_registro, estado] = combos[i];
  const ref = db.collection("afiliados").doc(cedula);
  batch.set(ref, {
    cedula,
    tipo_documento: "CEDULA DE CIUDADANIA",
    nombres: n,
    apellidos: a,
    nombre_completo: `${n} ${a}`,
    email: null,
    celular: "3000000000",
    telefono_fijo: null,
    ciudad: ciudades[i % ciudades.length],
    departamento: null,
    direccion: null,
    empresa: empresas[i % empresas.length],
    cargo: "Cargo de prueba",
    sede: null,
    fecha_afiliacion: "2026-01-01",
    canal_registro,
    estado,
    es_prueba: true,
    actualizado_en: new Date().toISOString(),
  });
});

await batch.commit();
console.log(`Creados ${nombres.length} afiliados de prueba (es_prueba: true).`);
console.log("Para borrarlos todos: node scripts/borrar_datos_prueba.mjs");
