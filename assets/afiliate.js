// Formulario público de afiliación. Firebase Storage no está disponible en
// este proyecto (requiere plan de pago Blaze), así que los dos documentos se
// guardan como data URI (base64) dentro del mismo documento de Firestore
// (colección `afiliados`, mismo modelo que usa el panel admin), con
// canal_registro:'web' y estado:'pendiente_verificacion'. Por eso el límite
// de tamaño por archivo es bajo: Firestore rechaza cualquier documento que
// supere 1 MiB en total. Ver firebase/firestore.rules para las reglas que
// permiten esta escritura pública restringida. Cuando se active Storage,
// migrar esto a uploadBytes + getDownloadURL (ver historial de este archivo).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app = initializeApp(window.SINTRAOSI_FIREBASE_CONFIG);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const MAX_BYTES = 350 * 1024;

function wireUploadBox(boxId, inputId) {
  const box = $(boxId);
  const input = $(inputId);
  const text = box.querySelector(".upload-box-text");
  const original = text.textContent;
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (file) {
      box.classList.add("has-file");
      text.textContent = file.name;
    } else {
      box.classList.remove("has-file");
      text.textContent = original;
    }
  });
}
wireUploadBox("box_cedula", "f_doc_cedula");
wireUploadBox("box_certificado", "f_doc_certificado");

function leerComoDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

$("afiliateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("afiliateError");
  const ok = $("afiliateOk");
  err.hidden = true;
  ok.hidden = true;

  const cedula = $("f_cedula").value.replace(/\D/g, "").trim();
  const docCedula = $("f_doc_cedula").files[0];
  const docCertificado = $("f_doc_certificado").files[0];

  if (!cedula) {
    err.textContent = "Ingresa tu número de cédula.";
    err.hidden = false;
    return;
  }
  if (!docCedula || !docCertificado) {
    err.textContent = "Debes adjuntar la fotocopia de la cédula y la certificación laboral.";
    err.hidden = false;
    return;
  }
  for (const f of [docCedula, docCertificado]) {
    if (f.size > MAX_BYTES) {
      err.textContent = `El archivo "${f.name}" supera el máximo de 350 KB. Usa una foto comprimida o un escaneo liviano.`;
      err.hidden = false;
      return;
    }
  }
  if (!$("terms").checked) {
    err.textContent = "Debes aceptar los términos y condiciones de la afiliación.";
    err.hidden = false;
    return;
  }

  const btn = $("afiliateSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Enviando…";
  try {
    const [documento_cedula_url, documento_certificado_url] = await Promise.all([
      leerComoDataURL(docCedula),
      leerComoDataURL(docCertificado),
    ]);

    const nombres = [$("f_primer_nombre").value, $("f_segundo_nombre").value].filter(Boolean).join(" ").trim();
    const apellidos = [$("f_primer_apellido").value, $("f_segundo_apellido").value].filter(Boolean).join(" ").trim();

    await setDoc(doc(db, "afiliados", cedula), {
      cedula,
      tipo_documento: "CEDULA DE CIUDADANIA",
      nombres,
      apellidos,
      fecha_nacimiento: $("f_fecha_nacimiento").value || null,
      lugar_nacimiento: $("f_lugar_nacimiento").value || null,
      lugar_expedicion: $("f_lugar_expedicion").value || null,
      estado_civil: $("f_estado_civil").value || null,
      departamento: $("f_departamento").value || null,
      municipio: $("f_municipio").value || null,
      ciudad: $("f_ciudad").value || null,
      empresa: $("f_empresa").value || null,
      tipo_contrato: $("f_tipo_contrato").value || null,
      documento_cedula_url,
      documento_certificado_url,
      canal_registro: "web",
      estado: "pendiente_verificacion",
      es_prueba: false,
      creado_en: new Date().toISOString(),
    });

    $("afiliateForm").reset();
    document.querySelectorAll(".upload-box").forEach((b) => b.classList.remove("has-file"));
    $("box_cedula").querySelector(".upload-box-text").textContent = "Fotocopia de la cédula";
    $("box_certificado").querySelector(".upload-box-text").textContent = "Certificación laboral vigente";
    ok.hidden = false;
  } catch (e2) {
    console.error(e2);
    if (e2.code === "permission-denied") {
      err.textContent = "Ya existe una solicitud o afiliación registrada con esa cédula. Si crees que es un error, contacta a tu regional.";
    } else if (e2.code === "invalid-argument" || /longer than/i.test(e2.message || "")) {
      err.textContent = "Los archivos son demasiado pesados en conjunto. Usa fotos o escaneos más livianos (menos de 350 KB cada uno).";
    } else {
      err.textContent = "No se pudo enviar tu solicitud. Verifica tu conexión e intenta de nuevo.";
    }
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar solicitud de afiliación";
  }
});
