// Actualiza en Firestore lo que agregamos en esta sesión, para que el panel
// admin y el CMS queden en sync con el HTML estático (si no se hace esto, el
// cliente de site-content.js sobreescribiría las fotos nuevas de junta/galería
// con los datos viejos que ya estaban en Firestore al cargar la página).
//
// Uso: node scripts/update_organigramas_calendario.mjs
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

// ---------------------------------------------------------------------------
// Junta nacional: mismos 10, ahora con foto real.
// ---------------------------------------------------------------------------
await setPagina("junta", {
  listas: {
    junta: [
      { iniciales: "DA", nombre: "Darwin Acevedo", cargo: "Presidente", foto: "assets/equipo/nacional-darwin-acevedo.jpg" },
      { iniciales: "KD", nombre: "Kelly Díaz Becerra", cargo: "Secretaria", foto: "assets/equipo/nacional-kelly-diaz-becerra.jpg" },
      { iniciales: "ML", nombre: "Mary López", cargo: "Fiscal", foto: "assets/equipo/nacional-mary-lopez.jpg" },
      { iniciales: "SC", nombre: "Sandra Corredor", cargo: "Tesorera", foto: "assets/equipo/nacional-sandra-corredor.jpg" },
      { iniciales: "GR", nombre: "Gustavo Ríos", cargo: "Vicepresidente", foto: "assets/equipo/nacional-gustavo-rios.jpg" },
      { iniciales: "MH", nombre: "Mónica Hoyos", cargo: "Secretaria mujer", foto: "assets/equipo/nacional-monica-hoyos.jpg" },
      { iniciales: "AF", nombre: "Anyela Franco", cargo: "Secretaria asuntos Jurídicos", foto: "assets/equipo/nacional-anyela-franco.jpg" },
      { iniciales: "JM", nombre: "Juan Carlos Molina", cargo: "Secretaria salud", foto: "assets/equipo/nacional-juan-carlos-molina.jpg" },
      { iniciales: "DÁ", nombre: "Diego Álzate", cargo: "Prensa y propaganda", foto: "assets/equipo/nacional-diego-alzate.jpg" },
      { iniciales: "MR", nombre: "Miguel Ángel Rodríguez", cargo: "Secretaria Bienestar", foto: "assets/equipo/nacional-miguel-angel-rodriguez.jpg" },
    ],
  },
});

// ---------------------------------------------------------------------------
// Galería: los 9 items originales + las 7 fotos de la marcha del 1° de mayo.
// ---------------------------------------------------------------------------
await setPagina("galeria", {
  listas: {
    galeria: [
      { imagen_url: "", caption: "Día Internacional de la Mujer SINTRAOSI" },
      { imagen_url: "assets/foto-1.jpg", caption: "Movilización en la Plaza de Bolívar, Bogotá" },
      { imagen_url: "assets/foto-2.jpg", caption: "Jornada de movilización, Bogotá" },
      { imagen_url: "assets/foto-3.jpg", caption: "Delegación SINTRAOSI · UNI Global Union" },
      { imagen_url: "assets/foto-4.jpg", caption: "Marcha nacional junto a otras centrales obreras" },
      { imagen_url: "assets/foto-5.jpg", caption: "Afiliadas SINTRAOSI en movilización" },
      { imagen_url: "assets/foto-6.jpg", caption: "1ra Asamblea Nacional SINTRAOSI 2026" },
      { imagen_url: "assets/foto-7.jpg", caption: "Encuentro institucional de la Junta Directiva" },
      { imagen_url: "assets/foto-8.jpg", caption: "Pancarta SINTRAOSI · Keralty / EPS Sanitas" },
      { imagen_url: "assets/marcha-1-mayo/foto-1.jpg", caption: "Marcha del 1° de Mayo · Subdirectiva Ibagué" },
      { imagen_url: "assets/marcha-1-mayo/foto-2.jpg", caption: "Marcha del 1° de Mayo · Ibagué" },
      { imagen_url: "assets/marcha-1-mayo/foto-3.jpg", caption: "Marcha del 1° de Mayo · Ibagué" },
      { imagen_url: "assets/marcha-1-mayo/foto-4.jpg", caption: "Marcha del 1° de Mayo · Ibagué" },
      { imagen_url: "assets/marcha-1-mayo/foto-5.jpg", caption: "Marcha del 1° de Mayo · Ibagué" },
      { imagen_url: "assets/marcha-1-mayo/foto-6.jpg", caption: "Marcha del 1° de Mayo · Ibagué" },
      { imagen_url: "assets/marcha-1-mayo/foto-7.jpg", caption: "Marcha del 1° de Mayo · Ibagué" },
    ],
  },
});

// ---------------------------------------------------------------------------
// Regionales: se conserva la lista de tarjetas por ciudad + se agregan los
// dos organigramas de mesas regionales (Ibagué, Medellín).
// ---------------------------------------------------------------------------
await setPagina("regionales", {
  listas: {
    regionales: [
      { ciudad: "Bogotá D.C.", etiqueta: "Sede nacional", texto: "Calle 28 A # 15-55, Ofi. 301" },
      { ciudad: "Medellín", etiqueta: "Regional activa", texto: "Seguimiento a fondos de pensiones y comunicados regionales." },
      { ciudad: "Cali", etiqueta: "Regional activa", texto: "Cartelera informativa activa en Clínica Sebastián de Belalcázar." },
      { ciudad: "Barranquilla", etiqueta: "Regional Caribe", texto: "Regional en pie de lucha frente a decisiones del Grupo Keralty." },
      { ciudad: "Cartagena", etiqueta: "Regional Caribe", texto: "Regional con afiliados activos en Cartagena y la costa Caribe." },
      { ciudad: "Bucaramanga", etiqueta: "Regional activa", texto: "Subdirectiva regional con junta propia." },
      { ciudad: "Villavicencio", etiqueta: "Regional nueva", texto: "Regional en formalización — datos de contacto y junta pendientes." },
      { ciudad: "Ibagué", etiqueta: "Regional nueva", texto: "Regional en formalización — datos de contacto y junta pendientes." },
    ],
    mesa_ibague: [
      { nombre: "Sandra Patricia Quintero Rodríguez", cargo: "Secretaría de Organización y Formación", foto: "assets/equipo/ibague-sandra-quintero.jpg" },
      { nombre: "Esmeralda Cala Ferreira", cargo: "Tesorera", foto: "assets/equipo/ibague-esmeralda-cala.jpg" },
      { nombre: "Diana Carolina Zuluaga Herrán", cargo: "Secretaria General", foto: "assets/equipo/ibague-diana-zuluaga.jpg" },
      { nombre: "Ingrid Katherine Murcia Castellanos", cargo: "Secretaría de Prensa y Publicidad", foto: "assets/equipo/ibague-ingrid-murcia.jpg" },
      { nombre: "Johana Alejandra Torres Buitrago", cargo: "Secretaría de Asuntos Jurídicos, Laborales e Intersindicales", foto: "assets/equipo/ibague-johana-torres.jpg" },
      { nombre: "Angélica María Bohórquez Heredia", cargo: "Fiscal", foto: "assets/equipo/ibague-angelica-bohorquez.jpg" },
      { nombre: "Liliana Mayret Ballares Zorro", cargo: "Secretaría de Salud y el Deporte", foto: "assets/equipo/ibague-liliana-ballares.jpg" },
      { nombre: "Laura Estefanía Carrillo Guerra", cargo: "Secretaría de la Mujer", foto: "assets/equipo/ibague-laura-carrillo.jpg" },
    ],
    mesa_medellin: [
      { nombre: "Mónica María Hoyos Maya", cargo: "Presidente Medellín", foto: "assets/equipo/medellin-monica-hoyos.jpg" },
      { nombre: "Luz Mery González Rivera", cargo: "Vicepresidente", foto: "assets/equipo/medellin-luz-mery-gonzalez.jpg" },
      { nombre: "Leidy Johanna Restrepo Ortiz", cargo: "Secretaria General", foto: "assets/equipo/medellin-leidy-restrepo.jpg" },
      { nombre: "María Piedad Zuluaga Ramírez", cargo: "Tesorera", foto: "assets/equipo/medellin-maria-piedad-zuluaga.jpg" },
      { nombre: "María Paulina Sierra Monsalve", cargo: "Revisor Fiscal", foto: "assets/equipo/medellin-maria-paulina-sierra.jpg" },
      { nombre: "Cristina Adriana Ospina Arango", cargo: "Secretaría de Asuntos Jurídicos e Intersindicales", foto: "assets/equipo/medellin-cristina-ospina.jpg" },
      { nombre: "Sulien Castaño Beltrán", cargo: "Secretaría de Salud y Bienestar", foto: "assets/equipo/medellin-sulien-castano.jpg" },
      { nombre: "Catalina Cardona Castaño", cargo: "Secretaría de Organización y Formación", foto: "assets/equipo/medellin-catalina-cardona.jpg" },
      { nombre: "Lina María Martínez Ruiz", cargo: "Secretaría de Organización y Formación", foto: "assets/equipo/medellin-lina-martinez.jpg" },
      { nombre: "Claudia Patricia Chica Rojas", cargo: "Secretaría de Organización y Formación", foto: "assets/equipo/medellin-claudia-chica.jpg" },
    ],
  },
});

// ---------------------------------------------------------------------------
// Calendario: evento "Marcha del Primero de Mayo" con las fotos ya asociadas.
// ---------------------------------------------------------------------------
await db.collection("eventos_calendario").doc("marcha-1-mayo-2026").set({
  titulo: "Marcha del Primero de Mayo — Subdirectiva Ibagué",
  fecha: "2026-05-01",
  categoria: "marcha",
  descripcion: "Movilización del Día Internacional de los Trabajadores. La subdirectiva Ibagué marchó junto a otras centrales obreras (CUT, UNI Global Union) exigiendo mejores condiciones laborales.",
  fotos: [
    "assets/marcha-1-mayo/foto-1.jpg",
    "assets/marcha-1-mayo/foto-2.jpg",
    "assets/marcha-1-mayo/foto-3.jpg",
    "assets/marcha-1-mayo/foto-4.jpg",
    "assets/marcha-1-mayo/foto-5.jpg",
    "assets/marcha-1-mayo/foto-6.jpg",
    "assets/marcha-1-mayo/foto-7.jpg",
  ],
  estado: "publicado",
  creado_en: new Date().toISOString(),
  actualizado_en: new Date().toISOString(),
}, { merge: true });
console.log("Evento 'Marcha del Primero de Mayo' sembrado en eventos_calendario.");

console.log("\nListo.");
