const getEnv = (key) =>
  (typeof Netlify !== "undefined" && Netlify.env?.get(key)) ||
  (typeof Deno !== "undefined" && Deno.env?.get(key)) ||
  "";

async function requestModel(model, apiKey, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
    const { prompt, durationSeconds = 35 } = await req.json();
    const primaryModel = (getEnv("GEMINI_MODEL") || "gemini-3.8-flash")
      .trim()
      .replace(/^models\//, "");
    const fallbackList = getEnv("GEMINI_FALLBACK_MODELS")
      .split(",")
      .map((m) => m.trim().replace(/^models\//, ""))
      .filter(Boolean);

    const models = [...new Set([primaryModel, ...fallbackList])];

    const systemInstruction = `Eres director creativo, guionista y director de fotografía de videos verticales 9:16 virales de fútbol en español (TikTok / Reels / YouTube Shorts).
Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura:
{
  "title": "Título corto del video",
  "theme": {
    "primaryColor": "#004D98",
    "secondaryColor": "#A50044",
    "accentColor": "#EDBB00",
    "bgColor": "#07111F"
  },
  "scenes": [
    {
      "id": "s1",
      "type": "cinematic" | "tactics",
      "layout": "hero-impact" | "story-clean" | "split-versus" | "stat-overlay" | "quote-press" | "cta-engage",
      "cameraMotion": "impact-punch" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right",
      "durationSeconds": 6,
      "badge": "ETIQUETA BREVE",
      "title": "TITULAR CON IMPACTO",
      "subtitle": "Frase narrada natural y directa (10 a 18 palabras) en español.",
      "imagePrompt": "Detailed ENGLISH visual prompt describing a realistic full-bleed vertical 9:16 scene with exact characters, facial expressions, jerseys/outfits, actions, environment, lighting, and camera framing. Never include text or borders.",
      "fallbackImagePrompt": "Alternative ENGLISH visual prompt describing the same football scene with expressive cinematic sports artwork and zero text.",
      "highlightValue": "60M €",
      "stampText": "CLAVE",
      "quoteText": "Frase corta de titular o contexto si layout es quote-press.",
      "leftLabel": "Lamine",
      "leftValue": 78,
      "rightLabel": "Mbappé",
      "rightValue": 82,
      "bullets": ["Opción 1", "Opción 2"],
      "tacticCaption": "Solo si type es tactics."
    }
  ]
}

REGLAS DE ORO PARA QUE CADA VIDEO SEA ÚNICO Y NATURAL:
1. Adapta el número de escenas (entre 4 y 6) y la estructura narrativa completamente al tema pedido por el usuario. NO repitas siempre el mismo orden de layouts.
2. Usa "type": "cinematic" para casi todas las escenas. Usa "type": "tactics" ÚNICAMENTE si el usuario pide explícitamente explicar una jugada o movimiento táctico en pizarra.
3. Adapta "layout" al contenido real de cada escena y evita repetir el mismo layout en dos escenas seguidas:
   - "hero-impact": apertura o momento explosivo con titular gigante y destello.
   - "story-clean": escena narrativa cinematográfica limpia para que brille la imagen (ideal para historias, despachos, documentos, momentos de partido, drama).
   - "split-versus": SOLO cuando el tema compara o enfrenta a dos jugadores o equipos (incluye leftLabel, rightLabel y opcionalmente valores si hay datos reales).
   - "stat-overlay": SOLO cuando hay una cifra, año, monto o récord real que destacar (pon el dato en highlightValue y una palabra en stampText).
   - "quote-press": ideal para polémicas, noticias, fichajes, declaraciones o casos institucionales (usa quoteText con un titular de prensa breve).
   - "cta-engage": cierre con pregunta directa a la audiencia (usa bullets solo si aportan 2 opciones de debate).
4. Varía "cameraMotion" entre escenas consecutivas ("impact-punch", "zoom-in", "pan-right", "zoom-out", "pan-left") para mantener dinamismo visual constante.
5. "imagePrompt" SIEMPRE en inglés, muy específico y fotorrealista: describe personas concretas (ej. Lamine Yamal with curly dark hair in FC Barcelona blaugrana jersey, Kylian Mbappé in white Real Madrid jersey, Florentino Pérez in tailored dark suit with glasses in an executive office, referees on pitch, confidential folders on a dark desk, roaring stadium crowd), ángulos de cámara (close-up, low angle, medium shot, over-the-shoulder) e iluminación cinematográfica. Indica composición vertical limpia con espacio arriba y abajo para superponer títulos y subtítulos, SIN texto ni marcos dentro de la imagen.
6. Adapta "theme" a los colores reales del tema pedido (blaugrana si es del Barça, dorado/oscuro si es Champions o polémica institucional, etc.).`;

    const buildPayload = (disableThinking) => ({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.8,
        maxOutputTokens: 6000,
        ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });

    const startTime = Date.now();
    const maxBudgetMs = 40000;
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
