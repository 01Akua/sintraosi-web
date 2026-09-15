// Migra el contenido actualmente hardcodeado del sitio (textos de Inicio,
// regionales, junta directiva, galería y las noticias existentes) a Firestore,
// para que el panel pueda editarlo desde ya sin que el sitio público cambie
// en nada al momento de correr este script.
//
// Uso: node scripts/seed_contenido.mjs
// Es idempotente: se puede volver a correr, sobreescribe con los mismos datos.

import { readFile } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  await readFile(new URL("./serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ---------------------------------------------------------------------------
// Páginas: campos de texto + listas reordenables
// ---------------------------------------------------------------------------
const paginas = {
  inicio: {
    campos: {
      hero_tagline: "Sindicato de primer grado — UNI Global Union · CUT",
      hero_titulo_1: "Sindicalismo",
      hero_titulo_2: "de cara al futuro.",
      hero_lede: "Somos una organización sindical independiente que busca mejorar las condiciones laborales y sociales de los trabajadores del Grupo Empresarial Keralty / Sanitas Internacional y sus familias, mediante el diálogo respetuoso y la negociación colectiva.",
      quienes_tag: "Quiénes somos",
      quienes_titulo: "Una organización sindical al servicio de sus afiliados",
      quienes_p1: "Somos una Organización Sindical independiente encaminada en la búsqueda de las mejoras de las condiciones laborales y sociales de nuestros afiliados y sus familias, mediante un diálogo respetuoso y la negociación colectiva.",
      quienes_p2: "Contamos con un grupo de directivos comprometidos con responsabilidad social y valores que inspiren confianza entre los afiliados, con vida sindical activa y vocación de servicio.",
      noticias_tag: "Manténgase informado",
      noticias_titulo: "Últimas noticias",
      noticias_p: "Acontecimientos recientes de las regionales SINTRAOSI a nivel nacional.",
      regionales_tag: "Presencia nacional",
      regionales_titulo: "Encuentra tu regional",
      regionales_p: "SINTRAOSI tiene presencia activa en ocho ciudades del país.",
      galeria_tag: "Momentos SINTRAOSI",
      galeria_titulo: "Galería",
      galeria_p: "Fotos y videos de nuestras jornadas, asambleas y actividades regionales.",
      cta_titulo: "Tu afiliación te protege desde el primer día.",
      cta_p: "Completa el formulario de afiliación y un delegado de tu regional revisará tu solicitud. La membresía está protegida por fuero sindical.",
    },
    listas: {},
  },
  regionales: {
    campos: {},
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
    },
  },
  junta: {
    campos: {},
    listas: {
      junta: [
        { iniciales: "DA", nombre: "Darwin Acevedo", cargo: "Presidente" },
        { iniciales: "KD", nombre: "Kelly Díaz Becerra", cargo: "Secretaria" },
        { iniciales: "ML", nombre: "Mary López", cargo: "Fiscal" },
        { iniciales: "SC", nombre: "Sandra Corredor", cargo: "Tesorera" },
        { iniciales: "GR", nombre: "Gustavo Ríos", cargo: "Vicepresidente" },
        { iniciales: "MH", nombre: "Mónica Hoyos", cargo: "Secretaria mujer" },
        { iniciales: "AF", nombre: "Anyela Franco", cargo: "Secretaria asuntos Jurídicos" },
        { iniciales: "JM", nombre: "Juan Carlos Molina", cargo: "Secretaria salud" },
        { iniciales: "DÁ", nombre: "Diego Álzate", cargo: "Prensa y propaganda" },
        { iniciales: "MR", nombre: "Miguel Ángel Rodríguez", cargo: "Secretaria Bienestar" },
      ],
    },
  },
  galeria: {
    campos: {},
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
      ],
    },
  },
};

for (const [pageId, contenido] of Object.entries(paginas)) {
  const doc = { ...contenido, actualizado_en: new Date().toISOString() };
  await db.collection("paginas_borrador").doc(pageId).set(doc);
  await db.collection("paginas_publicado").doc(pageId).set({ ...doc, publicado_en: new Date().toISOString() });
  console.log(`Página '${pageId}' sembrada (borrador + publicado).`);
}

// ---------------------------------------------------------------------------
// Noticias existentes (las que ya estaban hardcodeadas en el sitio)
// ---------------------------------------------------------------------------
const noticias = [
  { region: "Medellín", titulo: "¡Pago de saldos en fondos de pensiones! Comunicado…", resumen: "", contenido: "", imagen_url: "", fecha: "", orden: 1 },
  { region: "Barranquilla", titulo: "¡Barranquilla en pie de lucha! Keralty arremete…", resumen: "", contenido: "", imagen_url: "", fecha: "2021-09-04", orden: 2 },
  { region: "Cali", titulo: "Cali cuenta con cartelera informativa en Clínica Sebastián de Belalcázar…", resumen: "", contenido: "", imagen_url: "", fecha: "", orden: 3 },
  { region: "Bucaramanga", titulo: "Renuncia Esauc Figueroa como presidente de la subdirectiva…", resumen: "", contenido: "", imagen_url: "", fecha: "", orden: 4 },
  { region: "Bogotá D.C.", titulo: "Ley de luto — de tu derecho a saber…", resumen: "", contenido: "", imagen_url: "", fecha: "", orden: 5 },
];

for (let i = 0; i < noticias.length; i++) {
  // ID fijo (no autogenerado) para que correr el script varias veces no duplique.
  const ref = db.collection("noticias").doc(`seed-${i + 1}`);
  await ref.set({
    ...noticias[i],
    estado: "publicado",
    creado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
  });
}
console.log(`${noticias.length} noticias sembradas (publicadas).`);

console.log("\nListo. El sitio sigue mostrando exactamente lo mismo -- ahora ese contenido vive en Firestore y se puede editar desde el panel.");
