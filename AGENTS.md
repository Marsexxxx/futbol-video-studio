# Instrucciones del Proyecto: Video Studio AI (`futbol-video-studio`)

## Reglas de Trabajo (OBLIGATORIAS)
1. **Ediciones quirúrgicas:** Nunca reescribas archivos completos si solo se pidió un ajuste puntual. Modifica únicamente las líneas necesarias y conserva intactas las funciones existentes.
2. **Validación antes de terminar:** Después de cada cambio en TypeScript/React, ejecuta `npm run build` para confirmar que no existan errores de compilación.
3. **Idioma:** Responde al usuario siempre en español claro y conciso. No hagas `git push` sin confirmación explícita del usuario.

## Arquitectura Actual
- **Frontend:** React + TypeScript + Vite (`src/App.tsx`, `src/types.ts`, `src/index.css`).
- **Motor de video:** Remotion 9:16 (`1080×1920`, 30 fps) en `src/remotion/DynamicVideo.tsx` y `src/remotion/Root.tsx`, usando `@remotion/transitions`, `@remotion/shapes` y `@remotion/noise`.
  - **Motor SVG Animado (`AnimatedSvgStage` + `StyleBackdrop`):** Renderiza escenas SVG deterministas cuadro a cuadro (`useCurrentFrame()` + variables CSS acotadas, sin `@keyframes`), soporta `renderMode: "animated"` y `layout: "animated-stage"`, sanitización SVG, globo `speechBubble` y 10 `animationStyle`: `pixel-art`, `chalkboard`, `neon-sketch`, `ps2-retro`, `comic`, `flat-vector`, `minimal-line`, `cgi`, `lego` y `3d-explainer`.
- **Backend (Netlify Edge Functions):**
  - `netlify/edge-functions/generate-video.js` (guion, estructura de escenas y `animationPrompt` con Gemini)
  - `netlify/edge-functions/generate-scene-svg.js` (generación individual de `svgScene` por escena para `AnimatedSvgStage`)
  - `netlify/edge-functions/generate-image.js` (imágenes 9:16 con Gemini/Imagen)
  - `netlify/edge-functions/generate-tts.js` (voz de estudio Gemini TTS)
  - `netlify/edge-functions/export-video.js` y `export-status.js` (render MP4 en GitHub Actions)
- **Render en la nube:** `scripts/prepare-render.mjs` descarga assets para renderizar en GitHub Actions.
- **SFX locales:** `public/sfx/whoosh.wav` y `public/sfx/pop.wav`.

## Dos Pestañas Principales (NO mezclar ni romper)
1. **Contenido General:** Videos verticales sobre cualquier tema (deportes, historia, ciencia, etc.). Soporta modos `animated`, `hybrid`, `editorial` y `cinematic`, subtítulos dinámicos palabra por palabra y clásicos, subida de imágenes y videos por escena, y control exacto de duración.
2. **Reclutamiento / Vacantes:**
   - **Empresa predeterminada:** `UNIÓN DE PRODUCTORES DE CAÑA DE JOACHÍN`
   - **Paleta oficial (ASR Group):**
     - Verde principal: `#008F4C`
     - Verde medio: `#7EC34A`
     - Verde lima (acentos): `#BCD853`
     - Grises: `#26282A` (fondo), `#636466` (gris medio), `#A7A9AC` (gris claro)
   - **Encabezado corporativo fijo:** Visible cuando `showBrandHeader` es `true`, con el nombre de la empresa a la izquierda y el logo `public/logoasr.png` (proporción cuadrada `732×756`) en la esquina superior derecha.
   - **Escena final de Flyer (`layout: "flyer-end"`):** Muestra la imagen del flyer completa en `objectFit: "contain"` sin recortes y con subtítulos compactos en la parte inferior.

## Detalles Técnicos Clave
- En `src/remotion/DynamicVideo.tsx`, cualquier archivo de `public/` debe resolverse con `resolveMediaSrc` para que funcione tanto en la vista previa de Netlify (Vite) como al renderizar MP4 en GitHub Actions (Remotion).
