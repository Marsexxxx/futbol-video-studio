const getEnv = (key) =>
  (typeof Netlify !== "undefined" && Netlify.env?.get(key)) ||
  (typeof Deno !== "undefined" && Deno.env?.get(key)) ||
  "";

const GEMINI_HOST = ["generativelanguage", "googleapis", "com"].join(".");
const GEMINI_API_BASE = "https" + "://" + GEMINI_HOST + "/v1beta/models";

const RECRUITMENT_THEME = {
  primaryColor: "#008F4C",
  secondaryColor: "#7EC34A",
  accentColor: "#BCD853",
  bgColor: "#26282A",
};

function clampDuration(sec) {
  return Math.min(180, Math.max(10, Math.round(sec)));
}

function extractRequestedDuration(promptText, fallbackSeconds = 35) {
  const text = String(promptText || "").toLowerCase();

  if (/(?:\b1\b|\bun\b)\s*(?:minuto|min)\s*y\s*medio/.test(text)) {
    return 90;
  }

  const minSecMatch = text.match(
    /(?:\b(\d+(?:[.,]\d+)?)|\bun\b)\s*(?:minutos?|mins?)\s*(?:y|con)?\s*(\d+)\s*(?:segundos?|segs?\.?)/
  );
  if (minSecMatch) {
    const mins = minSecMatch[1]
      ? parseFloat(minSecMatch[1].replace(",", "."))
      : 1;
    const secs = parseInt(minSecMatch[2], 10);
    return clampDuration(Math.round(mins * 60 + secs));
  }

  const clockMatch = text.match(
    /(?:dure|duraci[oó]n|de|video\s+de)\s*(\d):([0-5]\d)\b/
  );
  if (clockMatch) {
    return clampDuration(
      parseInt(clockMatch[1], 10) * 60 + parseInt(clockMatch[2], 10)
    );
  }

  const minOnlyMatch = text.match(
    /(?:\b(\d+(?:[.,]\d+)?)|\bun\b)\s*(?:minutos?|mins?)\b/
  );
  if (minOnlyMatch) {
    const mins = minOnlyMatch[1]
      ? parseFloat(minOnlyMatch[1].replace(",", "."))
      : 1;
    return clampDuration(Math.round(mins * 60));
  }

  const secWordMatch = text.match(/\b(\d{1,3})\s*(?:segundos?|segs?\.?)\b/);
  if (secWordMatch) {
    const secs = parseInt(secWordMatch[1], 10);
    if (secs >= 8 && secs <= 300) return clampDuration(secs);
  }

  const shortSecMatch = text.match(
    /(?:de|dure|duraci[oó]n|en|unos|aprox\.?)\s+(\d{1,3})\s*s\b/
  );
  if (shortSecMatch) {
    const secs = parseInt(shortSecMatch[1], 10);
    if (secs >= 8 && secs <= 300) return clampDuration(secs);
  }

  return clampDuration(Number(fallbackSeconds) || 35);
}

function getTargetSceneCount(targetSeconds) {
  if (targetSeconds <= 16) return 3;
  if (targetSeconds <= 28) return 4;
  if (targetSeconds <= 44) return 5;
  if (targetSeconds <= 62) return 6;
  if (targetSeconds <= 80) return 7;
  if (targetSeconds <= 105) return 9;
  return Math.min(12, Math.max(9, Math.round(targetSeconds / 11)));
}

function normalizeSceneDurations(scenes, targetSeconds, fixedLastDuration = null) {
  if (!Array.isArray(scenes) || scenes.length === 0) return scenes;

  if (fixedLastDuration && scenes.length > 1) {
    const lastSec = Math.min(15, Math.max(4, Number(fixedLastDuration) || 6));
    const bodyTarget = Math.max(8, targetSeconds - lastSec);
    const bodyScenes = normalizeSceneDurations(scenes.slice(0, -1), bodyTarget, null);
    const lastScene = {
      ...scenes[scenes.length - 1],
      durationSeconds: Number(lastSec.toFixed(1)),
    };
    return [...bodyScenes, lastScene];
  }

  const weights = scenes.map((s) => {
    const words = String(s.subtitle || s.title || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(6, words);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let assigned = scenes.map((s, idx) => {
    const raw = (weights[idx] / totalWeight) * targetSeconds;
    return {
      ...s,
      durationSeconds: Number(Math.max(2.5, Math.round(raw * 10) / 10).toFixed(1)),
    };
  });

  const currentSum = assigned.reduce((acc, s) => acc + s.durationSeconds, 0);
  const diff = Number((targetSeconds - currentSum).toFixed(1));
  if (assigned.length > 0 && Math.abs(diff) >= 0.1) {
    const lastIdx = assigned.length - 1;
    assigned[lastIdx].durationSeconds = Number(
      Math.max(2.5, assigned[lastIdx].durationSeconds + diff).toFixed(1)
    );
  }

  return assigned;
}

async function requestModel(model, apiKey, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: { message: text.slice(0, 180) } };
    }

    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return {
        ok: false,
        status: 504,
        data: { error: { message: `El modelo ${model} excedió el tiempo límite.` } },
      };
    }
    throw err;
  }
}

const TOPIC_HINTS = {
  auto: "Detecta automáticamente la temática exacta del prompt (historia, ciencia, tecnología, negocios, finanzas, misterio, cine, cocina, motivación, noticias, deportes o cualquier otro tema) y adapta colores, ritmo, estética visual y tono narrativo 100% a ese tema.",
  sports: "Enfoque deportivo/futbolístico de alto impacto, con estética de transmisión deportiva y energía de grada.",
  story: "Enfoque documental, histórico o de misterio con atmósfera envolvente, narrativa cinematográfica y tensión dramática.",
  tech: "Enfoque de tecnología, inteligencia artificial, negocios o finanzas con estética moderna, limpia y ejecutiva.",
  viral: "Enfoque de curiosidades, ciencia, psicología o datos sorprendentes con ganchos rápidos y visuales llamativos.",
  cinema: "Enfoque de cine, cultura pop, videojuegos o entretenimiento con iluminación dramática de película.",
  recruitment: "Enfoque profesional y atractivo de reclutamiento laboral y atracción de talento corporativo/agroindustrial.",
};

const VALID_ANIMATION_STYLES = [
  "pixel-art",
  "chalkboard",
  "neon-sketch",
  "ps2-retro",
  "comic",
  "flat-vector",
  "minimal-line",
  "cgi",
  "lego",
  "3d-explainer",
];

const ANIMATION_STYLE_HINTS = {
  "pixel-art":
    "Estilo PIXEL ART: construye personajes, fondos y utilería exclusivamente con rectángulos y cuadrados pequeños (<rect>) alineados en grilla retro 8-bit/16-bit, sin curvas ni bordes redondeados, usando colores sólidos contrastados.",
  chalkboard:
    "Estilo PIZARRA (CHALKBOARD): usa trazos blancos (#F8FAFC), crema (#FDE68A) y verde/menta suave (#7EC34A) simulando dibujo a mano con tiza sobre pizarra oscura (fill=\"none\" o rellenos translúcidos suaves, stroke-linecap=\"round\", stroke-width=\"4\" a \"7\"). Aprovecha la clase anim-draw en trazos clave.",
  "neon-sketch":
    "Estilo BOCETO LUMINOSO (NEON SKETCH): usa contornos brillantes neón cian (#22D3EE), ámbar (#F59E0B) y magenta (#EC4899) con rellenos oscuros profundos (#060d1f / #0f172a) o translúcidos. Aprovecha anim-draw y anim-pulse.",
  "ps2-retro":
    "Estilo PS2 RETRO (LOW-POLY): construye siluetas y objetos con planos geométricos facetados (<polygon>) y sombreado angular de consola 2000s, con colores saturados y brillos geométricos.",
  comic:
    "Estilo CÓMIC: usa contornos negros gruesos (stroke=\"#0F172A\", stroke-width=\"6\" a \"9\"), colores planos vibrantes de historieta, líneas cinéticas de acción e incluye speechBubble corto (2 a 4 palabras) cuando aporte humor o impacto.",
  "flat-vector":
    "Estilo VECTOR PLANO (EDITORIAL MODERNO): usa formas limpias, proporciones estilizadas modernas y capas planas sin contorno (o contorno mínimo), con paleta limpia y legible.",
  "minimal-line":
    "Estilo LÍNEA MINIMALISTA (TINTA SOBRE BLANCO): usa trazos finos oscuros (#0F172A, stroke-width=\"3\" a \"5\", fill=\"none\" o blanco #FFFFFF) con pequeños acentos puntuales de color y sin rellenos oscuros pesados. Aprovecha anim-draw.",
  cgi:
    "Estilo CGI DRAMÁTICO: incluye <defs> con <radialGradient> y <linearGradient> para simular volumen 3D, iluminación cenital dramática, reflejos especulares y sombras suaves bajo los elementos. Aprovecha anim-pulse.",
  lego:
    "Estilo LEGO (BLOQUES STOP-MOTION): construye personajes y objetos con bloques rectangulares, cabezas cilíndricas con pivote superior, manos en C y pequeños círculos tipo stud en la parte superior de las piezas.",
  "3d-explainer":
    "Estilo 3D EXPLICATIVO (ESTUDIO SUAVE): usa formas muy redondeadas, gradientes pastel suaves en <defs>, personajes amigables y sombras ambientales limpias. Incluye speechBubble corto cuando ayude a explicar.",
};

const buildSvgStageInstructions = (animationStyle, isRecruitment) => `
INSTRUCCIONES DE DISEÑO PARA "svgScene" (OBLIGATORIO CUANDO APLIQUE):
- Cada "svgScene" debe ser un <svg viewBox="0 0 1080 1120" xmlns="http://www.w3.org/2000/svg">...</svg> limpio, autocontenido y compacto (ENTRE 25 y 65 primitivas SVG por escena para mantener el JSON rápido y válido).
- PROHIBIDO usar CSS @keyframes, <style>, <script> o <foreignObject> dentro del SVG.
- Dibuja personajes, objetos o escenarios MUY reconocibles y fieles al tema pedido (rasgos distintivos reales: peinado, barba, gafas, uniforme/camiseta con colores reales o vestimenta laboral, postura corporal, utilería y expresión facial).
- NO repitas la misma composición ni diseño entre escenas: cada escena debe ilustrar visualmente la acción exacta de su guion en un encuadre distinto.
- Organiza las partes móviles en grupos <g> usando estas clases semánticas (úsalas de forma natural según la acción):
  * Fondo o entorno lento: class="anim-pan-bg"
  * Torso / cuerpo principal con respiración: class="anim-bob"
  * Cabeza: class="anim-head"
  * Piernas opuestas al caminar/correr: class="anim-walk-leg-l" y class="anim-walk-leg-r"
  * Brazos izquierdo y derecho: class="anim-arm-l" y class="anim-arm-r"
  * Entrada lateral al iniciar la escena: class="anim-enter-left" o class="anim-enter-right"
  * Elemento sorpresa o dato que aparece a mitad de escena: class="anim-pop"
  * Trazos o líneas que se dibujan progresivamente: class="anim-draw"
  * Objetos flotantes (íconos, nubes, balones, estrellas, documentos): class="anim-float"
  * Brillo o energía pulsante: class="anim-pulse"
- Estética obligatoria del SVG (${animationStyle}): ${ANIMATION_STYLE_HINTS[animationStyle] || ANIMATION_STYLE_HINTS["flat-vector"]}
- Opcionalmente incluye "speechBubble" corto (2 a 4 palabras) cuando aporte dinamismo o claridad.${
  isRecruitment
    ? '\n- En Reclutamiento mantén los colores corporativos ASR Group (#008F4C, #7EC34A, #BCD853, #26282A, #FFFFFF) y NUNCA pongas "svgScene" en la escena final "flyer-end".'
    : ""
}`;

const RENDER_MODE_HINTS = {
  animated: `MODO ANIMACIÓN DINÁMICA 100% (ESCENAS SVG POR CÓDIGO):
- Usa "sceneMode": "animated" y "layout": "animated-stage" en TODAS las escenas (excepto "flyer-end" en reclutamiento).
- Genera un "svgScene" único, expresivo y adaptado al guion en CADA escena (sin fotos IA; deja "imagePrompt": "").`,
  hybrid: `MODO HÍBRIDO (OBLIGATORIO MEZCLAR):
- Alterna inteligentemente entre escenas visuales ("sceneMode": "hybrid" con "imagePrompt" detallado) y escenas animadas por código ("sceneMode": "editorial", "layout": "animated-stage" con "svgScene" único y expresivo).
- Incluye al menos 2 escenas clave con "layout": "animated-stage" y "svgScene" único adaptado al guion, sin repetir diseños entre escenas.`,
  editorial: `MODO EDITORIAL / MOTION GRAPHICS:
- Usa "sceneMode": "editorial" en TODAS las escenas para lograr una estética limpia de motion graphics estilo Vox/Johnny Harris con íconos dinámicos, formas animadas y tarjetas editoriales.`,
  cinematic: `MODO CINEMATOGRÁFICO:
- Usa "sceneMode": "cinematic" en TODAS las escenas con visuales a pantalla completa y movimientos de cámara dinámicos.`,
};

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = getEnv("GEMINI_API_KEY").trim();
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Falta configurar GEMINI_API_KEY en Netlify." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const {
      prompt,
      durationSeconds = 35,
      voiceSpeed = 1.0,
      topicMode = "auto",
      renderMode = "hybrid",
      animationStyle = "flat-vector",
      studioMode = "general",
      companyName = "UNIÓN DE PRODUCTORES DE CAÑA DE JOACHÍN",
      flyerDuration = 6,
    } = await req.json();

    const safeAnimationStyle = VALID_ANIMATION_STYLES.includes(animationStyle)
      ? animationStyle
      : "flat-vector";
    const includeSvgStage = renderMode === "animated" || renderMode === "hybrid";
    const svgStageHint = includeSvgStage
      ? buildSvgStageInstructions(safeAnimationStyle, studioMode === "recruitment" || topicMode === "recruitment")
      : "";

    const isRecruitment = studioMode === "recruitment" || topicMode === "recruitment";
    const effectiveDuration = extractRequestedDuration(prompt, durationSeconds);
    const sceneCount = isRecruitment
      ? Math.max(4, getTargetSceneCount(effectiveDuration))
      : getTargetSceneCount(effectiveDuration);
    const speed = Math.min(1.5, Math.max(0.85, Number(voiceSpeed) || 1.0));
    const speechBudgetSec = Math.max(6, effectiveDuration - sceneCount * 0.9);
    const targetTotalWords = Math.max(18, Math.round(speechBudgetSec * 2.55 * speed));
    const avgWordsPerScene = Math.max(6, Math.round(targetTotalWords / sceneCount));
    const minWordsPerScene = Math.max(5, Math.round(avgWordsPerScene * 0.8));
    const maxWordsPerScene = Math.max(minWordsPerScene + 3, Math.round(avgWordsPerScene * 1.2));
    const avgSecPerScene = (effectiveDuration / sceneCount).toFixed(1);

    const primaryModel = (getEnv("GEMINI_MODEL") || "gemini-3.8-flash")
      .trim()
      .replace(/^models\//, "");
    const fallbackList = getEnv("GEMINI_FALLBACK_MODELS")
      .split(",")
      .map((m) => m.trim().replace(/^models\//, ""))
      .filter(Boolean);

    const models = [...new Set([primaryModel, ...fallbackList])];
    const topicHint = TOPIC_HINTS[topicMode] || TOPIC_HINTS.auto;
    const modeHint = RENDER_MODE_HINTS[renderMode] || RENDER_MODE_HINTS.hybrid;

    const systemInstruction = isRecruitment
      ? `Eres director creativo especialista en Employer Branding y videos verticales 9:16 de RECLUTAMIENTO LABORAL para redes sociales (TikTok, Reels, Facebook, WhatsApp Status) en español.
Empresa que contrata: "${companyName}" (sector agroindustrial / caña de azúcar).
${modeHint}
${svgStageHint}

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura:
{
  "title": "Vacante: Nombre del puesto",
  "theme": {
    "primaryColor": "#008F4C",
    "secondaryColor": "#7EC34A",
    "accentColor": "#BCD853",
    "bgColor": "#26282A"
  },
  "scenes": [
    {
      "id": "s1",
      "type": "cinematic",
      "sceneMode": "animated" | "hybrid" | "editorial" | "cinematic",
      "layout": "animated-stage" | "hero-impact" | "story-clean" | "stat-overlay" | "quote-press" | "cta-engage" | "flyer-end",
      "cameraMotion": "impact-punch" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right",
      "transition": "slide-left" | "slide-up" | "wipe" | "fade" | "flip",
      "iconName": "briefcase" | "user-check" | "map-pin" | "badge-check" | "phone" | "calendar" | "building" | "check-circle" | "wrench" | "shield" | "trending-up" | "award" | "users" | "target" | "banknote" | "clock" | "sparkles",
      "calloutText": "Etiqueta corta de 2 a 4 palabras (ej. CONTRATACIÓN INMEDIATA, PRESTACIONES DE LEY)",
      "durationSeconds": ${avgSecPerScene},
      "badge": "ETIQUETA BREVE",
      "title": "TITULAR CLARO Y ATRACTIVO",
      "subtitle": "Locución natural, cercana y profesional en español.",
      "imagePrompt": "Detailed ENGLISH visual prompt depicting authentic modern agricultural/industrial workplace, friendly Mexican professionals, sugarcane fields, machinery, or modern office matching the exact job role, natural daylight, green and neutral gray color harmony, vertical 9:16 frame, strictly NO text, NO logos, NO borders (or empty string if layout is animated-stage).",
      "fallbackImagePrompt": "Clean modern editorial illustration of the workplace and job role in green and gray tones, vertical 9:16, strictly NO text.",
      "svgScene": "Solo cuando sceneMode es animated o layout es animated-stage (y NUNCA en flyer-end): <svg viewBox=\"0 0 1080 1120\" xmlns=\"http://www.w3.org/2000/svg\">...</svg> único y expresivo con 25 a 65 primitivas y clases anim-*.",
      "speechBubble": "Texto muy corto opcional (2 a 4 palabras) para globo de diálogo",
      "highlightValue": "Dato breve si aplica (ej. 100%, INMEDIATA, +BONOS)",
      "stampText": "VACANTE ACTIVA",
      "quoteText": "Beneficio o frase destacada si layout es quote-press",
      "ctaText": "POSTÚLATE HOY MISMO ↓",
      "bullets": ["Requisito o beneficio 1", "Requisito o beneficio 2"]
    }
  ]
}

REGLAS ESTRICTAS PARA VIDEOS DE RECLUTAMIENTO:
1. Duración objetivo EXACTA: ${effectiveDuration} segundos.
2. Genera EXACTAMENTE ${sceneCount} escenas en total:
   - Las primeras ${sceneCount - 1} escenas presentan la vacante de forma dinámica y atractiva:
     * Si renderMode es "animated", TODAS las primeras ${sceneCount - 1} escenas deben tener "sceneMode": "animated", "layout": "animated-stage" y un "svgScene" único y diferente en cada escena (y "imagePrompt": "").
     * Si renderMode es "hybrid", usa "layout": "animated-stage" con "svgScene" en las escenas editoriales/animadas y fotos en las demás.
     * En otros modos, alterna dinámicamente entre "hero-impact", "story-clean", "cta-engage", "stat-overlay" o "quote-press".
   - LA ÚLTIMA ESCENA (escena #${sceneCount}) DEBE SER OBLIGATORIAMENTE:
     * "layout": "flyer-end"
     * "sceneMode": "editorial"
     * "durationSeconds": ${Math.max(4, Number(flyerDuration) || 6)}
     * "badge": "INFORMACIÓN Y CONTACTO"
     * "title": "POSTÚLATE HOY"
     * "subtitle": Una invitación breve y cálida de cierre (10 a 15 palabras) invitando a revisar el flyer en pantalla, tomar captura o enviar su solicitud.
     * "imagePrompt": "" (vacío) y SIN "svgScene".
3. Mantén el campo "subtitle" de las primeras ${sceneCount - 1} escenas entre ${minWordsPerScene} y ${maxWordsPerScene} palabras para respetar los ${effectiveDuration} segundos reales.
4. Usa SIEMPRE exactamente los colores oficiales verde y gris en "theme": primaryColor "#008F4C", secondaryColor "#7EC34A", accentColor "#BCD853", bgColor "#26282A".
5. PROHIBIDO usar "type": "tactics" o "layout": "split-versus" salvo que el prompt pida explícitamente comparar cifras/porcentajes o una pizarra táctica de fútbol.
6. Usa "iconName" laborales relevantes ("briefcase", "user-check", "map-pin", "badge-check", "wrench", "building", "banknote", "shield", "check-circle") y "calloutText" breves y claros.
7. En "imagePrompt" (cuando aplique foto) describe ambientes reales, limpios, seguros y positivos acordes al puesto SIN texto ni letras en las imágenes.`
      : `Eres director creativo, guionista y director de motion graphics para videos verticales 9:16 virales en español sobre CUALQUIER temática (TikTok / Reels / YouTube Shorts).
${topicHint}
${modeHint}
${svgStageHint}

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura:
{
  "title": "Título corto del video",
  "theme": {
    "primaryColor": "#1E3A8A",
    "secondaryColor": "#BE123C",
    "accentColor": "#FACC15",
    "bgColor": "#07111F"
  },
  "scenes": [
    {
      "id": "s1",
      "type": "cinematic",
      "sceneMode": "animated" | "hybrid" | "editorial" | "cinematic",
      "layout": "animated-stage" | "hero-impact" | "story-clean" | "stat-overlay" | "quote-press" | "cta-engage",
      "cameraMotion": "impact-punch" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right",
      "transition": "slide-left" | "slide-up" | "wipe" | "fade" | "flip",
      "iconName": "trophy" | "file-text" | "scale" | "banknote" | "gavel" | "shield" | "flame" | "zap" | "clock" | "globe" | "brain" | "rocket" | "alert" | "megaphone" | "target" | "trending-up" | "lock" | "eye" | "users" | "crown" | "swords" | "sparkles" | "newspaper" | "briefcase" | "landmark" | "cpu" | "heart" | "compass" | "award" | "radio" | "flag",
      "calloutText": "Dato o golpe visual corto de 2 a 4 palabras que aparece a mitad de escena",
      "durationSeconds": ${avgSecPerScene},
      "badge": "ETIQUETA BREVE",
      "title": "TITULAR CON IMPACTO",
      "subtitle": "Locución natural en español ajustada exactamente al límite de palabras.",
      "imagePrompt": "Detailed ENGLISH visual prompt describing a vertical 9:16 scene matching the exact topic, people/subjects, setting, lighting, and camera angle. Strictly NO text, NO borders (or empty string if layout is animated-stage).",
      "fallbackImagePrompt": "Alternative ENGLISH visual prompt describing the same scene in dramatic editorial style with zero text.",
      "svgScene": "Cuando sceneMode es animated o layout es animated-stage: <svg viewBox=\"0 0 1080 1120\" xmlns=\"http://www.w3.org/2000/svg\">...</svg> único, expresivo y adaptado al guion (25 a 65 primitivas SVG) con clases anim-*.",
      "speechBubble": "Texto muy corto opcional (2 a 4 palabras) para globo de diálogo",
      "highlightValue": "Dato corto si aplica",
      "stampText": "CLAVE",
      "quoteText": "Frase corta si layout es quote-press",
      "ctaText": "Llamado a la acción breve si layout es cta-engage",
      "bullets": ["Punto 1", "Punto 2"]
    }
  ]
}

REGLAS ESTRICTAS DE DURACIÓN (CRÍTICO):
1. Duración objetivo EXACTA: ${effectiveDuration} segundos.
2. Genera EXACTAMENTE ${sceneCount} escenas cuya suma de "durationSeconds" sea ${effectiveDuration} segundos.
3. Para que la voz narrada dure ${effectiveDuration} segundos reales, el campo "subtitle" de CADA escena debe tener entre ${minWordsPerScene} y ${maxWordsPerScene} palabras (total aproximado de ${targetTotalWords} palabras entre todas las escenas).

REGLAS DE DINAMISMO VISUAL Y ANTI-PLANTILLAS:
4. PROHIBIDO usar "type": "tactics" (el tablero fijo) salvo que el usuario pida explícitamente "pizarra táctica de fútbol". En cualquier otro caso usa siempre "type": "cinematic".
5. PROHIBIDO usar "layout": "split-versus" (barras de porcentaje) salvo que el prompt del usuario pida explícitamente comparar dos cifras o porcentajes.
6. Cuando renderMode sea "animated", TODAS las escenas deben usar "sceneMode": "animated", "layout": "animated-stage" y un "svgScene" único y creativo por escena. En modo "hybrid", usa "layout": "animated-stage" + "svgScene" en las escenas editoriales/animadas sin repetir composiciones.
7. Elige un "iconName" específico y coherente en CADA escena, y escribe un "calloutText" breve (2 a 4 palabras).
8. Varía "layout", "cameraMotion" y "transition" entre escenas consecutivas para que el video tenga ritmo real.
9. Adapta "theme" a la paleta cromática real del tema.
10. Cuando una escena use foto ("hybrid" o "cinematic"), "imagePrompt" debe ir SIEMPRE en inglés, muy específico, encuadre vertical 9:16 limpio SIN texto ni marcos.`;

    const buildPayload = (disableThinking) => ({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: isRecruitment ? 0.68 : 0.78,
        maxOutputTokens: 16000,
        ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });

    const startTime = Date.now();
    const maxBudgetMs = 48000;
    let lastResult = { ok: false, status: 503, data: {} };
    let usedModel = primaryModel;

    for (const model of models) {
      const remainingMs = maxBudgetMs - (Date.now() - startTime);
      if (remainingMs < 3000) break;

      usedModel = model;
      lastResult = await requestModel(model, apiKey, buildPayload(true), remainingMs);

      if (!lastResult.ok && lastResult.status === 400) {
        const msg = JSON.stringify(lastResult.data).toLowerCase();
        if (msg.includes("thinking") || msg.includes("budget")) {
          const retryMs = maxBudgetMs - (Date.now() - startTime);
          if (retryMs >= 3000) {
            lastResult = await requestModel(model, apiKey, buildPayload(false), retryMs);
          }
        }
      }

      if (lastResult.ok) break;
      const shouldFallback =
        lastResult.status === 503 ||
        lastResult.status === 429 ||
        lastResult.status === 404 ||
        lastResult.status === 504;
      if (!shouldFallback) break;
    }

    if (!lastResult.ok) {
      const apiMsg =
        typeof lastResult.data?.error === "string"
          ? lastResult.data.error
          : lastResult.data?.error?.message;
      return new Response(
        JSON.stringify({
          error:
            lastResult.status === 503
              ? `El modelo ${usedModel} está saturado (503). Intenta de nuevo en unos segundos.`
              : apiMsg || `Error ${lastResult.status} al consultar Gemini (${usedModel}).`,
        }),
        { status: lastResult.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const parts = lastResult.data?.candidates?.[0]?.content?.parts || [];
    const answerPart = parts.find((p) => p.text && !p.thought) || parts[parts.length - 1];
    const rawText = answerPart?.text;

    if (!rawText) {
      return new Response(
        JSON.stringify({ error: "Gemini respondió vacío sin texto." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    const videoSpec = JSON.parse(cleaned);
    videoSpec.targetDuration = effectiveDuration;
    videoSpec.renderMode = renderMode;
    videoSpec.animationStyle = safeAnimationStyle;
    videoSpec.studioMode = isRecruitment ? "recruitment" : "general";

    const wantsComparison =
      /\b(?:compara|comparar|comparaci[oó]n|comparativa|porcentaje|porcentajes|cifras|versus|vs\.?)\b|%/i.test(
        prompt || ""
      );
    const wantsFootballTactics =
      /pizarra\s+t[aá]ctica(?:\s+de\s+f[uú]tbol)?/i.test(prompt || "");

    const normalizeGeneratedScene = (scene, idx, isLastRecruitment) => {
      if (isLastRecruitment) {
        const { svgScene: _s, speechBubble: _b, ...rest } = scene;
        return {
          ...rest,
          type: "cinematic",
          layout: "flyer-end",
          sceneMode: "editorial",
          imagePrompt: "",
        };
      }

      const nextType =
        !wantsFootballTactics && scene.type === "tactics"
          ? "cinematic"
          : isRecruitment
          ? "cinematic"
          : scene.type || "cinematic";

      const nextSceneMode =
        renderMode === "animated"
          ? "animated"
          : renderMode === "editorial"
          ? "editorial"
          : renderMode === "cinematic"
          ? "cinematic"
          : scene.sceneMode || (idx % 2 === 1 ? "editorial" : "hybrid");

      const hasSvg = Boolean(
        typeof scene.svgScene === "string" && scene.svgScene.trim()
      );

      let nextLayout = scene.layout;
      if (!wantsComparison && nextLayout === "split-versus") {
        nextLayout =
          nextSceneMode === "animated" || hasSvg
            ? "animated-stage"
            : "story-clean";
      }
      if (nextSceneMode === "animated") {
        nextLayout = "animated-stage";
      } else if (renderMode === "hybrid" && hasSvg) {
        nextLayout = "animated-stage";
      } else if (!nextLayout && nextType !== "tactics") {
        nextLayout = "story-clean";
      }

      return {
        ...scene,
        type: nextType,
        sceneMode: nextSceneMode,
        layout: nextLayout,
        imagePrompt:
          nextSceneMode === "animated" ? "" : scene.imagePrompt || "",
      };
    };

    let scenes = Array.isArray(videoSpec.scenes) ? videoSpec.scenes : [];

    if (isRecruitment) {
      videoSpec.theme = { ...RECRUITMENT_THEME };
      videoSpec.showBrandHeader = true;
      videoSpec.companyName = companyName || "UNIÓN DE PRODUCTORES DE CAÑA DE JOACHÍN";
      videoSpec.companyBadge = "VACANTE DISPONIBLE";
      videoSpec.companyLogoUrl = "logoasr.png";

      if (scenes.length > 0 && scenes[scenes.length - 1].layout !== "flyer-end") {
        scenes.push({
          id: `s-flyer-${Date.now()}`,
          type: "cinematic",
          sceneMode: "editorial",
          layout: "flyer-end",
          cameraMotion: "zoom-in",
          transition: "fade",
          iconName: "badge-check",
          durationSeconds: Math.max(4, Number(flyerDuration) || 6),
          badge: "INFORMACIÓN Y CONTACTO",
          title: "POSTÚLATE HOY",
          subtitle:
            "Toma captura de esta pantalla con toda la información y postúlate hoy mismo. ¡Te esperamos!",
          imagePrompt: "",
        });
      }

      scenes = normalizeSceneDurations(
        scenes,
        effectiveDuration,
        Math.max(4, Number(flyerDuration) || 6)
      ).map((scene, idx, arr) =>
        normalizeGeneratedScene(scene, idx, idx === arr.length - 1)
      );
    } else {
      videoSpec.showBrandHeader = false;
      scenes = normalizeSceneDurations(scenes, effectiveDuration).map(
        (scene, idx) => normalizeGeneratedScene(scene, idx, false)
      );
    }

    videoSpec.scenes = scenes;

    return new Response(JSON.stringify(videoSpec), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Error interno al generar el video." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
