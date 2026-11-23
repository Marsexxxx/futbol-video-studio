const getEnv = (key) =>
  (typeof Netlify !== "undefined" && Netlify.env?.get(key)) ||
  (typeof Deno !== "undefined" && Deno.env?.get(key)) ||
  "";

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes) {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function parseWavDuration(bytes) {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (riff !== "RIFF") return null;

  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === "fmt " && offset + 24 <= bytes.length) {
      byteRate = view.getUint32(offset + 16, true);
    } else if (chunkId === "data") {
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (byteRate > 0 && dataSize > 0) {
    return dataSize / byteRate;
  }
  return null;
}

function wrapPcmAsWav(pcmBytes, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const wav = new Uint8Array(44 + pcmBytes.length);
  const view = new DataView(wav.buffer);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      wav[offset + i] = str.charCodeAt(i);
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, pcmBytes.length, true);
  wav.set(pcmBytes, 44);

  return {
    wavBytes: wav,
    durationSeconds: pcmBytes.length / byteRate,
  };
}

async function callGeminiTts(model, apiKey, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `[https://generativelanguage.googleapis.com/v1beta/models/$](https://generativelanguage.googleapis.com/v1beta/models/$){model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: { message: raw.slice(0, 180) } };
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

const STYLE_PROMPTS = {
  tiktok:
    "Energetic, natural Spanish short-form content creator for TikTok and Reels. Brisk conversational pace, confident tone, expressive emphasis on key words, smooth finish at the end of the sentence, never robotic.",
  documentary:
    "Clear, engaging Spanish documentary narrator and analyst. Warm human voice, crisp pronunciation, cinematic storytelling cadence, slight natural pause on commas and full stop.",
  analyst:
    "Clear, confident Spanish analyst and narrator. Natural documentary cadence, warm human voice, crisp pronunciation, clean ending.",
  hype:
    "Excited, passionate Spanish presenter and narrator. Dynamic momentum, high-energy storytelling, expressive intonation and clean ending.",
  mystery:
    "Intriguing, suspenseful Spanish storyteller. Atmospheric, controlled cadence that builds curiosity and tension, clear natural finish.",
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
      text,
      voice = "Fenrir",
      languageCode = "es-MX",
      style = "tiktok",
    } = await req.json();

    const cleanText = String(text || "").trim();
    if (!cleanText) {
      return new Response(JSON.stringify({ error: "Texto vacío para narrar." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const preferredModel = (getEnv("GEMINI_TTS_MODEL") || "gemini-3.8-flash-lite-tts")
      .trim()
      .replace(/^models\//, "");

    const models = [...new Set([preferredModel, "gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"])];
    const styleDescription = STYLE_PROMPTS[style] || STYLE_PROMPTS.tiktok;

    const buildPayload = (includeMetadata, includeLang) => ({
      contents: [
        {
          role: "user",
          parts: [
            includeMetadata
              ? {
                  text: cleanText,
                  speechMetadata: { style: styleDescription },
                }
              : { text: cleanText },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          ...(includeLang ? { languageCode } : {}),
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
      },
    });

    const startTime = Date.now();
    const maxBudgetMs = 30000;
    let lastResult = { ok: false, status: 503, data: {} };
    let usedModel = models[0];

    for (const model of models) {
      const remainingMs = maxBudgetMs - (Date.now() - startTime);
      if (remainingMs < 3000) break;

      usedModel = model;
      lastResult = await callGeminiTts(model, apiKey, buildPayload(true, true), remainingMs);

      if (!lastResult.ok && lastResult.status === 400) {
        const retryMs = maxBudgetMs - (Date.now() - startTime);
        if (retryMs >= 3000) {
          lastResult = await callGeminiTts(model, apiKey, buildPayload(false, true), retryMs);
        }
        if (!lastResult.ok && lastResult.status === 400) {
          const retryMs2 = maxBudgetMs - (Date.now() - startTime);
          if (retryMs2 >= 3000) {
            lastResult = await callGeminiTts(model, apiKey, buildPayload(false, false), retryMs2);
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
          error: apiMsg || `Error ${lastResult.status} al generar voz con ${usedModel}.`,
        }),
        { status: lastResult.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const parts = lastResult.data?.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
    const inlineData = audioPart?.inlineData || audioPart?.inline_data;

    if (!inlineData?.data) {
      return new Response(
        JSON.stringify({ error: "Gemini TTS no devolvió audio." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const rawMime = (inlineData.mimeType || inlineData.mime_type || "audio/wav").toLowerCase();
    const rawBytes = base64ToUint8Array(inlineData.data);

    let finalBase64 = inlineData.data;
    let finalMime = "audio/wav";
    let durationSeconds = parseWavDuration(rawBytes);

    if (durationSeconds === null && (rawMime.includes("l16") || rawMime.includes("pcm"))) {
      const rateMatch = rawMime.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
      const wrapped = wrapPcmAsWav(rawBytes, sampleRate, 1, 16);
      finalBase64 = uint8ArrayToBase64(wrapped.wavBytes);
      durationSeconds = wrapped.durationSeconds;
    } else if (!rawMime.includes("wav") && durationSeconds === null) {
      finalMime = rawMime;
    }

    return new Response(
      JSON.stringify({
        audioBase64: finalBase64,
        mimeType: finalMime,
        durationSeconds,
        provider: usedModel,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Error interno al generar voz." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
