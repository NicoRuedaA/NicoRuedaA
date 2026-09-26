# nicorueda.dev — portfolio

Portfolio web de **Nico Rueda**, diseñador de juegos y desarrollador multiplataforma (Manacor, Mallorca).

Sitio estático: HTML, CSS y JavaScript sin frameworks ni paso de build. Bilingüe (ES/EN) y con dos temas:

- **Boceto** (claro): el papel, el boli y el rotulador del boceto a mano del nivel 1.1 de *Sapo Mafioso* (2022). Los trazos manuscritos son escaneos reales recoloreados con máscaras CSS.
- **Motor** (oscuro): las trazas del motor de partida en Rust/WASM.

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
