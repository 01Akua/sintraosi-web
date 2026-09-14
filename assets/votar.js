// Página pública de votación. No requiere cuenta: el afiliado se identifica
// con cédula + fecha de nacimiento, que solo se usan para calcular un hash
// (sha256) que Firestore compara contra `votantes_hash` — ver
// firebase/firestore.rules para el detalle de cómo se garantiza "un voto por
// persona" y el secreto del voto sin backend propio.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, collection, getDocs, query, where, writeBatch, increment,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app = initializeApp(window.SINTRAOSI_FIREBASE_CONFIG);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

let HASH_VOTANTE = null;
let VOTACIONES_ABIERTAS = [];
let VOTACION_ACTUAL = null;

function mostrarPaso(id) {
  ["pasoIdentidad", "pasoLista", "pasoVotar", "pasoOk"].forEach((p) => { $(p).hidden = p !== id; });
}

$("identidadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("identidadError");
  err.hidden = true;
  const cedula = $("id_cedula").value.replace(/\D/g, "").trim();
  const fecha = $("id_fecha_nacimiento").value;
  if (!cedula || !fecha) return;

  const btn = $("identidadBtn");
  btn.disabled = true;
  btn.textContent = "Verificando…";
  try {
    const hash = await sha256Hex(`${cedula}|${fecha}`);
    const snap = await getDoc(doc(db, "votantes_hash", hash));
    if (!snap.exists()) {
      err.textContent = "No encontramos un afiliado activo con esos datos. Verifica la cédula y la fecha de nacimiento, o contacta a tu regional si crees que es un error.";
      err.hidden = false;
      return;
    }
    HASH_VOTANTE = hash;
    await cargarVotacionesAbiertas();
    mostrarPaso("pasoLista");
  } catch (e2) {
    console.error(e2);
    err.textContent = "No se pudo verificar tu identidad. Intenta de nuevo.";
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Continuar";
  }
});

async function cargarVotacionesAbiertas() {
  const q = query(collection(db, "votaciones"), where("estado", "==", "abierta"));
  const snap = await getDocs(q);
  VOTACIONES_ABIERTAS = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const yaVotadas = JSON.parse(localStorage.getItem("sintraosi_votos") || "{}");
  const lista = $("listaVotaciones");
  const disponibles = VOTACIONES_ABIERTAS.filter((v) => !yaVotadas[v.id]);

  if (!disponibles.length) {
    lista.innerHTML = "";
    $("sinVotaciones").hidden = false;
    return;
  }
  $("sinVotaciones").hidden = true;
  lista.innerHTML = disponibles.map((v) => `
    <div class="votacion-item">
      <div class="info">
        <span class="tag">${v.tipo === "eleccion" ? "Elección" : "Asamblea"}</span>
        <h3>${escapeHtml(v.titulo)}</h3>
        ${v.descripcion ? `<p>${escapeHtml(v.descripcion)}</p>` : ""}
      </div>
      <button type="button" data-id="${v.id}">Votar</button>
    </div>
  `).join("");
}

$("listaVotaciones").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;
  const votacion = VOTACIONES_ABIERTAS.find((v) => v.id === btn.dataset.id);
  abrirFormularioVoto(votacion);
});

function abrirFormularioVoto(votacion) {
  VOTACION_ACTUAL = votacion;
  $("votarError").hidden = true;
  $("votarTitulo").textContent = votacion.titulo;
  $("votarDescripcion").textContent = votacion.descripcion || "";
  $("preguntasVotar").innerHTML = votacion.preguntas.map((p) => `
    <div class="pregunta-votar" data-pregunta="${p.id}">
      <h3>${escapeHtml(p.texto)}</h3>
      ${p.opciones.map((o) => `
        <label class="opcion-votar">
          <input type="radio" name="pregunta_${p.id}" value="${o.id}" required>
          ${escapeHtml(o.texto)}
        </label>
      `).join("")}
    </div>
  `).join("");
  mostrarPaso("pasoVotar");
}

$("volverListaBtn").addEventListener("click", () => mostrarPaso("pasoLista"));
$("volverListaBtn2").addEventListener("click", async () => {
  await cargarVotacionesAbiertas();
  mostrarPaso("pasoLista");
});

$("votoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("votarError");
  err.hidden = true;

  const respuestas = [];
  for (const pregunta of VOTACION_ACTUAL.preguntas) {
    const seleccion = document.querySelector(`input[name="pregunta_${pregunta.id}"]:checked`);
    if (!seleccion) {
      err.textContent = "Responde todas las preguntas antes de enviar tu voto.";
      err.hidden = false;
      return;
    }
    respuestas.push({ pregunta_id: pregunta.id, opcion_id: seleccion.value });
  }

  const btn = $("votoBtn");
  btn.disabled = true;
  btn.textContent = "Enviando…";
  try {
    const batch = writeBatch(db);
    const regRef = doc(db, "voto_registros", `${VOTACION_ACTUAL.id}__${HASH_VOTANTE}`);
    batch.set(regRef, { ts: new Date().toISOString() });
    const respRef = doc(collection(db, "voto_respuestas"));
    batch.set(respRef, { votacion_id: VOTACION_ACTUAL.id, respuestas, ts: new Date().toISOString() });
    batch.update(doc(db, "votaciones", VOTACION_ACTUAL.id), { participantes: increment(1) });
    await batch.commit();

    const yaVotadas = JSON.parse(localStorage.getItem("sintraosi_votos") || "{}");
    yaVotadas[VOTACION_ACTUAL.id] = true;
    localStorage.setItem("sintraosi_votos", JSON.stringify(yaVotadas));

    mostrarPaso("pasoOk");
  } catch (e2) {
    console.error(e2);
    err.textContent = "No se pudo registrar tu voto. Es posible que ya hayas votado en esta votación, o que se haya cerrado. Si crees que es un error, contacta a tu regional.";
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar voto";
  }
});
