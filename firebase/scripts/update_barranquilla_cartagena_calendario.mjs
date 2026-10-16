// Agrega a Firestore las mesas regionales de Barranquilla y Cartagena (ya
// publicadas en las páginas estáticas regional-barranquilla.html /
// regional-cartagena.html) y los dos eventos del calendario de actividades
// sobre la convocatoria de Delegados Nacionales 2026 (Resolución N°002 de
// 2026 de la Junta Directiva Nacional).
//
// Uso: node scripts/update_barranquilla_cartagena_calendario.mjs
// Es idempotente: se puede volver a correr sin duplicar nada.

import { readFile } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  await readFile(new URL("./serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function setPagina(pageId, contenido) {
  const doc = { ...contenido, actualizado_en: new Date().toISOString() };
  await db.collection("paginas_borrador").doc(pageId).set(doc, { merge: true });
  await db.collection("paginas_publicado").doc(pageId).set({ ...doc, publicado_en: new Date().toISOString() }, { merge: true });
  console.log(`Página '${pageId}' actualizada (borrador + publicado).`);
}

await setPagina("regionales", {
  listas: {
    mesa_barranquilla: [
      { nombre: "Mario Raul Polo Mercado", cargo: "Presidente subdirectiva Barranquilla", foto: "assets/equipo/barranquilla-mario-polo.jpg" },
      { nombre: "Patricia Rico Acevedo", cargo: "Vicepresidente", foto: "assets/equipo/barranquilla-patricia-rico.jpg" },
      { nombre: "Luz Dary Caro Pérez", cargo: "Secretaria", foto: "assets/equipo/barranquilla-luz-dary-caro.jpg" },
      { nombre: "Tania Luz Pérez Giraldo", cargo: "Tesorera", foto: "assets/equipo/barranquilla-tania-perez.jpg" },
      { nombre: "Katty Chinchilla Cardona", cargo: "Secretaria de la Mujer", foto: "assets/equipo/barranquilla-katty-chinchilla.jpg" },
      { nombre: "Joaquín Soto Velásquez", cargo: "Secretario de Salud y Deportes", foto: "assets/equipo/barranquilla-joaquin-soto.jpg" },
      { nombre: "Mercedes Gaviria Orozco", cargo: "Asuntos Laborales", foto: "assets/equipo/barranquilla-mercedes-gaviria.jpg" },
      { nombre: "Fanny Anaya Ortega", cargo: "Comité de Reclamos", foto: "assets/equipo/barranquilla-fanny-anaya.jpg" },
    ],
    mesa_cartagena: [
      { nombre: "Celia Margarita Baldiris Babilonia", cargo: "Presidente", foto: "assets/equipo/cartagena-celia-baldiris.jpg" },
      { nombre: "Tania Margarita de la Paz Ashook Puello", cargo: "Vicepresidencia", foto: "assets/equipo/cartagena-tania-ashook.jpg" },
      { nombre: "Marta Inés Martelo Ramos", cargo: "Secretaria General", foto: "assets/equipo/cartagena-marta-martelo.jpg" },
      { nombre: "Katleya Peñate Utria", cargo: "Fiscal", foto: "assets/equipo/cartagena-katleya-penate.jpg" },
      { nombre: "Alix Josefina Marín Rodriguez", cargo: "Secretaria Jurídica", foto: "assets/equipo/cartagena-alix-marin.jpg" },
      { nombre: "Diana Paola Arnedo Arteta", cargo: "Secretaría de la Mujer", foto: "assets/equipo/cartagena-diana-arnedo.jpg" },
      { nombre: "María Polo Peña", cargo: "Secretaría de Formación y Organización", foto: "assets/equipo/cartagena-maria-polo.jpg" },
      { nombre: "Ernesto José Redondo Aparicio", cargo: "Secretaría de Deportes", foto: "assets/equipo/cartagena-ernesto-redondo.jpg" },
      { nombre: "Mauricio Llamas Reales", cargo: "Secretario de Prensa y Propaganda", foto: "assets/equipo/cartagena-mauricio-llamas.jpg" },
    ],
  },
});

const eventosCalendario = [
  {
    id: "postulacion-delegados-nacionales-2026",
    titulo: "Postulación de Delegados Nacionales 2026",
    fecha: "2026-10-02",
    categoria: "otro",
    descripcion: "Resolución N°002 de 2026 de la Junta Directiva Nacional. Recepción de postulaciones del 2 al 9 de octubre (cierre el 9 de octubre). Requisitos: mínimo 2 años de afiliación, pertenecer directa o indirectamente a empresas del Grupo Empresarial Keralty, no pertenecer a otra organización sindical y estar a paz y salvo con el sindicato. Enviar datos a presidencia.nacional@sintraosi.org o secretaria.nacional@sintraosi.org.",
  },
  {
    id: "eleccion-delegados-nacionales-2026",
    titulo: "Elección de Delegados Nacionales 2026",
    fecha: "2026-10-15",
    categoria: "eleccion",
    descripcion: "Votación de los Delegados Nacionales SINTRAOSI a nivel nacional, con un único listado, mediante voto secreto y directo en modalidad virtual (Resolución N°002 de 2026).",
  },
];

for (const ev of eventosCalendario) {
  const { id, ...data } = ev;
  await db.collection("eventos_calendario").doc(id).set({
    ...data,
    estado: "publicado",
    creado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
  }, { merge: true });
  console.log(`Evento '${id}' publicado en eventos_calendario.`);
}

console.log("\nListo.");
