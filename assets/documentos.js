// Gate de descarga para Documentos: los estados financieros son información
// sensible, así que antes de mostrar la lista se verifica que quien la pide
// es un afiliado activo (mismo mecanismo de identidad que votar.js: hash de
// cédula + fecha de nacimiento contra la colección pública `votantes_hash`,
// sin necesidad de cuenta/login propio). Verificado una vez por pestaña
// (sessionStorage), no persiste entre sesiones de navegador.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app = initializeApp(window.SINTRAOSI_FIREBASE_CONFIG);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const CLAVE_SESION = "sintraosi_docs_verificado";

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function desbloquear() {
  $("pasoIdentidadDocs").hidden = true;
  $("docContenido").hidden = false;
}

if (sessionStorage.getItem(CLAVE_SESION) === "1") {
  desbloquear();
}

$("identidadDocsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("identidadDocsError");
  err.hidden = true;
  const cedula = $("doc_cedula").value.replace(/\D/g, "").trim();
  const fecha = $("doc_fecha_nacimiento").value;
  if (!cedula || !fecha) return;

  const btn = $("identidadDocsBtn");
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
    sessionStorage.setItem(CLAVE_SESION, "1");
    desbloquear();
  } catch (e2) {
    console.error(e2);
    err.textContent = "No se pudo verificar tu identidad. Intenta de nuevo.";
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Verificar y continuar";
  }
});
