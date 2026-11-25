const getEnv = (key) =>
  (typeof Netlify !== "undefined" && Netlify.env?.get(key)) ||
  (typeof Deno !== "undefined" && Deno.env?.get(key)) ||
  "";

const GEMINI_HOST = ["generativelanguage", "googleapis", "com"].join(".");
const GEMINI_API_BASE = "https" + "://" + GEMINI_HOST + "/v1beta/models";

const ANIMATION_STYLE_RULES = {
  "pixel-art":
    "Estilo PIXEL ART: construye personajes, objetos y fondo exclusivamente con rectángulos y cuadrados pequeños (<rect>) alineados en grilla retro 8-bit/16-bit, sin curvas suaves ni bordes redondeados, usando colores sólidos muy contrastados.",
  chalkboard:
    "Estilo PIZARRA (CHALKBOARD): usa trazos blancos (#F8FAFC), crema (#FDE68A) y verde/menta suave (#7EC34A) simulando dibujo hecho a mano con tiza sobre pizarra oscura (fill=\"none\" o rellenos translúcidos muy ligeros, stroke-linecap=\"round\", stroke-width=\"4\" a \"7\"). Aprovecha anim-draw en trazos clave.",
  "neon-sketch":
    "Estilo BOCETO LUMINOSO (NEON SKETCH): usa contornos brillantes neón cian (#22D3EE), ámbar (#F59E0B) y magenta (#EC4899) con rellenos oscuros profundos (#060d1f / #0f172a) o translúcidos. Aprovecha anim-draw y anim-pulse.",
  "ps2-retro":
    "Estilo PS2 RETRO (LOW-POLY): construye siluetas, rostros, ropa y escenario con planos geométricos facetados (<polygon>) y sombreado angular de consola 2000s, con colores saturados y brillos geométricos.",
  comic:
    "Estilo CÓMIC: usa contornos negros gruesos (stroke=\"#0F172A\", stroke-width=\"6\" a \"9\"), colores planos vibrantes de historieta, líneas cinéticas de acción y sombras en bloque.",
  "flat-vector":
    "Estilo VECTOR PLANO (EDITORIAL MODERNO): usa formas limpias, proporciones estilizadas modernas y capas planas sin contorno (o contorno sutil), con paleta limpia, expresiva y muy legible.",
  "minimal-line":
    "Estilo LÍNEA MINIMALISTA (TINTA SOBRE BLANCO): usa trazos finos oscuros (#0F172A, stroke-width=\"3\" a \"5\", fill=\"none\" o blanco #FFFFFF) con pequeños acentos puntuales de color y sin rellenos oscuros pesados. Aprovecha anim-draw.",
  cgi:
    "Estilo CGI DRAMÁTICO: incluye <defs> con <radialGradient> y <linearGradient> para simular volumen 3D, iluminación cenital dramática, reflejos especulares y sombras suaves proyectadas. Aprovecha anim-pulse.",
  lego:
    "Estilo LEGO (BLOQUES STOP-MOTION): construye personajes y objetos con bloques rectangulares, cabezas cilíndricas con pivote superior, manos en C y pequeños círculos tipo stud arriba de las piezas.",
  "3d-explainer":
    "Estilo 3D EXPLICATIVO (ESTUDIO SUAVE): usa formas muy redondeadas, gradientes pastel suaves en <defs>, personajes amigables con volumen suave y sombras ambientales limpias.",
};

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

function extractSvgScene(rawText) {
  const cleaned = String(rawText || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```svg\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let svgScene = "";
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed?.svgScene === "string") {
      svgScene = parsed.svgScene.trim();
    }
  } catch {
    const svgMatch = cleaned.match(/<svg\b[\s\S]*<\/svg>/i);
    if (svgMatch) {
      svgScene = svgMatch[0].replace(/\\"/g, '"').replace(/\\n/g, "\n");
    }
  }

  svgScene = svgScene
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi, "")
    .trim();

  return svgScene;
}

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
      scene = {},
      animationStyle = "flat-vector",
      theme = {},
      showBrandHeader = false,
    } = await req.json();

    const styleKey = ANIMATION_STYLE_RULES[animationStyle]
      ? animationStyle
      : "flat-vector";
    const styleRule = ANIMATION_STYLE_RULES[styleKey];

    const primaryColor = theme.primaryColor || (showBrandHeader ? "#008F4C" : "#1E3A8A");
    const secondaryColor = theme.secondaryColor || (showBrandHeader ? "#7EC34A" : "#BE123C");
    const accentColor = theme.accentColor || (showBrandHeader ? "#BCD853" : "#FACC15");
    const bgColor = theme.bgColor || (showBrandHeader ? "#26282A" : "#07111F");

    const primaryModel = (getEnv("GEMINI_MODEL") || "gemini-3.8-flash")
      .trim()
      .replace(/^models\//, "");
    const fallbackList = getEnv("GEMINI_FALLBACK_MODELS")
      .split(",")
      .map((m) => m.trim().replace(/^models\//, ""))
      .filter(Boolean);
    const models = [...new Set([primaryModel, ...fallbackList])];

    const systemInstruction = `Eres ilustrador experto en SVG animado determinista para video vertical 9:16 (1080x1920) con calidad de estudio editorial profesional (estilo Kurzgesagt / Vox).
Devuelve EXCLUSIVAMENTE un objeto JSON válido con la estructura exacta:
{
  "svgScene": "<svg viewBox=\"0 0 1080 1920\" preserveAspectRatio=\"xMidYMid slice\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
}

REGLAS ESTRICTAS DEL LIENZO Y ZONAS SEGURAS (1080×1920):
1. Un único <svg viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">...</svg> autocontenido, limpio y expresivo (ENTRE 35 y 85 primitivas SVG).
2. LIENZO FULL-BLEED 100% TRANSPARENTE: PROHIBIDO terminantemente dibujar cajas, marcos, bordes rectangulares o un <rect> opaco de fondo que encierre la ilustración en un cuadrado. El fondo del <svg> DEBE ser 100% transparente para fundirse orgánicamente con el escenario de pantalla completa.
3. ZONAS SEGURAS EXACTAS DENTRO DE 1080×1920:
   - Zona superior libre para título/encabezado (${showBrandHeader ? "y = 0 a y = 410" : "y = 0 a y = 380"}): solo luz ambiental, cielo, reflectores o elementos de fondo muy sutiles; NUNCA cabezas, rostros ni objetos clave.
   - Zona protagónica de personajes y acción (y = 420 a y = 1480, x = 110 a x = 970): deja al menos 110px de margen lateral para que ningún trofeo, balón o brazo quede cortado en los bordes.
   - Zona inferior libre para subtítulos (y = 1520 a y = 1920): solo suelo, césped extendido, sombras de contacto o degradado ambiental; NUNCA caras ni detalles importantes.

ESTRUCTURA DE 3 CAPAS Y CLASES SEMÁNTICAS OBLIGATORIAS:
4. Organiza CADA escena explícitamente en estas 3 capas <g> en orden de profundidad:
   1) <g class="anim-layer-bg">: elementos de entorno integrados sin bordes duros (arcos de estadio con luz radial, horizontes suaves, haces de luz, siluetas lejanas difusas; opcionalmente anim-pan-bg).
   2) <g class="anim-layer-mid">: personajes principales y objetos clave usando las clases semánticas de movimiento:
      - class="anim-bob" (torso o cuerpo principal con respiración suave)
      - class="anim-head" (cabeza)
      - class="anim-walk-leg-l" y class="anim-walk-leg-r" (piernas opuestas)
      - class="anim-arm-l" y class="anim-arm-r" (brazos izquierdo y derecho)
      - class="anim-enter-left" y class="anim-enter-right" (entrada lateral al inicio)
      - class="anim-pop" (elemento o insignia que aparece con rebote a mitad de escena)
      - class="anim-draw" (trazos o líneas progresivas)
      - class="anim-pulse" (brillo, aura o energía pulsante)
   3) <g class="anim-layer-fg">: detalles sutiles de primer plano (confeti, líneas de velocidad, destellos, balón en movimiento; usa class="anim-float" para flotación suave).

REGLAS ESTRICTAS DE ANATOMÍA Y COMPOSICIÓN:
5. Proporciones armónicas estilo ilustración editorial moderna: cabezas bien proporcionadas con cuello definido, hombros redondeados, cabello/barba con formas limpias, uniformes fieles con gradientes sutiles de volumen (<defs>) y sombras de contacto en el suelo (<ellipse> semitransparente bajo los pies).
6. EXTREMIDADES SIEMPRE UNIDAS: coloca los grupos de brazos (anim-arm-l, anim-arm-r) y piernas (anim-walk-leg-l, anim-walk-leg-r) con sus puntos de unión superpuestos ligeramente dentro del torso, hombros y cadera (usa stroke-linecap="round") para que al rotar jamás aparezca un hueco blanco ni extremidades desprendidas.
7. ROSTROS DESPEJADOS: PROHIBIDO tapar la cara o los ojos de un personaje con trofeos, balones, manos o carteles. Si un personaje levanta un trofeo o cartel, colócalo claramente ARRIBA de la cabeza o a un lado, nunca sobre el rostro.
8. MANOS LIMPIAS: evita gestos ambiguos o dedos sueltos mal formados; usa manos estilizadas simples y claras (puño cerrado celebrando, palma abierta o sosteniendo un objeto).

REGLAS DE TEXTO Y SEGURIDAD:
9. PROHIBIDO incluir <script>, <foreignObject>, CSS @keyframes, atributos on*, marcadores complejos, párrafos o etiquetas largas dentro del SVG (evita textos pegados o rotos como "PSG5 - 0INT").
10. Solo permite texto mínimo cuando sea icónico y visualmente imprescindible (ej. un año "1910", un dorsal de 1-2 dígitos centrado en la camiseta o un marcador bien espaciado "5 - 0"), siempre con tipografía limpia, text-anchor="middle" y ortografía impecable en español con tildes.
11. ESTÉTICA OBLIGATORIA (${styleKey}): ${styleRule}
12. PALETA DE COLOR BASE: primaryColor=${primaryColor}, secondaryColor=${secondaryColor}, accentColor=${accentColor}, bgColor=${bgColor}.${
      showBrandHeader
        ? " Modo corporativo ASR Group activo: prioriza tonos de marca verde/gris cuando corresponda a uniformes o elementos corporativos y mantén libre y = 0 a y = 410 por el encabezado superior."
        : ""
    }`;

    const sceneBrief = [
      `Titular: ${scene.title || "Escena"}`,
      `Narración/Subtítulo: ${scene.subtitle || ""}`,
      scene.badge ? `Etiqueta: ${scene.badge}` : "",
      scene.calloutText ? `Dato destacado: ${scene.calloutText}` : "",
      scene.animationPrompt
        ? `Descripción visual de animación: ${scene.animationPrompt}`
        : `Describe y dibuja visualmente la escena de forma creativa y clara.`,
    ]
      .filter(Boolean)
      .join("\n");

    const buildPayload = (disableThinking) => ({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: sceneBrief }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.72,
        maxOutputTokens: 6000,
        ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });

    const startTime = Date.now();
    const maxBudgetMs = 30000;
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
              : apiMsg || `Error ${lastResult.status} al generar SVG (${usedModel}).`,
        }),
        { status: lastResult.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const parts = lastResult.data?.candidates?.[0]?.content?.parts || [];
    const answerPart = parts.find((p) => p.text && !p.thought) || parts[parts.length - 1];
    const svgScene = extractSvgScene(answerPart?.text);

    if (!svgScene || !/<svg\b/i.test(svgScene)) {
      return new Response(
        JSON.stringify({ error: "Gemini no devolvió un SVG válido para la escena." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ svgScene, provider: usedModel }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Error interno al generar SVG." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
