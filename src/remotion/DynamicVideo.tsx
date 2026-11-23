import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CameraMotion,
  SceneLayout,
  SubtitleStyle,
  VideoScene,
  VideoSpec,
  VideoTheme,
} from "../types";

const h = React.createElement;

export const SCENE_LEAD_IN_FRAMES = 6;

export type DynamicVideoProps = {
  spec: VideoSpec;
  audioUrl?: string | null;
};

type WordTiming = {
  text: string;
  start: number;
  end: number;
};

type SubtitleChunk = {
  words: WordTiming[];
  start: number;
  end: number;
};

type SceneCommonProps = {
  scene: VideoScene;
  theme: VideoTheme;
  voiceSpeed: number;
  subtitleStyle: SubtitleStyle;
  sceneIndex: number;
};

const resolveMediaSrc = (src?: string | null): string | undefined => {
  if (!src) return undefined;
  if (
    src.startsWith("blob:") ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:")
  ) {
    return src;
  }
  return staticFile(src);
};

const buildWordChunks = (
  text: string,
  startFrame: number,
  speechFrames: number
): SubtitleChunk[] => {
  const rawWords = text.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  const weights = rawWords.map((word) => {
    const cleanLen = word.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]/g, "").length;
    const punctBonus = /[.,;!?]$/.test(word) ? 3 : 0;
    return Math.max(2, cleanLen) + 1.5 + punctBonus;
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  let cursor = startFrame;

  const timedWords: WordTiming[] = rawWords.map((word, idx) => {
    const dur = (weights[idx] / totalWeight) * speechFrames;
    const item: WordTiming = {
      text: word,
      start: cursor,
      end: cursor + dur,
    };
    cursor += dur;
    return item;
  });

  const chunks: SubtitleChunk[] = [];
  let bucket: WordTiming[] = [];
  let bucketChars = 0;

  for (const item of timedWords) {
    const nextChars =
      bucketChars + item.text.length + (bucket.length > 0 ? 1 : 0);
    if (bucket.length > 0 && (bucket.length >= 4 || nextChars > 24)) {
      chunks.push({
        words: bucket,
        start: bucket[0].start,
        end: bucket[bucket.length - 1].end,
      });
      bucket = [item];
      bucketChars = item.text.length;
    } else {
      bucket.push(item);
      bucketChars = nextChars;
    }
  }

  if (bucket.length > 0) {
    chunks.push({
      words: bucket,
      start: bucket[0].start,
      end: bucket[bucket.length - 1].end,
    });
  }

  return chunks;
};

const SceneTransition: React.FC<{
  children?: React.ReactNode;
  isFirst: boolean;
}> = ({ children, isFirst }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const fadeIn = isFirst
    ? 1
    : interpolate(frame, [0, 7], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  const entryScale = isFirst
    ? 1
    : interpolate(frame, [0, 10], [1.05, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      });

  const fadeOut = interpolate(
    frame,
    [Math.max(0, durationInFrames - 6), durationInFrames],
    [1, 0.85],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return h(
    AbsoluteFill,
    {
      style: {
        opacity: Math.min(fadeIn, fadeOut),
        transform: `scale(${entryScale})`,
      },
    },
    children
  );
};

const ClassicSubtitle: React.FC<{ text: string; accent: string }> = ({
  text,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 18, stiffness: 160 },
  });

  if (!text) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 94,
        left: 52,
        right: 52,
        backgroundColor: "rgba(5, 10, 20, 0.82)",
        borderLeft: `8px solid ${accent}`,
        borderRadius: 20,
        padding: "24px 30px",
        textAlign: "center",
        fontSize: 38,
        fontWeight: 800,
        color: "#FFFFFF",
        lineHeight: 1.28,
        boxShadow: "0 16px 38px rgba(0, 0, 0, 0.5)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [18, 0])}px)`,
      }}
    >
      {text}
    </div>
  );
};

const DynamicSubtitle: React.FC<{
  scene: VideoScene;
  accent: string;
  voiceSpeed: number;
}> = ({ scene, accent, voiceSpeed }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  if (!scene.subtitle?.trim()) return null;

  const speechFrames = scene.rawAudioDuration
    ? Math.max(15, (scene.rawAudioDuration / (voiceSpeed || 1)) * fps)
    : Math.max(20, durationInFrames - SCENE_LEAD_IN_FRAMES - 18);

  const chunks = buildWordChunks(
    scene.subtitle,
    SCENE_LEAD_IN_FRAMES,
    speechFrames
  );

  if (chunks.length === 0) return null;

  let activeChunkIndex = chunks.findIndex(
    (c) => frame >= c.start && frame < c.end
  );
  if (activeChunkIndex === -1) {
    activeChunkIndex = frame < chunks[0].start ? 0 : chunks.length - 1;
  }

  const activeChunk = chunks[activeChunkIndex];
  const chunkFrame = Math.max(0, frame - Math.floor(activeChunk.start));
  const chunkPop = spring({
    frame: chunkFrame,
    fps,
    config: { damping: 14, stiffness: 220 },
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 112,
        left: 42,
        right: 42,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "10px 14px",
          maxWidth: "100%",
          fontFamily: "system-ui, -apple-system, sans-serif",
          transform: `translateY(${interpolate(chunkPop, [0, 1], [14, 0])}px) scale(${interpolate(chunkPop, [0, 1], [0.94, 1])})`,
        }}
      >
        {activeChunk.words.map((word, idx) => {
          const isCurrent = frame >= word.start && frame < word.end;
          const isSpoken = frame >= word.end;
          const wordSpring = isCurrent
            ? spring({
                frame: Math.max(0, frame - Math.floor(word.start)),
                fps,
                config: { damping: 12, stiffness: 280 },
              })
            : 0;

          return (
            <span
              key={`${activeChunkIndex}-${idx}`}
              style={{
                display: "inline-block",
                fontSize: 54,
                fontWeight: 900,
                letterSpacing: -0.6,
                lineHeight: 1.12,
                padding: isCurrent ? "6px 18px" : "6px 8px",
                borderRadius: 16,
                backgroundColor: isCurrent ? accent : "rgba(6, 12, 24, 0.55)",
                color: isCurrent
                  ? "#07111F"
                  : isSpoken
                  ? "#FFFFFF"
                  : "rgba(255, 255, 255, 0.72)",
                transform: isCurrent
                  ? `scale(${interpolate(wordSpring, [0, 1], [0.9, 1.1])})`
                  : "scale(1)",
                textShadow: isCurrent
                  ? "none"
                  : "0 4px 16px rgba(0, 0, 0, 0.9)",
                boxShadow: isCurrent
                  ? "0 10px 26px rgba(0, 0, 0, 0.45)"
                  : "none",
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const SceneSubtitle: React.FC<{
  scene: VideoScene;
  accent: string;
  voiceSpeed: number;
  subtitleStyle: SubtitleStyle;
}> = ({ scene, accent, voiceSpeed, subtitleStyle }) => {
  if (subtitleStyle === "classic") {
    return h(ClassicSubtitle, { text: scene.subtitle, accent });
  }
  return h(DynamicSubtitle, { scene, accent, voiceSpeed });
};

const AnimatedBackdrop: React.FC<{
  imgSrc?: string;
  theme: VideoTheme;
  motion: CameraMotion;
  sceneIndex: number;
}> = ({ imgSrc, theme, motion, sceneIndex }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let scale = 1.08;
  let tx = 0;
  let ty = 0;

  if (motion === "zoom-in") {
    scale = interpolate(progress, [0, 1], [1.02, 1.18]);
    ty = interpolate(progress, [0, 1], [0, -18]);
  } else if (motion === "zoom-out") {
    scale = interpolate(progress, [0, 1], [1.2, 1.03]);
    ty = interpolate(progress, [0, 1], [-14, 10]);
  } else if (motion === "pan-left") {
    scale = 1.15;
    tx = interpolate(progress, [0, 1], [48, -48]);
  } else if (motion === "pan-right") {
    scale = 1.15;
    tx = interpolate(progress, [0, 1], [-48, 48]);
  } else if (motion === "impact-punch") {
    const punch = interpolate(frame, [0, 12], [1.24, 1.06], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.exp),
    });
    const slowDrift = interpolate(progress, [0, 1], [0, 0.08]);
    scale = punch + slowDrift;
    tx = frame < 10 ? Math.sin(frame * 2.8) * (10 - frame) * 1.4 : 0;
    ty = frame < 10 ? Math.cos(frame * 2.2) * (10 - frame) * 1.1 : 0;
  }

  const flashOpacity =
    motion === "impact-punch"
      ? interpolate(frame, [0, 9], [0.5, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  const sweepX = interpolate(progress, [0, 1], [-500, 1450]);
  const orbX = 240 + Math.sin(frame * 0.03 + sceneIndex) * 180;
  const orbY = 620 + Math.cos(frame * 0.025 + sceneIndex) * 140;

  return h(
    AbsoluteFill,
    {
      style: {
        backgroundColor: theme.bgColor,
        overflow: "hidden",
      },
    },
    imgSrc
      ? h(Img, {
          src: imgSrc,
          style: {
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
          },
        })
      : h(AbsoluteFill, {
          style: {
            background: `radial-gradient(circle at ${orbX}px ${orbY}px, ${theme.primaryColor} 0%, ${theme.bgColor} 58%, ${theme.secondaryColor} 100%)`,
            transform: `scale(${scale})`,
          },
        }),
    h(AbsoluteFill, {
      style: {
        background:
          "linear-gradient(180deg, rgba(4,9,20,0.78) 0%, rgba(4,9,20,0.18) 28%, rgba(4,9,20,0.06) 54%, rgba(4,9,20,0.86) 100%)",
      },
    }),
    <div
      style={{
        position: "absolute",
        top: -200,
        left: sweepX,
        width: 240,
        height: 2400,
        background:
          "linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)",
        transform: "rotate(18deg)",
        pointerEvents: "none",
      }}
    />,
    <div
      style={{
        position: "absolute",
        top: 28,
        left: 44,
        right: 44,
        height: 6,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.22)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: "100%",
          backgroundColor: theme.accentColor,
        }}
      />
    </div>,
    flashOpacity > 0
      ? h(AbsoluteFill, {
          style: {
            backgroundColor: "#FFFFFF",
            opacity: flashOpacity,
            pointerEvents: "none",
          },
        })
      : null
  );
};

const inferLayout = (scene: VideoScene): SceneLayout => {
  if (scene.layout) return scene.layout;
  if (scene.type === "hook") return "hero-impact";
  if (scene.type === "versus") return "split-versus";
  if (scene.type === "headline") return "stat-overlay";
  if (scene.type === "cta") return "cta-engage";
  return "story-clean";
};

const inferMotion = (scene: VideoScene, index: number): CameraMotion => {
  if (scene.cameraMotion) return scene.cameraMotion;
  const cycle: CameraMotion[] = [
    "impact-punch",
    "zoom-in",
    "pan-right",
    "zoom-out",
    "pan-left",
  ];
  return cycle[index % cycle.length];
};

const SceneCinematic: React.FC<SceneCommonProps> = ({
  scene,
  theme,
  voiceSpeed,
  subtitleStyle,
  sceneIndex,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = inferLayout(scene);
  const motion = inferMotion(scene, sceneIndex);
  const imgSrc = resolveMediaSrc(scene.imageUrl);

  const titleSpring = spring({
    frame: Math.max(0, frame - 2),
    fps,
    config: { damping: 14, stiffness: 170 },
  });
  const detailSpring = spring({
    frame: Math.max(0, frame - 14),
    fps,
    config: { damping: 13, stiffness: 180 },
  });

  const leftTarget = Math.min(100, Math.max(1, scene.leftValue ?? 50));
  const rightTarget = Math.min(100, Math.max(1, scene.rightValue ?? 50));
  const leftAnim = interpolate(frame, [12, 54], [0, leftTarget], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const rightAnim = interpolate(frame, [12, 54], [0, rightTarget], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return h(
    AbsoluteFill,
    {
      style: {
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#FFFFFF",
      },
    },
    h(AnimatedBackdrop, { imgSrc, theme, motion, sceneIndex }),
    layout === "hero-impact" ? (
      <div
        style={{
          position: "absolute",
          top: 86,
          left: 52,
          right: 52,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            padding: "10px 28px",
            borderRadius: 999,
            backgroundColor: theme.secondaryColor,
            color: "#FFFFFF",
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: 4,
            marginBottom: 22,
            boxShadow: "0 10px 26px rgba(0,0,0,0.45)",
            opacity: titleSpring,
            transform: `translateY(${interpolate(titleSpring, [0, 1], [-24, 0])}px)`,
          }}
        >
          {scene.badge}
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 88,
            fontWeight: 900,
            lineHeight: 0.98,
            letterSpacing: -2,
            textTransform: "uppercase",
            textShadow: "0 10px 32px rgba(0,0,0,0.85)",
            transform: `scale(${interpolate(titleSpring, [0, 1], [1.18, 1])})`,
            opacity: titleSpring,
          }}
        >
          {scene.title}
        </h1>
        <div
          style={{
            marginTop: 22,
            height: 8,
            width: interpolate(detailSpring, [0, 1], [0, 260]),
            borderRadius: 999,
            backgroundColor: theme.accentColor,
            boxShadow: `0 0 24px ${theme.accentColor}`,
          }}
        />
      </div>
    ) : null,
    layout === "story-clean" ? (
      <div
        style={{
          position: "absolute",
          top: 82,
          left: 52,
          right: 52,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 22px",
            borderRadius: 12,
            backgroundColor: "rgba(6, 12, 24, 0.72)",
            borderLeft: `6px solid ${theme.accentColor}`,
            color: theme.accentColor,
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: 3,
            marginBottom: 18,
            opacity: titleSpring,
            transform: `translateX(${interpolate(titleSpring, [0, 1], [-36, 0])}px)`,
          }}
        >
          {scene.badge}
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 64,
            fontWeight: 900,
            lineHeight: 1.05,
            textShadow: "0 8px 28px rgba(0,0,0,0.9)",
            opacity: titleSpring,
            transform: `translateY(${interpolate(titleSpring, [0, 1], [24, 0])}px)`,
          }}
        >
          {scene.title}
        </h2>
      </div>
    ) : null,
    layout === "split-versus" ? (
      <>
        <div
          style={{
            position: "absolute",
            top: 78,
            left: 48,
            right: 48,
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "8px 24px",
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.65)",
              border: `2px solid ${theme.accentColor}`,
              color: theme.accentColor,
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: 4,
              marginBottom: 14,
            }}
          >
            {scene.badge}
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 64,
              fontWeight: 900,
              lineHeight: 1.04,
              textShadow: "0 8px 26px rgba(0,0,0,0.9)",
            }}
          >
            {scene.title}
          </h2>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 340,
            left: 48,
            right: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            opacity: detailSpring,
            transform: `translateY(${interpolate(detailSpring, [0, 1], [30, 0])}px)`,
          }}
        >
          <div
            style={{
              flex: 1,
              background: `linear-gradient(135deg, ${theme.primaryColor}E6, rgba(7,17,31,0.88))`,
              borderBottom: `6px solid ${theme.accentColor}`,
              borderRadius: 20,
              padding: "20px 24px",
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 900, textTransform: "uppercase" }}>
              {scene.leftLabel || "A"}
            </div>
            {typeof scene.leftValue === "number" && (
              <div style={{ fontSize: 52, fontWeight: 900, color: theme.accentColor }}>
                {Math.round(leftAnim)}
              </div>
            )}
          </div>

          <div
            style={{
              width: 82,
              height: 82,
              borderRadius: 999,
              backgroundColor: theme.accentColor,
              color: "#07111F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 900,
              boxShadow: "0 12px 30px rgba(0,0,0,0.6)",
            }}
          >
            VS
          </div>

          <div
            style={{
              flex: 1,
              background: `linear-gradient(135deg, ${theme.secondaryColor}E6, rgba(7,17,31,0.88))`,
              borderBottom: "6px solid #FFFFFF",
              borderRadius: 20,
              padding: "20px 24px",
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 900, textTransform: "uppercase" }}>
              {scene.rightLabel || "B"}
            </div>
            {typeof scene.rightValue === "number" && (
              <div style={{ fontSize: 52, fontWeight: 900, color: "#FFFFFF" }}>
                {Math.round(rightAnim)}
              </div>
            )}
          </div>
        </div>
      </>
    ) : null,
    layout === "stat-overlay" ? (
      <>
        <div style={{ position: "absolute", top: 82, left: 52, right: 52 }}>
          <div
            style={{
              color: theme.accentColor,
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: 4,
              textShadow: "0 4px 16px rgba(0,0,0,0.9)",
            }}
          >
            {scene.badge}
          </div>
          <h2
            style={{
              margin: "10px 0 0 0",
              fontSize: 64,
              fontWeight: 900,
              lineHeight: 1.05,
              textShadow: "0 8px 26px rgba(0,0,0,0.9)",
            }}
          >
            {scene.title}
          </h2>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 350,
            left: 52,
            right: 52,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: detailSpring,
            transform: `scale(${interpolate(detailSpring, [0, 1], [0.75, 1])})`,
          }}
        >
          <div
            style={{
              fontSize: 156,
              fontWeight: 900,
              lineHeight: 0.95,
              color: theme.accentColor,
              textShadow: "0 14px 40px rgba(0,0,0,0.95)",
              letterSpacing: -4,
            }}
          >
            {scene.highlightValue || "100%"}
          </div>
          {scene.stampText && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 30px",
                borderRadius: 12,
                backgroundColor: theme.secondaryColor,
                color: "#FFFFFF",
                fontSize: 34,
                fontWeight: 900,
                letterSpacing: 4,
                transform: "rotate(-2.5deg)",
                boxShadow: "0 14px 32px rgba(0,0,0,0.55)",
              }}
            >
              {scene.stampText}
            </div>
          )}
        </div>
      </>
    ) : null,
    layout === "quote-press" ? (
      <>
        <div style={{ position: "absolute", top: 82, left: 52, right: 52 }}>
          <div
            style={{
              display: "inline-block",
              padding: "8px 22px",
              borderRadius: 8,
              backgroundColor: "#DC2626",
              color: "#FFFFFF",
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: 3,
              marginBottom: 16,
            }}
          >
            {scene.badge || "ÚLTIMA HORA"}
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 64,
              fontWeight: 900,
              lineHeight: 1.04,
              textShadow: "0 8px 28px rgba(0,0,0,0.9)",
            }}
          >
            {scene.title}
          </h2>
        </div>

        {scene.quoteText && (
          <div
            style={{
              position: "absolute",
              bottom: 350,
              left: 52,
              right: 52,
              backgroundColor: "rgba(7, 17, 31, 0.82)",
              borderLeft: `10px solid ${theme.accentColor}`,
              borderRadius: 20,
              padding: "26px 32px",
              fontSize: 36,
              fontWeight: 800,
              lineHeight: 1.25,
              boxShadow: "0 18px 40px rgba(0,0,0,0.6)",
              opacity: detailSpring,
              transform: `translateX(${interpolate(detailSpring, [0, 1], [-45, 0])}px)`,
            }}
          >
            “{scene.quoteText}”
          </div>
        )}
      </>
    ) : null,
    layout === "cta-engage" ? (
      <>
        <div
          style={{
            position: "absolute",
            top: 90,
            left: 52,
            right: 52,
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: theme.accentColor,
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: 4,
              marginBottom: 14,
            }}
          >
            {scene.badge}
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 72,
              fontWeight: 900,
              lineHeight: 1.04,
              textShadow: "0 10px 30px rgba(0,0,0,0.9)",
            }}
          >
            {scene.title}
          </h2>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 350,
            left: 52,
            right: 52,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            opacity: detailSpring,
            transform: `translateY(${interpolate(detailSpring, [0, 1], [28, 0])}px)`,
          }}
        >
          {(scene.bullets || []).slice(0, 2).map((b, i) => (
            <div
              key={i}
              style={{
                backgroundColor: "rgba(7, 17, 31, 0.8)",
                border: `3px solid ${i === 0 ? theme.accentColor : "rgba(255,255,255,0.4)"}`,
                borderRadius: 22,
                padding: "22px 28px",
                fontSize: 34,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: 18,
              }}
            >
              <span
                style={{
                  minWidth: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: theme.accentColor,
                  color: "#07111F",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                }}
              >
                {i + 1}
              </span>
              <span>{b}</span>
            </div>
          ))}
          <div
            style={{
              backgroundColor: theme.accentColor,
              color: "#07111F",
              borderRadius: 24,
              padding: "26px 30px",
              textAlign: "center",
              fontSize: 40,
              fontWeight: 900,
              boxShadow: "0 16px 36px rgba(0,0,0,0.55)",
            }}
          >
            {scene.ctaText || "¿TÚ QUÉ OPINAS? COMENTA ↓"}
          </div>
        </div>
      </>
    ) : null,
    h(SceneSubtitle, {
      scene,
      accent: theme.accentColor,
      voiceSpeed,
      subtitleStyle,
    })
  );
};

const SceneTactics: React.FC<SceneCommonProps> = ({
  scene,
  theme,
  voiceSpeed,
  subtitleStyle,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [10, Math.max(40, durationInFrames - 18)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const move = Easing.inOut(Easing.cubic)(Math.min(1, p * 1.15));

  const p6X = 450;
  const p6Y = interpolate(move, [0, 1], [720, 620]);
  const p8X = interpolate(move, [0, 1], [270, 355]);
  const p8Y = interpolate(move, [0, 1], [590, 420]);
  const p9X = interpolate(move, [0, 1], [450, 325]);
  const p9Y = interpolate(move, [0, 1], [380, 275]);
  const p19X = interpolate(move, [0, 1], [755, 585]);
  const p19Y = interpolate(move, [0, 1], [500, 245]);

  const pass1 = interpolate(p, [0.05, 0.35], [260, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pass2 = interpolate(p, [0.38, 0.72], [340, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shot = interpolate(p, [0.75, 0.98], [240, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let ballX = p6X;
  let ballY = p6Y - 28;
  if (p >= 0.05 && p < 0.38) {
    const t = interpolate(p, [0.05, 0.35], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    ballX = interpolate(t, [0, 1], [p6X, p8X]);
    ballY = interpolate(t, [0, 1], [p6Y, p8Y]);
  } else if (p >= 0.38 && p < 0.75) {
    const t = interpolate(p, [0.38, 0.72], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    ballX = interpolate(t, [0, 1], [p8X, p19X]);
    ballY = interpolate(t, [0, 1], [p8Y, p19Y]);
  } else if (p >= 0.75) {
    const t = interpolate(p, [0.75, 0.98], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    ballX = interpolate(t, [0, 1], [p19X, 465]);
    ballY = interpolate(t, [0, 1], [p19Y, 95]);
  }

  const defShift = interpolate(move, [0, 1], [0, -48]);
  const defenders = [
    { x: 230 + defShift, y: 275 },
    { x: 385 + defShift, y: 265 },
    { x: 530 + defShift, y: 265 },
    { x: 685 + defShift, y: 295 },
  ];

  const attackers = [
    { label: "6", x: p6X, y: p6Y },
    { label: "8", x: p8X, y: p8Y },
    { label: "9", x: p9X, y: p9Y },
    { label: scene.jerseyNumber || "19", x: p19X, y: p19Y },
  ];

  return h(
    AbsoluteFill,
    {
      style: {
        backgroundColor: theme.bgColor,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#FFFFFF",
        padding: "86px 56px",
        alignItems: "center",
      },
    },
    <div style={{ fontSize: 26, fontWeight: 800, color: theme.accentColor, letterSpacing: 4 }}>
      {scene.badge}
    </div>,
    <h2 style={{ fontSize: 58, fontWeight: 900, textAlign: "center", margin: "12px 0 34px 0" }}>
      {scene.title}
    </h2>,
    <svg
      viewBox="0 0 900 840"
      style={{
        width: 940,
        height: 880,
        borderRadius: 32,
        backgroundColor: "#0E2D22",
        border: "4px solid rgba(255,255,255,0.16)",
      }}
    >
      <rect x="40" y="40" width="820" height="760" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="4" />
      <rect x="210" y="40" width="480" height="220" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="4" />
      <rect x="330" y="40" width="240" height="86" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="4" />
      <rect x="385" y="18" width="130" height="22" fill="rgba(255,255,255,0.22)" stroke="#FFFFFF" strokeWidth="3" />

      <line x1={p6X} y1={p6Y} x2={p8X} y2={p8Y} stroke="#60A5FA" strokeWidth="6" strokeDasharray="260" strokeDashoffset={pass1} />
      <line x1={p8X} y1={p8Y} x2={p19X} y2={p19Y} stroke={theme.accentColor} strokeWidth="7" strokeDasharray="340" strokeDashoffset={pass2} />
      <line x1={p19X} y1={p19Y} x2={465} y2={95} stroke="#F43F5E" strokeWidth="8" strokeDasharray="240" strokeDashoffset={shot} />

      {defenders.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r="27" fill="#E2E8F0" stroke="#0F172A" strokeWidth="4" />
      ))}

      {attackers.map((pItem) => (
        <g key={pItem.label}>
          <circle cx={pItem.x} cy={pItem.y} r="34" fill={theme.primaryColor} stroke={theme.secondaryColor} strokeWidth="6" />
          <text x={pItem.x} y={pItem.y + 10} textAnchor="middle" fill="#FFFFFF" fontSize="27" fontWeight="900">
            {pItem.label}
          </text>
        </g>
      ))}

      <circle cx={ballX} cy={ballY} r="14" fill="#FFFFFF" stroke="#0F172A" strokeWidth="3" />
    </svg>,
    scene.tacticCaption ? (
      <div
        style={{
          marginTop: 28,
          width: "100%",
          backgroundColor: "rgba(255,255,255,0.06)",
          borderLeft: `8px solid ${theme.secondaryColor}`,
          borderRadius: 18,
          padding: "22px 28px",
          fontSize: 32,
          fontWeight: 700,
        }}
      >
        {scene.tacticCaption}
      </div>
    ) : null,
    h(SceneSubtitle, {
      scene,
      accent: theme.accentColor,
      voiceSpeed,
      subtitleStyle,
    })
  );
};

export const DynamicVideo: React.FC<DynamicVideoProps> = ({ spec, audioUrl }) => {
  const { fps } = useVideoConfig();
  const theme: VideoTheme = {
    primaryColor: spec.theme?.primaryColor || "#004D98",
    secondaryColor: spec.theme?.secondaryColor || "#A50044",
    accentColor: spec.theme?.accentColor || "#EDBB00",
    bgColor: spec.theme?.bgColor || "#07111F",
  };
  const voiceSpeed = spec.voiceSpeed || 1;
  const subtitleStyle: SubtitleStyle = spec.subtitleStyle || "dynamic";
  const resolvedGlobalAudio = resolveMediaSrc(audioUrl);

  let cursor = 0;

  return h(
    AbsoluteFill,
    { style: { backgroundColor: theme.bgColor } },
    resolvedGlobalAudio ? h(Audio, { src: resolvedGlobalAudio }) : null,
    spec.scenes.map((scene, index) => {
      const durationInFrames = Math.max(
        30,
        Math.ceil((scene.durationSeconds || 5) * fps)
      );
      const from = cursor;
      cursor += durationInFrames;
      const resolvedSceneAudio = resolveMediaSrc(scene.audioUrl);

      const audioNode =
        !resolvedGlobalAudio && resolvedSceneAudio
          ? h(
              Sequence,
              { from: SCENE_LEAD_IN_FRAMES },
              h(Audio, { src: resolvedSceneAudio, playbackRate: voiceSpeed })
            )
          : null;

      const sceneNode =
        scene.type === "tactics"
          ? h(SceneTactics, {
              scene,
              theme,
              voiceSpeed,
              subtitleStyle,
              sceneIndex: index,
            })
          : h(SceneCinematic, {
              scene,
              theme,
              voiceSpeed,
              subtitleStyle,
              sceneIndex: index,
            });

      return h(
        Sequence,
        {
          key: scene.id || index,
          from,
          durationInFrames,
        },
        audioNode,
        h(SceneTransition, { isFirst: index === 0 }, sceneNode)
      );
    })
  );
};
