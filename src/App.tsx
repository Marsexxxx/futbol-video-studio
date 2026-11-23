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
  Loader2,
  CheckCircle2,
  ExternalLink,
  Wand2,
} from "lucide-react";
import { DynamicVideo, SCENE_LEAD_IN_FRAMES } from "./remotion/DynamicVideo";
import { DEFAULT_VIDEO_SPEC } from "./defaultVideo";
import {
  CameraMotion,
  SceneLayout,
  SceneType,
  SubtitleStyle,
  VideoScene,
  VideoSpec,
  VisualStyle,
} from "./types";

const h = React.createElement;
const RemotionPlayer = Player as React.ComponentType<any>;

const FPS = 30;
const LEAD_IN_SEC = SCENE_LEAD_IN_FRAMES / FPS;
const TAIL_PAUSE_SEC = 0.75;

const VOICE_OPTIONS = [
  { id: "Fenrir", label: "Fenrir · Energético (Deportes)" },
  { id: "Puck", label: "Puck · Dinámico y juvenil" },
  { id: "Charon", label: "Charon · Grave y analítico" },
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
  { id: "analyst", label: "Estilo Analista táctico" },
  { id: "hype", label: "Estilo Narrador intenso" },
];

const VISUAL_STYLE_OPTIONS: { id: VisualStyle; label: string }[] = [
  { id: "photoreal", label: "Visual: Fotorrealista cinematográfico" },
  { id: "hyperart", label: "Visual: Arte deportivo hiperrealista" },
  { id: "editorial3d", label: "Visual: 3D Cinematográfico" },
];

const SPEED_OPTIONS = [
  { value: 0.95, label: "0.95x Pausada" },
  { value: 1.0, label: "1.0x Natural (Recomendada)" },
  { value: 1.1, label: "1.1x Ágil" },
  { value: 1.2, label: "1.2x Rápida" },
  { value: 1.3, label: "1.3x Muy rápida" },
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

function calcSceneDuration(rawAudioDuration: number, speed: number): number {
  const total = LEAD_IN_SEC + rawAudioDuration / speed + TAIL_PAUSE_SEC;
  return Number(Math.max(2.5, Math.ceil(total * 20) / 20).toFixed(2));
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
  if (lower.includes("mp4") || lower.includes("m4a")) return "m4a";
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  return fallback;
}

async function blobUrlToAsset(
  url: string,
  fallbackExt: string
): Promise<{ base64: string; ext: string }> {
  const res = await fetch(url);
  const blob = await res.blob();
  const buffer = await blob.arrayBuffer();
  return {
    base64: bytesToBase64(new Uint8Array(buffer)),
    ext: mimeToExt(blob.type, fallbackExt),
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
  speed: number
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
  const durationSeconds = calcSceneDuration(rawAudioDuration, speed);

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
    `Cinematic vertical sports scene representing: ${scene.title}. ${scene.subtitle}`
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
  const [spec, setSpec] = useState<VideoSpec>({
    ...DEFAULT_VIDEO_SPEC,
    voiceSpeed: 1.0,
    subtitleStyle: "dynamic",
  });
  const [prompt, setPrompt] = useState("");
  const [targetDuration, setTargetDuration] = useState(35);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [voice, setVoice] = useState("Fenrir");
  const [accent, setAccent] = useState("es-MX");
  const [voiceStyle, setVoiceStyle] = useState("tiktok");
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("dynamic");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("photoreal");
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

  const totalFrames = useMemo(() => {
    const frames = spec.scenes.reduce(
      (acc, scene) =>
        acc + Math.max(30, Math.ceil((scene.durationSeconds || 5) * FPS)),
      0
    );
    return Math.max(30, frames);
  }, [spec]);

  const totalSeconds = (totalFrames / FPS).toFixed(1);

  const syncedScenesCount = useMemo(
    () => spec.scenes.filter((s) => Boolean(s.audioUrl)).length,
    [spec]
  );

  const imagesReadyCount = useMemo(
    () => spec.scenes.filter((s) => Boolean(s.imageUrl)).length,
    [spec]
  );

  const videoSlug = useMemo(
    () =>
      (spec.title || "video-barca")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "video-barca",
    [spec.title]
  );

  const handleSpeedChange = (newSpeed: number) => {
    setVoiceSpeed(newSpeed);
    setSpec((prev) => ({
      ...prev,
      voiceSpeed: newSpeed,
      scenes: prev.scenes.map((scene) =>
        scene.rawAudioDuration
          ? {
              ...scene,
              durationSeconds: calcSceneDuration(scene.rawAudioDuration, newSpeed),
            }
          : scene
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
      scenes: updatedScenes,
    };

    try {
      let lastProvider = "gemini-3.8-flash-lite-tts";

      for (let i = 0; i < updatedScenes.length; i++) {
        const scene = updatedScenes[i];
        const textToSpeak = (scene.subtitle || scene.title || "").trim();
        if (!textToSpeak) continue;

        setVoiceProgress(`Voz ${i + 1}/${updatedScenes.length}...`);
        const result = await fetchSceneVoice(
          textToSpeak,
          selectedVoice,
          selectedAccent,
          selectedStyle,
          selectedSpeed
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
    selectedVisualStyle = visualStyle
  ): Promise<VideoSpec> => {
    setImagesLoading(true);
    setImageError(null);
    const updatedScenes = [...targetSpec.scenes];
    let latestSpec: VideoSpec = { ...targetSpec, scenes: updatedScenes };

    try {
      let lastProvider = "gemini-image";

      for (let i = 0; i < updatedScenes.length; i++) {
        const scene = updatedScenes[i];
        if (scene.type === "tactics") continue;

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
      const result = await fetchSceneVoice(
        textToSpeak,
        voice,
        accent,
        voiceStyle,
        voiceSpeed
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
    if (!scene) return;

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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setLoadingStep("Creando guion y dirección visual...");
    setError(null);
    setVoiceError(null);
    setImageError(null);

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, durationSeconds: targetDuration }),
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
      };
      setSpec(currentSpec);

      if (autoImages) {
        setLoadingStep("Generando imágenes realistas 9:16...");
        currentSpec = await generateAllImages(currentSpec, visualStyle);
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

      let globalAudioKey: string | undefined;
      if (audioUrl && audioUrl.startsWith("blob:")) {
        globalAudioKey = "global-audio";
        assets[globalAudioKey] = await blobUrlToAsset(audioUrl, "mp3");
      }

      const exportScenes: VideoScene[] = [];
      for (let i = 0; i < spec.scenes.length; i++) {
        const s = spec.scenes[i];
        const copy: VideoScene = { ...s };

        if (!globalAudioKey && s.audioUrl && s.audioUrl.startsWith("blob:")) {
          const key = `scene-audio-${i}`;
          assets[key] = await blobUrlToAsset(s.audioUrl, "wav");
          copy.audioAssetKey = key;
        }
        delete copy.audioUrl;

        if (s.imageUrl && s.imageUrl.startsWith("blob:")) {
          const key = `scene-image-${i}`;
          assets[key] = await blobUrlToAsset(s.imageUrl, "jpg");
          copy.imageAssetKey = key;
          delete copy.imageUrl;
        }

        exportScenes.push(copy);
      }

      const exportSpec: VideoSpec = {
        ...spec,
        voiceSpeed,
        subtitleStyle,
        globalAudioKey,
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
    const url = URL.createObjectURL(file);
    updateScene(index, { type: "cinematic", imageUrl: url });
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
      layout: "story-clean",
      cameraMotion: "zoom-in",
      durationSeconds: 5,
      badge: "NUEVA ESCENA",
      title: "TITULAR",
      subtitle: "Texto narrado para esta escena.",
      imagePrompt:
        "Dramatic vertical football stadium atmosphere at night under floodlights, realistic sports photography",
    };
    setSpec((prev) => ({ ...prev, scenes: [...prev.scenes, newScene] }));
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
        ({ audioUrl: _a, rawAudioDuration: _r, imageUrl: _i, ...rest }) => rest
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
          <span>Barça Video Studio AI</span>
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
                "Empaquetando imágenes, subtítulos y audio para renderizar..."}
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
          <form className="card" onSubmit={handleGenerate}>
            <div className="card-title">
              {h(Sparkles, { size: 16 })}
              <span>Generar video completo con Gemini</span>
            </div>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: Duelo épico entre Lamine Yamal y Kylian Mbappé en El Clásico, con escenas realistas en el estadio, tensión en el túnel y cierre preguntando quién es el nuevo rey..."
            />
            <div className="form-row">
              <label className="duration-field">
                <span>Duración objetivo</span>
                <input
                  type="number"
                  min={15}
                  max={90}
                  value={targetDuration}
                  onChange={(e) => setTargetDuration(Number(e.target.value))}
                />
                <span>seg</span>
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

          <div className="card">
            <div className="card-header-between">
              <div className="card-title">
                {h(Wand2, { size: 16 })}
                <span>Visuales IA, voz y subtítulos</span>
              </div>
              <div className="badge-group">
                {imagesReadyCount > 0 && (
                  <span className="status-badge">
                    {imageProvider ? "IA Visual" : "Imágenes"} ({imagesReadyCount}/
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
                onClick={() => generateAllImages(spec, visualStyle)}
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
                <span>Generar imágenes IA al crear video</span>
              </label>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={autoVoice}
                  onChange={(e) => setAutoVoice(e.target.checked)}
                />
                <span>Generar voz IA al crear video</span>
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
              <button type="button" className="btn-secondary" onClick={addScene}>
                {h(Plus, { size: 15 })}
                Añadir escena
              </button>
            </div>

            <div className="scene-list">
              {spec.scenes.map((scene, index) => (
                <div className="scene-card" key={scene.id || index}>
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
                          });
                        }
                      }}
                    >
                      <option value="hero-impact">Impacto / Portada</option>
                      <option value="story-clean">Cinematográfica limpia</option>
                      <option value="split-versus">Duelo / Cara a cara</option>
                      <option value="stat-overlay">Dato gigante</option>
                      <option value="quote-press">Titular / Polémica</option>
                      <option value="cta-engage">Cierre / Pregunta</option>
                      <option value="tactics">Pizarra táctica</option>
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
                      min={2}
                      max={30}
                      step={0.1}
                      value={scene.durationSeconds}
                      onChange={(e) =>
                        updateScene(index, {
                          durationSeconds: Math.max(2, Number(e.target.value)),
                        })
                      }
                    />
                    <span className="unit">s</span>

                    <button
                      type="button"
                      className={`icon-btn ${scene.imageUrl ? "active-voice" : ""}`}
                      title="Generar o regenerar imagen realista IA de esta escena"
                      disabled={sceneImageLoading === index || imagesLoading}
                      onClick={() => regenerateSingleSceneImage(index)}
                    >
                      {sceneImageLoading === index
                        ? h(Loader2, { size: 15, className: "spin" })
                        : h(Wand2, { size: 15 })}
                    </button>

                    <button
                      type="button"
                      className={`icon-btn ${scene.audioUrl ? "active-voice" : ""}`}
                      title="Generar o actualizar voz de esta escena"
                      disabled={sceneVoiceLoading === index || voiceLoading}
                      onClick={() => regenerateSingleSceneVoice(index)}
                    >
                      {h(Volume2, { size: 15 })}
                    </button>

                    <label className="icon-btn" title="Subir tu propia imagen/foto">
                      {h(ImageIcon, { size: 15 })}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => handleSceneImageUpload(index, e)}
                      />
                    </label>

                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => removeScene(index)}
                      disabled={spec.scenes.length <= 1}
                    >
                      {h(Trash2, { size: 15 })}
                    </button>
                  </div>

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
                  {scene.type !== "tactics" && (
                    <input
                      type="text"
                      value={scene.imagePrompt || ""}
                      onChange={(e) =>
                        updateScene(index, { imagePrompt: e.target.value })
                      }
                      placeholder="Prompt visual de la escena (puedes editarlo y pulsar la varita mágica)"
                      className="prompt-input"
                    />
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
