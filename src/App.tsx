import React, { useEffect, useMemo, useRef, useState } from "react";
import { Player } from "@remotion/player";
import {
  Sparkles,
  Upload,
  Download,
  Film,
  Trash2,
  Plus,
  Image as ImageIcon,
  Mic,
  Volume2,
  VolumeX,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Wand2,
  Video as VideoIcon,
  Layers,
  Briefcase,
  FileImage,
} from "lucide-react";
import {
  DynamicVideo,
  getTotalFrames,
  SCENE_LEAD_IN_FRAMES,
} from "./remotion/DynamicVideo";
import { DEFAULT_VIDEO_SPEC } from "./defaultVideo";
import {
  CameraMotion,
  RenderMode,
  SceneLayout,
  SceneType,
  StudioMode,
  SubtitleStyle,
  TopicMode,
  TransitionType,
  VideoScene,
  VideoSpec,
  VisualStyle,
} from "./types";

const h = React.createElement;
const RemotionPlayer = Player as React.ComponentType<any>;

const FPS = 30;
const LEAD_IN_SEC = SCENE_LEAD_IN_FRAMES / FPS;
const DEFAULT_TAIL_PAUSE_SEC = 0.75;
const MIN_TAIL_PAUSE_SEC = 0.4;

const DEFAULT_COMPANY_NAME = "UNIÓN DE PRODUCTORES DE CAÑA DE JOACHÍN";
const RECRUITMENT_PALETTE = {
  primaryColor: "#008F4C",
  secondaryColor: "#7EC34A",
  accentColor: "#BCD853",
  bgColor: "#26282A",
};

const DURATION_PRESETS = [15, 30, 45, 60, 90];
const RECRUITMENT_DURATION_PRESETS = [20, 30, 45, 60];

const RENDER_MODE_OPTIONS: { id: RenderMode; label: string }[] = [
  { id: "hybrid", label: "Formato: Híbrido (Imágenes/Videos + Íconos dinámicos)" },
  { id: "editorial", label: "Formato: Editorial (Íconos dinámicos + Motion Graphics)" },
  { id: "cinematic", label: "Formato: Cinematográfico (Pantalla completa)" },
];

const TOPIC_OPTIONS: { id: TopicMode; label: string }[] = [
  { id: "auto", label: "Temática: Automática (Cualquier tema)" },
  { id: "story", label: "Temática: Historia / Misterio / Documental" },
  { id: "tech", label: "Temática: Tecnología / Negocios / Finanzas" },
  { id: "viral", label: "Temática: Ciencia / Curiosidades / Datos" },
  { id: "cinema", label: "Temática: Cine / Cultura / Entretenimiento" },
  { id: "sports", label: "Temática: Deportes / Fútbol" },
];

const VOICE_OPTIONS = [
  { id: "Fenrir", label: "Fenrir · Energético y potente" },
  { id: "Puck", label: "Puck · Dinámico y juvenil" },
  { id: "Charon", label: "Charon · Grave y documental" },
  { id: "Orus", label: "Orus · Firme y directo" },
  { id: "Kore", label: "Kore · Femenina clara" },
  { id: "Zephyr", label: "Zephyr · Femenina energética" },
];

const ACCENT_OPTIONS = [
  { id: "es-MX", label: "Acento México" },
  { id: "es-ES", label: "Acento España" },
  { id: "es-AR", label: "Acento Argentina" },
  { id: "es-US", label: "Latino neutro" },
];

const STYLE_OPTIONS = [
  { id: "tiktok", label: "Estilo Reels / TikTok" },
  { id: "documentary", label: "Estilo Documental / Analista" },
  { id: "hype", label: "Estilo Intenso / Épico" },
  { id: "mystery", label: "Estilo Misterio / Suspenso" },
];

const VISUAL_STYLE_OPTIONS: { id: VisualStyle; label: string }[] = [
  { id: "editorial", label: "Visual: Ilustración Editorial / Recorte (Sin aspecto IA)" },
  { id: "photoreal", label: "Visual: Fotorrealista cinematográfico" },
  { id: "hyperart", label: "Visual: Arte conceptual hiperrealista" },
  { id: "editorial3d", label: "Visual: 3D Cinematográfico" },
  { id: "anime", label: "Visual: Anime cinematográfico" },
];

const SPEED_OPTIONS = [
  { value: 0.95, label: "0.95x Pausada" },
  { value: 1.0, label: "1.0x Natural (Recomendada)" },
  { value: 1.1, label: "1.1x Ágil" },
  { value: 1.2, label: "1.2x Rápida" },
  { value: 1.3, label: "1.3x Muy rápida" },
];

const ICON_OPTIONS = [
  { id: "briefcase", label: "Ícono: Trabajo / Vacante" },
  { id: "user-check", label: "Ícono: Talento / Perfil" },
  { id: "badge-check", label: "Ícono: Verificado / Oficial" },
  { id: "check-circle", label: "Ícono: Requisitos / Check" },
  { id: "map-pin", label: "Ícono: Ubicación" },
  { id: "phone", label: "Ícono: Contacto / Teléfono" },
  { id: "calendar", label: "Ícono: Horario / Fecha" },
  { id: "building", label: "Ícono: Empresa / Oficina" },
  { id: "wrench", label: "Ícono: Técnico / Operativo" },
  { id: "banknote", label: "Ícono: Sueldo / Prestaciones" },
  { id: "shield", label: "Ícono: Seguridad / Estabilidad" },
  { id: "trending-up", label: "Ícono: Crecimiento" },
  { id: "award", label: "Ícono: Reconocimiento" },
  { id: "users", label: "Ícono: Equipo / Personas" },
  { id: "target", label: "Ícono: Objetivo" },
  { id: "sparkles", label: "Ícono: Destello" },
  { id: "trophy", label: "Ícono: Trofeo" },
  { id: "crown", label: "Ícono: Corona" },
  { id: "swords", label: "Ícono: Duelo / VS" },
  { id: "file-text", label: "Ícono: Documento / Contrato" },
  { id: "gavel", label: "Ícono: Juicio / Ley" },
  { id: "scale", label: "Ícono: Balanza / Justicia" },
  { id: "newspaper", label: "Ícono: Prensa / Noticia" },
  { id: "megaphone", label: "Ícono: Anuncio / Aviso" },
  { id: "alert", label: "Ícono: Alerta / Misterio" },
  { id: "clock", label: "Ícono: Tiempo / Historia" },
  { id: "globe", label: "Ícono: Mundo / País" },
  { id: "compass", label: "Ícono: Mapa / Exploración" },
  { id: "brain", label: "Ícono: Mente / Estrategia" },
  { id: "cpu", label: "Ícono: Tecnología / IA" },
  { id: "rocket", label: "Ícono: Espacio / Despegue" },
  { id: "flame", label: "Ícono: Fuego / Épico" },
  { id: "zap", label: "Ícono: Impacto / Rayo" },
  { id: "lock", label: "Ícono: Secreto / Confidencial" },
  { id: "eye", label: "Ícono: Secreto revelado" },
  { id: "landmark", label: "Ícono: Institución" },
  { id: "flag", label: "Ícono: Meta / Bandera" },
];

const TRANSITION_OPTIONS: { id: TransitionType; label: string }[] = [
  { id: "slide-left", label: "Trans: Deslizar →" },
  { id: "slide-up", label: "Trans: Subir ↑" },
  { id: "wipe", label: "Trans: Barrido" },
  { id: "flip", label: "Trans: Volteo 3D" },
  { id: "fade", label: "Trans: Fundido" },
];

type GenerateResponse = Partial<VideoSpec> & {
  error?: string;
  errorMessage?: string;
  message?: string;
};

type TtsResponse = {
  audioBase64?: string;
  mimeType?: string;
  durationSeconds?: number | null;
  provider?: string;
  error?: string;
};

type ImageGenResponse = {
  imageBase64?: string;
  mimeType?: string;
  provider?: string;
  error?: string;
};

type ExportState = {
  status: "idle" | "uploading" | "queued" | "in_progress" | "completed" | "failed";
  jobId?: string;
  mp4AssetId?: number;
  runUrl?: string;
  error?: string;
};

function clampDuration(sec: number): number {
  return Math.min(180, Math.max(10, Math.round(sec)));
}

function extractRequestedDuration(
  promptText: string,
  fallbackSeconds: number
): { seconds: number; fromPrompt: boolean } {
  const text = String(promptText || "").toLowerCase();

  if (/(?:\b1\b|\bun\b)\s*(?:minuto|min)\s*y\s*medio/.test(text)) {
    return { seconds: 90, fromPrompt: true };
  }

  const minSecMatch = text.match(
    /(?:\b(\d+(?:[.,]\d+)?)|\bun\b)\s*(?:minutos?|mins?)\s*(?:y|con)?\s*(\d+)\s*(?:segundos?|segs?\.?)/
  );
  if (minSecMatch) {
    const mins = minSecMatch[1]
      ? parseFloat(minSecMatch[1].replace(",", "."))
      : 1;
    const secs = parseInt(minSecMatch[2], 10);
    return { seconds: clampDuration(Math.round(mins * 60 + secs)), fromPrompt: true };
  }

  const clockMatch = text.match(
    /(?:dure|duraci[oó]n|de|video\s+de)\s*(\d):([0-5]\d)\b/
  );
  if (clockMatch) {
    return {
      seconds: clampDuration(
        parseInt(clockMatch[1], 10) * 60 + parseInt(clockMatch[2], 10)
      ),
      fromPrompt: true,
    };
  }

  const minOnlyMatch = text.match(
    /(?:\b(\d+(?:[.,]\d+)?)|\bun\b)\s*(?:minutos?|mins?)\b/
  );
  if (minOnlyMatch) {
    const mins = minOnlyMatch[1]
      ? parseFloat(minOnlyMatch[1].replace(",", "."))
      : 1;
    return { seconds: clampDuration(Math.round(mins * 60)), fromPrompt: true };
  }

  const secWordMatch = text.match(/\b(\d{1,3})\s*(?:segundos?|segs?\.?)\b/);
  if (secWordMatch) {
    const secs = parseInt(secWordMatch[1], 10);
    if (secs >= 8 && secs <= 300) {
      return { seconds: clampDuration(secs), fromPrompt: true };
    }
  }

  const shortSecMatch = text.match(
    /(?:de|dure|duraci[oó]n|en|unos|aprox\.?)\s+(\d{1,3})\s*s\b/
  );
  if (shortSecMatch) {
    const secs = parseInt(shortSecMatch[1], 10);
    if (secs >= 8 && secs <= 300) {
      return { seconds: clampDuration(secs), fromPrompt: true };
    }
  }

  return { seconds: clampDuration(fallbackSeconds || 35), fromPrompt: false };
}

function calcSceneDuration(
  rawAudioDuration: number,
  speed: number,
  tailPause = DEFAULT_TAIL_PAUSE_SEC,
  minFloor = 2.2
): number {
  const total = LEAD_IN_SEC + rawAudioDuration / speed + tailPause;
  return Number(Math.max(minFloor, Math.ceil(total * 20) / 20).toFixed(2));
}

function fitScenesToTargetDuration(
  scenes: VideoScene[],
  speed: number,
  targetDuration?: number
): VideoScene[] {
  if (!targetDuration || scenes.length === 0) return scenes;
  const voicedCount = scenes.filter((s) => Boolean(s.rawAudioDuration)).length;
  if (voicedCount === 0) return scenes;

  const baseDurations = scenes.map((s) => {
    const floor = s.layout === "flyer-end" ? Math.max(5, s.durationSeconds || 6) : 2.2;
    return s.rawAudioDuration
      ? calcSceneDuration(s.rawAudioDuration, speed, DEFAULT_TAIL_PAUSE_SEC, floor)
      : s.durationSeconds || 5;
  });
  const minDurations = scenes.map((s) => {
    const floor = s.layout === "flyer-end" ? Math.max(4.5, s.durationSeconds || 5) : 2.0;
    return s.rawAudioDuration
      ? calcSceneDuration(s.rawAudioDuration, speed, MIN_TAIL_PAUSE_SEC, floor)
      : Math.max(2, s.durationSeconds || 5);
  });

  const baseTotal = baseDurations.reduce((a, b) => a + b, 0);
  const minTotal = minDurations.reduce((a, b) => a + b, 0);

  if (baseTotal < targetDuration) {
    const extraNeeded = targetDuration - baseTotal;
    const perSceneExtra = Math.min(2.2, extraNeeded / scenes.length);
    return scenes.map((scene, idx) => ({
      ...scene,
      durationSeconds: Number((baseDurations[idx] + perSceneExtra).toFixed(2)),
    }));
  }

  if (baseTotal > targetDuration && minTotal <= targetDuration) {
    const ratio =
      baseTotal === minTotal
        ? 0
        : (targetDuration - minTotal) / (baseTotal - minTotal);
    return scenes.map((scene, idx) => ({
      ...scene,
      durationSeconds: Number(
        (
          minDurations[idx] +
          (baseDurations[idx] - minDurations[idx]) * ratio
        ).toFixed(2)
      ),
    }));
  }

  return scenes.map((scene, idx) => ({
    ...scene,
    durationSeconds: Number(
      (minTotal > targetDuration ? minDurations[idx] : baseDurations[idx]).toFixed(2)
    ),
  }));
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function mimeToExt(mime: string, fallback: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes("wav")) return "wav";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "mp3";
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("m4a")) return "m4a";
  if (lower.includes("webm")) return "webm";
  if (lower.includes("quicktime") || lower.includes("mov")) return "mov";
  if (lower.includes("mp4")) return "mp4";
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  return fallback;
}

async function blobUrlToAsset(
  url: string,
  fallbackExt: string
): Promise<{ base64: string; ext: string; byteSize: number }> {
  const res = await fetch(url);
  const blob = await res.blob();
  const buffer = await blob.arrayBuffer();
  return {
    base64: bytesToBase64(new Uint8Array(buffer)),
    ext: mimeToExt(blob.type, fallbackExt),
    byteSize: buffer.byteLength,
  };
}

function compressToVerticalJpeg(
  base64: string,
  mimeType: string
): Promise<string> {
  return new Promise((resolve) => {
    const bytes = base64ToBytes(base64);
    const rawBlob = new Blob([bytes.buffer as ArrayBuffer], {
      type: mimeType || "image/png",
    });
    const tempUrl = URL.createObjectURL(rawBlob);
    const img = new window.Image();

    img.onload = () => {
      try {
        const targetW = 900;
        const targetH = 1600;
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(tempUrl);
          return;
        }

        const scale = Math.max(targetW / img.width, targetH / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const dx = (targetW - drawW) / 2;
        const dy = (targetH - drawH) / 2;

        ctx.drawImage(img, dx, dy, drawW, drawH);
        canvas.toBlob(
          (jpgBlob) => {
            if (jpgBlob) {
              URL.revokeObjectURL(tempUrl);
              resolve(URL.createObjectURL(jpgBlob));
            } else {
              resolve(tempUrl);
            }
          },
          "image/jpeg",
          0.85
        );
      } catch {
        resolve(tempUrl);
      }
    };

    img.onerror = () => resolve(tempUrl);
    img.src = tempUrl;
  });
}

async function measureExactAudioDuration(
  bytes: Uint8Array,
  blobUrl: string,
  serverDuration?: number | null
): Promise<number> {
  if (
    typeof serverDuration === "number" &&
    Number.isFinite(serverDuration) &&
    serverDuration > 0.2
  ) {
    return serverDuration;
  }

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const bufferCopy = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer;
      const decoded = await ctx.decodeAudioData(bufferCopy);
      const duration = decoded.duration;
      await ctx.close();
      if (Number.isFinite(duration) && duration > 0.2) {
        return duration;
      }
    }
  } catch {}

  return new Promise((resolve) => {
    const audio = new window.Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      resolve(
        Number.isFinite(audio.duration) && audio.duration > 0.2
          ? audio.duration
          : 5
      );
    };
    audio.onerror = () => resolve(5);
    audio.src = blobUrl;
  });
}

async function fetchSceneVoice(
  text: string,
  voice: string,
  languageCode: string,
  style: string,
  speed: number,
  minFloor = 2.2
): Promise<{
  audioUrl: string;
  rawAudioDuration: number;
  durationSeconds: number;
  provider: string;
}> {
  const res = await fetch("/api/generate-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, languageCode, style }),
  });

  const raw = await res.text();
  let data: TtsResponse = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Error TTS (${res.status}): ${raw.slice(0, 120)}`);
  }

  if (!res.ok || !data.audioBase64) {
    throw new Error(data.error || "No se pudo generar el audio de la escena.");
  }

  const bytes = base64ToBytes(data.audioBase64);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: data.mimeType || "audio/wav",
  });
  const audioUrl = URL.createObjectURL(blob);
  const rawAudioDuration = await measureExactAudioDuration(
    bytes,
    audioUrl,
    data.durationSeconds
  );
  const durationSeconds = calcSceneDuration(
    rawAudioDuration,
    speed,
    DEFAULT_TAIL_PAUSE_SEC,
    minFloor
  );

  return {
    audioUrl,
    rawAudioDuration,
    durationSeconds,
    provider: data.provider || "gemini-3.8-flash-lite-tts",
  };
}

async function fetchSceneImage(
  scene: VideoScene,
  visualStyle: VisualStyle
): Promise<{ imageUrl: string; provider: string }> {
  const promptText = (
    scene.imagePrompt ||
    `Cinematic vertical 9:16 scene representing: ${scene.title}. ${scene.subtitle}`
  ).trim();

  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: promptText,
      fallbackPrompt: scene.fallbackImagePrompt || promptText,
      visualStyle,
    }),
  });

  const raw = await res.text();
  let data: ImageGenResponse = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Error Imagen (${res.status}): ${raw.slice(0, 120)}`);
  }

  if (!res.ok || !data.imageBase64) {
    throw new Error(data.error || "No se pudo generar la imagen de la escena.");
  }

  const imageUrl = await compressToVerticalJpeg(
    data.imageBase64,
    data.mimeType || "image/png"
  );

  return {
    imageUrl,
    provider: data.provider || "gemini-image",
  };
}

export function App() {
  const [activeTab, setActiveTab] = useState<StudioMode>("general");
  const [spec, setSpec] = useState<VideoSpec>({
    ...DEFAULT_VIDEO_SPEC,
    voiceSpeed: 1.0,
    subtitleStyle: "dynamic",
    renderMode: "hybrid",
    sfxEnabled: true,
    targetDuration: 35,
    studioMode: "general",
    showBrandHeader: false,
  });

  // General mode state
  const [prompt, setPrompt] = useState("");
  const [targetDurationInput, setTargetDurationInput] = useState("35");
  const [topicMode, setTopicMode] = useState<TopicMode>("auto");

  // Recruitment mode state
  const [companyName, setCompanyName] = useState(DEFAULT_COMPANY_NAME);
  const [companyBadge, setCompanyBadge] = useState("VACANTE DISPONIBLE");
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);
  const [customLogoName, setCustomLogoName] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [jobLocation, setJobLocation] = useState("Joachín, Veracruz");
  const [jobRequirements, setJobRequirements] = useState("");
  const [jobBenefits, setJobBenefits] = useState("");
  const [jobExtra, setJobExtra] = useState("");
  const [recruitmentDurationInput, setRecruitmentDurationInput] = useState("30");
  const [flyerDuration, setFlyerDuration] = useState(6);
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [flyerName, setFlyerName] = useState<string | null>(null);

  // Shared production controls
  const [renderMode, setRenderMode] = useState<RenderMode>("hybrid");
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [voice, setVoice] = useState("Fenrir");
  const [accent, setAccent] = useState("es-MX");
  const [voiceStyle, setVoiceStyle] = useState("tiktok");
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("dynamic");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("editorial");
  const [autoVoice, setAutoVoice] = useState(true);
  const [autoImages, setAutoImages] = useState(true);

  const [voiceProvider, setVoiceProvider] = useState<string | null>(null);
  const [imageProvider, setImageProvider] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState("");
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesProgress, setImagesProgress] = useState("");
  const [sceneVoiceLoading, setSceneVoiceLoading] = useState<number | null>(null);
  const [sceneImageLoading, setSceneImageLoading] = useState<number | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [exportState, setExportState] = useState<ExportState>({ status: "idle" });
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, []);

  const parsedTargetDuration = useMemo(() => {
    const n = Number(targetDurationInput);
    return Number.isFinite(n) && n > 0 ? clampDuration(n) : 35;
  }, [targetDurationInput]);

  const parsedRecruitmentDuration = useMemo(() => {
    const n = Number(recruitmentDurationInput);
    return Number.isFinite(n) && n > 0 ? clampDuration(n) : 30;
  }, [recruitmentDurationInput]);

  const totalFrames = useMemo(() => getTotalFrames(spec, FPS), [spec]);
  const totalSeconds = (totalFrames / FPS).toFixed(1);

  const syncedScenesCount = useMemo(
    () => spec.scenes.filter((s) => Boolean(s.audioUrl)).length,
    [spec]
  );

  const mediaReadyCount = useMemo(
    () => spec.scenes.filter((s) => Boolean(s.imageUrl || s.videoUrl)).length,
    [spec]
  );

  const videoSlug = useMemo(
    () =>
      (spec.title || "video-ai")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "video-ai",
    [spec.title]
  );

  const handleRenderModeChange = (nextMode: RenderMode) => {
    setRenderMode(nextMode);
    setSpec((prev) => ({
      ...prev,
      renderMode: nextMode,
      scenes: prev.scenes.map((scene, idx) =>
        scene.layout === "flyer-end"
          ? { ...scene, sceneMode: "editorial" }
          : {
              ...scene,
              sceneMode:
                nextMode === "editorial"
                  ? "editorial"
                  : nextMode === "cinematic"
                  ? "cinematic"
                  : idx % 2 === 1
                  ? "editorial"
                  : "hybrid",
            }
      ),
    }));
  };

  const handleSfxToggle = (enabled: boolean) => {
    setSfxEnabled(enabled);
    setSpec((prev) => ({ ...prev, sfxEnabled: enabled }));
  };

  const handleSpeedChange = (newSpeed: number) => {
    setVoiceSpeed(newSpeed);
    setSpec((prev) => ({
      ...prev,
      voiceSpeed: newSpeed,
      scenes: fitScenesToTargetDuration(
        prev.scenes,
        newSpeed,
        prev.targetDuration
      ),
    }));
  };

  const handleSubtitleStyleChange = (nextStyle: SubtitleStyle) => {
    setSubtitleStyle(nextStyle);
    setSpec((prev) => ({
      ...prev,
      subtitleStyle: nextStyle,
    }));
  };

  const handleFlyerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (flyerUrl && flyerUrl.startsWith("blob:")) URL.revokeObjectURL(flyerUrl);
    const nextUrl = URL.createObjectURL(file);
    setFlyerUrl(nextUrl);
    setFlyerName(file.name);

    setSpec((prev) => {
      const idx = prev.scenes.findIndex((s) => s.layout === "flyer-end");
      if (idx === -1) return prev;
      return {
        ...prev,
        scenes: prev.scenes.map((scene, i) =>
          i === idx ? { ...scene, imageUrl: nextUrl } : scene
        ),
      };
    });
  };

  const handleCustomLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (customLogoUrl && customLogoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(customLogoUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setCustomLogoUrl(nextUrl);
    setCustomLogoName(file.name);

    setSpec((prev) =>
      prev.showBrandHeader ? { ...prev, companyLogoUrl: nextUrl } : prev
    );
  };

  const applyCorporateBrandingLive = (
    nextName = companyName,
    nextBadge = companyBadge
  ) => {
    setSpec((prev) =>
      prev.showBrandHeader
        ? {
            ...prev,
            companyName: nextName,
            companyBadge: nextBadge,
            companyLogoUrl: customLogoUrl || "logoasr.png",
            theme: { ...RECRUITMENT_PALETTE },
          }
        : prev
    );
  };

  const generateAllVoices = async (
    targetSpec: VideoSpec,
    selectedVoice = voice,
    selectedAccent = accent,
    selectedStyle = voiceStyle,
    selectedSpeed = voiceSpeed
  ): Promise<VideoSpec> => {
    setVoiceLoading(true);
    setVoiceError(null);
    const updatedScenes = [...targetSpec.scenes];
    let latestSpec: VideoSpec = {
      ...targetSpec,
      voiceSpeed: selectedSpeed,
      subtitleStyle,
      renderMode: targetSpec.renderMode || renderMode,
      sfxEnabled,
      scenes: updatedScenes,
    };

    try {
      let lastProvider = "gemini-3.8-flash-lite-tts";

      for (let i = 0; i < updatedScenes.length; i++) {
        const scene = updatedScenes[i];
        const textToSpeak = (scene.subtitle || scene.title || "").trim();
        if (!textToSpeak) continue;

        const minFloor =
          scene.layout === "flyer-end"
            ? Math.max(4.5, scene.durationSeconds || flyerDuration)
            : 2.2;

        setVoiceProgress(`Voz ${i + 1}/${updatedScenes.length}...`);
        const result = await fetchSceneVoice(
          textToSpeak,
          selectedVoice,
          selectedAccent,
          selectedStyle,
          selectedSpeed,
          minFloor
        );
        lastProvider = result.provider;

        if (scene.audioUrl && scene.audioUrl.startsWith("blob:")) {
          URL.revokeObjectURL(scene.audioUrl);
        }

        updatedScenes[i] = {
          ...scene,
          audioUrl: result.audioUrl,
          rawAudioDuration: result.rawAudioDuration,
          durationSeconds: result.durationSeconds,
        };

        latestSpec = {
          ...latestSpec,
          scenes: [...updatedScenes],
        };
        setSpec(latestSpec);
      }

      const fittedScenes = fitScenesToTargetDuration(
        updatedScenes,
        selectedSpeed,
        targetSpec.targetDuration
      );
      latestSpec = {
        ...latestSpec,
        scenes: fittedScenes,
      };
      setSpec(latestSpec);
      setVoiceProvider(lastProvider);
    } catch (err) {
      setVoiceError(
        err instanceof Error
          ? err.message
          : "Error al generar las voces con Gemini."
      );
    } finally {
      setVoiceLoading(false);
      setVoiceProgress("");
    }

    return latestSpec;
  };

  const generateAllImages = async (
    targetSpec: VideoSpec,
    selectedVisualStyle = visualStyle,
    forceEditorial = false
  ): Promise<VideoSpec> => {
    setImagesLoading(true);
    setImageError(null);
    const updatedScenes = [...targetSpec.scenes];
    let latestSpec: VideoSpec = { ...targetSpec, scenes: updatedScenes };

    try {
      let lastProvider = "gemini-image";

      for (let i = 0; i < updatedScenes.length; i++) {
        const scene = updatedScenes[i];
        if (
          scene.type === "tactics" ||
          scene.videoUrl ||
          scene.layout === "flyer-end"
        ) {
          continue;
        }
        const effectiveMode = scene.sceneMode || targetSpec.renderMode || renderMode;
        if (!forceEditorial && effectiveMode === "editorial") continue;

        setImagesProgress(`Imagen ${i + 1}/${updatedScenes.length}...`);
        const result = await fetchSceneImage(scene, selectedVisualStyle);
        lastProvider = result.provider;

        if (scene.imageUrl && scene.imageUrl.startsWith("blob:")) {
          URL.revokeObjectURL(scene.imageUrl);
        }

        updatedScenes[i] = {
          ...scene,
          imageUrl: result.imageUrl,
        };

        latestSpec = {
          ...latestSpec,
          scenes: [...updatedScenes],
        };
        setSpec(latestSpec);
      }

      setImageProvider(lastProvider);
    } catch (err) {
      setImageError(
        err instanceof Error
          ? err.message
          : "No se pudieron generar todas las imágenes."
      );
    } finally {
      setImagesLoading(false);
      setImagesProgress("");
    }

    return latestSpec;
  };

  const regenerateSingleSceneVoice = async (index: number) => {
    const scene = spec.scenes[index];
    const textToSpeak = (scene?.subtitle || scene?.title || "").trim();
    if (!scene || !textToSpeak) return;

    setSceneVoiceLoading(index);
    setVoiceError(null);

    try {
      const minFloor =
        scene.layout === "flyer-end"
          ? Math.max(4.5, scene.durationSeconds || flyerDuration)
          : 2.2;
      const result = await fetchSceneVoice(
        textToSpeak,
        voice,
        accent,
        voiceStyle,
        voiceSpeed,
        minFloor
      );
      setVoiceProvider(result.provider);
      if (scene.audioUrl && scene.audioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(scene.audioUrl);
      }
      updateScene(index, {
        audioUrl: result.audioUrl,
        rawAudioDuration: result.rawAudioDuration,
        durationSeconds: result.durationSeconds,
      });
    } catch (err) {
      setVoiceError(
        err instanceof Error ? err.message : "No se pudo regenerar la voz."
      );
    } finally {
      setSceneVoiceLoading(null);
    }
  };

  const regenerateSingleSceneImage = async (index: number) => {
    const scene = spec.scenes[index];
    if (!scene || scene.layout === "flyer-end") return;

    setSceneImageLoading(index);
    setImageError(null);

    try {
      const result = await fetchSceneImage(scene, visualStyle);
      setImageProvider(result.provider);
      if (scene.imageUrl && scene.imageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(scene.imageUrl);
      }
      updateScene(index, {
        type: scene.type === "tactics" ? "cinematic" : scene.type,
        imageUrl: result.imageUrl,
      });
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : "No se pudo regenerar la imagen."
      );
    } finally {
      setSceneImageLoading(null);
    }
  };

  const handleGenerateGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const detected = extractRequestedDuration(prompt, parsedTargetDuration);
    const requestedSeconds = detected.seconds;
    setTargetDurationInput(String(requestedSeconds));

    setLoading(true);
    setLoadingStep(`Creando guion de ${requestedSeconds}s con Gemini...`);
    setError(null);
    setVoiceError(null);
    setImageError(null);

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          durationSeconds: requestedSeconds,
          voiceSpeed,
          topicMode,
          renderMode,
          studioMode: "general",
        }),
      });

      const raw = await res.text();
      let data: GenerateResponse = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(`Error del servidor (${res.status}): ${raw.slice(0, 140)}`);
      }

      if (!res.ok) {
        throw new Error(
          data.error ||
            data.errorMessage ||
            data.message ||
            `Error ${res.status} al generar el video.`
        );
      }

      if (!Array.isArray(data.scenes) || data.scenes.length === 0) {
        throw new Error("La respuesta no incluyó escenas válidas.");
      }

      let currentSpec: VideoSpec = {
        ...(data as VideoSpec),
        voiceSpeed,
        subtitleStyle,
        renderMode,
        sfxEnabled,
        studioMode: "general",
        showBrandHeader: false,
        targetDuration: data.targetDuration || requestedSeconds,
      };
      setSpec(currentSpec);

      if (autoImages && renderMode !== "editorial") {
        setLoadingStep("Generando visuales 9:16...");
        currentSpec = await generateAllImages(currentSpec, visualStyle, false);
      }

      if (autoVoice && !audioUrl) {
        setLoadingStep("Generando voz de estudio sincronizada...");
        currentSpec = await generateAllVoices(
          currentSpec,
          voice,
          accent,
          voiceStyle,
          voiceSpeed
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error de conexión con Gemini."
      );
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const handleGenerateRecruitment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim() && !jobExtra.trim()) {
      setError("Escribe al menos el nombre de la vacante o los detalles del puesto.");
      return;
    }

    const requestedSeconds = parsedRecruitmentDuration;
    const cleanCompany = companyName.trim() || DEFAULT_COMPANY_NAME;

    const recruitmentPrompt = [
      `Crea un video profesional y dinámico de reclutamiento laboral de ${requestedSeconds} segundos para la empresa ${cleanCompany}.`,
      jobTitle.trim() ? `Vacante / Puesto: ${jobTitle.trim()}.` : "",
      jobLocation.trim() ? `Ubicación: ${jobLocation.trim()}.` : "",
      jobRequirements.trim() ? `Requisitos y perfil buscado: ${jobRequirements.trim()}.` : "",
      jobBenefits.trim() ? `Ofrecemos / Beneficios: ${jobBenefits.trim()}.` : "",
      jobExtra.trim() ? `Información adicional / Postulación: ${jobExtra.trim()}.` : "",
      "Hazlo cercano, claro y atractivo para atraer candidatos en redes sociales, cerrando con la escena del flyer final con los datos de contacto.",
    ]
      .filter(Boolean)
      .join("\n");

    setLoading(true);
    setLoadingStep(`Creando video de vacante (${requestedSeconds}s)...`);
    setError(null);
    setVoiceError(null);
    setImageError(null);

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: recruitmentPrompt,
          durationSeconds: requestedSeconds,
          voiceSpeed,
          topicMode: "recruitment",
          renderMode,
          studioMode: "recruitment",
          companyName: cleanCompany,
          flyerDuration,
        }),
      });

      const raw = await res.text();
      let data: GenerateResponse = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(`Error del servidor (${res.status}): ${raw.slice(0, 140)}`);
      }

      if (!res.ok) {
        throw new Error(
          data.error ||
            data.errorMessage ||
            data.message ||
            `Error ${res.status} al generar el video de vacante.`
        );
      }

      if (!Array.isArray(data.scenes) || data.scenes.length === 0) {
        throw new Error("La respuesta no incluyó escenas válidas.");
      }

      const hydratedScenes = (data.scenes as VideoScene[]).map((scene) =>
        scene.layout === "flyer-end" && flyerUrl
          ? { ...scene, imageUrl: flyerUrl }
          : scene
      );

      let currentSpec: VideoSpec = {
        ...(data as VideoSpec),
        theme: { ...RECRUITMENT_PALETTE },
        scenes: hydratedScenes,
        voiceSpeed,
        subtitleStyle,
        renderMode,
        sfxEnabled,
        studioMode: "recruitment",
        showBrandHeader: true,
        companyName: cleanCompany,
        companyBadge: companyBadge.trim() || "VACANTE DISPONIBLE",
        companyLogoUrl: customLogoUrl || "logoasr.png",
        targetDuration: data.targetDuration || requestedSeconds,
      };
      setSpec(currentSpec);

      if (autoImages && renderMode !== "editorial") {
        setLoadingStep("Generando visuales corporativos 9:16...");
        currentSpec = await generateAllImages(currentSpec, visualStyle, false);
      }

      if (autoVoice && !audioUrl) {
        setLoadingStep("Generando voz de reclutamiento sincronizada...");
        currentSpec = await generateAllVoices(
          currentSpec,
          voice,
          accent,
          voiceStyle,
          voiceSpeed
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear el video de vacante."
      );
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const triggerDownload = (assetId: number) => {
    const downloadUrl = `/api/export-status?download=1&assetId=${encodeURIComponent(String(assetId))}&name=${encodeURIComponent(videoSlug)}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${videoSlug}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleExportMp4 = async () => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    const jobId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setExportState({ status: "uploading", jobId });

    try {
      const assets: Record<string, { base64: string; ext: string }> = {};
      let totalAssetBytes = 0;

      let globalAudioKey: string | undefined;
      if (audioUrl && audioUrl.startsWith("blob:")) {
        globalAudioKey = "global-audio";
        const item = await blobUrlToAsset(audioUrl, "mp3");
        totalAssetBytes += item.byteSize;
        assets[globalAudioKey] = { base64: item.base64, ext: item.ext };
      }

      let companyLogoAssetKey: string | undefined;
      let exportLogoUrl = spec.companyLogoUrl;
      if (spec.showBrandHeader && exportLogoUrl && exportLogoUrl.startsWith("blob:")) {
        companyLogoAssetKey = "company-logo";
        const item = await blobUrlToAsset(exportLogoUrl, "png");
        totalAssetBytes += item.byteSize;
        assets[companyLogoAssetKey] = { base64: item.base64, ext: item.ext };
        exportLogoUrl = undefined;
      }

      const exportScenes: VideoScene[] = [];
      for (let i = 0; i < spec.scenes.length; i++) {
        const s = spec.scenes[i];
        const copy: VideoScene = { ...s };

        if (!globalAudioKey && s.audioUrl && s.audioUrl.startsWith("blob:")) {
          const key = `scene-audio-${i}`;
          const item = await blobUrlToAsset(s.audioUrl, "wav");
          totalAssetBytes += item.byteSize;
          assets[key] = { base64: item.base64, ext: item.ext };
          copy.audioAssetKey = key;
        }
        delete copy.audioUrl;

        if (s.imageUrl && s.imageUrl.startsWith("blob:")) {
          const key = `scene-image-${i}`;
          const item = await blobUrlToAsset(
            s.imageUrl,
            s.layout === "flyer-end" ? "png" : "jpg"
          );
          totalAssetBytes += item.byteSize;
          assets[key] = { base64: item.base64, ext: item.ext };
          copy.imageAssetKey = key;
          delete copy.imageUrl;
        }

        if (s.videoUrl && s.videoUrl.startsWith("blob:")) {
          const key = `scene-video-${i}`;
          const item = await blobUrlToAsset(s.videoUrl, "mp4");
          totalAssetBytes += item.byteSize;
          assets[key] = { base64: item.base64, ext: item.ext };
          copy.videoAssetKey = key;
          delete copy.videoUrl;
        }

        exportScenes.push(copy);
      }

      if (totalAssetBytes > 18 * 1024 * 1024) {
        throw new Error(
          `Los archivos subidos pesan ${(totalAssetBytes / (1024 * 1024)).toFixed(1)} MB. Usa clips o imágenes más ligeras (máximo 18 MB en total) para exportar en la nube.`
        );
      }

      const exportSpec: VideoSpec = {
        ...spec,
        voiceSpeed,
        subtitleStyle,
        renderMode,
        sfxEnabled,
        globalAudioKey,
        companyLogoUrl: exportLogoUrl,
        companyLogoAssetKey,
        scenes: exportScenes,
      };

      const res = await fetch("/api/export-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, spec: exportSpec, assets }),
      });

      const raw = await res.text();
      let data: {
        ok?: boolean;
        startedAt?: number;
        actionsUrl?: string;
        error?: string;
      } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(`Error al iniciar exportación (${res.status}): ${raw.slice(0, 140)}`);
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Error ${res.status} al exportar MP4.`);
      }

      const startedAt = data.startedAt || Date.now();
      setExportState({
        status: "queued",
        jobId,
        runUrl: data.actionsUrl,
      });

      pollTimerRef.current = window.setInterval(async () => {
        try {
          const statusRes = await fetch(
            `/api/export-status?jobId=${encodeURIComponent(jobId)}&startedAt=${startedAt}`
          );
          if (!statusRes.ok) return;
          const st = await statusRes.json();

          if (st.status === "completed" && st.assetId) {
            if (pollTimerRef.current) {
              window.clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            setExportState({
              status: "completed",
              jobId,
              mp4AssetId: st.assetId,
              runUrl: st.runUrl || data.actionsUrl,
            });
            triggerDownload(st.assetId);
          } else if (st.status === "failed") {
            if (pollTimerRef.current) {
              window.clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            setExportState({
              status: "failed",
              jobId,
              runUrl: st.runUrl || data.actionsUrl,
              error: `El render falló en GitHub Actions (${st.conclusion || "error"}). Revisa el registro.`,
            });
          } else if (st.status === "in_progress" || st.status === "queued") {
            setExportState((prev) => ({
              ...prev,
              status: st.status,
              runUrl: st.runUrl || prev.runUrl,
            }));
          }
        } catch {}
      }, 4500);
    } catch (err) {
      setExportState({
        status: "failed",
        error: err instanceof Error ? err.message : "No se pudo exportar el MP4.",
      });
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(file));
    setAudioName(file.name);
  };

  const handleSceneImageUpload = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const prev = spec.scenes[index]?.imageUrl;
    if (prev && prev.startsWith("blob:") && prev !== flyerUrl) {
      URL.revokeObjectURL(prev);
    }
    const url = URL.createObjectURL(file);
    updateScene(index, { type: "cinematic", imageUrl: url });
  };

  const handleSceneVideoUpload = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const prev = spec.scenes[index]?.videoUrl;
    if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
    const url = URL.createObjectURL(file);
    updateScene(index, {
      type: "cinematic",
      videoUrl: url,
      videoName: file.name,
      videoMuted: true,
    });
  };

  const removeSceneVideo = (index: number) => {
    const prev = spec.scenes[index]?.videoUrl;
    if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
    updateScene(index, {
      videoUrl: undefined,
      videoName: undefined,
      videoAssetKey: undefined,
    });
  };

  const updateScene = (index: number, patch: Partial<VideoScene>) => {
    setSpec((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene, i) =>
        i === index ? { ...scene, ...patch } : scene
      ),
    }));
  };

  const addScene = () => {
    const newScene: VideoScene = {
      id: `s-${Date.now()}`,
      type: "cinematic",
      sceneMode: renderMode,
      layout: "story-clean",
      cameraMotion: "zoom-in",
      transition: "slide-left",
      iconName: activeTab === "recruitment" ? "briefcase" : "sparkles",
      calloutText: "PUNTO CLAVE",
      durationSeconds: 5,
      badge: "NUEVA ESCENA",
      title: "TITULAR",
      subtitle: "Texto narrado para esta escena.",
      imagePrompt:
        "Dramatic vertical 9:16 cinematic scene with atmospheric lighting, realistic photography",
    };
    setSpec((prev) => ({ ...prev, scenes: [...prev.scenes, newScene] }));
  };

  const addFlyerScene = () => {
    const flyerScene: VideoScene = {
      id: `s-flyer-${Date.now()}`,
      type: "cinematic",
      sceneMode: "editorial",
      layout: "flyer-end",
      cameraMotion: "zoom-in",
      transition: "fade",
      iconName: "badge-check",
      durationSeconds: flyerDuration,
      badge: "INFORMACIÓN Y CONTACTO",
      title: jobTitle.trim() || "POSTÚLATE HOY",
      subtitle:
        "Guarda esta pantalla con toda la información y postúlate hoy mismo. ¡Te esperamos!",
      imageUrl: flyerUrl || undefined,
      imagePrompt: "",
    };
    setSpec((prev) => ({ ...prev, scenes: [...prev.scenes, flyerScene] }));
  };

  const removeScene = (index: number) => {
    if (spec.scenes.length <= 1) return;
    setSpec((prev) => ({
      ...prev,
      scenes: prev.scenes.filter((_, i) => i !== index),
    }));
  };

  const downloadJson = () => {
    const cleanSpec: VideoSpec = {
      ...spec,
      scenes: spec.scenes.map(
        ({
          audioUrl: _a,
          rawAudioDuration: _r,
          imageUrl: _i,
          videoUrl: _v,
          ...rest
        }) => rest
      ),
    };
    const blob = new Blob([JSON.stringify(cleanSpec, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoSlug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isExporting =
    exportState.status === "uploading" ||
    exportState.status === "queued" ||
    exportState.status === "in_progress";

  const isBusy = loading || voiceLoading || imagesLoading;

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div className="brand">
          {h(Film, { size: 20 })}
          <span>Video Studio AI</span>
        </div>
        <div className="header-actions">
          <span className="pill">{totalSeconds}s · 9:16</span>
          <button type="button" className="btn-secondary" onClick={downloadJson}>
            {h(Download, { size: 16 })}
            JSON
          </button>

          {exportState.status === "completed" && exportState.mp4AssetId ? (
            <button
              type="button"
              className="btn-success"
              onClick={() => triggerDownload(exportState.mp4AssetId!)}
            >
              {h(CheckCircle2, { size: 16 })}
              Descargar MP4
            </button>
          ) : null}

          <button
            type="button"
            className="btn-primary"
            disabled={isExporting || isBusy}
            onClick={handleExportMp4}
          >
            {isExporting ? (
              <>
                {h(Loader2, { size: 16, className: "spin" })}
                {exportState.status === "uploading"
                  ? "Subiendo..."
                  : exportState.status === "in_progress"
                  ? "Renderizando MP4..."
                  : "En cola..."}
              </>
            ) : (
              <>
                {h(Download, { size: 16 })}
                Exportar MP4
              </>
            )}
          </button>
        </div>
      </header>

      {exportState.status !== "idle" && (
        <div className={`export-banner export-${exportState.status}`}>
          <div className="export-banner-left">
            {isExporting && h(Loader2, { size: 16, className: "spin" })}
            {exportState.status === "completed" && h(CheckCircle2, { size: 16 })}
            <span>
              {exportState.status === "uploading" &&
                "Empaquetando imágenes, videos, flyer, subtítulos y audio para renderizar..."}
              {exportState.status === "queued" &&
                "Trabajo enviado a GitHub Actions. Esperando servidor de render (1-2 min)..."}
              {exportState.status === "in_progress" &&
                "Renderizando video 1080×1920 con Remotion en la nube..."}
              {exportState.status === "completed" &&
                "Tu video MP4 está listo. La descarga inició automáticamente."}
              {exportState.status === "failed" &&
                (exportState.error || "Error al exportar el video.")}
            </span>
          </div>
          <div className="export-banner-actions">
            {exportState.runUrl && (
              <a
                href={exportState.runUrl}
                target="_blank"
                rel="noreferrer"
                className="export-link"
              >
                Ver progreso {h(ExternalLink, { size: 13 })}
              </a>
            )}
            {exportState.status === "completed" && exportState.mp4AssetId && (
              <button
                type="button"
                className="btn-success"
                onClick={() => triggerDownload(exportState.mp4AssetId!)}
              >
                {h(Download, { size: 14 })}
                Volver a descargar
              </button>
            )}
          </div>
        </div>
      )}

      <main className="studio-grid">
        <section className="editor-panel">
          <div className="studio-tabs">
            <button
              type="button"
              className={`studio-tab ${activeTab === "general" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("general");
                setError(null);
              }}
            >
              {h(Sparkles, { size: 15 })}
              <span>Contenido General</span>
            </button>
            <button
              type="button"
              className={`studio-tab recruitment ${activeTab === "recruitment" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("recruitment");
                setError(null);
              }}
            >
              {h(Briefcase, { size: 15 })}
              <span>Reclutamiento / Vacantes</span>
            </button>
          </div>

          {activeTab === "general" ? (
            <form className="card" onSubmit={handleGenerateGeneral}>
              <div className="card-title">
                {h(Sparkles, { size: 16 })}
                <span>Crear video sobre cualquier tema</span>
              </div>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ej: Un video de 45 segundos sobre cómo Florentino Pérez convenció a Figo de fichar por el Real Madrid, con ritmo editorial, íconos dinámicos de contratos y dinero, y pregunta final..."
              />

              <div className="voice-grid">
                <select
                  value={renderMode}
                  onChange={(e) =>
                    handleRenderModeChange(e.target.value as RenderMode)
                  }
                  className="full-span"
                >
                  {RENDER_MODE_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  value={topicMode}
                  onChange={(e) => setTopicMode(e.target.value as TopicMode)}
                  className="full-span"
                >
                  {TOPIC_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="duration-presets">
                {DURATION_PRESETS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`preset-chip ${parsedTargetDuration === sec ? "active" : ""}`}
                    onClick={() => setTargetDurationInput(String(sec))}
                  >
                    {sec}s
                  </button>
                ))}
              </div>

              <div className="form-row">
                <label className="duration-field">
                  <span>Duración</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={targetDurationInput}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, "");
                      setTargetDurationInput(digits);
                    }}
                    onBlur={() =>
                      setTargetDurationInput(String(parsedTargetDuration))
                    }
                  />
                  <span>seg (10–180)</span>
                </label>
                <button type="submit" className="btn-primary" disabled={isBusy}>
                  {isBusy
                    ? h(Loader2, { size: 16, className: "spin" })
                    : h(Sparkles, { size: 16 })}
                  {loading
                    ? imagesProgress || voiceProgress || loadingStep || "Generando..."
                    : "Crear video"}
                </button>
              </div>
              {error && <div className="error-banner">{error}</div>}
            </form>
          ) : (
            <form
              className="card recruitment-card"
              onSubmit={handleGenerateRecruitment}
            >
              <div className="card-header-between">
                <div className="card-title recruitment-title">
                  {h(Briefcase, { size: 16 })}
                  <span>Video de Reclutamiento · Paleta Oficial</span>
                </div>
                <div className="palette-swatches" title="Paleta oficial ASR (verdes y grises)">
                  <span style={{ backgroundColor: "#008F4C" }} />
                  <span style={{ backgroundColor: "#7EC34A" }} />
                  <span style={{ backgroundColor: "#BCD853" }} />
                  <span style={{ backgroundColor: "#636466" }} />
                  <span style={{ backgroundColor: "#A7A9AC" }} />
                </div>
              </div>

              <div className="recruitment-brand-box">
                <div className="recruitment-grid">
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      applyCorporateBrandingLive(e.target.value, companyBadge);
                    }}
                    placeholder="Nombre de la empresa en el encabezado"
                  />
                  <input
                    type="text"
                    value={companyBadge}
                    onChange={(e) => {
                      setCompanyBadge(e.target.value);
                      applyCorporateBrandingLive(companyName, e.target.value);
                    }}
                    placeholder="Etiqueta superior (ej. VACANTE DISPONIBLE)"
                  />
                </div>
                <div className="audio-row">
                  <span className="logo-status">
                    Logo superior derecho:{" "}
                    <strong>{customLogoName || "logoasr.png (predeterminado)"}</strong>
                  </span>
                  <label className="btn-secondary file-label">
                    {h(Upload, { size: 14 })}
                    <span>{customLogoName ? "Cambiar logo" : "Subir otro PNG"}</span>
                    <input
                      type="file"
                      accept="image/png,image/*"
                      hidden
                      onChange={handleCustomLogoUpload}
                    />
                  </label>
                  {customLogoName && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Volver a usar logoasr.png"
                      onClick={() => {
                        if (customLogoUrl) URL.revokeObjectURL(customLogoUrl);
                        setCustomLogoUrl(null);
                        setCustomLogoName(null);
                        setSpec((prev) =>
                          prev.showBrandHeader
                            ? { ...prev, companyLogoUrl: "logoasr.png" }
                            : prev
                        );
                      }}
                    >
                      {h(Trash2, { size: 14 })}
                    </button>
                  )}
                </div>
              </div>

              <div className="recruitment-grid">
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Puesto / Vacante (Ej: Técnico de Control Agrícola)"
                />
                <input
                  type="text"
                  value={jobLocation}
                  onChange={(e) => setJobLocation(e.target.value)}
                  placeholder="Ubicación (Ej: Joachín, Veracruz)"
                />
              </div>

              <textarea
                rows={2}
                value={jobRequirements}
                onChange={(e) => setJobRequirements(e.target.value)}
                placeholder="Requisitos clave (Ej: Ingeniería agrónoma o afín, licencia de manejo, disponibilidad de horario...)"
              />

              <textarea
                rows={2}
                value={jobBenefits}
                onChange={(e) => setJobBenefits(e.target.value)}
                placeholder="Ofrecemos / Beneficios (Ej: Sueldo competitivo, prestaciones superiores a la ley, capacitación constante...)"
              />

              <input
                type="text"
                value={jobExtra}
                onChange={(e) => setJobExtra(e.target.value)}
                placeholder="Detalles extra o cómo postularse (Ej: Envía tu CV por WhatsApp o acude a oficinas de lunes a viernes)"
              />

              <div className="flyer-upload-box">
                <div className="flyer-upload-top">
                  <div className="card-title">
                    {h(FileImage, { size: 16 })}
                    <span>Flyer final de la vacante (escena de cierre)</span>
                  </div>
                  <label className="duration-field">
                    <span>Tiempo</span>
                    <input
                      type="number"
                      min={4}
                      max={15}
                      value={flyerDuration}
                      onChange={(e) =>
                        setFlyerDuration(
                          Math.min(15, Math.max(4, Number(e.target.value) || 6))
                        )
                      }
                    />
                    <span>s</span>
                  </label>
                </div>

                <div className="audio-row">
                  <label className="btn-recruitment-outline file-label">
                    {h(Upload, { size: 15 })}
                    <span>
                      {flyerName
                        ? "Cambiar imagen del flyer"
                        : "Cargar imagen del flyer (.png / .jpg)"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleFlyerUpload}
                    />
                  </label>
                  {flyerName ? (
                    <span className="flyer-chip">
                      {h(CheckCircle2, { size: 14 })}
                      <span>{flyerName}</span>
                    </span>
                  ) : (
                    <span className="flyer-hint">
                      Puedes cargarlo ahora o después de generar el video.
                    </span>
                  )}
                </div>
              </div>

              <select
                value={renderMode}
                onChange={(e) =>
                  handleRenderModeChange(e.target.value as RenderMode)
                }
              >
                {RENDER_MODE_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>

              <div className="duration-presets">
                {RECRUITMENT_DURATION_PRESETS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`preset-chip ${parsedRecruitmentDuration === sec ? "active" : ""}`}
                    onClick={() => setRecruitmentDurationInput(String(sec))}
                  >
                    {sec}s
                  </button>
                ))}
              </div>

              <div className="form-row">
                <label className="duration-field">
                  <span>Duración total</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={recruitmentDurationInput}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, "");
                      setRecruitmentDurationInput(digits);
                    }}
                    onBlur={() =>
                      setRecruitmentDurationInput(
                        String(parsedRecruitmentDuration)
                      )
                    }
                  />
                  <span>seg</span>
                </label>
                <button
                  type="submit"
                  className="btn-recruitment"
                  disabled={isBusy}
                >
                  {isBusy
                    ? h(Loader2, { size: 16, className: "spin" })
                    : h(Briefcase, { size: 16 })}
                  {loading
                    ? imagesProgress ||
                      voiceProgress ||
                      loadingStep ||
                      "Generando..."
                    : "Crear video de vacante"}
                </button>
              </div>
              {error && <div className="error-banner">{error}</div>}
            </form>
          )}

          <div className="card">
            <div className="card-header-between">
              <div className="card-title">
                {h(Layers, { size: 16 })}
                <span>Visuales, animaciones, SFX y voz</span>
              </div>
              <div className="badge-group">
                {mediaReadyCount > 0 && (
                  <span className="status-badge">
                    {imageProvider ? "Visuales" : "Media"} ({mediaReadyCount}/
                    {spec.scenes.length})
                  </span>
                )}
                {!audioUrl && syncedScenesCount > 0 && (
                  <span className="status-badge">
                    {voiceProvider ? "Voz IA" : "Audio"} · {voiceSpeed}x (
                    {syncedScenesCount}/{spec.scenes.length})
                  </span>
                )}
                {audioUrl && <span className="status-badge">Usando tu audio</span>}
              </div>
            </div>

            <div className="voice-grid">
              <select
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
                className="full-span"
              >
                {VISUAL_STYLE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>

              <select value={voice} onChange={(e) => setVoice(e.target.value)}>
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>

              <select value={accent} onChange={(e) => setAccent(e.target.value)}>
                {ACCENT_OPTIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>

              <select
                value={voiceStyle}
                onChange={(e) => setVoiceStyle(e.target.value)}
              >
                {STYLE_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>

              <select
                value={voiceSpeed}
                onChange={(e) => handleSpeedChange(Number(e.target.value))}
              >
                {SPEED_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              <select
                value={subtitleStyle}
                onChange={(e) =>
                  handleSubtitleStyleChange(e.target.value as SubtitleStyle)
                }
                className="full-span"
              >
                <option value="dynamic">
                  Subtítulos dinámicos (Palabra por palabra estilo TikTok)
                </option>
                <option value="classic">
                  Subtítulos clásicos (Bloque completo fijo)
                </option>
              </select>
            </div>

            <div className="audio-row">
              <button
                type="button"
                className="btn-primary"
                disabled={isBusy}
                onClick={() => generateAllImages(spec, visualStyle, true)}
              >
                {h(Wand2, { size: 15 })}
                {imagesLoading
                  ? imagesProgress || "Generando imágenes..."
                  : "Generar imágenes IA"}
              </button>

              <button
                type="button"
                className="btn-primary"
                disabled={isBusy}
                onClick={() =>
                  generateAllVoices(spec, voice, accent, voiceStyle, voiceSpeed)
                }
              >
                {h(Volume2, { size: 15 })}
                {voiceLoading
                  ? voiceProgress || "Generando voz..."
                  : "Generar voz Gemini"}
              </button>

              <label className="btn-secondary file-label">
                {h(Mic, { size: 15 })}
                {h(Upload, { size: 14 })}
                <span>{audioName ? "Cambiar mi voz" : "Subir mi voz"}</span>
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={handleAudioUpload}
                />
              </label>

              {audioName && (
                <div className="audio-chip">
                  <span>{audioName}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      if (audioUrl) URL.revokeObjectURL(audioUrl);
                      setAudioUrl(null);
                      setAudioName(null);
                    }}
                  >
                    {h(Trash2, { size: 14 })}
                  </button>
                </div>
              )}
            </div>

            <div className="audio-row">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={autoImages}
                  onChange={(e) => setAutoImages(e.target.checked)}
                />
                <span>Generar imágenes IA</span>
              </label>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={autoVoice}
                  onChange={(e) => setAutoVoice(e.target.checked)}
                />
                <span>Generar voz IA</span>
              </label>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={sfxEnabled}
                  onChange={(e) => handleSfxToggle(e.target.checked)}
                />
                <span>Efectos de sonido (SFX)</span>
              </label>
            </div>

            {imageError && <div className="error-banner">{imageError}</div>}
            {voiceError && <div className="error-banner">{voiceError}</div>}
          </div>

          <div className="card">
            <div className="card-header-between">
              <div className="card-title">
                <span>Escenas ({spec.scenes.length})</span>
              </div>
              <div className="badge-group">
                {activeTab === "recruitment" && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={addFlyerScene}
                  >
                    {h(FileImage, { size: 15 })}
                    Añadir Flyer
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={addScene}>
                  {h(Plus, { size: 15 })}
                  Añadir escena
                </button>
              </div>
            </div>

            <div className="scene-list">
              {spec.scenes.map((scene, index) => (
                <div
                  className={`scene-card ${scene.layout === "flyer-end" ? "flyer-scene-card" : ""}`}
                  key={scene.id || index}
                >
                  <div className="scene-card-top">
                    <span className="scene-index">#{index + 1}</span>
                    <select
                      value={
                        scene.type === "tactics"
                          ? "tactics"
                          : scene.layout || "story-clean"
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "tactics") {
                          updateScene(index, { type: "tactics" as SceneType });
                        } else {
                          updateScene(index, {
                            type: "cinematic",
                            layout: val as SceneLayout,
                            sceneMode:
                              val === "flyer-end"
                                ? "editorial"
                                : scene.sceneMode || renderMode,
                          });
                        }
                      }}
                    >
                      <option value="hero-impact">Impacto / Portada</option>
                      <option value="story-clean">Narrativa limpia</option>
                      <option value="split-versus">Duelo / Comparativa</option>
                      <option value="stat-overlay">Dato gigante</option>
                      <option value="quote-press">Titular / Cita</option>
                      <option value="cta-engage">Lista / Beneficios / CTA</option>
                      <option value="flyer-end">Flyer Final (Imagen completa)</option>
                      <option value="tactics">Pizarra táctica (Deportes)</option>
                    </select>

                    <select
                      value={scene.cameraMotion || "zoom-in"}
                      onChange={(e) =>
                        updateScene(index, {
                          cameraMotion: e.target.value as CameraMotion,
                        })
                      }
                      title="Animación de cámara"
                    >
                      <option value="impact-punch">Golpe</option>
                      <option value="zoom-in">Zoom In</option>
                      <option value="zoom-out">Zoom Out</option>
                      <option value="pan-right">Paneo →</option>
                      <option value="pan-left">Paneo ←</option>
                    </select>

                    <input
                      type="number"
                      className="sec-input"
                      min={1}
                      max={45}
                      step={0.5}
                      value={scene.durationSeconds}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!Number.isNaN(val)) {
                          updateScene(index, {
                            durationSeconds: Math.min(45, Math.max(1, val)),
                          });
                        }
                      }}
                    />
                    <span className="unit">s</span>

                    {scene.layout !== "flyer-end" && (
                      <button
                        type="button"
                        className={`icon-btn ${scene.imageUrl ? "active-voice" : ""}`}
                        title="Generar o regenerar imagen IA de esta escena"
                        disabled={sceneImageLoading === index || imagesLoading}
                        onClick={() => regenerateSingleSceneImage(index)}
                      >
                        {sceneImageLoading === index
                          ? h(Loader2, { size: 15, className: "spin" })
                          : h(Wand2, { size: 15 })}
                      </button>
                    )}

                    <button
                      type="button"
                      className={`icon-btn ${scene.audioUrl ? "active-voice" : ""}`}
                      title="Generar o actualizar voz de esta escena"
                      disabled={sceneVoiceLoading === index || voiceLoading}
                      onClick={() => regenerateSingleSceneVoice(index)}
                    >
                      {h(Volume2, { size: 15 })}
                    </button>

                    <label
                      className={`icon-btn ${scene.imageUrl ? "active-voice" : ""}`}
                      title={
                        scene.layout === "flyer-end"
                          ? "Subir imagen del Flyer final"
                          : "Subir tu propia imagen/foto"
                      }
                    >
                      {h(ImageIcon, { size: 15 })}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => handleSceneImageUpload(index, e)}
                      />
                    </label>

                    {scene.layout !== "flyer-end" && (
                      <label
                        className={`icon-btn ${scene.videoUrl ? "active-video" : ""}`}
                        title="Subir tu propio video (.mp4 / .webm / .mov) para esta escena"
                      >
                        {h(VideoIcon, { size: 15 })}
                        <input
                          type="file"
                          accept="video/*"
                          hidden
                          onChange={(e) => handleSceneVideoUpload(index, e)}
                        />
                      </label>
                    )}

                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => removeScene(index)}
                      disabled={spec.scenes.length <= 1}
                    >
                      {h(Trash2, { size: 15 })}
                    </button>
                  </div>

                  {scene.videoUrl && (
                    <div className="video-chip-row">
                      <span className="video-chip-label">
                        {h(VideoIcon, { size: 13 })}
                        <span>{scene.videoName || "Video cargado"}</span>
                      </span>
                      <div className="video-chip-actions">
                        <button
                          type="button"
                          className="mini-chip-btn"
                          onClick={() =>
                            updateScene(index, {
                              videoMuted: scene.videoMuted === false ? true : false,
                            })
                          }
                        >
                          {scene.videoMuted === false
                            ? h(Volume2, { size: 13 })
                            : h(VolumeX, { size: 13 })}
                          <span>
                            {scene.videoMuted === false ? "Con audio" : "Silenciado"}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="mini-chip-btn danger"
                          onClick={() => removeSceneVideo(index)}
                        >
                          {h(Trash2, { size: 13 })}
                          <span>Quitar</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {scene.type !== "tactics" && scene.layout !== "flyer-end" && (
                    <div className="scene-motion-row">
                      <select
                        value={scene.sceneMode || renderMode}
                        onChange={(e) =>
                          updateScene(index, {
                            sceneMode: e.target.value as RenderMode,
                          })
                        }
                        title="Estilo visual de esta escena"
                      >
                        <option value="hybrid">Híbrida</option>
                        <option value="editorial">Editorial (Íconos)</option>
                        <option value="cinematic">Cinematográfica</option>
                      </select>

                      <select
                        value={scene.iconName || "sparkles"}
                        onChange={(e) =>
                          updateScene(index, { iconName: e.target.value })
                        }
                        title="Ícono dinámico de la escena"
                      >
                        {ICON_OPTIONS.map((ic) => (
                          <option key={ic.id} value={ic.id}>
                            {ic.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={scene.transition || "slide-left"}
                        onChange={(e) =>
                          updateScene(index, {
                            transition: e.target.value as TransitionType,
                          })
                        }
                        title="Transición hacia la siguiente escena"
                      >
                        {TRANSITION_OPTIONS.map((tr) => (
                          <option key={tr.id} value={tr.id}>
                            {tr.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <input
                    type="text"
                    value={scene.title}
                    onChange={(e) => updateScene(index, { title: e.target.value })}
                    placeholder="Titular de la escena"
                  />
                  <textarea
                    rows={2}
                    value={scene.subtitle}
                    onChange={(e) =>
                      updateScene(index, { subtitle: e.target.value })
                    }
                    placeholder="Texto narrado y subtítulo en pantalla"
                  />
                  {scene.type !== "tactics" && scene.layout !== "flyer-end" && (
                    <>
                      <input
                        type="text"
                        value={scene.calloutText || ""}
                        onChange={(e) =>
                          updateScene(index, { calloutText: e.target.value })
                        }
                        placeholder="Etiqueta dinámica a mitad de escena (ej. PRESTACIONES DE LEY)"
                        className="callout-input"
                      />
                      <input
                        type="text"
                        value={scene.imagePrompt || ""}
                        onChange={(e) =>
                          updateScene(index, { imagePrompt: e.target.value })
                        }
                        placeholder="Prompt visual de la escena (puedes editarlo y pulsar la varita mágica)"
                        className="prompt-input"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="preview-panel">
          <div className="phone-frame">
            {h(RemotionPlayer, {
              component: DynamicVideo,
              inputProps: { spec, audioUrl },
              durationInFrames: totalFrames,
              fps: FPS,
              compositionWidth: 1080,
              compositionHeight: 1920,
              controls: true,
              loop: true,
              style: { width: "100%", height: "100%" },
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
