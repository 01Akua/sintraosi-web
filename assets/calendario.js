// Página pública del calendario de fechas importantes de SINTRAOSI.
// Lee la colección `eventos_calendario` (solo estado="publicado") y dibuja:
// 1) un mini-calendario mensual con puntos en los días con evento,
// 2) una lista de próximos eventos y otra de eventos pasados con sus fotos.
// Si Firestore falla, la página no se rompe: solo muestra "sin eventos".
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, query, where, getDocs,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

function getDb() {
  const app = getApps().length ? getApps()[0] : initializeApp(window.SINTRAOSI_FIREBASE_CONFIG);
  return getFirestore(app);
}

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const CATEGORIAS = {
  marcha: "Marcha / movilización",
  asamblea: "Asamblea",
  aniversario: "Aniversario",
  capacitacion: "Capacitación",
  eleccion: "Elección",
  otro: "Actividad",
};

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

let EVENTOS = []; // [{id, titulo, fecha:"YYYY-MM-DD", categoria, descripcion, fotos:[url]}]
let VISTA_MES = new Date();
const HOY = new Date(); HOY.setHours(0,0,0,0);

function parseFecha(f) {
  // "YYYY-MM-DD" -> Date local (evita el corrimiento de zona horaria de new Date("YYYY-MM-DD"))
  const [y, m, d] = (f || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

async function cargarEventos() {
  const db = getDb();
  const q = query(collection(db, "eventos_calendario"), where("estado", "==", "publicado"));
  const snap = await getDocs(q);
  EVENTOS = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => parseFecha(e.fecha));
  EVENTOS.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ---------------------------------------------------------------------------
// Mini-calendario mensual
// ---------------------------------------------------------------------------
function renderCalendario() {
  const year = VISTA_MES.getFullYear();
  const month = VISTA_MES.getMonth();
  $("calMesLabel").textContent = `${MESES[month]} ${year}`;

  const primerDia = new Date(year, month, 1);
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const offset = primerDia.getDay(); // 0=domingo

  const eventosPorDia = {};
  EVENTOS.forEach((e) => {
    const f = parseFecha(e.fecha);
    if (f.getFullYear() === year && f.getMonth() === month) {
      (eventosPorDia[f.getDate()] ||= []).push(e);
    }
  });

  let html = "";
  for (let i = 0; i < offset; i++) html += `<div class="cal-day pad"></div>`;
  for (let d = 1; d <= diasEnMes; d++) {
    const fechaDia = new Date(year, month, d);
    const esHoy = fechaDia.getTime() === HOY.getTime();
    const eventosDia = eventosPorDia[d];
    const esPasado = fechaDia < HOY;
    let cls = "cal-day";
    if (esHoy) cls += " today";
    if (eventosDia) cls += " has-event" + (esPasado ? " is-past" : "");
    const titulo = eventosDia ? eventosDia.map((e) => e.titulo).join(" · ") : "";
    html += `<div class="${cls}" ${titulo ? `title="${escapeHtml(titulo)}" data-dia="${d}"` : ""}>${d}${eventosDia ? '<span class="dot"></span>' : ""}</div>`;
  }
  $("calGrid").innerHTML = html;

  $("calGrid").querySelectorAll(".has-event").forEach((el) => {
    el.addEventListener("click", () => {
      const dia = parseInt(el.dataset.dia, 10);
      const evs = eventosPorDia[dia];
      if (evs && evs.length) {
        document.querySelector(`[data-evento-id="${evs[0].id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
}

$("calPrev").addEventListener("click", () => { VISTA_MES = new Date(VISTA_MES.getFullYear(), VISTA_MES.getMonth() - 1, 1); renderCalendario(); });
$("calNext").addEventListener("click", () => { VISTA_MES = new Date(VISTA_MES.getFullYear(), VISTA_MES.getMonth() + 1, 1); renderCalendario(); });
$("calHoy").addEventListener("click", () => { VISTA_MES = new Date(); renderCalendario(); });

// ---------------------------------------------------------------------------
// Listas de eventos
// ---------------------------------------------------------------------------
function formatoFechaLarga(f) {
  const d = parseFecha(f);
  if (!d) return "";
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function renderEventoCard(e, pasado) {
  const fotosHtml = (e.fotos && e.fotos.length)
    ? `<div class="evento-fotos">${e.fotos.map((url) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(e.titulo)}" loading="lazy">`).join("")}</div>`
    : "";
  return `
    <div class="evento-card ${pasado ? "pasado" : ""}" data-evento-id="${e.id}">
      <div class="evento-head">
        <span class="evento-fecha">${formatoFechaLarga(e.fecha)}</span>
        <span class="evento-cat">${escapeHtml(CATEGORIAS[e.categoria] || CATEGORIAS.otro)}</span>
      </div>
      <h3>${escapeHtml(e.titulo)}</h3>
      ${e.descripcion ? `<p>${escapeHtml(e.descripcion)}</p>` : ""}
      ${fotosHtml}
    </div>
  `;
}

function renderListas() {
  const proximos = EVENTOS.filter((e) => parseFecha(e.fecha) >= HOY);
  const pasados = EVENTOS.filter((e) => parseFecha(e.fecha) < HOY).slice().reverse();

  $("listaProximos").innerHTML = proximos.length
    ? proximos.map((e) => renderEventoCard(e, false)).join("")
    : `<p class="cal-empty">No hay eventos próximos programados todavía.</p>`;

  $("listaPasados").innerHTML = pasados.length
    ? pasados.map((e) => renderEventoCard(e, true)).join("")
    : `<p class="cal-empty">Todavía no hay eventos pasados registrados.</p>`;

  document.querySelectorAll(".evento-fotos img").forEach((img) => {
    img.addEventListener("click", () => abrirLightbox(img.src, img.alt));
  });
}

function abrirLightbox(src, alt) {
  $("lightboxImg").src = src;
  $("lightboxImg").alt = alt;
  $("lightbox").classList.add("open");
}
$("lightbox").addEventListener("click", () => $("lightbox").classList.remove("open"));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("lightbox").classList.remove("open"); });

document.querySelectorAll(".cal-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".cal-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const vista = tab.dataset.vista;
    $("vistaProximos").hidden = vista !== "proximos";
    $("vistaPasados").hidden = vista !== "pasados";
  });
});

async function init() {
  renderCalendario();
  if (!window.SINTRAOSI_FIREBASE_CONFIG) {
    $("listaProximos").innerHTML = `<p class="cal-empty">No hay eventos próximos programados todavía.</p>`;
    $("listaPasados").innerHTML = `<p class="cal-empty">Todavía no hay eventos pasados registrados.</p>`;
    return;
  }
  try {
    await cargarEventos();
  } catch (err) {
    console.warn("No se pudo cargar el calendario desde Firestore.", err);
    EVENTOS = [];
  }
  renderCalendario();
  renderListas();
}

document.addEventListener("DOMContentLoaded", init);
