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
} from "lucide-react";
import { DynamicVideo } from "./remotion/DynamicVideo";
import { DEFAULT_VIDEO_SPEC } from "./defaultVideo";
import { SceneType, VideoScene, VideoSpec } from "./types";

const FPS = 30;

type GenerateResponse = Partial<VideoSpec> & {
  error?: string;
  errorMessage?: string;
  message?: string;
};

export function App() {
  const [spec, setSpec] = useState<VideoSpec>(DEFAULT_VIDEO_SPEC);
  const [prompt, setPrompt] = useState("");
  const [targetDuration, setTargetDuration] = useState(35);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/.netlify/functions/generate-video", {
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

      setSpec(data as VideoSpec);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión con Gemini.");
    } finally {
      setLoading(false);
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
    const blob = new Blob([JSON.stringify(spec, null, 2)], {
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
              <button type="submit" className="btn-primary" disabled={loading}>
                <Sparkles size={16} />
                {loading ? "Generando..." : "Crear video"}
              </button>
            </div>
            {error && <div className="error-banner">{error}</div>}
          </form>

          <div className="card">
            <div className="card-title">
              <Mic size={16} />
              <span>Tu voz en off (Audio local)</span>
            </div>
            <div className="audio-row">
              <label className="btn-secondary file-label">
                <Upload size={15} />
                <span>{audioName ? "Cambiar audio" : "Subir .mp3 / .wav"}</span>
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
                      max={20}
                      value={scene.durationSeconds}
                      onChange={(e) =>
                        updateScene(index, {
                          durationSeconds: Math.max(2, Number(e.target.value)),
                        })
                      }
                    />
                    <span className="unit">s</span>
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
                    placeholder="Subtítulo en pantalla"
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
