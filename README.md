# Tótem Liceo Agrícola Marta Martínez Cruz

Kiosco táctil para tótem exterior de 43" en el Liceo Bicentenario Agrícola Marta Martínez Cruz,
Yerbas Buenas, Región del Maule.

Funciona **sin conexión**. Internet solo se usa para enterarse de que hay contenido nuevo.

> ### ⚠️ Contenido de maqueta
> La historia, la dirección, los teléfonos y el sostenedor vienen del sitio del liceo y de SNA Educa.
> **Las cifras del predio, la disposición del plano, las estadísticas, los nombres de profesores y
> los cuatro PDF son contenido de relleno para visualizar el formato.** Hay que reemplazarlos por
> información validada por el liceo antes de instalar.

---

## Ver el tótem

Abrir `kiosco/index.html` en el navegador. No necesita servidor ni instalar nada.

Está diseñado a 1080 × 1920 (vertical) y se escala solo a cualquier pantalla. En un monitor de tótem
real queda 1:1. El botón `⛶` de la franja inferior lo lleva a pantalla completa.

**Teclas de mantención:** `1`–`6` saltan de pantalla · `T` panel técnico · `F` pantalla completa ·
`←` `→` pasan página en el lector · `Esc` cierra.

## Qué hay

| Pantalla | Contenido |
|---|---|
| **Inicio** | Atractor con campo animado, avisos vigentes y cifras rotando |
| **El Liceo** | Historia desde 1958, línea de tiempo, internado, club de huasos |
| **Agropecuaria** | Menciones Agricultura y Pecuaria, módulos MINEDUC, perfil de egreso |
| **El Campo** | Plano de las 90 ha con 12 puntos táctiles y ficha por punto |
| **Documentos** | PDF que suben los profesores, filtrados por público, con lector propio |
| **Visítanos** | Contacto, admisión, cómo llegar y QR |

Vuelve solo al atractor a los 45 segundos sin uso.

## Estructura

```
kiosco/
  index.html                 la app completa, un solo archivo
  plano.svg                  dibujo base del predio (los puntos vienen del contenido)
  contenido/
    contenido.json           todo el texto editable del tótem
    documentos/*.pdf         los PDF que se leen en pantalla
scripts/
  hacer-pdfs.js              genera los PDF de ejemplo y los embebe en el kiosco
docs/
  presentacion.html          página que explica la arquitectura (no es el tótem)
```

## Editar el contenido

Todo el texto sale de `kiosco/contenido/contenido.json`: cifras del atractor, avisos con fecha de
inicio y término, hitos, módulos por mención, los 12 puntos del plano con sus coordenadas, fichas de
documentos y datos de contacto.

El kiosco lleva además una **copia embebida** de ese JSON dentro de `index.html`. Arranca con esa
copia sí o sí, aunque no haya red, no haya servidor y no haya archivo en disco. El orden de carga es:

1. Copia embebida — siempre disponible
2. `contenido/contenido.json` en disco — si el kiosco está servido
3. Servidor remoto — sincronización en segundo plano, se aplica durante el atractor

## Regenerar los PDF de ejemplo

```bash
node scripts/hacer-pdfs.js
```

Escribe los PDF en `kiosco/contenido/documentos/` y los inyecta en base64 dentro de `index.html`,
entre los marcadores `<!--DOCS-INICIO-->` y `<!--DOCS-FIN-->`. Sin dependencias.

En producción estos archivos los sube cada profesor desde el panel, no este script.

## Antes de instalar

El prototipo carga tres cosas desde CDN: tipografías de Google Fonts, PDF.js y el generador de QR.
**Hay que bajarlas a `kiosco/lib/` y apuntar ahí**, o sin internet las tipografías caen a las del
sistema, el lector cae al visor del navegador y el QR deja de ser escaneable. Son unos 400 KB.

Otros puntos de la instalación:

- Navegador en modo kiosco con arranque automático y watchdog
- Gabinete IP65, pantalla de 2 500–3 500 nits, táctil PCAP
- Si el equipo es una Raspberry Pi, agregar módulo RTC: sin reloj de respaldo los avisos con fecha
  se rompen al cortarse la luz
- Reinicio programado de madrugada y apagado del panel de noche

## Pendiente

- Panel web para que los profesores suban PDF y editen contenido (servidor local dentro del tótem)
- Servidor de sincronización y telemetría
- Empaquetar las librerías localmente
- Scripts de arranque en modo kiosco

---

Fuentes de la información real: [martamartinezcruz.cl](https://www.martamartinezcruz.cl/historia-liceo/) ·
[SNA Educa](https://www.snaeduca.cl/liceoagricolamartamartinezcruz/) ·
[Currículum Nacional MINEDUC](https://www.curriculumnacional.cl/portal/Educacion-Tecnico-Profesional/Especialidad-Agropecuaria/)
