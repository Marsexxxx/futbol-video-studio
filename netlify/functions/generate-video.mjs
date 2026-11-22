const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiWithRetry(url, payload, maxAttempts = 3) {
  let response;
  let data = {};

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.ok) {
      return { response, data };
    }

    const isTemporary = response.status === 503 || response.status === 429;
    if (!isTemporary || attempt === maxAttempts) {
      return { response, data };
    }

    await sleep(attempt * 1200);
  }

  return { response, data };
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Falta configurar GEMINI_API_KEY en Netlify." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { prompt, durationSeconds = 35 } = await req.json();
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

    const systemInstruction = `
Eres director creativo y guionista de videos verticales 9:16 (TikTok/Reels/Shorts) especializados en fútbol y análisis deportivo.
Devuelve EXCLUSIVAMENTE un objeto JSON válido que siga exactamente esta estructura:
{
  "title": "Título corto del proyecto",
  "theme": {
    "primaryColor": "#004D98",
    "secondaryColor": "#A50044",
    "accentColor": "#EDBB00",
    "bgColor": "#07111F"
  },
  "scenes": [
    {
      "id": "s1",
      "type": "hook" | "tactics" | "versus" | "headline" | "cta",
      "durationSeconds": 6,
      "badge": "ETIQUETA CORTA",
      "title": "TITULAR BREVE",
      "subtitle": "Texto narrado o subtítulo conciso en pantalla (máximo 15 palabras).",
      "highlightValue": "60M €",
      "stampText": "CLAVE",
      "jerseyNumber": "19",
      "leftLabel": "Equipo o Jugador A",
      "leftValue": 68,
      "rightLabel": "Equipo o Jugador B",
      "rightValue": 32,
      "bullets": ["Punto clave 1", "Punto clave 2"],
      "tacticCaption": "Explicación corta del movimiento en pizarra."
    }
  ]
}
Reglas:
1. Genera entre 4 y 6 escenas cuya suma de durationSeconds se aproxime a ${durationSeconds} segundos.
2. Empieza siempre con una escena "hook", incluye al menos una "tactics" o "versus" en el desarrollo, y termina con una escena "cta".
3. Usa textos directos, en español, sin relleno y pensados para lectura rápida en móvil.
4. En cada escena incluye solo los campos útiles para su tipo, pero siempre incluye id, type, durationSeconds, badge, title y subtitle.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    };

    const { response, data } = await callGeminiWithRetry(url, payload);

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error:
            response.status === 503
              ? "El modelo de Gemini está saturado en este momento. Intenta de nuevo en unos segundos."
              : data.error?.message || "Error al consultar la API de Gemini.",
        }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return new Response(
        JSON.stringify({ error: "Gemini no devolvió contenido." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const videoSpec = JSON.parse(rawText);
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
