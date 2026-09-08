/* Genera los PDF de ejemplo del totem y los inyecta embebidos en kiosco/index.html.
   Sin dependencias: node scripts/hacer-pdfs.js
   En produccion estos archivos los sube cada profesor desde el panel del liceo. */

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const DIR = path.join(RAIZ, "kiosco", "contenido", "documentos");

/* ---------- escritor PDF minimo (Helvetica, A4, WinAnsi) ---------- */
function pdf(titulo, autor, paginas) {
  const objs = [];
  const add = (s) => objs.push(s);

  // Helvetica con WinAnsiEncoding acepta tildes y ñ (un byte, igual que latin1),
  // pero no la raya larga ni las comillas tipográficas: se reemplazan antes de escribir.
  const norm = (t) => String(t)
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x00-\xFF]/g, "?");
  const esc = (t) => norm(t).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const W = 595, H = 842, M = 62;

  const contenidos = paginas.map((bloques) => {
    let y = H - M;
    let s = "";
    for (const b of bloques) {
      const [tipo, texto] = b;
      if (tipo === "h1") { y -= 6; s += `BT /F2 22 Tf 0.05 0.20 0.16 rg ${M} ${y} Td (${esc(texto)}) Tj ET\n`; y -= 34; }
      else if (tipo === "h2") { y -= 12; s += `BT /F2 13 Tf 0.55 0.42 0.10 rg ${M} ${y} Td (${esc(texto)}) Tj ET\n`; y -= 22; }
      else if (tipo === "linea") { s += `0.80 0.82 0.78 RG 1 w ${M} ${y + 8} m ${W - M} ${y + 8} l S\n`; y -= 14; }
      else if (tipo === "vacio") { y -= 14; }
      else {
        for (const linea of envolver(texto, 88)) {
          s += `BT /F1 11 Tf 0.10 0.13 0.11 rg ${M} ${y} Td (${esc(linea)}) Tj ET\n`;
          y -= 16;
        }
      }
    }
    s += `BT /F1 8 Tf 0.45 0.48 0.45 rg ${M} 42 Td (${esc(autor + "  |  Liceo Agrícola Marta Martínez Cruz  |  documento de maqueta")}) Tj ET\n`;
    return s;
  });

  add("<</Type/Catalog/Pages 2 0 R>>");
  const kids = paginas.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
  add(`<</Type/Pages/Kids[${kids}]/Count ${paginas.length}>>`);
  add("<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>");
  add("<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>");
  contenidos.forEach((c, i) => {
    add(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${W} ${H}]/Resources<</Font<</F1 3 0 R/F2 4 0 R>>>>/Contents ${6 + i * 2} 0 R>>`);
    add(`<</Length ${Buffer.byteLength(c, "latin1")}>>\nstream\n${c}endstream`);
  });

  let out = "%PDF-1.4\n";
  const offsets = [0];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) out += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  out += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R/Info<</Title (${esc(titulo)})/Author (${esc(autor)})>>>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

function envolver(t, max) {
  const palabras = String(t).split(/\s+/), out = [];
  let l = "";
  for (const p of palabras) {
    if ((l + " " + p).trim().length > max) { out.push(l.trim()); l = p; }
    else l += " " + p;
  }
  if (l.trim()) out.push(l.trim());
  return out.length ? out : [""];
}

/* ---------- los documentos ---------- */
const DOCS = [
  {
    id: "ficha-agropecuaria",
    archivo: "ficha-especialidad-agropecuaria.pdf",
    titulo: "Especialidad Agropecuaria: ficha para apoderados",
    autor: "Prof. Rodrigo Salas - Jefe de Especialidad",
    paginas: [
      [
        ["h1", "Especialidad Agropecuaria"],
        ["h2", "Ficha informativa para apoderados y visitas"],
        ["linea", ""],
        ["p", "La especialidad Agropecuaria forma Técnicos de Nivel Medio capaces de trabajar en producción agrícola y ganadera. Se cursa en 3° y 4° medio como formación diferenciada técnico-profesional, con menciones en Agricultura y en Pecuaria."],
        ["vacio", ""],
        ["h2", "Qué aprende su hijo o hija"],
        ["p", "- Manejo de suelo, fertilización y riego tecnificado."],
        ["p", "- Establecimiento y conducción de cultivos, praderas y frutales."],
        ["p", "- Alimentación, sanidad y manejo del rebaño lechero y de carne."],
        ["p", "- Control biológico de plagas y manejo integrado."],
        ["p", "- Operación segura de tractor e implementos de labranza."],
        ["p", "- Costos, registros prediales y formulación de un emprendimiento."],
        ["vacio", ""],
        ["h2", "Dónde se aprende"],
        ["p", "El liceo cuenta con 90 hectáreas de campo productivo: pivote central, tres invernaderos, sala de riego tecnificado, lechería con ordeña mecánica, establos, medialuna, galpón de maquinaria propia, huerto de frutales y el Laboratorio de Control Biológico, sello del establecimiento."],
      ],
      [
        ["h2", "Práctica profesional"],
        ["p", "La práctica profesional es de 240 horas y se realiza en empresas del rubro: viveros, packing de cerezas, plantas lecheras y predios de agricultura familiar campesina a través del convenio con INDAP. El liceo asigna un profesor tutor que visita al estudiante en terreno."],
        ["vacio", ""],
        ["h2", "Después del liceo"],
        ["p", "El título de Técnico de Nivel Medio en Agropecuaria permite trabajar de inmediato o continuar estudios en Agronomía, Medicina Veterinaria o Ingeniería Agrícola. Existen convenios de continuidad de estudios con INACAP y Santo Tomás."],
        ["vacio", ""],
        ["h2", "Preguntas frecuentes"],
        ["p", "¿Necesita experiencia previa en el campo? No. La formación parte desde cero en 3° medio."],
        ["vacio", ""],
        ["p", "¿Hay internado? Sí, con 140 camas para estudiantes de comunas rurales del Maule, con alimentación, cuidado nocturno y estudio vespertino."],
        ["vacio", ""],
        ["p", "¿Qué ropa necesita? Overol, botas de goma y guantes para las clases en terreno. El liceo entrega el listado completo en la matrícula."],
        ["vacio", ""],
        ["linea", ""],
        ["p", "Consultas: bicentenariomartamcruz@snaeduca.cl - 73 239 0030"],
      ],
    ],
  },
  {
    id: "guia-ordena",
    archivo: "guia-ordena-higienica.pdf",
    titulo: "Guía de práctica: ordeña higiénica",
    autor: "Prof. Carolina Muñoz - Módulo Producción de leche",
    paginas: [
      [
        ["h1", "Guía de práctica: ordeña higiénica"],
        ["h2", "Módulo 08 - Producción y ordeña de leche - 4° medio Pecuaria"],
        ["linea", ""],
        ["p", "Objetivo: realizar la rutina de ordeña cumpliendo el protocolo higiénico, registrando la producción individual y detectando signos de mastitis."],
        ["vacio", ""],
        ["h2", "Antes de entrar a la sala"],
        ["p", "1. Lavado de manos y uso de guantes de nitrilo."],
        ["p", "2. Overol limpio, botas lavadas en el pediluvio."],
        ["p", "3. Revisar la temperatura del estanque de frío: debe estar bajo 4 °C."],
        ["p", "4. Verificar que el equipo de ordeña fue lavado en el ciclo anterior."],
        ["vacio", ""],
        ["h2", "Rutina de ordeña"],
        ["p", "1. Despunte: extraer los primeros chorros en el tazón de fondo oscuro y observar grumos o sangre. Registrar cualquier anomalía."],
        ["p", "2. Sellado previo: aplicar sellador y esperar 30 segundos de contacto."],
        ["p", "3. Secado: papel individual por pezón, nunca reutilizar."],
        ["p", "4. Colocación de pezoneras dentro de los 90 segundos siguientes."],
        ["p", "5. Retiro sin sobreordeña. Cortar el vacío antes de sacar la unidad."],
        ["p", "6. Sellado posterior cubriendo el pezón completo."],
      ],
      [
        ["h2", "Registro"],
        ["p", "Cada estudiante anota en la planilla: número de la vaca, litros de la mañana, litros de la tarde, observaciones sanitarias y tratamientos aplicados. La planilla se entrega al profesor al terminar la rutina."],
        ["vacio", ""],
        ["h2", "Señales de mastitis que debe reportar"],
        ["p", "- Grumos, coágulos o sangre en el despunte."],
        ["p", "- Ubre caliente, enrojecida o dolorosa al tacto."],
        ["p", "- Caída brusca de producción en una vaca."],
        ["p", "- Leche acuosa o con olor anormal."],
        ["vacio", ""],
        ["h2", "Evaluación"],
        ["p", "Se evalúa en pauta de cotejo durante tres rutinas consecutivas. Se aprueba con el 80 % de los indicadores logrados. La seguridad y el trato del animal son criterios eliminatorios: no se aprueba la práctica si hay maltrato o si se omite el protocolo higiénico."],
        ["vacio", ""],
        ["linea", ""],
        ["p", "Consultas al profesor de módulo o en la sala de ordeña, de lunes a viernes."],
      ],
    ],
  },
  {
    id: "calendario-admision",
    archivo: "calendario-admision-2027.pdf",
    titulo: "Calendario de admisión 2027",
    autor: "Dirección",
    paginas: [
      [
        ["h1", "Calendario de admisión 2027"],
        ["h2", "Postulación a 1° medio y a la especialidad Agropecuaria"],
        ["linea", ""],
        ["h2", "Sistema de Admisión Escolar (SAE)"],
        ["p", "Postulación principal: del 20 de agosto al 8 de septiembre de 2026, en sistemadeadmisionescolar.cl. Se postula en línea y sin costo. No hay pruebas de selección."],
        ["vacio", ""],
        ["p", "Publicación de resultados: 27 de octubre de 2026."],
        ["p", "Período de aceptación: del 27 al 31 de octubre de 2026."],
        ["p", "Período complementario: del 10 al 14 de noviembre de 2026."],
        ["p", "Matrícula: del 2 al 12 de diciembre de 2026, en Secretaría del liceo."],
        ["vacio", ""],
        ["h2", "Puertas abiertas"],
        ["p", "Sábado 10 de octubre y sábado 14 de noviembre, de 10:00 a 14:00 horas. Recorrido guiado por la lechería, los invernaderos y el Laboratorio de Control Biológico, con estudiantes de 4° medio como guías. No requiere inscripción previa."],
        ["vacio", ""],
        ["h2", "Internado"],
        ["p", "Los cupos de internado se asignan después de la matrícula, con prioridad por distancia al establecimiento. Consultar requisitos en Inspectoría General."],
        ["vacio", ""],
        ["h2", "Documentos para la matrícula"],
        ["p", "- Certificado de nacimiento."],
        ["p", "- Certificado anual de estudios de 8° básico."],
        ["p", "- Informe de personalidad."],
        ["p", "- Certificado de residencia si postula a internado."],
        ["vacio", ""],
        ["linea", ""],
        ["p", "Camino Abranquil km 1 s/n, Yerbas Buenas - 73 239 0030"],
      ],
    ],
  },
  {
    id: "control-biologico",
    archivo: "cartilla-control-biologico.pdf",
    titulo: "Cartilla: control biológico de plagas",
    autor: "Prof. Inés Vergara - Laboratorio de Control Biológico",
    paginas: [
      [
        ["h1", "Control biológico de plagas"],
        ["h2", "Cartilla de trabajo del laboratorio"],
        ["linea", ""],
        ["p", "El control biológico usa organismos vivos para reducir poblaciones de plagas, en vez de aplicar pesticidas. Es la línea de trabajo que distingue a este liceo y por la que recibimos delegaciones de otros establecimientos y de INACAP."],
        ["vacio", ""],
        ["h2", "Los tres tipos de control"],
        ["p", "Clásico: se introduce un enemigo natural que no existe en la zona."],
        ["p", "Aumentativo: se cría y libera el enemigo natural en cantidad. Es el que hacemos aquí."],
        ["p", "Conservativo: se modifica el manejo del predio para favorecer a los enemigos naturales que ya están."],
        ["vacio", ""],
        ["h2", "Lo que criamos en el laboratorio"],
        ["p", "- Chrysoperla: sus larvas comen pulgones, huevos y larvas pequeñas."],
        ["p", "- Trichogramma: avispita que parasita huevos de polillas."],
        ["p", "- Chinita Cryptolaemus: contra el chanchito blanco en frutales."],
        ["vacio", ""],
        ["h2", "Rutina semanal del estudiante"],
        ["p", "1. Monitoreo con trampas amarillas en invernadero y frutales."],
        ["p", "2. Conteo e identificación de plagas y enemigos naturales."],
        ["p", "3. Cálculo del umbral de daño económico."],
        ["p", "4. Decisión: liberar, esperar o combinar con manejo cultural."],
        ["p", "5. Registro en la bitácora del laboratorio."],
      ],
      [
        ["h2", "Umbral de daño económico"],
        ["p", "No toda plaga se combate. Se actúa cuando el daño esperado supera el costo del control. Por eso el conteo es obligatorio antes de cualquier liberación: sin datos no se decide."],
        ["vacio", ""],
        ["h2", "Cuidados en la crianza"],
        ["p", "- Temperatura entre 22 y 26 °C en la sala de cría."],
        ["p", "- Humedad relativa entre 60 y 70 %."],
        ["p", "- Revisar diariamente que no haya contaminación por hormigas o ácaros."],
        ["p", "- Rotular cada bandeja con especie, fecha y estado de desarrollo."],
        ["vacio", ""],
        ["h2", "Seguridad"],
        ["p", "El laboratorio no maneja pesticidas, pero sí material biológico vivo. No se saca material fuera del predio sin autorización del profesor. Lavado de manos al entrar y al salir."],
        ["vacio", ""],
        ["linea", ""],
        ["p", "Laboratorio de Control Biológico - punto 8 del plano del predio."],
      ],
    ],
  },
];

/* ---------- generar ---------- */
fs.mkdirSync(DIR, { recursive: true });
const embebidos = {};
const meta = [];

for (const d of DOCS) {
  const buf = pdf(d.titulo, d.autor, d.paginas);
  fs.writeFileSync(path.join(DIR, d.archivo), buf);
  embebidos[d.id] = buf.toString("base64");
  meta.push({ id: d.id, archivo: d.archivo, kb: Math.round(buf.length / 1024), paginas: d.paginas.length });
  console.log(`  ${d.archivo}  ${(buf.length / 1024).toFixed(1)} KB  ${d.paginas.length} pág.`);
}

/* ---------- inyectar en el kiosco ---------- */
const idx = path.join(RAIZ, "kiosco", "index.html");
let html = fs.readFileSync(idx, "utf8");
const INI = "<!--DOCS-INICIO-->", FIN = "<!--DOCS-FIN-->";
const bloque = INI + '\n<script type="application/json" id="docs-embebidos">\n' +
  JSON.stringify(embebidos) + "\n</" + "script>\n" + FIN;

if (html.includes(INI) && html.includes(FIN)) {
  html = html.slice(0, html.indexOf(INI)) + bloque + html.slice(html.indexOf(FIN) + FIN.length);
  fs.writeFileSync(idx, html, "utf8");
  console.log("\n  PDF embebidos en kiosco/index.html");
} else {
  console.log("\n  (marcadores DOCS-INICIO/DOCS-FIN no encontrados en kiosco/index.html)");
}
console.log(JSON.stringify(meta, null, 2));
