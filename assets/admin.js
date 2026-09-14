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
  serverTimestamp, query, where,
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
let CONTENIDO_CARGADO = false;
let VOTACIONES_CARGADAS = false;
document.querySelectorAll(".admin-tab").forEach((tabEl) => {
  tabEl.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
    tabEl.classList.add("active");
    const target = tabEl.dataset.tab;
    ["dashboard", "afiliados", "contenido", "votaciones", "usuarios"].forEach((name) => {
      $(`tab-${name}`).hidden = name !== target;
    });
    if (target === "usuarios") cargarAdmins();
    if (target === "contenido" && !CONTENIDO_CARGADO) {
      CONTENIDO_CARGADO = true;
      cargarContenido();
    }
    if (target === "votaciones" && !VOTACIONES_CARGADAS) {
      VOTACIONES_CARGADAS = true;
      cargarVotaciones();
    }
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

// Colores del donut (coherentes con las paletas de badges ya usadas en la tabla)
const COLOR_WEB = "#2C7A46";        // var(--blue-700)
const COLOR_PRESENCIAL = "#C9A227"; // var(--amber)
const COLOR_ACTIVO = "#2C7A46";     // var(--blue-700)
const COLOR_PENDIENTE = "#C62828";  // var(--rojo)

function afiliadosParaStats() {
  const incluirPrueba = $("filterMostrarPrueba").checked;
  return incluirPrueba ? TODOS_AFILIADOS : TODOS_AFILIADOS.filter((a) => !a.es_prueba);
}

function construirDonut({ pctA, colorA, lblA, valA, pctB, colorB, lblB, valB, centroLbl }) {
  const gradiente = `conic-gradient(${colorA} 0% ${pctA}%, ${colorB} ${pctA}% 100%)`;
  return `
    <div class="donut-card">
      <div class="donut" style="background:${gradiente};">
        <div class="donut-center">
          <div class="pct">${pctA}%</div>
          <div class="pct-lbl">${centroLbl}</div>
        </div>
      </div>
      <div class="donut-legend">
        <div class="item"><span class="dot" style="background:${colorA};"></span><span class="lbl">${lblA}</span> <span class="val">${valA} (${pctA}%)</span></div>
        <div class="item"><span class="dot" style="background:${colorB};"></span><span class="lbl">${lblB}</span> <span class="val">${valB} (${100 - pctA}%)</span></div>
      </div>
    </div>
  `;
}

function renderStats() {
  const incluyendoPrueba = $("filterMostrarPrueba").checked;
  const base = afiliadosParaStats();
  const total = base.length;
  const web = base.filter((a) => a.canal_registro === "web").length;
  const presencial = total - web;
  const activos = base.filter((a) => a.estado === "activo").length;
  const pendientes = total - activos;
  const pctWeb = total ? Math.round((web / total) * 100) : 0;
  const pctActivos = total ? Math.round((activos / total) * 100) : 0;
  const nPrueba = TODOS_AFILIADOS.filter((a) => a.es_prueba).length;

  $("statsGrid").innerHTML = `
    ${nPrueba ? `<div class="admin-error" style="background:var(--sky-100); color:var(--blue-800); border-color:var(--blue-600); margin-bottom:14px;">
      ${incluyendoPrueba
        ? `Mostrando estadísticas <strong>incluyendo ${nPrueba} registros de prueba</strong> — desmarca "Mostrar registros de prueba" para ver solo datos reales.`
        : `Hay ${nPrueba} registros de prueba guardados, excluidos de estas estadísticas. Marca "Mostrar registros de prueba" (pestaña Afiliados) para incluirlos aquí y comparar.`}
    </div>` : ""}
    <div class="stats-grid">
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
    </div>
    <div class="donut-row">
      ${construirDonut({
        pctA: pctWeb, colorA: COLOR_WEB, lblA: "Página web", valA: web,
        colorB: COLOR_PRESENCIAL, lblB: "Presencial", valB: presencial,
        centroLbl: "por web",
      })}
      ${construirDonut({
        pctA: pctActivos, colorA: COLOR_ACTIVO, lblA: "Activos", valA: activos,
        colorB: COLOR_PENDIENTE, lblB: "Pendientes", valB: pendientes,
        centroLbl: "activos",
      })}
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
  const mostrarPrueba = $("filterMostrarPrueba").checked;

  VISTA_FILTRADA = TODOS_AFILIADOS.filter((a) => {
    if (!mostrarPrueba && a.es_prueba) return false;
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

["searchInput", "filterCanal", "filterEstado", "filterMostrarPrueba"].forEach((id) => {
  $(id).addEventListener("input", aplicarFiltros);
  $(id).addEventListener("change", aplicarFiltros);
});
$("filterMostrarPrueba").addEventListener("change", renderStats);

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
        <td>${escapeHtml(a.nombre_completo || "—")}${a.es_prueba ? '<span class="badge badge-prueba">PRUEBA</span>' : ""}</td>
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
    await sincronizarVotanteHash(afiliado, null);
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
  "sede", "fecha_afiliacion", "fecha_nacimiento", "canal_registro", "estado",
];

// ---------------------------------------------------------------------------
// Elegibilidad para votar: votantes_hash/{sha256(cedula|fecha_nacimiento)}
// Se mantiene sincronizada automáticamente cada vez que se guarda o elimina
// un afiliado desde este panel (ver también firebase/scripts/sync_votantes.mjs
// para la sincronización masiva inicial).
// ---------------------------------------------------------------------------
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sincronizarVotanteHash(afiliadoAnterior, afiliadoNuevo) {
  if (afiliadoAnterior && afiliadoAnterior.cedula && afiliadoAnterior.fecha_nacimiento) {
    const hashViejo = await sha256Hex(`${afiliadoAnterior.cedula}|${afiliadoAnterior.fecha_nacimiento}`);
    const yaNoAplica = !afiliadoNuevo ||
      afiliadoNuevo.cedula !== afiliadoAnterior.cedula ||
      afiliadoNuevo.fecha_nacimiento !== afiliadoAnterior.fecha_nacimiento ||
      afiliadoNuevo.estado !== "activo";
    if (yaNoAplica) {
      await deleteDoc(doc(db, "votantes_hash", hashViejo)).catch(() => {});
    }
  }
  if (afiliadoNuevo && afiliadoNuevo.estado === "activo" && afiliadoNuevo.cedula && afiliadoNuevo.fecha_nacimiento) {
    const hashNuevo = await sha256Hex(`${afiliadoNuevo.cedula}|${afiliadoNuevo.fecha_nacimiento}`);
    await setDoc(doc(db, "votantes_hash", hashNuevo), { sincronizado_en: new Date().toISOString() });
  }
}

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
    $("f_es_prueba").checked = !!afiliado.es_prueba;
  } else {
    $("afiliadoModalTitle").textContent = "Nuevo afiliado";
    $("f_cedula_original").value = "";
    $("f_cedula").disabled = false;
    $("f_canal_registro").value = "presencial";
    $("f_estado").value = "activo";
    $("f_es_prueba").checked = false;
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
    fecha_nacimiento: $("f_fecha_nacimiento").value || null,
    canal_registro: $("f_canal_registro").value,
    estado: $("f_estado").value,
    es_prueba: $("f_es_prueba").checked,
    actualizado_en: new Date().toISOString(),
  };

  const afiliadoAnterior = cedulaOriginal ? TODOS_AFILIADOS.find((a) => a.cedula === cedulaOriginal) : null;

  const btn = $("afiliadoModalSave");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  try {
    await setDoc(doc(db, "afiliados", cedula), data, { merge: true });
    await sincronizarVotanteHash(afiliadoAnterior, data);
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

// =============================================================================
// Contenido del sitio (CMS): noticias + textos/listas de páginas
// =============================================================================

document.querySelectorAll(".content-subtab").forEach((tabEl) => {
  tabEl.addEventListener("click", () => {
    document.querySelectorAll(".content-subtab").forEach((t) => t.classList.remove("active"));
    tabEl.classList.add("active");
    const target = tabEl.dataset.subtab;
    ["noticias", "inicio", "regionales", "junta", "galeria"].forEach((name) => {
      $(`content-${name}`).hidden = name !== target;
    });
  });
});

async function cargarContenido() {
  await Promise.all([
    cargarNoticiasAdmin(),
    cargarPaginaAdmin("inicio"),
    cargarPaginaAdmin("regionales"),
    cargarPaginaAdmin("junta"),
    cargarPaginaAdmin("galeria"),
  ]);
}

// ---------------------------------------------------------------------------
// Noticias
// ---------------------------------------------------------------------------
let NOTICIAS = [];

async function cargarNoticiasAdmin() {
  const snap = await getDocs(collection(db, "noticias"));
  NOTICIAS = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  NOTICIAS.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  renderNoticiasTabla();
}

function renderNoticiasTabla() {
  $("noticiasTbody").innerHTML = NOTICIAS.map((n, idx) => `
    <tr>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="subir" data-id="${n.id}" ${idx === 0 ? "disabled" : ""}>↑</button>
          <button class="icon-btn" data-action="bajar" data-id="${n.id}" ${idx === NOTICIAS.length - 1 ? "disabled" : ""}>↓</button>
        </div>
      </td>
      <td>${escapeHtml(n.titulo)}</td>
      <td>${escapeHtml(n.region || "—")}</td>
      <td><span class="badge ${n.estado === "publicado" ? "badge-publicado" : "badge-borrador"}">${n.estado === "publicado" ? "Publicado" : "Borrador"}</span></td>
      <td>${escapeHtml(n.fecha || "—")}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="editar" data-id="${n.id}">Editar</button>
          <button class="icon-btn" data-action="toggle-estado" data-id="${n.id}">${n.estado === "publicado" ? "Despublicar" : "Publicar"}</button>
          <button class="icon-btn" data-action="eliminar" data-id="${n.id}">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="loading-row">No hay noticias todavía.</td></tr>`;
}

async function moverNoticia(id, direccion) {
  const idx = NOTICIAS.findIndex((n) => n.id === id);
  const vecino = direccion === "subir" ? idx - 1 : idx + 1;
  if (vecino < 0 || vecino >= NOTICIAS.length) return;
  const a = NOTICIAS[idx], b = NOTICIAS[vecino];
  const ordenA = a.orden, ordenB = b.orden;
  await Promise.all([
    setDoc(doc(db, "noticias", a.id), { orden: ordenB }, { merge: true }),
    setDoc(doc(db, "noticias", b.id), { orden: ordenA }, { merge: true }),
  ]);
  await cargarNoticiasAdmin();
}

$("noticiasTbody").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const noticia = NOTICIAS.find((n) => n.id === id);
  const accion = btn.dataset.action;
  if (accion === "subir" || accion === "bajar") {
    await moverNoticia(id, accion === "subir" ? "subir" : "bajar");
  } else if (accion === "editar") {
    abrirModalNoticia(noticia);
  } else if (accion === "toggle-estado") {
    const nuevoEstado = noticia.estado === "publicado" ? "borrador" : "publicado";
    await setDoc(doc(db, "noticias", id), { estado: nuevoEstado }, { merge: true });
    mostrarToast(nuevoEstado === "publicado" ? "Noticia publicada." : "Noticia despublicada.");
    await cargarNoticiasAdmin();
  } else if (accion === "eliminar") {
    if (!confirm(`¿Eliminar la noticia "${noticia.titulo}"? Esta acción no se puede deshacer.`)) return;
    await deleteDoc(doc(db, "noticias", id));
    mostrarToast("Noticia eliminada.");
    await cargarNoticiasAdmin();
  }
});

function abrirModalNoticia(noticia) {
  $("noticiaFormError").hidden = true;
  $("noticiaForm").reset();
  if (noticia) {
    $("noticiaModalTitle").textContent = "Editar noticia";
    $("ni_id").value = noticia.id;
    $("ni_titulo").value = noticia.titulo || "";
    $("ni_region").value = noticia.region || "Bogotá D.C.";
    $("ni_fecha").value = noticia.fecha || "";
    $("ni_resumen").value = noticia.resumen || "";
    $("ni_imagen_url").value = noticia.imagen_url || "";
    $("ni_contenido").value = noticia.contenido || "";
    $("ni_publicada").checked = noticia.estado === "publicado";
  } else {
    $("noticiaModalTitle").textContent = "Nueva noticia";
    $("ni_id").value = "";
    $("ni_publicada").checked = false;
  }
  $("noticiaModal").hidden = false;
}

$("openNewNoticiaBtn").addEventListener("click", () => abrirModalNoticia(null));
$("noticiaModalCancel").addEventListener("click", () => { $("noticiaModal").hidden = true; });

$("noticiaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("noticiaFormError");
  err.hidden = true;
  const titulo = $("ni_titulo").value.trim();
  if (!titulo) {
    err.textContent = "El título es obligatorio.";
    err.hidden = false;
    return;
  }
  const idExistente = $("ni_id").value;
  const data = {
    titulo,
    region: $("ni_region").value,
    fecha: $("ni_fecha").value || "",
    resumen: $("ni_resumen").value.trim(),
    imagen_url: $("ni_imagen_url").value.trim(),
    contenido: $("ni_contenido").value.trim(),
    estado: $("ni_publicada").checked ? "publicado" : "borrador",
    actualizado_en: new Date().toISOString(),
  };
  const btn = $("noticiaModalSave");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  try {
    if (idExistente) {
      await setDoc(doc(db, "noticias", idExistente), data, { merge: true });
    } else {
      const nuevoRef = doc(collection(db, "noticias"));
      const maxOrden = NOTICIAS.reduce((m, n) => Math.max(m, n.orden || 0), 0);
      await setDoc(nuevoRef, { ...data, orden: maxOrden + 1, creado_en: new Date().toISOString() });
    }
    $("noticiaModal").hidden = true;
    mostrarToast("Noticia guardada.");
    await cargarNoticiasAdmin();
  } catch (e2) {
    err.textContent = "No se pudo guardar. Intenta de nuevo.";
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar";
  }
});

// ---------------------------------------------------------------------------
// Páginas: textos (campos) + listas reordenables — patrón borrador/publicado
// ---------------------------------------------------------------------------
const PAGINAS = {}; // pageId -> { borrador: {campos,listas}, publicado: {campos,listas} }

const CAMPOS_INICIO = [
  { key: "hero_tagline", label: "Hero — etiqueta superior" },
  { key: "hero_titulo_1", label: "Hero — título (línea 1)" },
  { key: "hero_titulo_2", label: "Hero — título (línea 2, en cursiva)" },
  { key: "hero_lede", label: "Hero — texto", textarea: true },
  { key: "quienes_tag", label: "Quiénes somos — etiqueta" },
  { key: "quienes_titulo", label: "Quiénes somos — título" },
  { key: "quienes_p1", label: "Quiénes somos — párrafo 1", textarea: true },
  { key: "quienes_p2", label: "Quiénes somos — párrafo 2", textarea: true },
  { key: "noticias_tag", label: "Sección noticias — etiqueta" },
  { key: "noticias_titulo", label: "Sección noticias — título" },
  { key: "noticias_p", label: "Sección noticias — texto" },
  { key: "regionales_tag", label: "Sección regionales — etiqueta" },
  { key: "regionales_titulo", label: "Sección regionales — título" },
  { key: "regionales_p", label: "Sección regionales — texto" },
  { key: "galeria_tag", label: "Sección galería — etiqueta" },
  { key: "galeria_titulo", label: "Sección galería — título" },
  { key: "galeria_p", label: "Sección galería — texto" },
  { key: "cta_titulo", label: "CTA final — título" },
  { key: "cta_p", label: "CTA final — texto", textarea: true },
];

const FIELDS_REGIONALES = [
  { key: "ciudad", label: "Ciudad" },
  { key: "etiqueta", label: "Etiqueta" },
  { key: "texto", label: "Texto (opcional)" },
];
const FIELDS_JUNTA = [
  { key: "iniciales", label: "Iniciales" },
  { key: "nombre", label: "Nombre completo" },
  { key: "cargo", label: "Cargo" },
];
const FIELDS_GALERIA = [
  { key: "imagen_url", label: "URL de la imagen" },
  { key: "caption", label: "Descripción" },
];

async function cargarPaginaAdmin(pageId) {
  const [bSnap, pSnap] = await Promise.all([
    getDoc(doc(db, "paginas_borrador", pageId)),
    getDoc(doc(db, "paginas_publicado", pageId)),
  ]);
  PAGINAS[pageId] = {
    borrador: bSnap.exists() ? bSnap.data() : { campos: {}, listas: {} },
    publicado: pSnap.exists() ? pSnap.data() : { campos: {}, listas: {} },
  };
  if (!PAGINAS[pageId].borrador.campos) PAGINAS[pageId].borrador.campos = {};
  if (!PAGINAS[pageId].borrador.listas) PAGINAS[pageId].borrador.listas = {};

  if (pageId === "inicio") {
    renderCamposForm($("inicioForm"), "inicio", CAMPOS_INICIO);
    actualizarEstadoLbl("inicio");
  } else if (pageId === "regionales") {
    if (!PAGINAS.regionales.borrador.listas.regionales) PAGINAS.regionales.borrador.listas.regionales = [];
    renderListEditor("regionales", "regionales", FIELDS_REGIONALES);
    actualizarEstadoLbl("regionales");
  } else if (pageId === "junta") {
    if (!PAGINAS.junta.borrador.listas.junta) PAGINAS.junta.borrador.listas.junta = [];
    renderListEditor("junta", "junta", FIELDS_JUNTA);
    actualizarEstadoLbl("junta");
  } else if (pageId === "galeria") {
    if (!PAGINAS.galeria.borrador.listas.galeria) PAGINAS.galeria.borrador.listas.galeria = [];
    renderListEditor("galeria", "galeria", FIELDS_GALERIA);
    actualizarEstadoLbl("galeria");
  }
}

function actualizarEstadoLbl(pageId) {
  const p = PAGINAS[pageId].publicado;
  const fecha = p.publicado_en ? new Date(p.publicado_en).toLocaleString("es-CO") : "nunca";
  $(`${pageId}EstadoLbl`).textContent = `Última publicación: ${fecha}`;
}

function renderCamposForm(containerEl, pageId, config) {
  const campos = PAGINAS[pageId].borrador.campos;
  containerEl.innerHTML = config.map((f) => `
    <div class="admin-field ${f.textarea ? "full" : ""}">
      <label>${escapeHtml(f.label)}</label>
      ${f.textarea
        ? `<textarea rows="3" data-campo="${f.key}">${escapeHtml(campos[f.key] || "")}</textarea>`
        : `<input type="text" data-campo="${f.key}" value="${escapeHtml(campos[f.key] || "")}">`}
    </div>
  `).join("");
  containerEl.querySelectorAll("[data-campo]").forEach((el) => {
    el.addEventListener("input", () => {
      PAGINAS[pageId].borrador.campos[el.dataset.campo] = el.value;
    });
  });
}

function renderListEditor(pageId, listId, fieldsConfig) {
  const items = PAGINAS[pageId].borrador.listas[listId];
  const container = $(`${listId}List`);
  if (!items.length) {
    container.innerHTML = `<p style="color:var(--texto-mute); font-size:0.85rem;">Sin elementos todavía. Usa "+ Agregar" para crear el primero.</p>`;
    return;
  }
  container.innerHTML = items.map((item, idx) => `
    <div class="list-item" data-idx="${idx}">
      <div class="list-item-fields">
        ${fieldsConfig.map((f) => `<input type="text" data-field="${f.key}" placeholder="${escapeHtml(f.label)}" value="${escapeHtml(item[f.key] || "")}">`).join("")}
      </div>
      <div class="list-item-actions">
        <button type="button" data-action="up" ${idx === 0 ? "disabled" : ""}>↑</button>
        <button type="button" data-action="down" ${idx === items.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" data-action="del" class="danger">✕</button>
      </div>
    </div>
  `).join("");
}

function attachListEditorEvents(pageId, listId, fieldsConfig) {
  const container = $(`${listId}List`);
  container.addEventListener("input", (e) => {
    const fieldEl = e.target.closest("[data-field]");
    if (!fieldEl) return;
    const idx = parseInt(fieldEl.closest(".list-item").dataset.idx, 10);
    PAGINAS[pageId].borrador.listas[listId][idx][fieldEl.dataset.field] = fieldEl.value;
  });
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const idx = parseInt(btn.closest(".list-item").dataset.idx, 10);
    const items = PAGINAS[pageId].borrador.listas[listId];
    if (btn.dataset.action === "up" && idx > 0) {
      [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
    } else if (btn.dataset.action === "down" && idx < items.length - 1) {
      [items[idx + 1], items[idx]] = [items[idx], items[idx + 1]];
    } else if (btn.dataset.action === "del") {
      items.splice(idx, 1);
    }
    renderListEditor(pageId, listId, fieldsConfig);
  });
}
attachListEditorEvents("regionales", "regionales", FIELDS_REGIONALES);
attachListEditorEvents("junta", "junta", FIELDS_JUNTA);
attachListEditorEvents("galeria", "galeria", FIELDS_GALERIA);

$("regionalesAgregarBtn").addEventListener("click", () => {
  PAGINAS.regionales.borrador.listas.regionales.push({ ciudad: "", etiqueta: "", texto: "" });
  renderListEditor("regionales", "regionales", FIELDS_REGIONALES);
});
$("juntaAgregarBtn").addEventListener("click", () => {
  PAGINAS.junta.borrador.listas.junta.push({ iniciales: "", nombre: "", cargo: "" });
  renderListEditor("junta", "junta", FIELDS_JUNTA);
});
$("galeriaAgregarBtn").addEventListener("click", () => {
  PAGINAS.galeria.borrador.listas.galeria.push({ imagen_url: "", caption: "" });
  renderListEditor("galeria", "galeria", FIELDS_GALERIA);
});

async function guardarBorrador(pageId) {
  const data = { ...PAGINAS[pageId].borrador, actualizado_en: new Date().toISOString() };
  await setDoc(doc(db, "paginas_borrador", pageId), data);
  PAGINAS[pageId].borrador = data;
  mostrarToast("Borrador guardado.");
}

async function publicarPagina(pageId) {
  await guardarBorrador(pageId);
  const data = { ...PAGINAS[pageId].borrador, publicado_en: new Date().toISOString() };
  await setDoc(doc(db, "paginas_publicado", pageId), data);
  PAGINAS[pageId].publicado = data;
  actualizarEstadoLbl(pageId);
  mostrarToast("Cambios publicados. Ya son visibles en el sitio.");
}

$("inicioGuardarBtn").addEventListener("click", () => guardarBorrador("inicio"));
$("inicioPublicarBtn").addEventListener("click", () => publicarPagina("inicio"));
$("regionalesGuardarBtn").addEventListener("click", () => guardarBorrador("regionales"));
$("regionalesPublicarBtn").addEventListener("click", () => publicarPagina("regionales"));
$("juntaGuardarBtn").addEventListener("click", () => guardarBorrador("junta"));
$("juntaPublicarBtn").addEventListener("click", () => publicarPagina("junta"));
$("galeriaGuardarBtn").addEventListener("click", () => guardarBorrador("galeria"));
$("galeriaPublicarBtn").addEventListener("click", () => publicarPagina("galeria"));

// =============================================================================
// Votaciones (asamblea y elecciones)
// =============================================================================
let VOTACIONES = [];
let MODAL_PREGUNTAS = [];
let TOTAL_ELEGIBLES = null;

async function cargarVotaciones() {
  const snap = await getDocs(collection(db, "votaciones"));
  VOTACIONES = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  VOTACIONES.sort((a, b) => (b.creado_en || "").localeCompare(a.creado_en || ""));
  renderVotacionesTabla();
}

function renderVotacionesTabla() {
  $("votacionesTbody").innerHTML = VOTACIONES.map((v) => `
    <tr>
      <td>${escapeHtml(v.titulo)}</td>
      <td>${v.tipo === "eleccion" ? "Elección" : "Asamblea"}</td>
      <td><span class="badge ${v.estado === "abierta" ? "badge-abierta" : v.estado === "cerrada" ? "badge-cerrada" : "badge-borrador"}">${v.estado === "abierta" ? "Abierta" : v.estado === "cerrada" ? "Cerrada" : "Borrador"}</span></td>
      <td>${v.participantes || 0} voto(s)</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="editar" data-id="${v.id}">Editar</button>
          ${v.estado === "borrador" ? `<button class="icon-btn" data-action="abrir" data-id="${v.id}">Abrir</button>` : ""}
          ${v.estado === "abierta" ? `<button class="icon-btn" data-action="cerrar" data-id="${v.id}">Cerrar</button>` : ""}
          ${v.estado !== "borrador" ? `<button class="icon-btn" data-action="resultados" data-id="${v.id}">Resultados</button>` : ""}
          <button class="icon-btn" data-action="eliminar" data-id="${v.id}">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="loading-row">No hay votaciones todavía.</td></tr>`;
}

$("votacionesTbody").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const votacion = VOTACIONES.find((v) => v.id === id);
  const accion = btn.dataset.action;
  if (accion === "editar") {
    abrirModalVotacion(votacion);
  } else if (accion === "abrir") {
    if (!votacion.preguntas || !votacion.preguntas.length) {
      return mostrarToast("Agrega al menos una pregunta antes de abrir la votación.");
    }
    await setDoc(doc(db, "votaciones", id), { estado: "abierta", abierta_en: new Date().toISOString() }, { merge: true });
    mostrarToast("Votación abierta. Ya se puede votar desde el sitio público.");
    await cargarVotaciones();
  } else if (accion === "cerrar") {
    if (!confirm(`¿Cerrar la votación "${votacion.titulo}"? Nadie podrá votar después de esto.`)) return;
    await setDoc(doc(db, "votaciones", id), { estado: "cerrada", cerrada_en: new Date().toISOString() }, { merge: true });
    mostrarToast("Votación cerrada.");
    await cargarVotaciones();
  } else if (accion === "resultados") {
    await mostrarResultados(votacion);
  } else if (accion === "eliminar") {
    if (!confirm(`¿Eliminar la votación "${votacion.titulo}"? Esta acción no se puede deshacer.`)) return;
    await deleteDoc(doc(db, "votaciones", id));
    mostrarToast("Votación eliminada.");
    await cargarVotaciones();
  }
});

// ---- Modal crear/editar ----
function nuevoId() {
  return Math.random().toString(36).slice(2, 10);
}

function abrirModalVotacion(votacion) {
  $("votacionFormError").hidden = true;
  $("votacionForm").reset();
  if (votacion) {
    $("votacionModalTitle").textContent = "Editar votación";
    $("v_id").value = votacion.id;
    $("v_titulo").value = votacion.titulo || "";
    $("v_descripcion").value = votacion.descripcion || "";
    $("v_tipo").value = votacion.tipo || "asamblea";
    $("v_resultados_publicos").checked = !!votacion.resultados_publicos;
    MODAL_PREGUNTAS = JSON.parse(JSON.stringify(votacion.preguntas || []));
  } else {
    $("votacionModalTitle").textContent = "Nueva votación";
    $("v_id").value = "";
    $("v_tipo").value = "asamblea";
    $("v_resultados_publicos").checked = true;
    MODAL_PREGUNTAS = [{ id: nuevoId(), texto: "", opciones: [
      { id: nuevoId(), texto: "A favor" },
      { id: nuevoId(), texto: "En contra" },
      { id: nuevoId(), texto: "Abstención" },
    ] }];
  }
  actualizarEtiquetaTipo();
  renderPreguntasEditor();
  $("votacionModal").hidden = false;
}

function actualizarEtiquetaTipo() {
  const esEleccion = $("v_tipo").value === "eleccion";
  $("v_preguntas_label").textContent = esEleccion ? "Cargos" : "Preguntas";
  $("votacionAgregarPreguntaBtn").textContent = esEleccion ? "+ Agregar cargo" : "+ Agregar pregunta";
}
$("v_tipo").addEventListener("change", () => { actualizarEtiquetaTipo(); renderPreguntasEditor(); });

function renderPreguntasEditor() {
  const esEleccion = $("v_tipo").value === "eleccion";
  const lblPregunta = esEleccion ? "Nombre del cargo (ej. Presidencia)" : "Texto de la pregunta";
  const lblOpcion = esEleccion ? "Nombre del candidato" : "Opción";

  $("votacionPreguntasEditor").innerHTML = MODAL_PREGUNTAS.map((p, pi) => `
    <div class="pregunta-card" data-pi="${pi}">
      <div class="pregunta-top">
        <input type="text" data-role="pregunta-texto" placeholder="${lblPregunta}" value="${escapeHtml(p.texto)}">
        <button type="button" class="icon-btn" data-action="del-pregunta">Eliminar ${esEleccion ? "cargo" : "pregunta"}</button>
      </div>
      ${p.opciones.map((o, oi) => `
        <div class="opcion-row" data-oi="${oi}">
          <input type="text" data-role="opcion-texto" placeholder="${lblOpcion}" value="${escapeHtml(o.texto)}">
          <button type="button" class="icon-btn" data-action="del-opcion">✕</button>
        </div>
      `).join("")}
      <button type="button" class="btn-secondary" data-action="add-opcion" style="margin-top:4px; padding:6px 12px; font-size:0.78rem;">+ ${esEleccion ? "Agregar candidato" : "Agregar opción"}</button>
    </div>
  `).join("");
}

$("votacionPreguntasEditor").addEventListener("input", (e) => {
  const card = e.target.closest(".pregunta-card");
  if (!card) return;
  const pi = parseInt(card.dataset.pi, 10);
  if (e.target.dataset.role === "pregunta-texto") {
    MODAL_PREGUNTAS[pi].texto = e.target.value;
  } else if (e.target.dataset.role === "opcion-texto") {
    const oi = parseInt(e.target.closest(".opcion-row").dataset.oi, 10);
    MODAL_PREGUNTAS[pi].opciones[oi].texto = e.target.value;
  }
});

$("votacionPreguntasEditor").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const card = e.target.closest(".pregunta-card");
  const pi = parseInt(card.dataset.pi, 10);
  if (btn.dataset.action === "del-pregunta") {
    MODAL_PREGUNTAS.splice(pi, 1);
  } else if (btn.dataset.action === "add-opcion") {
    MODAL_PREGUNTAS[pi].opciones.push({ id: nuevoId(), texto: "" });
  } else if (btn.dataset.action === "del-opcion") {
    const oi = parseInt(e.target.closest(".opcion-row").dataset.oi, 10);
    MODAL_PREGUNTAS[pi].opciones.splice(oi, 1);
  }
  renderPreguntasEditor();
});

$("votacionAgregarPreguntaBtn").addEventListener("click", () => {
  MODAL_PREGUNTAS.push({ id: nuevoId(), texto: "", opciones: [{ id: nuevoId(), texto: "" }, { id: nuevoId(), texto: "" }] });
  renderPreguntasEditor();
});

$("openNewVotacionBtn").addEventListener("click", () => abrirModalVotacion(null));
$("votacionModalCancel").addEventListener("click", () => { $("votacionModal").hidden = true; });

$("votacionForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("votacionFormError");
  err.hidden = true;

  const titulo = $("v_titulo").value.trim();
  if (!titulo) {
    err.textContent = "El título es obligatorio.";
    err.hidden = false;
    return;
  }
  const preguntasLimpias = MODAL_PREGUNTAS
    .map((p) => ({ ...p, texto: p.texto.trim(), opciones: p.opciones.map((o) => ({ ...o, texto: o.texto.trim() })).filter((o) => o.texto) }))
    .filter((p) => p.texto && p.opciones.length >= 2);

  if (!preguntasLimpias.length) {
    err.textContent = "Agrega al menos una pregunta/cargo con mínimo 2 opciones/candidatos, todos con texto.";
    err.hidden = false;
    return;
  }

  const idExistente = $("v_id").value;
  const data = {
    titulo,
    descripcion: $("v_descripcion").value.trim(),
    tipo: $("v_tipo").value,
    resultados_publicos: $("v_resultados_publicos").checked,
    preguntas: preguntasLimpias,
    actualizado_en: new Date().toISOString(),
  };

  const btn = $("votacionModalSave");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  try {
    if (idExistente) {
      await setDoc(doc(db, "votaciones", idExistente), data, { merge: true });
    } else {
      const ref = doc(collection(db, "votaciones"));
      await setDoc(ref, { ...data, estado: "borrador", participantes: 0, creado_en: new Date().toISOString() });
    }
    $("votacionModal").hidden = true;
    mostrarToast("Votación guardada.");
    await cargarVotaciones();
  } catch (e2) {
    err.textContent = "No se pudo guardar. Intenta de nuevo.";
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar borrador";
  }
});

// ---- Resultados ----
async function mostrarResultados(votacion) {
  $("resultadosModalTitle").textContent = `Resultados — ${votacion.titulo}`;
  $("resultadosContenido").innerHTML = `<p style="color:var(--texto-mute); font-size:0.85rem;">Cargando…</p>`;
  $("resultadosModal").hidden = false;

  if (TOTAL_ELEGIBLES === null) {
    const snapElegibles = await getDocs(collection(db, "votantes_hash"));
    TOTAL_ELEGIBLES = snapElegibles.size;
  }

  const q = query(collection(db, "voto_respuestas"), where("votacion_id", "==", votacion.id));
  const snap = await getDocs(q);
  const respuestas = snap.docs.map((d) => d.data());

  const participacionPct = TOTAL_ELEGIBLES ? Math.round((respuestas.length / TOTAL_ELEGIBLES) * 100) : 0;

  let html = `<p class="mono-note" style="margin-bottom:18px;">Participación: ${respuestas.length} de ${TOTAL_ELEGIBLES} afiliados habilitados (${participacionPct}%)</p>`;

  for (const pregunta of votacion.preguntas) {
    const conteos = {};
    pregunta.opciones.forEach((o) => { conteos[o.id] = 0; });
    let totalPregunta = 0;
    respuestas.forEach((r) => {
      const elegida = (r.respuestas || []).find((x) => x.pregunta_id === pregunta.id);
      if (elegida && conteos[elegida.opcion_id] !== undefined) {
        conteos[elegida.opcion_id]++;
        totalPregunta++;
      }
    });
    html += `<div class="resultado-pregunta"><h4>${escapeHtml(pregunta.texto)}</h4>`;
    pregunta.opciones.forEach((o) => {
      const n = conteos[o.id];
      const pct = totalPregunta ? Math.round((n / totalPregunta) * 100) : 0;
      html += `
        <div class="resultado-opcion">
          <div class="fila"><span>${escapeHtml(o.texto)}</span><span>${n} (${pct}%)</span></div>
          <div class="barra-bg"><div class="barra-fill" style="width:${pct}%;"></div></div>
        </div>
      `;
    });
    html += `</div>`;
  }
  $("resultadosContenido").innerHTML = html;
}

$("resultadosModalCerrar").addEventListener("click", () => { $("resultadosModal").hidden = true; });
