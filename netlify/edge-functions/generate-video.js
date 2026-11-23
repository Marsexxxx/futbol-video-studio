const getEnv = (key) =>
  (typeof Netlify !== "undefined" && Netlify.env?.get(key)) ||
  (typeof Deno !== "undefined" && Deno.env?.get(key)) ||
  "";

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

function normalizeSceneDurations(scenes, targetSeconds) {
  if (!Array.isArray(scenes) || scenes.length === 0) return scenes;

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

const TOPIC_HINTS = {
  auto: "Detecta automáticamente la temática exacta del prompt (historia, ciencia, tecnología, negocios, finanzas, misterio, cine, cocina, motivación, noticias, deportes o cualquier otro tema) y adapta colores, ritmo, estética visual y tono narrativo 100% a ese tema.",
  sports: "Enfoque deportivo/futbolístico de alto impacto, con estética de transmisión deportiva y energía de grada.",
  story: "Enfoque documental, histórico o de misterio con atmósfera envolvente, narrativa cinematográfica y tensión dramática.",
  tech: "Enfoque de tecnología, inteligencia artificial, negocios o finanzas con estética moderna, limpia y ejecutiva.",
  viral: "Enfoque de curiosidades, ciencia, psicología o datos sorprendentes con ganchos rápidos y visuales llamativos.",
  cinema: "Enfoque de cine, cultura pop, videojuegos o entretenimiento con iluminación dramática de película.",
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
    } = await req.json();

    const effectiveDuration = extractRequestedDuration(prompt, durationSeconds);
    const sceneCount = getTargetSceneCount(effectiveDuration);
    const speed = Math.min(1.5, Math.max(0.85, Number(voiceSpeed) || 1.0));
    const speechBudgetSec = Math.max(6, effectiveDuration - sceneCount * 0.95);
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

    const systemInstruction = `Eres director creativo, guionista y director de fotografía de videos verticales 9:16 virales en español sobre CUALQUIER temática (TikTok / Reels / YouTube Shorts).
${topicHint}

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
      "type": "cinematic" | "tactics",
      "layout": "hero-impact" | "story-clean" | "split-versus" | "stat-overlay" | "quote-press" | "cta-engage",
      "cameraMotion": "impact-punch" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right",
      "durationSeconds": ${avgSecPerScene},
      "badge": "ETIQUETA BREVE",
      "title": "TITULAR CON IMPACTO",
      "subtitle": "Locución natural en español ajustada exactamente al límite de palabras.",
      "imagePrompt": "Detailed ENGLISH visual prompt describing a realistic full-bleed vertical 9:16 scene matching the exact topic, people/subjects, setting, lighting, and camera angle. Strictly NO text, NO borders.",
      "fallbackImagePrompt": "Alternative ENGLISH visual prompt describing the same scene in dramatic editorial style with zero text.",
      "highlightValue": "Dato corto si aplica",
      "stampText": "CLAVE",
      "quoteText": "Frase corta si layout es quote-press",
      "ctaText": "Llamado a la acción breve si layout es cta-engage",
      "leftLabel": "Opción A",
      "leftValue": 70,
      "rightLabel": "Opción B",
      "rightValue": 30,
      "bullets": ["Punto 1", "Punto 2"],
      "tacticCaption": "Solo si type es tactics."
    }
  ]
}

REGLAS ESTRICTAS DE DURACIÓN (CRÍTICO):
1. Duración objetivo EXACTA: ${effectiveDuration} segundos.
2. Genera EXACTAMENTE ${sceneCount} escenas cuya suma de "durationSeconds" sea ${effectiveDuration} segundos.
3. Para que la voz narrada dure ${effectiveDuration} segundos reales, el campo "subtitle" de CADA escena debe tener entre ${minWordsPerScene} y ${maxWordsPerScene} palabras (total aproximado de ${targetTotalWords} palabras entre todas las escenas). NO escribas textos demasiado cortos si el video es largo, ni demasiado largos si el video es corto.

REGLAS DE COHERENCIA VISUAL Y TEMÁTICA:
4. Usa "type": "cinematic" en todas las escenas. Usa "type": "tactics" ÚNICAMENTE si el usuario pide explicar explícitamente una jugada táctica deportiva en pizarra.
5. Adapta "theme" a la paleta cromática real del tema (dorado/oscuro para misterio o historia, cian/índigo para tecnología o ciencia, verde/pizarra para finanzas, rojo/ámbar para cocina o drama, blaugrana solo si el tema es del FC Barcelona).
6. Varía "layout" y "cameraMotion" entre escenas consecutivas para que cada video tenga ritmo único:
   - "hero-impact": apertura potente o punto culminante.
   - "story-clean": escena narrativa cinematográfica limpia para que luzca la imagen.
   - "split-versus": SOLO cuando el tema compara o enfrenta dos conceptos, personas, productos o equipos.
   - "stat-overlay": SOLO cuando hay una cifra, año, precio o dato clave real.
   - "quote-press": ideal para noticias, frases célebres, polémicas o investigaciones.
   - "cta-engage": cierre con pregunta o invitación acorde al tema (incluye "ctaText").
7. "imagePrompt" SIEMPRE en inglés, muy específico al tema pedido, con encuadre vertical 9:16 limpio y espacio arriba/abajo para títulos y subtítulos, SIN texto ni marcos dentro de la imagen.`;

    const buildPayload = (disableThinking) => ({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.78,
        maxOutputTokens: 9000,
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
    videoSpec.scenes = normalizeSceneDurations(videoSpec.scenes, effectiveDuration);

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
