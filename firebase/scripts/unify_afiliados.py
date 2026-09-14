#!/usr/bin/env python3
"""
Unifica BASE DE DATOS 2026 A SEPTIEMBRE 10.xls (base oficial, afiliaciones presenciales/históricas)
con afiliados.csv (envíos del formulario web) en un solo esquema, listo para importar a Firestore.

Salida:
  firebase/data/afiliados_unificados.json   -> array de documentos, listo para Firestore (id = cedula)
  firebase/data/afiliados_unificados.csv    -> mismo contenido en CSV, para revisión humana
  firebase/data/registros_descartados.csv   -> filas del formulario web descartadas por ser prueba/basura
  firebase/data/reporte.json                -> estadísticas del proceso
"""
import pandas as pd
import re
import json
import unicodedata
from datetime import datetime, date

BASE_XLS = "BASE DE DATOS 2026 A SEPTIEMBRE 10.xls"
AFILIADOS_CSV = "afiliados.csv"

OUT_JSON = "firebase/data/afiliados_unificados.json"
OUT_CSV = "firebase/data/afiliados_unificados.csv"
OUT_DESCARTADOS = "firebase/data/registros_descartados.csv"
OUT_REPORTE = "firebase/data/reporte.json"

TEST_WORDS = {"test", "prueba", "pruebas", "kkkkkk", "kkkkk", "ggdg", "dgdg", "asdf", "zzzz", "xxxx"}


def norm_cc(x):
    if pd.isna(x):
        return None
    s = re.sub(r"\D", "", str(x).strip())
    return s if s else None


def clean_str(x):
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return None
    s = str(x).strip()
    s = re.sub(r"\s+", " ", s)
    return s if s and s.lower() != "nan" else None


def title_case(x):
    s = clean_str(x)
    return s.title() if s else None


def to_iso_date(x):
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return None
    if isinstance(x, (pd.Timestamp, datetime, date)):
        try:
            return x.date().isoformat() if hasattr(x, "date") else x.isoformat()
        except Exception:
            return None
    s = str(x).strip()
    if not s or s.lower() == "nan":
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:19], fmt).date().isoformat()
        except Exception:
            continue
    m = re.match(r"^\d{4}-\d{2}-\d{2}", s)
    return m.group(0) if m else None


def strip_accents(s):
    if not s:
        return ""
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def is_junk_person(nombre, apellido, cedula_len):
    text = strip_accents(f"{nombre or ''} {apellido or ''}").lower()
    if any(w in text for w in TEST_WORDS):
        return True
    if cedula_len < 6 or cedula_len > 10:
        return True
    return False


def _to_int(x):
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return None
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return None


def full_name(n1, n2, a1, a2):
    parts = [p for p in [n1, n2, a1, a2] if p]
    return " ".join(parts) if parts else None


# ---------------------------------------------------------------------------
# 1. Cargar base oficial
# ---------------------------------------------------------------------------
xls = pd.ExcelFile(BASE_XLS)
base = xls.parse("Hoja1")
base["cc_norm"] = base["NUMERO DE \n IDENTIFICACION"].apply(norm_cc)
base = base[base["cc_norm"].notna()].copy()

presenciales = {}
dup_base = 0
for _, row in base.iterrows():
    cc = row["cc_norm"]
    b_n1 = clean_str(row.get("PRIMER NOMBRE"))
    b_n2 = clean_str(row.get("SEGUNDO NOMBRE"))
    b_a1 = clean_str(row.get("PRIMER \nAPELLIDO"))
    b_a2 = clean_str(row.get("SEGUNDO APELLIDO"))
    doc = {
        "cedula": cc,
        "tipo_documento": clean_str(row.get("TIPO DE DOCUMENTO")),
        "nombres": clean_str(f"{b_n1 or ''} {b_n2 or ''}".strip()) or None,
        "apellidos": clean_str(f"{b_a1 or ''} {b_a2 or ''}".strip()) or None,
        "nombre_completo": full_name(b_n1, b_n2, b_a1, b_a2),
        "genero": clean_str(row.get("GENERO")),
        "fecha_nacimiento": to_iso_date(row.get("FECHA DE NACIMIENTO")),
        "pais_nacimiento": clean_str(row.get("PAIS DE NACIMIENTO")),
        "pais_residencia": clean_str(row.get("PAIS DE RESIDENCIA")),
        "departamento": clean_str(row.get("DEPARTAMENTO DE NOTIFICACION  DE DIRECCION")),
        "ciudad": clean_str(row.get("CIUDAD DE RESIDENCIA")),
        "direccion": clean_str(row.get("DIRECCION DE NOTIFICACION")),
        "telefono_fijo": clean_str(row.get("TELEFONO\nFIJO                                 \n")),
        "celular": clean_str(row.get("TELEFONO CELULAR")),
        "estado_civil": clean_str(row.get("ESTADO CIVIL")),
        "hijos": _to_int(row.get("N°. DE HIJOS")),
        "escolaridad": clean_str(row.get("ESCOLARIDAD")),
        "email": clean_str(row.get("E-MAIL ")),
        "fecha_radicacion_empresa": to_iso_date(row.get("FECHA DE  RADICACION DE AFILIACION  EN LA EMPRESA")),
        "fecha_afiliacion": to_iso_date(row.get("FECHA SOLICITUD DE AFILIACION A SINTRAOSI")),
        "cargo_sindical": clean_str(row.get("CARGO SINDICAL")),
        "empresa": clean_str(row.get("EMPRESA A LA QUE PERTENECE")),
        "nit_empresa": clean_str(row.get("NIT DE LA EMPRESA")),
        "sector_empresa": clean_str(row.get("SECTOR DE LA  EMPRESA")),
        "fecha_ingreso_empresa": to_iso_date(row.get("FECHA INGRESO A LA EMPRESA")),
        "cargo": clean_str(row.get("CARGO LABORAL")),
        "sede": clean_str(row.get("SEDE DE TRABAJO")),
        "estado_sintraosi": clean_str(row.get("ESTADO ACTUAL EN SINTRAOSI")) or "ACTIVO (A)",
        "canal_registro": "presencial",
        "estado": "activo",
        "fuente": {"base_oficial_fila": int(row["Unnamed: 0"]) if not pd.isna(row.get("Unnamed: 0")) else None, "form_id_web": None},
    }
    if cc in presenciales:
        dup_base += 1  # cédula duplicada en la base oficial misma; nos quedamos con la primera
        continue
    presenciales[cc] = doc

# ---------------------------------------------------------------------------
# 2. Cargar formulario web, limpiar duplicados/basura
# ---------------------------------------------------------------------------
afil = pd.read_csv(AFILIADOS_CSV, dtype=str)
afil["cc_norm"] = afil["cedula"].apply(norm_cc)
afil["fecha_registro_dt"] = pd.to_datetime(afil["fecha_registro"], errors="coerce")

descartados = []
web_candidates = {}  # cc_norm -> lista de filas (para quedarnos con la más reciente)
for _, row in afil.iterrows():
    cc = row["cc_norm"]
    n1, a1 = clean_str(row.get("nombre_1")), clean_str(row.get("apellido_1"))
    if cc is None:
        descartados.append({**row.to_dict(), "motivo": "cedula_vacia"})
        continue
    if is_junk_person(n1, a1, len(cc)):
        descartados.append({**row.to_dict(), "motivo": "prueba_o_cedula_invalida"})
        continue
    web_candidates.setdefault(cc, []).append(row)

dup_web_envios = 0
solo_web = {}
for cc, rows in web_candidates.items():
    if len(rows) > 1:
        dup_web_envios += len(rows) - 1
    # quedarnos con el envío más reciente (más probable que tenga los datos correctos/actualizados)
    rows_sorted = sorted(rows, key=lambda r: r["fecha_registro_dt"] if pd.notna(r["fecha_registro_dt"]) else pd.Timestamp.min)
    row = rows_sorted[-1]

    n1, n2 = clean_str(row.get("nombre_1")), clean_str(row.get("nombre_2"))
    a1, a2 = clean_str(row.get("apellido_1")), clean_str(row.get("apellido_2"))

    doc = {
        "cedula": cc,
        "tipo_documento": "CEDULA DE CIUDADANIA",
        "nombres": clean_str(f"{n1 or ''} {n2 or ''}".strip()) or None,
        "apellidos": clean_str(f"{a1 or ''} {a2 or ''}".strip()) or None,
        "nombre_completo": full_name(n1, n2, a1, a2),
        "genero": None,
        "fecha_nacimiento": to_iso_date(row.get("fecha_nacimiento")),
        "pais_nacimiento": "COLOMBIA",
        "pais_residencia": "COLOMBIA",
        "departamento": clean_str(row.get("departamento")),
        "ciudad": clean_str(row.get("ciudad")) or clean_str(row.get("municipio")) or clean_str(row.get("ciudad_alt")),
        "direccion": clean_str(row.get("direccion")),
        "telefono_fijo": clean_str(row.get("telefono_fijo")),
        "celular": clean_str(row.get("celular")),
        "estado_civil": clean_str(row.get("estado_civil")),
        "hijos": _to_int(row.get("cantidad_hijos")),
        "escolaridad": clean_str(row.get("nivel_educativo")),
        "email": clean_str(row.get("email")),
        "fecha_radicacion_empresa": None,
        "fecha_afiliacion": to_iso_date(row.get("fecha_afiliacion")) or to_iso_date(row.get("fecha_registro")),
        "cargo_sindical": None,
        "empresa": clean_str(row.get("empresa")),
        "nit_empresa": None,
        "sector_empresa": None,
        "fecha_ingreso_empresa": to_iso_date(row.get("fecha_ingreso_empresa")),
        "cargo": clean_str(row.get("cargo")),
        "sede": clean_str(row.get("sede")),
        "estado_sintraosi": None,
        "canal_registro": "web",
        "estado": None,  # se decide abajo según si ya está en la base oficial
        "fuente": {"base_oficial_fila": None, "form_id_web": int(row["form_id"])},
    }
    solo_web[cc] = doc

# ---------------------------------------------------------------------------
# 3. Unificar: la base oficial manda cuando hay choque de datos.
#    Si la cédula está en ambas fuentes, se marca canal_registro="web" (hay evidencia
#    de que también llenó el formulario) pero estado="activo" (ya está oficializado)
#    y se completan campos vacíos de la base oficial con datos del formulario web.
# ---------------------------------------------------------------------------
unificados = {}
en_ambas = 0

for cc, doc in presenciales.items():
    unificados[cc] = doc

for cc, wdoc in solo_web.items():
    if cc in unificados:
        en_ambas += 1
        base_doc = unificados[cc]
        base_doc["canal_registro"] = "web"  # tiene registro en ambas fuentes
        base_doc["fuente"]["form_id_web"] = wdoc["fuente"]["form_id_web"]
        # completar campos vacíos de la base oficial con el formulario web
        for k, v in wdoc.items():
            if k in ("canal_registro", "estado", "fuente", "cedula"):
                continue
            if not base_doc.get(k) and v:
                base_doc[k] = v
    else:
        wdoc["estado"] = "pendiente_verificacion"
        unificados[cc] = wdoc

registros = list(unificados.values())
registros.sort(key=lambda d: d["cedula"])

# ---------------------------------------------------------------------------
# 4. Guardar salidas
# ---------------------------------------------------------------------------
import os
os.makedirs("firebase/data", exist_ok=True)

with open(OUT_JSON, "w", encoding="utf-8") as f:
    json.dump(registros, f, ensure_ascii=False, indent=2)

pd.DataFrame(registros).to_csv(OUT_CSV, index=False, encoding="utf-8-sig")

desc_df = pd.DataFrame(descartados)
if not desc_df.empty:
    desc_df = desc_df.drop(columns=["cc_norm", "fecha_registro_dt"], errors="ignore")
desc_df.to_csv(OUT_DESCARTADOS, index=False, encoding="utf-8-sig")

n_presencial = sum(1 for d in registros if d["canal_registro"] == "presencial")
n_web = sum(1 for d in registros if d["canal_registro"] == "web")
n_activo = sum(1 for d in registros if d["estado"] == "activo")
n_pendiente = sum(1 for d in registros if d["estado"] == "pendiente_verificacion")

reporte = {
    "generado": datetime.now().isoformat(timespec="seconds"),
    "total_base_oficial_filas": int(len(base)),
    "total_base_oficial_cedulas_unicas": len(presenciales),
    "cedulas_duplicadas_en_base_oficial": dup_base,
    "total_web_filas": int(len(afil)),
    "total_web_cedulas_validas_unicas": len(web_candidates),
    "envios_web_duplicados_descartados": dup_web_envios,
    "registros_web_descartados_por_basura": len(descartados),
    "cedulas_en_ambas_fuentes": en_ambas,
    "cedulas_solo_base_oficial": len(presenciales) - en_ambas,
    "cedulas_solo_web": len(solo_web) - en_ambas,
    "total_unificado": len(registros),
    "por_canal_registro": {"presencial": n_presencial, "web": n_web},
    "por_estado": {"activo": n_activo, "pendiente_verificacion": n_pendiente},
    "porcentaje_canal_web": round(100 * n_web / len(registros), 1) if registros else 0,
    "porcentaje_canal_presencial": round(100 * n_presencial / len(registros), 1) if registros else 0,
}
with open(OUT_REPORTE, "w", encoding="utf-8") as f:
    json.dump(reporte, f, ensure_ascii=False, indent=2)

print(json.dumps(reporte, ensure_ascii=False, indent=2))
