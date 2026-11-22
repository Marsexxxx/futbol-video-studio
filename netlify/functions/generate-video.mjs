const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiWithinBudget(url, payload) {
  const startTime = Date.now();
  const maxBudgetMs = 8500;
  let lastStatus = 504;
  let lastData = {};

  for (let attempt = 1; attempt <= 2; attempt++) {
    const remainingMs = maxBudgetMs - (Date.now() - startTime);
    if (remainingMs < 1500) {
      return {
        ok: false,
        status: 504,
        data: { error: "Gemini tardó demasiado en responder. Intenta de nuevo." },
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remainingMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);
      lastStatus = response.status;

      const text = await response.text();
      try {
        lastData = text ? JSON.parse(text) : {};
      } catch {
        lastData = { error: { message: text.slice(0, 180) } };
      }

      if (response.ok) {
        return { ok: true, status: response.status, data: lastData };
      }

      const isTemporary = response.status === 503 || response.status === 429;
      const canRetry = isTemporary && attempt === 1 && Date.now() - startTime < 4500;
      if (!canRetry) {
        return { ok: false, status: response.status, data: lastData };
      }

      await sleep(700);
    } catch (err) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        return {
          ok: false,
          status: 504,
          data: {
            error:
              "El modelo tardó más de 8 segundos (límite de Netlify). Intenta de nuevo o usa un prompt más corto.",
          },
        };
      }
      throw err;
    }
  }

  return { ok: false, status: lastStatus, data: lastData };
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Falta configurar GEMINI_API_KEY en Netlify." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { prompt, durationSeconds = 35 } = await req.json();
    const model = (process.env.GEMINI_MODEL || "gemini-3.8-flash")
      .trim()
      .replace(/^models\//, "");

    const systemInstruction = `Devuelve SOLO JSON válido para un video vertical 9:16 de fútbol en español con este formato exacto:
{
  "title": "Título corto",
  "theme": { "primaryColor": "#004D98", "secondaryColor": "#A50044", "accentColor": "#EDBB00", "bgColor": "#07111F" },
  "scenes": [
    {
      "id": "s1",
      "type": "hook" | "tactics" | "versus" | "headline" | "cta",
      "durationSeconds": 6,
      "badge": "ETIQUETA",
      "title": "TITULAR",
      "subtitle": "Subtítulo breve de máximo 14 palabras.",
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
Usa entre 4 y 5 escenas que sumen cerca de ${durationSeconds} segundos. Empieza con "hook" y termina con "cta".`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 1200,
      },
    };

    const result = await callGeminiWithinBudget(url, payload);

    if (!result.ok) {
      const apiMsg =
        typeof result.data?.error === "string"
          ? result.data.error
          : result.data?.error?.message;
      return new Response(
        JSON.stringify({
          error:
            result.status === 503
              ? `El modelo ${model} está saturado (503). Intenta de nuevo en unos segundos.`
              : apiMsg || `Error ${result.status} al consultar Gemini (${model}).`,
        }),
        { status: result.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const rawText = result.data?.candidates?.[0]?.content?.parts?.[0]?.text;
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
