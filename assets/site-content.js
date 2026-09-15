// Hidrata las páginas públicas del sitio con el contenido publicado en
// Firestore (textos editables y listas reordenables: noticias, regionales,
// junta directiva, galería). Si Firestore no responde o algo falla, la
// página se queda tal cual con su contenido estático — nunca se rompe.
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, collection, query, where, orderBy, getDocs,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

function getDb() {
  const app = getApps().length ? getApps()[0] : initializeApp(window.SINTRAOSI_FIREBASE_CONFIG);
  return getFirestore(app);
}

function aplicarCampos(campos) {
  if (!campos) return;
  document.querySelectorAll("[data-cms]").forEach((el) => {
    const key = el.dataset.cms;
    if (campos[key] != null && campos[key] !== "") el.textContent = campos[key];
  });
}

// Slugs de las subpáginas regional-<slug>.html — si una ciudad no está aquí,
// las tarjetas enlazan a noticias.html en vez de una subpágina inexistente.
const SLUGS_REGIONALES = {
  "Bogotá D.C.": "bogota",
  "Medellín": "medellin",
  "Cali": "cali",
  "Barranquilla": "barranquilla",
  "Cartagena": "cartagena",
  "Bucaramanga": "bucaramanga",
  "Villavicencio": "villavicencio",
  "Ibagué": "ibague",
};

// ---- Renderers de listas: listId -> (contenedor, items) => void ----
const RENDERERS = {
  regionales(container, items, limite) {
    const datos = limite ? items.slice(0, limite) : items;
    let html = datos.map((it) => {
      const slug = SLUGS_REGIONALES[it.ciudad];
      const href = slug ? `regional-${slug}.html` : "noticias.html";
      return `
      <div class="reg-card">
        <div class="reg-code">${escapeHtml(it.ciudad || "").slice(0, 3).toUpperCase()}</div>
        <div class="reg-city">${escapeHtml(it.ciudad)}</div>
        <div class="reg-tag">${escapeHtml(it.etiqueta)}</div>
        ${it.texto ? `<p style="font-size:0.85rem; color:var(--texto-mute); margin-top:6px;">${escapeHtml(it.texto)}</p>` : ""}
        <a href="${href}" class="reg-link">Ver regional →</a>
      </div>
    `;
    }).join("");
    // Tarjeta fija de "contáctanos" al final, solo en la página completa de regionales.
    if (container.dataset.cmsExtraCard === "contacto") {
      html += `
        <div class="reg-card" style="justify-content:center; align-items:center; text-align:center;">
          <p style="font-size:0.85rem; color:var(--texto-mute);">¿Tu ciudad no aparece? Escríbenos.</p>
          <a href="contacto.html" class="reg-link">Contáctanos →</a>
        </div>
      `;
    }
    container.innerHTML = html;
  },
  junta(container, items) {
    container.innerHTML = items.map((it) => `
      <div class="junta-card">
        <div class="junta-avatar">${escapeHtml(it.iniciales)}</div>
        <div><div class="junta-name">${escapeHtml(it.nombre)}</div><div class="junta-role">${escapeHtml(it.cargo)}</div></div>
      </div>
    `).join("");
  },
  galeria(container, items, limite) {
    let datos = items;
    if (limite) datos = items.filter((it) => it.imagen_url).slice(0, limite);
    container.innerHTML = datos.map((it) => {
      if (!it.imagen_url) return `<div class="gal-item filled">${escapeHtml(it.caption)}</div>`;
      return `<div class="gal-item photo"><img src="${escapeAttr(it.imagen_url)}" alt="${escapeAttr(it.caption)}"><div class="cap">${escapeHtml(it.caption)}</div></div>`;
    }).join("");
  },
};

function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function renderNoticiaCard(n) {
  const thumb = n.imagen_url
    ? `<img src="${escapeAttr(n.imagen_url)}" alt="${escapeAttr(n.titulo)}">`
    : `<span class="news-thumb-ph">IMAGEN — comunicado</span>`;
  return `
    <div class="news-card">
      <div class="news-thumb">${thumb}</div>
      <div class="news-body">
        <div class="news-region">SINTRAOSI ${escapeHtml(n.region)}</div>
        <h3>${escapeHtml(n.titulo)}</h3>
        <a href="noticia.html?id=${encodeURIComponent(n.id)}" class="read">Leer más →</a>
      </div>
    </div>
  `;
}

async function cargarNoticias(db) {
  const contenedores = document.querySelectorAll("[data-cms-list='noticias']");
  if (!contenedores.length) return;
  const q = query(collection(db, "noticias"), where("estado", "==", "publicado"), orderBy("orden", "asc"));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  contenedores.forEach((el) => {
    const limite = el.dataset.cmsLimite ? parseInt(el.dataset.cmsLimite, 10) : null;
    const region = el.dataset.cmsRegion || null;
    // El filtro por región se hace en el cliente (no en la consulta) para no
    // depender de un índice compuesto de Firestore por región + estado + orden.
    let datos = region ? items.filter((n) => n.region === region) : items;
    if (limite) datos = datos.slice(0, limite);
    if (!datos.length) return; // sin datos: deja el contenido estático de respaldo
    el.innerHTML = datos.map(renderNoticiaCard).join("");
  });
}

async function cargarPagina(db, pageId) {
  const snap = await getDoc(doc(db, "paginas_publicado", pageId));
  if (!snap.exists()) return;
  const data = snap.data();
  aplicarCampos(data.campos);
  for (const [listId, items] of Object.entries(data.listas || {})) {
    const renderer = RENDERERS[listId];
    if (!renderer) continue;
    document.querySelectorAll(`[data-cms-list='${listId}']`).forEach((el) => {
      const limite = el.dataset.cmsLimite ? parseInt(el.dataset.cmsLimite, 10) : null;
      if (!items.length) return;
      renderer(el, items, limite);
    });
  }
}

export async function initSiteContent() {
  if (!window.SINTRAOSI_FIREBASE_CONFIG) return;
  const page = document.body.dataset.page;
  const pageIdMap = { inicio: "inicio", regionales: "regionales", junta: "junta", galeria: "galeria" };
  try {
    const db = getDb();
    const tareas = [cargarNoticias(db)];
    if (page && pageIdMap[page]) tareas.push(cargarPagina(db, pageIdMap[page]));
    // El home usa listas de otras páginas también (regionales, galería) además de sus propios campos.
    if (page === "inicio") {
      tareas.push(cargarPagina(db, "regionales"));
      tareas.push(cargarPagina(db, "galeria"));
    }
    await Promise.all(tareas);
  } catch (err) {
    console.warn("No se pudo cargar el contenido editable desde Firestore, se muestra el contenido estático.", err);
  }
}

document.addEventListener("DOMContentLoaded", initSiteContent);
