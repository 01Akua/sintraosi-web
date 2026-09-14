// Panel administrativo de afiliados — SINTRAOSI
// Usa el SDK modular de Firebase (v10) vía CDN. Todo el acceso a datos pasa por
// Firestore Security Rules (ver firebase/firestore.rules): solo usuarios logueados
// con un documento en la colección `admins` pueden leer/escribir.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app = initializeApp(window.SINTRAOSI_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------------------------------------------------------------------
// Estado en memoria
// ---------------------------------------------------------------------------
let TODOS_AFILIADOS = [];   // cache completa cargada de Firestore
let VISTA_FILTRADA = [];
let PAGINA = 0;
const POR_PAGINA = 25;

// ---------------------------------------------------------------------------
// Helpers UI
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

function mostrarToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(mostrarToast._h);
  mostrarToast._h = setTimeout(() => (t.hidden = true), 3200);
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const btn = $("loginBtn");
  const err = $("loginError");
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = "Entrando…";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e2) {
    err.textContent = "No se pudo iniciar sesión. Revisa el correo y la contraseña.";
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Iniciar sesión";
  }
});

$("logoutBtn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $("loginScreen").hidden = false;
    $("appShell").hidden = true;
    return;
  }
  // Verificar que el usuario esté en la colección admins antes de mostrar nada
  const emailNorm = (user.email || "").toLowerCase();
  const adminSnap = await getDoc(doc(db, "admins", emailNorm)).catch(() => null);
  if (!adminSnap || !adminSnap.exists()) {
    $("loginError").textContent = "Tu cuenta no tiene acceso al panel. Contacta a un administrador para que te agregue.";
    $("loginError").hidden = false;
    await signOut(auth);
    return;
  }
  $("loginScreen").hidden = true;
  $("appShell").hidden = false;
  $("userEmailLabel").textContent = user.email;
  await cargarTodo();
});

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
document.querySelectorAll(".admin-tab").forEach((tabEl) => {
  tabEl.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
    tabEl.classList.add("active");
    const target = tabEl.dataset.tab;
    ["dashboard", "afiliados", "usuarios"].forEach((name) => {
      $(`tab-${name}`).hidden = name !== target;
    });
    if (target === "usuarios") cargarAdmins();
  });
});

// ---------------------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------------------
async function cargarTodo() {
  const snap = await getDocs(collection(db, "afiliados"));
  TODOS_AFILIADOS = snap.docs.map((d) => d.data());
  renderStats();
  aplicarFiltros();
}

function renderStats() {
  const total = TODOS_AFILIADOS.length;
  const web = TODOS_AFILIADOS.filter((a) => a.canal_registro === "web").length;
  const presencial = total - web;
  const activos = TODOS_AFILIADOS.filter((a) => a.estado === "activo").length;
  const pendientes = total - activos;
  const pctWeb = total ? Math.round((web / total) * 100) : 0;
  const pctPresencial = 100 - pctWeb;

  $("statsGrid").innerHTML = `
    <div class="stat-card">
      <div class="n">${total.toLocaleString("es-CO")}</div>
      <div class="lbl">Total de afiliados</div>
    </div>
    <div class="stat-card">
      <div class="n">${activos.toLocaleString("es-CO")}</div>
      <div class="lbl">Activos (oficializados)</div>
    </div>
    <div class="stat-card">
      <div class="n">${pendientes.toLocaleString("es-CO")}</div>
      <div class="lbl">Pendientes de verificación</div>
    </div>
    <div class="stat-card" style="grid-column:span 2;">
      <div class="lbl" style="margin-bottom:8px;">Canal de afiliación</div>
      <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-bottom:6px;">
        <span>Página web — ${web} (${pctWeb}%)</span>
        <span>Presencial — ${presencial} (${pctPresencial}%)</span>
      </div>
      <div class="bar">
        <div class="seg-web" style="width:${pctWeb}%;"></div>
        <div class="seg-presencial" style="width:${pctPresencial}%;"></div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Búsqueda / filtros / tabla
// ---------------------------------------------------------------------------
function normalizar(s) {
  return (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function aplicarFiltros() {
  const q = normalizar($("searchInput").value.trim());
  const canal = $("filterCanal").value;
  const estado = $("filterEstado").value;

  VISTA_FILTRADA = TODOS_AFILIADOS.filter((a) => {
    if (canal && a.canal_registro !== canal) return false;
    if (estado && a.estado !== estado) return false;
    if (!q) return true;
    const campo = normalizar(
      [a.cedula, a.nombre_completo, a.empresa, a.ciudad, a.email, a.cargo].join(" ")
    );
    return campo.includes(q);
  });

  VISTA_FILTRADA.sort((a, b) => (a.nombre_completo || "").localeCompare(b.nombre_completo || ""));
  PAGINA = 0;
  renderTabla();
}

["searchInput", "filterCanal", "filterEstado"].forEach((id) => {
  $(id).addEventListener("input", aplicarFiltros);
  $(id).addEventListener("change", aplicarFiltros);
});

function renderTabla() {
  const total = VISTA_FILTRADA.length;
  const inicio = PAGINA * POR_PAGINA;
  const pagina = VISTA_FILTRADA.slice(inicio, inicio + POR_PAGINA);

  if (!pagina.length) {
    $("afiliadosTbody").innerHTML = `<tr><td colspan="8" class="loading-row">No se encontraron afiliados con esos filtros.</td></tr>`;
  } else {
    $("afiliadosTbody").innerHTML = pagina.map((a) => `
      <tr>
        <td>${escapeHtml(a.cedula)}</td>
        <td>${escapeHtml(a.nombre_completo || "—")}</td>
        <td>${escapeHtml(a.empresa || "—")}</td>
        <td>${escapeHtml(a.ciudad || "—")}</td>
        <td><span class="badge ${a.canal_registro === "web" ? "badge-web" : "badge-presencial"}">${a.canal_registro === "web" ? "Página web" : "Presencial"}</span></td>
        <td><span class="badge ${a.estado === "activo" ? "badge-activo" : "badge-pendiente"}">${a.estado === "activo" ? "Activo" : "Pendiente"}</span></td>
        <td>${escapeHtml(a.fecha_afiliacion || "—")}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-action="editar" data-cedula="${escapeHtml(a.cedula)}">Editar</button>
            <button class="icon-btn" data-action="eliminar" data-cedula="${escapeHtml(a.cedula)}">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  $("pagerInfo").textContent = `${total} afiliado(s) — página ${PAGINA + 1} de ${totalPaginas}`;
  $("pagerPrev").disabled = PAGINA === 0;
  $("pagerNext").disabled = inicio + POR_PAGINA >= total;
}

$("pagerPrev").addEventListener("click", () => { if (PAGINA > 0) { PAGINA--; renderTabla(); } });
$("pagerNext").addEventListener("click", () => {
  if ((PAGINA + 1) * POR_PAGINA < VISTA_FILTRADA.length) { PAGINA++; renderTabla(); }
});

$("afiliadosTbody").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const cedula = btn.dataset.cedula;
  const afiliado = TODOS_AFILIADOS.find((a) => a.cedula === cedula);
  if (btn.dataset.action === "editar") {
    abrirModalAfiliado(afiliado);
  } else if (btn.dataset.action === "eliminar") {
    if (!confirm(`¿Eliminar a ${afiliado?.nombre_completo || cedula} de la base de afiliados? Esta acción no se puede deshacer.`)) return;
    await deleteDoc(doc(db, "afiliados", cedula));
    TODOS_AFILIADOS = TODOS_AFILIADOS.filter((a) => a.cedula !== cedula);
    aplicarFiltros();
    renderStats();
    mostrarToast("Afiliado eliminado.");
  }
});

// ---------------------------------------------------------------------------
// Modal crear / editar afiliado
// ---------------------------------------------------------------------------
const CAMPOS_FORM = [
  "cedula", "tipo_documento", "nombres", "apellidos", "email", "celular",
  "telefono_fijo", "ciudad", "departamento", "direccion", "empresa", "cargo",
  "sede", "fecha_afiliacion", "canal_registro", "estado",
];

function abrirModalAfiliado(afiliado) {
  $("afiliadoFormError").hidden = true;
  $("afiliadoForm").reset();
  if (afiliado) {
    $("afiliadoModalTitle").textContent = "Editar afiliado";
    $("f_cedula_original").value = afiliado.cedula;
    $("f_cedula").value = afiliado.cedula || "";
    $("f_cedula").disabled = true;
    CAMPOS_FORM.filter((c) => c !== "cedula").forEach((c) => {
      const el = $("f_" + c);
      if (el) el.value = afiliado[c] || "";
    });
  } else {
    $("afiliadoModalTitle").textContent = "Nuevo afiliado";
    $("f_cedula_original").value = "";
    $("f_cedula").disabled = false;
    $("f_canal_registro").value = "presencial";
    $("f_estado").value = "activo";
  }
  $("afiliadoModal").hidden = false;
}

$("openNewAfiliadoBtn").addEventListener("click", () => abrirModalAfiliado(null));
$("afiliadoModalCancel").addEventListener("click", () => { $("afiliadoModal").hidden = true; });

$("afiliadoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("afiliadoFormError");
  err.hidden = true;

  const cedulaOriginal = $("f_cedula_original").value;
  const cedula = $("f_cedula").value.replace(/\D/g, "").trim();
  if (!cedula) {
    err.textContent = "La cédula es obligatoria y debe tener solo números.";
    err.hidden = false;
    return;
  }
  if (!cedulaOriginal && TODOS_AFILIADOS.some((a) => a.cedula === cedula)) {
    err.textContent = "Ya existe un afiliado con esa cédula.";
    err.hidden = false;
    return;
  }

  const nombres = $("f_nombres").value.trim();
  const apellidos = $("f_apellidos").value.trim();
  const data = {
    cedula,
    tipo_documento: $("f_tipo_documento").value,
    nombres, apellidos,
    nombre_completo: `${nombres} ${apellidos}`.trim(),
    email: $("f_email").value.trim() || null,
    celular: $("f_celular").value.trim() || null,
    telefono_fijo: $("f_telefono_fijo").value.trim() || null,
    ciudad: $("f_ciudad").value.trim() || null,
    departamento: $("f_departamento").value.trim() || null,
    direccion: $("f_direccion").value.trim() || null,
    empresa: $("f_empresa").value.trim() || null,
    cargo: $("f_cargo").value.trim() || null,
    sede: $("f_sede").value.trim() || null,
    fecha_afiliacion: $("f_fecha_afiliacion").value || null,
    canal_registro: $("f_canal_registro").value,
    estado: $("f_estado").value,
    actualizado_en: new Date().toISOString(),
  };

  const btn = $("afiliadoModalSave");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  try {
    await setDoc(doc(db, "afiliados", cedula), data, { merge: true });
    if (cedulaOriginal && cedulaOriginal !== cedula) {
      // cambió la cédula (id del doc): borrar el doc viejo
      await deleteDoc(doc(db, "afiliados", cedulaOriginal));
      TODOS_AFILIADOS = TODOS_AFILIADOS.filter((a) => a.cedula !== cedulaOriginal);
    }
    const idx = TODOS_AFILIADOS.findIndex((a) => a.cedula === cedula);
    if (idx >= 0) TODOS_AFILIADOS[idx] = { ...TODOS_AFILIADOS[idx], ...data };
    else TODOS_AFILIADOS.push(data);

    $("afiliadoModal").hidden = true;
    renderStats();
    aplicarFiltros();
    mostrarToast("Afiliado guardado correctamente.");
  } catch (e2) {
    err.textContent = "No se pudo guardar. Intenta de nuevo.";
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar";
  }
});

// ---------------------------------------------------------------------------
// Usuarios del panel (colección admins)
// ---------------------------------------------------------------------------
async function cargarAdmins() {
  const snap = await getDocs(collection(db, "admins"));
  const admins = snap.docs.map((d) => d.data());
  admins.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  $("adminsTbody").innerHTML = admins.map((a) => `
    <tr>
      <td>${escapeHtml(a.email)}</td>
      <td>${escapeHtml(a.nombre || "—")}</td>
      <td>${escapeHtml((a.creado_en || "").slice(0, 10))}</td>
      <td><button class="btn-danger" data-email="${escapeHtml(a.email)}">Quitar acceso</button></td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="loading-row">Sin usuarios.</td></tr>`;
}

$("addAdminBtn").addEventListener("click", async () => {
  const email = $("newAdminEmail").value.trim().toLowerCase();
  const nombre = $("newAdminNombre").value.trim();
  if (!email) return mostrarToast("Ingresa un correo válido.");
  await setDoc(doc(db, "admins", email), {
    email, nombre: nombre || email, rol: "admin",
    creado_en: new Date().toISOString(),
    creado_por: auth.currentUser?.email || null,
  });
  $("newAdminEmail").value = "";
  $("newAdminNombre").value = "";
  mostrarToast(`${email} ahora tiene acceso al panel.`);
  cargarAdmins();
});

$("adminsTbody").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-email]");
  if (!btn) return;
  const email = btn.dataset.email;
  if (email === (auth.currentUser?.email || "").toLowerCase()) {
    return mostrarToast("No puedes quitarte el acceso a ti mismo.");
  }
  if (!confirm(`¿Quitar el acceso al panel de ${email}?`)) return;
  await deleteDoc(doc(db, "admins", email));
  mostrarToast("Acceso revocado.");
  cargarAdmins();
});
