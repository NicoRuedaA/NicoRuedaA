# nicorueda.dev — portfolio

Portfolio web de **Nico Rueda**, diseñador de juegos y desarrollador multiplataforma (Manacor, Mallorca).

Sitio estático: HTML, CSS y JavaScript sin frameworks ni paso de build. Bilingüe (ES/EN).

El diseño gira alrededor de los cuadernos de Nico, y todo lo que puede ser de su mano lo es:

- **Todo lo escrito o dibujado a mano son fotos reales** de sus cuadernos (`assets/cuaderno/`, `assets/cuaderno/p2/`) y del boceto del nivel 1.1 de *Sapo Mafioso*, 2022 (`assets/hand/`), convertidas en máscaras WebP y recoloreadas con CSS. Cada escaneo lleva un pie que describe solo lo que se ve y cita su letra tal cual.
- **Títulos y nombre a mano**: los títulos de sección en español, «Nico Rueda» y «Aquí no hay jefe final. Hay un correo.» los escribió Nico para la web (`assets/cuaderno/titulos/`). Cada palabra es una máscara aparte, así que el título se parte en líneas como texto; el texto real sigue en la página para lectores de pantalla y buscadores. En inglés los títulos siguen en letra de imprenta.
- **Las cifras de los números** (1.4, 01, 02…) están compuestas con sus dígitos reales, recortados de unos apuntes de árboles AVL (`assets/cuaderno/cifras/`). El resto del texto va en letra de imprenta: no hay ninguna tipografía que imite su letra.
- **Las rayas** que separan filas, índices y tarjetas son trazos escaneados de lápiz, boli y rotulador (`r-*.webp`, `v-pencil-*.webp`), y las frases clave llevan su **fluorescente rosa** (`hl-pink-*.webp`, de un diagrama entidad-relación).
- **Sus recuadros y sus círculos son los controles**: los botones llevan el recuadro que dibujó alrededor de «consola» en unos apuntes de sistemas operativos; capturas y tarjetas, una viñeta de un storyboard; la sección actual y las opciones elegidas van rodeadas con el círculo de sus apuntes de árboles AVL. Cada uno está cortado en cuatro esquinas y cuatro lados (máscaras en `site.css`, variables `--hbs-*`, `--hbl-*`, `--hbc-*`), así que las esquinas no se deforman y solo se estiran los lados.
- **Papel sobre la mesa**: cada sección es una hoja con el grano de una foto de una hoja en blanco (`papel-l/d.webp`) y las esquinas redondeadas de su cuaderno.
- **Iconos suyos** (`assets/cuaderno/iconos/`): reproducir, pausa, la flecha ↗ de los enlaces externos, el ✓ de «copiado» y la mancha de tinta del botón del tema oscuro los dibujó para la web; el icono de «papel» es su recuadro de «consola» en pequeño.
- **Su notación es la interfaz**: los subrayados de títulos, `->` en botones y enlaces, `└>` en problema/decisión/resultado, `?` en «lo que aún no hace» y `×` para cerrar son trazos recortados de sus páginas.
- **Los marcos y los dibujos de las figuras interactivas los traza el código** (`assets/js/pen.js`) imitando cómo dibuja: cada lado es un trazo relleno con presión (entra fino, engorda y sale en cola) que se pasa de la esquina; sombreado a 60°, monigotes y hexágonos como los del cuaderno. Todo con semilla, así que un redibujado es siempre el mismo dibujo.
- **1.4 · Del cuaderno** es un pliego de dos páginas con robots y criaturas, un personaje suyo, estudios de anatomía y de cabezas, apuntes de clase y tres ideas de juego dibujadas a mano en el ordenador (archivos de 2021). Los robots de caja de una de las páginas andan por los márgenes del resto de la web.
- Dos temas: **papel** (claro: papel blanco con grano, boli azul, granate, verde, lápiz y fluorescente) y **tinta** (oscuro: la tinta pasa a ser la página; las piezas en color van sobre un recorte de papel para conservar su negro).

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

- Fechas de la UdG en la ficha y la trayectoria.
- Autoría del arte del Tactical Prototype, U.Roguelike y Animal Expirement (se presentan como arte del proyecto o del equipo, no como ilustración propia).
- Los pies de los escaneos del cuaderno (`index.html`, clases `scan` y `bk`): describen lo que se ve; si alguno de esos dibujos era para un proyecto concreto, se puede decir.
- Fecha del diagrama entidad-relación (está junto a 2025 en la trayectoria) y de las ideas de juego (se dicen «archivos de 2021» por la fecha de los archivos).

## Añadir más páginas del cuaderno

Las máscaras se generan desde la foto original: se recorta dentro del papel (nunca el fondo), se estima el nivel del papel localmente y la tinta pasa a canal alfa; los bolis de colores se separan por tono (azul/negro, granate, verde). Las páginas con color real se separan en dos capas: la tinta negra como máscara recoloreable (`-k.webp`) y el color tal cual (`-c.webp`). Luego se añade una clase `.scan--nombre` o `.bk--nombre` en `site.css` con su `aspect-ratio` y sus máscaras, y una `<figure class="scan">` con su pie en ES/EN.

Nunca se recorta el mantel estampado ni la mesa que salen debajo del cuaderno en muchas fotos, ni dedos o firmas, ni páginas con personajes de terceros (por ejemplo, el dibujo de Jinx de la parte 2, página 05).
