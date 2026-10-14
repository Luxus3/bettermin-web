# BetterMin · Sitio web

Rediseño de la landing de BetterMin: oscuro, minimalista y con dos animaciones protagonistas.

- **Hero:** el isotipo de BetterMin hecho de partículas que reaccionan al cursor ([Canvas UI](https://canvasui.dev), componente ParticleObject).
- **Cómo funciona:** escena 3D propia (three.js) que se queda fija mientras se scrollea. Un rajo dibujado con curvas de nivel, sensores en los bancos, tres flujos de datos (operacional, mineralogía y biología), el gemelo digital y la señal con la desviación anticipada.

Es un sitio estático, sin frameworks: un solo `index.html` con su CSS y JS, más la carpeta `assets/`.

## Verlo en local

Las animaciones necesitan un servidor local; si se abre `index.html` con doble clic, el navegador bloquea la carga de las partículas.

```bash
python -m http.server 5510
```

Después abrir `http://localhost:5510` en el navegador.

## Estructura

```
index.html          Página completa (HTML, CSS y JS)
assets/
  fx.js             Animaciones compiladas (three.js + partículas + escena 3D)
  logo.png          Logo BetterMin
  isotipo.png       Isotipo usado por las partículas del hero
  flotacion.jpg     Fotos de aplicaciones
  lixiviacion.jpg
  relave.jpg
  udd-ventures.png  Logos de "Con el apoyo de"
  chrysalis.png
src/                Código fuente de las animaciones
  entry.ts          Expone createParticleObject y createFlow3D
  flow3d.ts         Escena 3D de "Cómo funciona"
  lib/              ParticleObject de Canvas UI (MIT + Commons Clause)
```

## Modificar las animaciones

Solo hace falta si se cambia algo en `src/`. El sitio ya trae `assets/fx.js` compilado.

```bash
npm install
npm run build
```

## Publicar en GitHub Pages

1. Subir esta carpeta a un repositorio.
2. En el repo: **Settings → Pages → Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. El archivo `.nojekyll` ya está incluido para que GitHub sirva los archivos tal cual.

## Pendientes

- Fotos del equipo (la sección es tipográfica y está lista para sumarlas).
- Mail o link de agenda para los botones "Alinear un piloto" y "Agendar reunión técnica" (hoy apuntan a la sección de contacto).
- Dominio: hoy bettermin.com se publica desde el repo `bettermin-site`. Para usar esta versión hay que reemplazar el `index.html` de ese repo o apuntar el dominio a este.

## Créditos

- Partículas del hero: Canvas UI, licencia MIT + Commons Clause (ver `src/lib/LICENSE-canvas-ui.md`).
- 3D: [three.js](https://threejs.org) (MIT).
- Tipografías: Space Grotesk, Inter y JetBrains Mono (Google Fonts).
