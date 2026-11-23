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

    const systemInstruction = `Eres director creativo e ilustrador vectorial 2D para videos verticales 9:16 de fútbol en español.
Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura:
{
  "title": "Título corto",
  "theme": {
    "primaryColor": "#004D98",
    "secondaryColor": "#A50044",
    "accentColor": "#EDBB00",
    "bgColor": "#07111F"
  },
  "scenes": [
    {
      "id": "s1",
      "type": "custom" | "hook" | "tactics" | "versus" | "headline" | "cta",
      "durationSeconds": 6,
      "badge": "ETIQUETA",
      "title": "TITULAR BREVE",
      "subtitle": "Frase narrada de máximo 16 palabras.",
      "svgMarkup": "<svg viewBox='0 0 800 800' xmlns='http://www.w3.org/2000/svg'>...</svg>",
      "highlightValue": "80%",
      "stampText": "CLAVE",
      "jerseyNumber": "10",
      "leftLabel": "Opción A",
      "leftValue": 70,
      "rightLabel": "Opción B",
      "rightValue": 30,
      "bullets": ["Punto 1", "Punto 2"],
      "tacticCaption": "Movimiento táctico breve."
    }
  ]
}

REGLAS CRÍTICAS DE COHERENCIA VISUAL:
1. Usa entre 4 y 5 escenas que sumen cerca de ${durationSeconds} segundos.
2. NUNCA uses "tactics" (pizarrón) si el tema NO trata de táctica o movimientos en cancha.
3. NUNCA uses "versus" (barras de porcentaje) si el tema NO compara estadísticas reales.
4. Para historias, polémicas, casos institucionales, despachos, documentos, árbitros o personajes específicos (ej. Figo, Florentino, Negreira, directivos, periodistas, jugadores), usa type: "custom" y dibuja un "svgMarkup" fiel y detallado para cada escena.
5. REGLAS PARA "svgMarkup" (cuando type es "custom"):
   - Siempre usa exactamente: <svg viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">...</svg>
   - Dibuja ilustraciones vectoriales 2D estilo cartoon editorial limpio, con contornos oscuros (stroke="#0F172A" stroke-width="6"), formas geométricas bien proporcionadas, sombras simples y colores vivos.
   - Si hay personajes, dibuja rasgos reconocibles y expresivos: cabeza, cabello característico, gafas si aplica, cejas y boca con emoción, vestimenta acorde (traje y corbata, uniforme de árbitro, camiseta de fútbol con colores correctos) y objetos en escena (carpetas confidenciales, contratos, billetes, micrófonos, silbatos, tarjetas, estadios).
   - No incluyas <script>, <style> ni enlaces externos. Usa comillas simples dentro de los atributos SVG para mantener el JSON limpio.
6. La última escena puede ser "cta" (con bullets y pregunta final) o "custom" si el cierre requiere personajes.`;

    const buildPayload = (disableThinking) => ({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.75,
        maxOutputTokens: 12000,
        ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });

    const startTime = Date.now();
    const maxBudgetMs = 45000;
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
