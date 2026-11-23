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

const RENDER_MODE_HINTS = {
  hybrid: `MODO HÍBRIDO (OBLIGATORIO MEZCLAR):
- Alterna inteligentemente "sceneMode" entre "hybrid" (imagen visual + ícono dinámico + etiqueta flotante) y "editorial" (motion graphics puro con ícono grande animado, cuadrícula viva y tarjetas editoriales sin foto de fondo).
- Usa "sceneMode": "editorial" en al menos 2 escenas clave y "hybrid" en las escenas de impacto o narrativa visual.`,
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
      studioMode = "general",
      companyName = "UNIÓN DE PRODUCTORES DE CAÑA DE JOACHÍN",
      flyerDuration = 6,
    } = await req.json();

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
      "sceneMode": "hybrid" | "editorial" | "cinematic",
      "layout": "hero-impact" | "story-clean" | "stat-overlay" | "quote-press" | "cta-engage" | "flyer-end",
      "cameraMotion": "impact-punch" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right",
      "transition": "slide-left" | "slide-up" | "wipe" | "fade" | "flip",
      "iconName": "briefcase" | "user-check" | "map-pin" | "badge-check" | "phone" | "calendar" | "building" | "check-circle" | "wrench" | "shield" | "trending-up" | "award" | "users" | "target" | "banknote" | "clock" | "sparkles",
      "calloutText": "Etiqueta corta de 2 a 4 palabras (ej. CONTRATACIÓN INMEDIATA, PRESTACIONES DE LEY)",
      "durationSeconds": ${avgSecPerScene},
      "badge": "ETIQUETA BREVE",
      "title": "TITULAR CLARO Y ATRACTIVO",
      "subtitle": "Locución natural, cercana y profesional en español.",
      "imagePrompt": "Detailed ENGLISH visual prompt depicting authentic modern agricultural/industrial workplace, friendly Mexican professionals, sugarcane fields, machinery, or modern office matching the exact job role, natural daylight, green and neutral gray color harmony, vertical 9:16 frame, strictly NO text, NO logos, NO borders.",
      "fallbackImagePrompt": "Clean modern editorial illustration of the workplace and job role in green and gray tones, vertical 9:16, strictly NO text.",
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
     * Escena 1 ("hero-impact"): Gancho directo anunciando que ${companyName} está contratando el puesto exacto.
     * Escenas intermedias: Alterna dinámicamente entre "story-clean", "cta-engage" (usando bullets para listar 2 requisitos o 2 beneficios clave), "stat-overlay" o "quote-press" para explicar funciones del puesto, requisitos y prestaciones sin sonar aburrido.
   - LA ÚLTIMA ESCENA (escena #${sceneCount}) DEBE SER OBLIGATORIAMENTE:
     * "layout": "flyer-end"
     * "sceneMode": "editorial"
     * "durationSeconds": ${Math.max(4, Number(flyerDuration) || 6)}
     * "badge": "INFORMACIÓN Y CONTACTO"
     * "title": "POSTÚLATE HOY"
     * "subtitle": Una invitación breve y cálida de cierre (10 a 15 palabras) invitando a revisar el flyer en pantalla, tomar captura o enviar su solicitud.
     * "imagePrompt": "" (vacío, porque el usuario cargará su flyer oficial aquí).
3. Mantén el campo "subtitle" de las primeras ${sceneCount - 1} escenas entre ${minWordsPerScene} y ${maxWordsPerScene} palabras para respetar los ${effectiveDuration} segundos reales.
4. Usa SIEMPRE exactamente los colores oficiales verde y gris en "theme": primaryColor "#008F4C", secondaryColor "#7EC34A", accentColor "#BCD853", bgColor "#26282A".
5. NUNCA uses "type": "tactics" ni "split-versus".
6. Usa "iconName" laborales relevantes ("briefcase", "user-check", "map-pin", "badge-check", "wrench", "building", "banknote", "shield", "check-circle") y "calloutText" breves y claros.
7. En "imagePrompt" describe ambientes reales, limpios, seguros y positivos acordes al puesto (campo cañero, taller, oficina administrativa, logística, ingeniería, etc.) SIN texto ni letras en las imágenes.`
      : `Eres director creativo, guionista y director de motion graphics para videos verticales 9:16 virales en español sobre CUALQUIER temática (TikTok / Reels / YouTube Shorts).
${topicHint}
${modeHint}

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
      "sceneMode": "hybrid" | "editorial" | "cinematic",
      "layout": "hero-impact" | "story-clean" | "split-versus" | "stat-overlay" | "quote-press" | "cta-engage",
      "cameraMotion": "impact-punch" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right",
      "transition": "slide-left" | "slide-up" | "wipe" | "fade" | "flip",
      "iconName": "trophy" | "file-text" | "scale" | "banknote" | "gavel" | "shield" | "flame" | "zap" | "clock" | "globe" | "brain" | "rocket" | "alert" | "megaphone" | "target" | "trending-up" | "lock" | "eye" | "users" | "crown" | "swords" | "sparkles" | "newspaper" | "briefcase" | "landmark" | "cpu" | "heart" | "compass" | "award" | "radio" | "flag",
      "calloutText": "Dato o golpe visual corto de 2 a 4 palabras que aparece a mitad de escena",
      "durationSeconds": ${avgSecPerScene},
      "badge": "ETIQUETA BREVE",
      "title": "TITULAR CON IMPACTO",
      "subtitle": "Locución natural en español ajustada exactamente al límite de palabras.",
      "imagePrompt": "Detailed ENGLISH visual prompt describing a vertical 9:16 scene matching the exact topic, people/subjects, setting, lighting, and camera angle. Strictly NO text, NO borders.",
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
3. Para que la voz narrada dure ${effectiveDuration} segundos reales, el campo "subtitle" de CADA escena debe tener entre ${minWordsPerScene} y ${maxWordsPerScene} palabras (total aproximado de ${targetTotalWords} palabras entre todas las escenas).

REGLAS DE DINAMISMO VISUAL Y COHERENCIA:
4. Usa "type": "cinematic" en casi todas las escenas. Usa "type": "tactics" ÚNICAMENTE si el usuario pide explicar explícitamente una jugada táctica deportiva en pizarra.
5. Elige un "iconName" específico y coherente en CADA escena.
6. Escribe un "calloutText" breve y llamativo (2 a 4 palabras) que refuerce lo que dice la voz a mitad de cada escena.
7. Varía "layout", "cameraMotion" y "transition" entre escenas consecutivas para que el video tenga ritmo real.
8. Adapta "theme" a la paleta cromática real del tema.
9. "imagePrompt" SIEMPRE en inglés, muy específico, encuadre vertical 9:16 limpio con espacio arriba y abajo para títulos/subtítulos, SIN texto ni marcos dentro de la imagen.`;

    const buildPayload = (disableThinking) => ({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: isRecruitment ? 0.68 : 0.78,
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
    videoSpec.renderMode = renderMode;
    videoSpec.studioMode = isRecruitment ? "recruitment" : "general";

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
      ).map((scene, idx, arr) => {
        const isLast = idx === arr.length - 1;
        if (isLast) {
          return {
            ...scene,
            type: "cinematic",
            layout: "flyer-end",
            sceneMode: "editorial",
            imagePrompt: "",
          };
        }
        return {
          ...scene,
          type: "cinematic",
          sceneMode:
            renderMode === "editorial"
              ? "editorial"
              : renderMode === "cinematic"
              ? "cinematic"
              : scene.sceneMode || (idx % 2 === 1 ? "editorial" : "hybrid"),
        };
      });
    } else {
      videoSpec.showBrandHeader = false;
      scenes = normalizeSceneDurations(scenes, effectiveDuration).map(
        (scene, idx) => ({
          ...scene,
          sceneMode:
            renderMode === "editorial"
              ? "editorial"
              : renderMode === "cinematic"
              ? "cinematic"
              : scene.sceneMode || (idx % 2 === 1 ? "editorial" : "hybrid"),
        })
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
