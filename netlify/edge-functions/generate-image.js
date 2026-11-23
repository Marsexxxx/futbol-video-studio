const getEnv = (key) =>
  (typeof Netlify !== "undefined" && Netlify.env?.get(key)) ||
  (typeof Deno !== "undefined" && Deno.env?.get(key)) ||
  "";

const GEMINI_API_BASE =
  "https" + "://[generativelanguage.googleapis.com/v1beta/models](https://generativelanguage.googleapis.com/v1beta/models)";

let cachedModels = null;
let cachedAt = 0;

async function discoverImageModels(apiKey) {
  const configured = getEnv("GEMINI_IMAGE_MODEL")
    .trim()
    .replace(/^models\//, "");

  if (cachedModels && Date.now() - cachedAt < 10 * 60 * 1000) {
    return configured
      ? [
          {
            name: configured,
            kind: configured.includes("imagen") ? "imagen" : "gemini",
          },
          ...cachedModels.filter((m) => m.name !== configured),
        ]
      : cachedModels;
  }

  const discovered = [];
  try {
    const res = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const models = data.models || [];

      const geminiImage = models
        .filter((m) => {
          const name = (m.name || "").toLowerCase();
          const methods = m.supportedGenerationMethods || [];
          return (
            name.includes("gemini") &&
            name.includes("image") &&
            methods.includes("generateContent")
          );
        })
        .map((m) => ({
          name: m.name.replace(/^models\//, ""),
          kind: "gemini",
        }))
        .sort((a, b) => b.name.localeCompare(a.name));

      const imagenModels = models
        .filter((m) => {
          const name = (m.name || "").toLowerCase();
          const methods = m.supportedGenerationMethods || [];
          return name.includes("imagen") && methods.includes("predict");
        })
        .map((m) => ({
          name: m.name.replace(/^models\//, ""),
          kind: "imagen",
        }))
        .sort((a, b) => b.name.localeCompare(a.name));

      discovered.push(...geminiImage, ...imagenModels);
    }
  } catch {}

  const defaults = [
    { name: "gemini-3.8-flash-image", kind: "gemini" },
    { name: "gemini-3.1-flash-image-preview", kind: "gemini" },
    { name: "gemini-2.5-flash-image", kind: "gemini" },
    { name: "imagen-4.0-fast-generate-001", kind: "imagen" },
    { name: "imagen-4.0-generate-001", kind: "imagen" },
    { name: "imagen-3.0-generate-002", kind: "imagen" },
  ];

  const seen = new Set();
  const merged = [];
  for (const item of [...discovered, ...defaults]) {
    if (!seen.has(item.name)) {
      seen.add(item.name);
      merged.push(item);
    }
  }

  cachedModels = merged;
  cachedAt = Date.now();

  if (configured) {
    return [
      {
        name: configured,
        kind: configured.includes("imagen") ? "imagen" : "gemini",
      },
      ...merged.filter((m) => m.name !== configured),
    ];
  }

  return merged;
}

async function callGeminiImage(model, apiKey, promptText, timeoutMs) {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const tryOnce = async (payload) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: { message: raw.slice(0, 180) } };
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        return {
          ok: false,
          status: 504,
          data: { error: { message: `Timeout en ${model}` } },
        };
      }
      throw err;
    }
  };

  let res = await tryOnce({
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "9:16" },
    },
  });

  if (!res.ok && res.status === 400) {
    res = await tryOnce({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });
  }

  if (!res.ok) return res;

  const parts = res.data?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p) => {
    const inline = p.inlineData || p.inline_data;
    return (
      inline?.data &&
      String(inline.mimeType || inline.mime_type || "").startsWith("image/")
    );
  });
  const inline = imgPart?.inlineData || imgPart?.inline_data;

  if (!inline?.data) {
    return {
      ok: false,
      status: 422,
      blocked: true,
      data: { error: { message: "El modelo no devolvió imagen para ese prompt." } },
    };
  }

  return {
    ok: true,
    status: 200,
    imageBase64: inline.data,
    mimeType: inline.mimeType || inline.mime_type || "image/png",
  };
}

async function callImagen(model, apiKey, promptText, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${GEMINI_API_BASE}/${model}:predict?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: promptText }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "9:16",
          outputOptions: { mimeType: "image/jpeg" },
          personGeneration: "allow_adult",
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: { message: raw.slice(0, 180) } };
    }

    if (!res.ok) {
      return { ok: false, status: res.status, data };
    }

    const pred = data.predictions?.[0];
    if (!pred?.bytesBase64Encoded) {
      return {
        ok: false,
        status: 422,
        blocked: true,
        data: { error: { message: "Imagen no devolvió archivo." } },
      };
    }

    return {
      ok: true,
      status: 200,
      imageBase64: pred.bytesBase64Encoded,
      mimeType: pred.mimeType || "image/jpeg",
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return {
        ok: false,
        status: 504,
        data: { error: { message: `Timeout en ${model}` } },
      };
    }
    throw err;
  }
}

const VISUAL_STYLES = {
  photoreal:
    "Ultra-realistic cinematic photography, shot on 85mm lens, shallow depth of field, dramatic lighting, rich realistic textures, documentary aesthetic, edge-to-edge full-bleed vertical 9:16 frame, strictly NO text, NO letters, NO numbers overlay, NO watermarks, NO borders, NO frames.",
  editorial:
    "Clean modern editorial magazine vector collage illustration, Vox and Johnny Harris documentary aesthetic, bold crisp shapes, subtle halftone paper texture, high-contrast stylized character likeness without uncanny AI photorealism, full-bleed vertical 9:16 frame, strictly NO text, NO letters, NO watermarks, NO frames.",
  hyperart:
    "Hyper-realistic dramatic digital concept artwork, cinematic lighting, rich contrast, expressive lifelike details, volumetric atmosphere, high-budget movie poster style, edge-to-edge full-bleed vertical 9:16 frame, strictly NO text, NO letters, NO watermarks, NO borders, NO frames.",
  editorial3d:
    "High-end stylized 3D cinematic render, Unreal Engine 5 lighting, expressive lifelike details, dramatic shadows, premium animated film aesthetic, edge-to-edge full-bleed vertical 9:16 frame, strictly NO text, NO letters, NO watermarks, NO borders, NO frames.",
  anime:
    "High-budget modern cinematic anime illustration, dramatic lighting, crisp linework, atmospheric depth, vibrant film color grading, edge-to-edge full-bleed vertical 9:16 frame, strictly NO text, NO letters, NO watermarks, NO borders, NO frames.",
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
      fallbackPrompt,
      visualStyle = "photoreal",
    } = await req.json();

    const basePrompt = String(prompt || "").trim();
    if (!basePrompt) {
      return new Response(JSON.stringify({ error: "Prompt visual vacío." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const styleSuffix = VISUAL_STYLES[visualStyle] || VISUAL_STYLES.photoreal;
    const primaryPrompt = `${basePrompt}. ${styleSuffix}`;
    const safeRetryPrompt = `${String(fallbackPrompt || basePrompt).trim()}. Modern editorial documentary artwork, dramatic lighting, rich detail, full-bleed vertical 9:16 frame, strictly NO text, NO borders, NO frames.`;

    const candidates = await discoverImageModels(apiKey);
    const startTime = Date.now();
    const maxBudgetMs = 42000;
    let lastError = "No se pudo generar la imagen.";
    let lastStatus = 500;

    for (const candidate of candidates.slice(0, 5)) {
      const remainingMs = maxBudgetMs - (Date.now() - startTime);
      if (remainingMs < 5000) break;

      const callFn =
        candidate.kind === "imagen" ? callImagen : callGeminiImage;
      let result = await callFn(
        candidate.name,
        apiKey,
        primaryPrompt,
        Math.min(remainingMs, 22000)
      );

      if (
        !result.ok &&
        (result.blocked || result.status === 422 || result.status === 400)
      ) {
        const retryMs = maxBudgetMs - (Date.now() - startTime);
        if (retryMs >= 5000) {
          result = await callFn(
            candidate.name,
            apiKey,
            safeRetryPrompt,
            Math.min(retryMs, 18000)
          );
        }
      }

      if (result.ok && result.imageBase64) {
        return new Response(
          JSON.stringify({
            imageBase64: result.imageBase64,
            mimeType: result.mimeType,
            provider: candidate.name,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      lastStatus = result.status || 500;
      lastError =
        (typeof result.data?.error === "string"
          ? result.data.error
          : result.data?.error?.message) ||
        `Error ${lastStatus} con ${candidate.name}`;

      const canTryNext =
        lastStatus === 404 ||
        lastStatus === 400 ||
        lastStatus === 429 ||
        lastStatus === 503 ||
        lastStatus === 504 ||
        lastStatus === 422;
      if (!canTryNext) break;
    }

    return new Response(JSON.stringify({ error: lastError }), {
      status: lastStatus,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Error interno generando imagen." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
