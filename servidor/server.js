/* Servidor del totem. Sin dependencias: node servidor/server.js
   Corre DENTRO del mini-PC del totem. Sirve tres cosas:
     - el kiosco     ->  http://IP:4300/kiosco/
     - el panel      ->  http://IP:4300/
     - la API        ->  http://IP:4300/api/...
   No necesita internet: basta con que el profesor este en la red del liceo. */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PUERTO = process.env.PUERTO || 4300;
const RAIZ = path.join(__dirname, "..");
const KIOSCO = path.join(RAIZ, "kiosco");
const PANEL = path.join(RAIZ, "panel");
const DATOS = path.join(__dirname, "datos");
const DOCS = path.join(KIOSCO, "contenido", "documentos");
const CONTENIDO = path.join(KIOSCO, "contenido", "contenido.json");
const HISTORIAL = path.join(DATOS, "historial");
const USUARIOS = path.join(DATOS, "usuarios.json");
const BITACORA = path.join(DATOS, "bitacora.log");

const EQUIPO = process.env.EQUIPO || "TOTEM-MMC-01";
const MAX_PDF = 10 * 1024 * 1024;

for (const d of [DATOS, HISTORIAL, DOCS]) fs.mkdirSync(d, { recursive: true });

/* ---------- usuarios ---------- */
/* La clave se guarda como sha256(clave + sal). Para agregar o cambiar usuarios:
     node servidor/server.js --usuario carolina "Prof. Carolina Munoz" profesor claveNueva  */
function hash(clave, sal) {
  return crypto.createHash("sha256").update(sal + clave).digest("hex");
}
function cargarUsuarios() {
  if (!fs.existsSync(USUARIOS)) {
    const sal = crypto.randomBytes(8).toString("hex");
    const inicial = [
      { usuario: "utp", nombre: "Encargada UTP", cargo: "Unidad Tecnico Pedagogica",
        rol: "encargado", sal, clave: hash("cambiar123", sal) },
    ];
    fs.writeFileSync(USUARIOS, JSON.stringify(inicial, null, 2));
    console.log("\n  Se creo servidor/datos/usuarios.json con un usuario inicial:");
    console.log("    usuario: utp    clave: cambiar123");
    console.log("    CAMBIELA antes de instalar en el liceo.\n");
  }
  return JSON.parse(fs.readFileSync(USUARIOS, "utf8"));
}

if (process.argv[2] === "--usuario") {
  const [, , , usuario, nombre, rol, clave] = process.argv;
  if (!usuario || !clave) {
    console.log('uso: node servidor/server.js --usuario <usuario> "<nombre>" <profesor|encargado> <clave>');
    process.exit(1);
  }
  const us = cargarUsuarios().filter((u) => u.usuario !== usuario);
  const sal = crypto.randomBytes(8).toString("hex");
  us.push({ usuario, nombre, cargo: "", rol: rol || "profesor", sal, clave: hash(clave, sal) });
  fs.writeFileSync(USUARIOS, JSON.stringify(us, null, 2));
  console.log("  Usuario guardado:", usuario, "(" + (rol || "profesor") + ")");
  process.exit(0);
}

const sesiones = new Map(); // token -> {usuario, nombre, rol, hasta}

function sesionDe(req) {
  const c = req.headers.cookie || "";
  const m = c.match(/sesion=([a-f0-9]+)/);
  if (!m) return null;
  const s = sesiones.get(m[1]);
  if (!s || s.hasta < Date.now()) { sesiones.delete(m[1]); return null; }
  return s;
}

/* ---------- utilidades ---------- */
function bitacora(linea) {
  const l = new Date().toISOString() + "  " + linea + "\n";
  fs.appendFile(BITACORA, l, () => {});
  process.stdout.write("  " + l);
}
function json(res, code, obj) {
  const b = Buffer.from(JSON.stringify(obj), "utf8");
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Content-Length": b.length,
                        "Cache-Control": "no-store" });
  res.end(b);
}
function cuerpo(req, max = 2 * 1024 * 1024) {
  return new Promise((ok, mal) => {
    const trozos = [];
    let n = 0;
    req.on("data", (t) => {
      n += t.length;
      if (n > max) { mal(new Error("demasiado grande")); req.destroy(); return; }
      trozos.push(t);
    });
    req.on("end", () => ok(Buffer.concat(trozos)));
    req.on("error", mal);
  });
}
function leerContenido() {
  return JSON.parse(fs.readFileSync(CONTENIDO, "utf8"));
}
function manifiesto() {
  const c = leerContenido();
  const archivos = [];
  const agregar = (rel, abs) => {
    if (!fs.existsSync(abs)) return;
    const b = fs.readFileSync(abs);
    archivos.push({ ruta: rel, bytes: b.length, hash: crypto.createHash("sha256").update(b).digest("hex").slice(0, 16) });
  };
  agregar("contenido/contenido.json", CONTENIDO);
  for (const f of fs.readdirSync(DOCS)) agregar("contenido/documentos/" + f, path.join(DOCS, f));
  return { version: c.version, generado: c.generado || null, equipo: EQUIPO, archivos };
}

const TIPOS = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml", ".pdf":"application/pdf",
  ".css":"text/css; charset=utf-8", ".png":"image/png", ".jpg":"image/jpeg", ".woff2":"font/woff2" };

function estatico(res, abs) {
  fs.readFile(abs, (e, b) => {
    if (e) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("No encontrado"); return; }
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(abs).toLowerCase()] || "application/octet-stream",
      "Content-Length": b.length,
      "Cache-Control": "no-store",
    });
    res.end(b);
  });
}
/* No se sale de la carpeta permitida aunque pidan ../../ */
function dentro(base, rel) {
  const abs = path.resolve(base, "." + rel);
  return abs.startsWith(path.resolve(base)) ? abs : null;
}

/* ---------- servidor ---------- */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const ruta = decodeURIComponent(u.pathname);
  const ses = sesionDe(req);

  // el kiosco puede estar servido desde otro origen
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  try {
    /* ----- API ----- */
    if (ruta === "/api/estado")
      return json(res, 200, {
        equipo: EQUIPO, version: leerContenido().version,
        sesion: ses ? { nombre: ses.nombre, rol: ses.rol } : null,
        hora: new Date().toISOString(),
      });

    if (ruta === "/api/manifest") return json(res, 200, manifiesto());
    if (ruta === "/api/contenido") return estatico(res, CONTENIDO);

    if (ruta === "/api/entrar" && req.method === "POST") {
      const b = JSON.parse((await cuerpo(req, 4096)).toString("utf8"));
      const usr = cargarUsuarios().find((x) => x.usuario === b.usuario);
      if (!usr || hash(b.clave || "", usr.sal) !== usr.clave) {
        bitacora("ENTRAR  fallo para " + (b.usuario || "?"));
        return json(res, 401, { error: "Usuario o clave incorrectos" });
      }
      const token = crypto.randomBytes(16).toString("hex");
      sesiones.set(token, { usuario: usr.usuario, nombre: usr.nombre, cargo: usr.cargo,
                            rol: usr.rol, hasta: Date.now() + 12 * 3600e3 });
      res.setHeader("Set-Cookie", `sesion=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);
      bitacora("ENTRAR  " + usr.nombre + " (" + usr.rol + ")");
      return json(res, 200, { nombre: usr.nombre, cargo: usr.cargo, rol: usr.rol });
    }

    if (ruta === "/api/salir" && req.method === "POST") {
      const m = (req.headers.cookie || "").match(/sesion=([a-f0-9]+)/);
      if (m) sesiones.delete(m[1]);
      res.setHeader("Set-Cookie", "sesion=; Path=/; Max-Age=0");
      return json(res, 200, { ok: true });
    }

    // de aqui para abajo hay que haber entrado
    if (ruta.startsWith("/api/") && req.method !== "GET" && !ses)
      return json(res, 401, { error: "Hay que entrar primero" });

    if (ruta === "/api/documento" && req.method === "POST") {
      const id = (u.searchParams.get("id") || "").replace(/[^a-zA-Z0-9_-]/g, "");
      if (!id) return json(res, 400, { error: "Falta el identificador" });
      const b = await cuerpo(req, MAX_PDF);
      if (b.slice(0, 4).toString("latin1") !== "%PDF")
        return json(res, 400, { error: "El archivo no es un PDF" });
      fs.writeFileSync(path.join(DOCS, id + ".pdf"), b);
      bitacora("SUBIR   " + id + ".pdf (" + Math.round(b.length / 1024) + " KB) por " + ses.nombre);
      return json(res, 200, { ruta: "contenido/documentos/" + id + ".pdf", bytes: b.length });
    }

    if (ruta === "/api/documento" && req.method === "DELETE") {
      const id = (u.searchParams.get("id") || "").replace(/[^a-zA-Z0-9_-]/g, "");
      const f = path.join(DOCS, id + ".pdf");
      if (fs.existsSync(f)) fs.unlinkSync(f);
      bitacora("BORRAR  " + id + ".pdf por " + ses.nombre);
      return json(res, 200, { ok: true });
    }

    if (ruta === "/api/publicar" && req.method === "POST") {
      if (ses.rol !== "encargado")
        return json(res, 403, { error: "Solo el encargado publica al tótem" });
      const b = JSON.parse((await cuerpo(req)).toString("utf8"));
      if (!b.contenido || !b.contenido.pantallas)
        return json(res, 400, { error: "El contenido no tiene la forma esperada" });

      const anterior = leerContenido();
      fs.writeFileSync(path.join(HISTORIAL, "v" + anterior.version + ".json"),
                       JSON.stringify(anterior, null, 2));

      const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
      const previas = fs.readdirSync(HISTORIAL).filter((f) => f.indexOf("v" + hoy) === 0).length;
      b.contenido.version = hoy + "-" + (previas + 1);
      b.contenido.generado = new Date().toISOString();
      b.contenido.publicadoPor = ses.nombre;
      b.contenido.nota = b.nota || "";

      fs.writeFileSync(CONTENIDO, JSON.stringify(b.contenido, null, 2));
      bitacora("PUBLIC  v" + b.contenido.version + " por " + ses.nombre + " — " + (b.nota || "sin nota"));
      return json(res, 200, { version: b.contenido.version });
    }

    if (ruta === "/api/versiones")
      return json(res, 200, fs.readdirSync(HISTORIAL).filter((f) => f.endsWith(".json"))
        .map((f) => {
          const c = JSON.parse(fs.readFileSync(path.join(HISTORIAL, f), "utf8"));
          return { version: c.version, generado: c.generado || null,
                   quien: c.publicadoPor || "—", nota: c.nota || "" };
        }).sort((a, b) => (a.version < b.version ? 1 : -1)));

    if (ruta === "/api/restaurar" && req.method === "POST") {
      if (ses.rol !== "encargado") return json(res, 403, { error: "Solo el encargado restaura" });
      const b = JSON.parse((await cuerpo(req, 4096)).toString("utf8"));
      const f = path.join(HISTORIAL, "v" + String(b.version).replace(/[^0-9.\-]/g, "") + ".json");
      if (!fs.existsSync(f)) return json(res, 404, { error: "Esa versión no existe" });
      const anterior = leerContenido();
      fs.writeFileSync(path.join(HISTORIAL, "v" + anterior.version + ".json"),
                       JSON.stringify(anterior, null, 2));
      fs.copyFileSync(f, CONTENIDO);
      bitacora("RESTAU  v" + b.version + " por " + ses.nombre);
      return json(res, 200, { version: b.version });
    }

    if (ruta === "/api/telemetria" && req.method === "POST") {
      const b = JSON.parse((await cuerpo(req, 8192)).toString("utf8"));
      bitacora("LATIDO  " + (b.equipo || "?") + " v" + (b.version || "?") +
               " toques=" + (b.toques || 0) + " uptime=" + (b.uptime || "?"));
      return json(res, 200, { ok: true });
    }

    if (ruta.startsWith("/api/")) return json(res, 404, { error: "No existe ese endpoint" });

    /* ----- archivos ----- */
    if (ruta === "/" || ruta === "/index.html") return estatico(res, path.join(PANEL, "index.html"));
    if (ruta.startsWith("/kiosco/")) {
      const abs = dentro(KIOSCO, ruta.slice(7));
      if (!abs) return json(res, 400, { error: "Ruta no permitida" });
      return estatico(res, fs.existsSync(abs) && fs.statSync(abs).isDirectory()
        ? path.join(abs, "index.html") : abs);
    }
    if (ruta === "/kiosco") { res.writeHead(302, { Location: "/kiosco/" }); return res.end(); }

    const abs = dentro(PANEL, ruta);
    if (abs && fs.existsSync(abs) && fs.statSync(abs).isFile()) return estatico(res, abs);

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("No encontrado");
  } catch (e) {
    bitacora("ERROR   " + ruta + " — " + e.message);
    json(res, 500, { error: e.message });
  }
});

server.listen(PUERTO, () => {
  cargarUsuarios();
  const nets = require("os").networkInterfaces();
  const ips = [];
  for (const n of Object.values(nets))
    for (const d of n) if (d.family === "IPv4" && !d.internal) ips.push(d.address);
  console.log("\n  Tótem Marta Martínez Cruz");
  console.log("  ─────────────────────────────────────────");
  console.log("  Panel   http://localhost:" + PUERTO + "/");
  console.log("  Kiosco  http://localhost:" + PUERTO + "/kiosco/");
  ips.forEach((ip) => console.log("  En red  http://" + ip + ":" + PUERTO + "/"));
  console.log("  ─────────────────────────────────────────\n");
});
