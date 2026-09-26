# nicorueda.dev — portfolio

Portfolio web de **Nico Rueda**, diseñador de juegos y desarrollador multiplataforma (Manacor, Mallorca).

Sitio estático: HTML, CSS y JavaScript sin frameworks ni paso de build. Bilingüe (ES/EN).

El diseño gira alrededor del cuaderno de Nico:

- **Todo lo escrito o dibujado a mano son escaneos reales** del cuaderno (`assets/cuaderno/`) y del boceto del nivel 1.1 de *Sapo Mafioso*, 2022 (`assets/hand/`), convertidos en máscaras WebP y recoloreados con CSS. Cada escaneo lleva un pie que describe solo lo que se ve.
- **Su notación es la interfaz**: los subrayados de títulos, `->` en botones y enlaces, `└>` en problema/decisión/resultado, `?` en «lo que aún no hace» y `×` para cerrar o caído son trazos recortados de sus páginas.
- **Los marcos y los dibujos de las figuras los traza el código** (`assets/js/pen.js`) imitando cómo dibuja: una línea por lado que se pasa de la esquina, sombreado a 60°, monigotes y hexágonos como los del cuaderno. Todo con semilla, así que un redibujado es siempre el mismo dibujo.
- Dos temas: **papel** (claro: papel blanco, boli azul, granate, verde y lápiz) y **tinta** (oscuro: la tinta pasa a ser la página).

## Figuras interactivas

| Figura | Qué es | Origen |
| --- | --- | --- |
| FIG. 0 | El sapo dibujado a mano, voxelizado en vivo | `assets/vendor/voxel.js` de Voxelizer (MPL-2.0), sin cambios, en un Web Worker |
| FIG. 1 | Bandas de ojeo de Manager of Legends | `scouting_knowledge.rs` portado a JS |
| FIG. 2 | Repetición de una partida real IA vs IA (semilla 20026) | datos exportados del motor (`assets/data/match-20026.json`) |
| FIG. 3 | Demo oficial de Voxelizer | vídeo (solo se descarga al pulsar) |
| FIG. 4 | Generador FaceDNA | `face-model.js` + `renderer.js` de Sports Face (GPL-2.0), sin cambios |
| FIG. 5 | BFS con costes de terreno sobre hexágonos | `GraphSearch.cs` (2024) + `Game.Core` (2026) portados a JS |
| FIG. 6 | Validación de imágenes por *magic bytes* | `fetch_photos.py` de Viu Manacor |

## Ver en local

```sh
cd portfolio
npx http-server -c-1 .   # o: python3 -m http.server
```

Los módulos ES y el Web Worker necesitan servirse por HTTP (no funcionan con `file://`).

## Publicar

Es una carpeta autocontenida con rutas relativas. Para `nicorueda.dev`, copia el contenido de `portfolio/` a la raíz del repo `nicoruedaa.github.io` (conserva `CNAME` y la carpeta `juegos/`, que es donde viven las builds jugables de Catpire y Sapo Mafioso enlazadas desde la web).

## Antes de publicar, revisar

- Que `manageroflegends.com` y `viumanacor.cat` estén en línea (se enlazan desde los casos 01 y 06).
- Fechas y datos personales de la ficha y la trayectoria (Corsoft, UdG, CIDE).
- Autoría del arte del Tactical Prototype, U.Roguelike y Animal Expirement (se presentan como arte del proyecto o del equipo, no como ilustración propia).
- Los pies de los escaneos del cuaderno (`index.html`, clase `scan`): describen lo que se ve; si alguno de esos dibujos era para un proyecto concreto, se puede decir.

## Añadir más páginas del cuaderno

Las máscaras se generan desde la foto original: se recorta dentro del papel (nunca el fondo), se estima el nivel del papel localmente y la tinta pasa a canal alfa; los bolis de colores se separan por tono (azul/negro, granate, verde). Luego se añade una clase `.scan--nombre` en `site.css` con su `aspect-ratio` y su `mask-image`, y una `<figure class="scan">` con su pie en ES/EN.
