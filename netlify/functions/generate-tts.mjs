import crypto from "node:crypto";
import WebSocket from "ws";

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const SEC_MS_GEC_VERSION = "1-143.0.3650.75";

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateSecMsGec() {
  const winEpoch = 11644473600n;
  const nowSec = BigInt(Math.floor(Date.now() / 1000)) + winEpoch;
  const rounded = nowSec - (nowSec % 300n);
  const ticks = rounded * 10000000n;
  return crypto
    .createHash("sha256")
    .update(`${ticks}${TRUSTED_CLIENT_TOKEN}`, "ascii")
    .digest("hex")
    .toUpperCase();
}

function synthesizeEdgeTts(text, voice, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const connectionId = crypto.randomUUID().replace(/-/g, "");
    const requestId = crypto.randomUUID().replace(/-/g, "");
    const secMsGec = generateSecMsGec();
    const lang = voice.split("-").slice(0, 2).join("-") || "es-MX";
    const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connectionId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    const ws = new WebSocket(url, {
      headers: {
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
      },
    });

    const chunks = [];
    let settled = false;

    const finish = (err, buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      if (err) reject(err);
      else resolve(buffer);
    };

    const timer = setTimeout(() => {
      try {
        ws.terminate();
      } catch {}
      finish(new Error("Edge TTS timeout"));
    }, timeoutMs);

    ws.on("open", () => {
      const timestamp = new Date()
        .toUTCString()
        .replace("GMT", "GMT+0000 (Coordinated Universal Time)");

      const configMsg =
        `X-Timestamp:${timestamp}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;

      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
        `<voice name='${voice}'>` +
        `<prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapeXml(text)}</prosody>` +
        `</voice></speak>`;

      const ssmlMsg =
        `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${timestamp}\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml;

      ws.send(configMsg);
      ws.send(ssmlMsg);
    });

    ws.on("message", (data, isBinary) => {
      if (!isBinary) {
        const msg = data.toString("utf8");
        if (msg.includes("Path:turn.end")) {
          if (chunks.length > 0) finish(null, Buffer.concat(chunks));
          else finish(new Error("Edge TTS devolvió audio vacío"));
        }
        return;
      }

      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (buf.length < 2) return;
      const headerLen = buf.readUInt16BE(0);
      if (buf.length < 2 + headerLen) return;
      const header = buf.subarray(2, 2 + headerLen).toString("utf8");
      if (header.includes("Path:audio")) {
        chunks.push(buf.subarray(2 + headerLen));
      }
    });

    ws.on("error", (err) => finish(err));
    ws.on("close", () => {
      if (!settled) {
        if (chunks.length > 0) finish(null, Buffer.concat(chunks));
        else finish(new Error("Conexión Edge TTS cerrada sin audio"));
      }
    });
  });
}

function splitTextChunks(text, maxLen = 175) {
  const words = text.trim().split(/\s+/);
  const chunks = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length <= maxLen) {
      current = (current + " " + word).trim();
    } else {
      if (current) chunks.push(current);
      current = word;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function synthesizeGoogleTranslateTts(text, lang = "es-MX") {
  const parts = splitTextChunks(text, 175);
  const buffers = [];

  for (const part of parts) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(part)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      throw new Error(`Fallback TTS error ${res.status}`);
    }
    const arr = await res.arrayBuffer();
    buffers.push(Buffer.from(arr));
  }

  return Buffer.concat(buffers);
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { text, voice = "es-MX-JorgeNeural" } = await req.json();

    const cleanText = String(text || "").trim();
    if (!cleanText) {
      return new Response(JSON.stringify({ error: "Texto vacío para narrar." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let audioBuffer;
    let provider = "edge-tts";

    try {
      audioBuffer = await synthesizeEdgeTts(cleanText, voice);
    } catch {
      const lang = voice.startsWith("es-ES") ? "es-ES" : "es-MX";
      audioBuffer = await synthesizeGoogleTranslateTts(cleanText, lang);
      provider = "google-tts";
    }

    return new Response(
      JSON.stringify({
        audioBase64: audioBuffer.toString("base64"),
        mimeType: "audio/mpeg",
        provider,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err.message || "No se pudo generar la voz.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
