import React, { useMemo, useState } from "react";
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
} from "lucide-react";
import { DynamicVideo } from "./remotion/DynamicVideo";
import { DEFAULT_VIDEO_SPEC } from "./defaultVideo";
import { SceneType, VideoScene, VideoSpec } from "./types";

const FPS = 30;

const VOICE_OPTIONS = [
  { id: "es-MX-JorgeNeural", label: "Jorge · México (Masculino)" },
  { id: "es-MX-DaliaNeural", label: "Dalia · México (Femenino)" },
  { id: "es-ES-AlvaroNeural", label: "Álvaro · España (Masculino)" },
  { id: "es-AR-TomasNeural", label: "Tomás · Argentina (Masculino)" },
];

const SPEED_OPTIONS = [
  { value: 1.0, label: "1.0x Normal" },
  { value: 1.15, label: "1.15x Ágil" },
  { value: 1.25, label: "1.25x Reels / TikTok" },
  { value: 1.35, label: "1.35x Rápida" },
  { value: 1.5, label: "1.5x Muy rápida" },
];

type GenerateResponse = Partial<VideoSpec> & {
  error?: string;
  errorMessage?: string;
  message?: string;
};

type TtsResponse = {
  audioBase64?: string;
  mimeType?: string;
  provider?: string;
  error?: string;
};

function calcDuration(rawAudioDuration: number, speed: number): number {
  return Math.max(2, Math.ceil((rawAudioDuration / speed + 0.3) * 10) / 10);
}

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

function measureAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new window.Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 5;
      resolve(duration);
    };
    audio.onerror = () => resolve(5);
    audio.src = url;
  });
}

async function fetchSceneVoice(
  text: string,
  voice: string,
  speed: number
): Promise<{
  audioUrl: string;
  rawAudioDuration: number;
  durationSeconds: number;
  provider: string;
}> {
  const res = await fetch("/.netlify/functions/generate-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });

  const data: TtsResponse = await res.json();
  if (!res.ok || !data.audioBase64) {
    throw new Error(data.error || "No se pudo generar el audio de la escena.");
  }

  const audioUrl = base64ToBlobUrl(data.audioBase64, data.mimeType || "audio/mpeg");
  const rawAudioDuration = await measureAudioDuration(audioUrl);
  const durationSeconds = calcDuration(rawAudioDuration, speed);

  return {
    audioUrl,
    rawAudioDuration,
    durationSeconds,
    provider: data.provider || "edge-tts",
  };
}

export function App() {
  const [spec, setSpec] = useState<VideoSpec>({
    ...DEFAULT_VIDEO_SPEC,
    voiceSpeed: 1.25,
  });
  const [prompt, setPrompt] = useState("");
  const [targetDuration, setTargetDuration] = useState(35);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [voice, setVoice] = useState("es-MX-JorgeNeural");
  const [voiceSpeed, setVoiceSpeed] = useState(1.25);
  const [voiceProvider, setVoiceProvider] = useState<string | null>(null);
  const [autoVoice, setAutoVoice] = useState(true);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [sceneVoiceLoading, setSceneVoiceLoading] = useState<number | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);

  const totalFrames = useMemo(() => {
    const frames = spec.scenes.reduce(
      (acc, scene) => acc + Math.max(30, Math.round((scene.durationSeconds || 5) * FPS)),
      0
    );
    return Math.max(30, frames);
  }, [spec]);

  const totalSeconds = (totalFrames / FPS).toFixed(1);

  const syncedScenesCount = useMemo(
    () => spec.scenes.filter((s) => Boolean(s.audioUrl)).length,
    [spec]
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
              durationSeconds: calcDuration(scene.rawAudioDuration, newSpeed),
            }
          : scene
      ),
    }));
  };

  const generateAllVoices = async (
    targetSpec: VideoSpec,
    selectedVoice = voice,
    selectedSpeed = voiceSpeed
  ) => {
    setVoiceLoading(true);
    setVoiceError(null);

    try {
      let lastProvider = "edge-tts";
      const updatedScenes = await Promise.all(
        targetSpec.scenes.map(async (scene) => {
          const textToSpeak = (scene.subtitle || scene.title || "").trim();
          if (!textToSpeak) return scene;
          const result = await fetchSceneVoice(
            textToSpeak,
            selectedVoice,
            selectedSpeed
          );
          lastProvider = result.provider;
          if (scene.audioUrl && scene.audioUrl.startsWith("blob:")) {
            URL.revokeObjectURL(scene.audioUrl);
          }
          return {
            ...scene,
            audioUrl: result.audioUrl,
            rawAudioDuration: result.rawAudioDuration,
            durationSeconds: result.durationSeconds,
          };
        })
      );

      setVoiceProvider(lastProvider);
      setSpec({
        ...targetSpec,
        voiceSpeed: selectedSpeed,
        scenes: updatedScenes,
      });
    } catch (err) {
      setVoiceError(
        err instanceof Error ? err.message : "Error al generar las voces con IA."
      );
    } finally {
      setVoiceLoading(false);
    }
  };

  const regenerateSingleSceneVoice = async (index: number) => {
    const scene = spec.scenes[index];
    const textToSpeak = (scene?.subtitle || scene?.title || "").trim();
    if (!scene || !textToSpeak) return;

    setSceneVoiceLoading(index);
    setVoiceError(null);

    try {
      const result = await fetchSceneVoice(textToSpeak, voice, voiceSpeed);
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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setLoadingStep("Creando guion con Gemini...");
    setError(null);
    setVoiceError(null);

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

      const generatedSpec: VideoSpec = {
        ...(data as VideoSpec),
        voiceSpeed,
      };
      setSpec(generatedSpec);

      if (autoVoice && !audioUrl) {
        setLoadingStep("Generando voz sincronizada...");
        await generateAllVoices(generatedSpec, voice, voiceSpeed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión con Gemini.");
    } finally {
      setLoading(false);
      setLoadingStep("");
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
    updateScene(index, { imageUrl: url });
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
      type: "headline",
      durationSeconds: 5,
      badge: "NUEVA ESCENA",
      title: "TITULAR",
      subtitle: "Texto narrado para esta escena.",
      highlightValue: "100%",
      stampText: "CLAVE",
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
        ({ audioUrl: _a, rawAudioDuration: _r, ...rest }) => rest
      ),
    };
    const blob = new Blob([JSON.stringify(cleanSpec, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "video"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div className="brand">
          <Film size={20} />
          <span>Barça Video Studio AI</span>
        </div>
        <div className="header-actions">
          <span className="pill">{totalSeconds}s · 9:16</span>
          <button type="button" className="btn-secondary" onClick={downloadJson}>
            <Download size={16} />
            JSON
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled
            title="Lo conectaremos con GitHub Actions en el siguiente paso"
          >
            Exportar MP4 (Siguiente paso)
          </button>
        </div>
      </header>

      <main className="studio-grid">
        <section className="editor-panel">
          <form className="card" onSubmit={handleGenerate}>
            <div className="card-title">
              <Sparkles size={16} />
              <span>Generar estructura con Gemini</span>
            </div>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: Crea un video de 40 segundos sobre la remontada del 6-1 del Barça al PSG, explicando la presión alta y el gol de Sergi Roberto..."
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
              <button type="submit" className="btn-primary" disabled={loading || voiceLoading}>
                <Sparkles size={16} />
                {loading ? loadingStep || "Generando..." : "Crear video"}
              </button>
            </div>
            {error && <div className="error-banner">{error}</div>}
          </form>

          <div className="card">
            <div className="card-header-between">
              <div className="card-title">
                <Volume2 size={16} />
                <span>Voz en off (IA sincronizada o audio propio)</span>
              </div>
              {!audioUrl && syncedScenesCount > 0 && (
                <span className="status-badge">
                  {voiceProvider === "google-tts" ? "Respaldo" : "Edge Neural"} ·{" "}
                  {voiceSpeed}x ({syncedScenesCount}/{spec.scenes.length})
                </span>
              )}
              {audioUrl && <span className="status-badge">Usando tu audio</span>}
            </div>

            <div className="voice-controls">
              <select value={voice} onChange={(e) => setVoice(e.target.value)}>
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
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

              <button
                type="button"
                className="btn-primary"
                disabled={voiceLoading || loading}
                onClick={() => generateAllVoices(spec, voice, voiceSpeed)}
              >
                <Volume2 size={15} />
                {voiceLoading ? "Generando voz..." : "Generar voz IA"}
              </button>
            </div>

            <div className="audio-row">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={autoVoice}
                  onChange={(e) => setAutoVoice(e.target.checked)}
                />
                <span>Generar voz IA automáticamente al crear video</span>
              </label>
            </div>

            <div className="audio-row">
              <label className="btn-secondary file-label">
                <Mic size={15} />
                <Upload size={14} />
                <span>{audioName ? "Cambiar mi voz" : "Subir mi voz (.mp3 / .wav)"}</span>
                <input type="file" accept="audio/*" hidden onChange={handleAudioUpload} />
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
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
            {voiceError && <div className="error-banner">{voiceError}</div>}
          </div>

          <div className="card">
            <div className="card-header-between">
              <div className="card-title">
                <span>Escenas ({spec.scenes.length})</span>
              </div>
              <button type="button" className="btn-secondary" onClick={addScene}>
                <Plus size={15} />
                Añadir escena
              </button>
            </div>

            <div className="scene-list">
              {spec.scenes.map((scene, index) => (
                <div className="scene-card" key={scene.id || index}>
                  <div className="scene-card-top">
                    <span className="scene-index">#{index + 1}</span>
                    <select
                      value={scene.type}
                      onChange={(e) =>
                        updateScene(index, { type: e.target.value as SceneType })
                      }
                    >
                      <option value="hook">Portada (Hook)</option>
                      <option value="tactics">Pizarra táctica</option>
                      <option value="versus">Comparativa (VS)</option>
                      <option value="headline">Dato / Titular</option>
                      <option value="cta">Cierre (CTA)</option>
                    </select>
                    <input
                      type="number"
                      className="sec-input"
                      min={2}
                      max={25}
                      step={0.5}
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
                      className={`icon-btn ${scene.audioUrl ? "active-voice" : ""}`}
                      title="Generar o actualizar voz de esta escena"
                      disabled={sceneVoiceLoading === index || voiceLoading}
                      onClick={() => regenerateSingleSceneVoice(index)}
                    >
                      <Volume2 size={15} />
                    </button>
                    <label className="icon-btn" title="Añadir ilustración/imagen">
                      <ImageIcon size={15} />
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
                      <Trash2 size={15} />
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
                    onChange={(e) => updateScene(index, { subtitle: e.target.value })}
                    placeholder="Texto narrado y subtítulo en pantalla"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="preview-panel">
          <div className="phone-frame">
            <Player
              component={DynamicVideo}
              inputProps={{ spec, audioUrl }}
              durationInFrames={totalFrames}
              fps={FPS}
              compositionWidth={1080}
              compositionHeight={1920}
              controls
              loop
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
