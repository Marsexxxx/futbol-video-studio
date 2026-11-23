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
import { SubtitleStyle, VideoScene, VideoSpec, VideoTheme } from "../types";

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

const sanitizeSvg = (svg?: string): string => {
  if (!svg) return "";
  const cleaned = svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+=(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/javascript:/gi, "")
    .trim();

  return cleaned.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    const withoutSize = attrs.replace(/\s(?:width|height)=(?:"[^"]*"|'[^']*')/gi, "");
    return `<svg${withoutSize} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`;
  });
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
    const nextChars = bucketChars + item.text.length + (bucket.length > 0 ? 1 : 0);
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

const SceneFade: React.FC<{ children: React.ReactNode; isFirst: boolean }> = ({
  children,
  isFirst,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const fadeIn = isFirst
    ? 1
    : interpolate(frame, [0, 6], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
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

  const fadeStyle: React.CSSProperties = {
    opacity: Math.min(fadeIn, fadeOut),
  };

  return <AbsoluteFill style={fadeStyle}>{children}</AbsoluteFill>;
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

  const boxStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 84,
    left: 56,
    right: 56,
    backgroundColor: "rgba(6, 12, 24, 0.9)",
    border: `4px solid ${accent}`,
    borderRadius: 26,
    padding: "26px 34px",
    textAlign: "center",
    fontSize: 38,
    fontWeight: 800,
    color: "#FFFFFF",
    lineHeight: 1.3,
    boxShadow: "0 16px 36px rgba(0, 0, 0, 0.45)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    opacity: enter,
    transform: `translateY(${interpolate(enter, [0, 1], [18, 0])}px)`,
  };

  return <div style={boxStyle}>{text}</div>;
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

  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 92,
    left: 44,
    right: 44,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
  };

  const pillStyle: React.CSSProperties = {
    backgroundColor: "rgba(6, 12, 24, 0.88)",
    border: "3px solid rgba(255, 255, 255, 0.16)",
    borderRadius: 28,
    padding: "24px 32px",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: "12px 16px",
    maxWidth: "100%",
    boxShadow: "0 18px 42px rgba(0, 0, 0, 0.55)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    transform: `translateY(${interpolate(chunkPop, [0, 1], [14, 0])}px) scale(${interpolate(chunkPop, [0, 1], [0.94, 1])})`,
  };

  return (
    <div style={wrapperStyle}>
      <div style={pillStyle}>
        {activeChunk.words.map((word, idx) => {
          const isCurrent = frame >= word.start && frame < word.end;
          const isSpoken = frame >= word.end;
          const wordSpring = isCurrent
            ? spring({
                frame: Math.max(0, frame - Math.floor(word.start)),
                fps,
                config: { damping: 12, stiffness: 260 },
              })
            : 0;

          const wordStyle: React.CSSProperties = {
            display: "inline-block",
            fontSize: 48,
            fontWeight: 900,
            letterSpacing: -0.5,
            lineHeight: 1.15,
            padding: "6px 16px",
            borderRadius: 14,
            backgroundColor: isCurrent ? accent : "transparent",
            color: isCurrent
              ? "#07111F"
              : isSpoken
              ? "#FFFFFF"
              : "rgba(255, 255, 255, 0.55)",
            transform: isCurrent
              ? `scale(${interpolate(wordSpring, [0, 1], [0.92, 1.08])})`
              : "scale(1)",
            textShadow: isCurrent ? "none" : "0 4px 12px rgba(0, 0, 0, 0.65)",
          };

          return (
            <span key={`${activeChunkIndex}-${idx}`} style={wordStyle}>
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
    return <ClassicSubtitle text={scene.subtitle} accent={accent} />;
  }
  return (
    <DynamicSubtitle
      scene={scene}
      accent={accent}
      voiceSpeed={voiceSpeed}
    />
  );
};

const SceneCustom: React.FC<SceneCommonProps> = ({
  scene,
  theme,
  voiceSpeed,
  subtitleStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const floatY = Math.sin(frame * 0.055) * 8;
  const imgSrc = resolveMediaSrc(scene.imageUrl);
  const safeSvg = sanitizeSvg(scene.svgMarkup);

  const containerStyle: React.CSSProperties = {
    background: `linear-gradient(160deg, ${theme.primaryColor} 0%, ${theme.bgColor} 58%, ${theme.secondaryColor} 100%)`,
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#FFFFFF",
    alignItems: "center",
    padding: "96px 56px",
  };

  const badgeStyle: React.CSSProperties = {
    padding: "10px 28px",
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    border: `3px solid ${theme.accentColor}`,
    color: theme.accentColor,
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: 4,
    marginBottom: 22,
    opacity: pop,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 64,
    fontWeight: 900,
    textAlign: "center",
    lineHeight: 1.06,
    margin: "0 0 34px 0",
    textShadow: "0 8px 24px rgba(0,0,0,0.45)",
    transform: `scale(${interpolate(pop, [0, 1], [0.92, 1])})`,
  };

  const stageStyle: React.CSSProperties = {
    width: 820,
    height: 820,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: `translateY(${floatY}px) scale(${interpolate(pop, [0, 1], [0.88, 1])})`,
    opacity: pop,
    filter: "drop-shadow(0 24px 44px rgba(0,0,0,0.48))",
  };

  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: 28,
  };

  const svgContainerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={badgeStyle}>{scene.badge}</div>
      <h2 style={titleStyle}>{scene.title}</h2>

      <div style={stageStyle}>
        {imgSrc ? (
          <Img src={imgSrc} style={imgStyle} />
        ) : safeSvg ? (
          <div
            style={svgContainerStyle}
            dangerouslySetInnerHTML={{ __html: safeSvg }}
          />
        ) : null}
      </div>

      <SceneSubtitle
        scene={scene}
        accent={theme.accentColor}
        voiceSpeed={voiceSpeed}
        subtitleStyle={subtitleStyle}
      />
    </AbsoluteFill>
  );
};

const SceneHook: React.FC<SceneCommonProps> = ({
  scene,
  theme,
  voiceSpeed,
  subtitleStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14 } });
  const floatY = Math.sin(frame * 0.06) * 8;
  const imgSrc = resolveMediaSrc(scene.imageUrl);

  const containerStyle: React.CSSProperties = {
    background: `linear-gradient(155deg, ${theme.primaryColor} 0%, ${theme.bgColor} 58%, ${theme.secondaryColor} 100%)`,
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#FFFFFF",
    alignItems: "center",
    padding: "110px 64px",
  };

  const imgStyle: React.CSSProperties = {
    width: 560,
    height: 560,
    objectFit: "contain",
    borderRadius: 32,
    filter: "drop-shadow(0 24px 40px rgba(0,0,0,0.5))",
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div
        style={{
          padding: "12px 32px",
          borderRadius: 999,
          backgroundColor: "rgba(0, 0, 0, 0.45)",
          border: `3px solid ${theme.accentColor}`,
          color: theme.accentColor,
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: 4,
          marginBottom: 34,
          opacity: pop,
        }}
      >
        {scene.badge}
      </div>

      <h1
        style={{
          fontSize: 94,
          fontWeight: 900,
          textAlign: "center",
          lineHeight: 1.02,
          margin: "0 0 64px 0",
          letterSpacing: -2,
          textShadow: "0 10px 28px rgba(0,0,0,0.45)",
          transform: `scale(${interpolate(pop, [0, 1], [0.88, 1])})`,
        }}
      >
        {scene.title}
      </h1>

      <div style={{ transform: `translateY(${floatY}px)` }}>
        {imgSrc ? (
          <Img src={imgSrc} style={imgStyle} />
        ) : (
          <svg width="420" height="450" viewBox="0 0 320 350">
            <path
              d="M 54 310 L 72 95 L 118 58 L 202 58 L 248 95 L 266 310 Z"
              fill={theme.primaryColor}
              stroke="#0F172A"
              strokeWidth="10"
              strokeLinejoin="round"
            />
            <rect x="114" y="64" width="38" height="240" fill={theme.secondaryColor} />
            <rect x="176" y="64" width="38" height="240" fill={theme.secondaryColor} />
            <path
              d="M 118 58 Q 160 104 202 58"
              fill={theme.accentColor}
              stroke="#0F172A"
              strokeWidth="8"
            />
            <text
              x="160"
              y="224"
              textAnchor="middle"
              fontSize="124"
              fontWeight="900"
              fill={theme.accentColor}
              stroke="#0F172A"
              strokeWidth="5"
              fontFamily="Impact, sans-serif"
            >
              {scene.jerseyNumber || "10"}
            </text>
          </svg>
        )}
      </div>

      <SceneSubtitle
        scene={scene}
        accent={theme.accentColor}
        voiceSpeed={voiceSpeed}
        subtitleStyle={subtitleStyle}
      />
    </AbsoluteFill>
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

  const containerStyle: React.CSSProperties = {
    backgroundColor: theme.bgColor,
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#FFFFFF",
    padding: "86px 56px",
    alignItems: "center",
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={{ fontSize: 26, fontWeight: 800, color: theme.accentColor, letterSpacing: 4 }}>
        {scene.badge}
      </div>
      <h2 style={{ fontSize: 58, fontWeight: 900, textAlign: "center", margin: "12px 0 34px 0" }}>
        {scene.title}
      </h2>

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
      </svg>

      {scene.tacticCaption && (
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
      )}

      <SceneSubtitle
        scene={scene}
        accent={theme.accentColor}
        voiceSpeed={voiceSpeed}
        subtitleStyle={subtitleStyle}
      />
    </AbsoluteFill>
  );
};

const SceneVersus: React.FC<SceneCommonProps> = ({
  scene,
  theme,
  voiceSpeed,
  subtitleStyle,
}) => {
  const frame = useCurrentFrame();
  const leftTarget = Math.min(100, Math.max(5, scene.leftValue ?? 65));
  const rightTarget = Math.min(100, Math.max(5, scene.rightValue ?? 35));
  const imgSrc = resolveMediaSrc(scene.imageUrl);

  const leftVal = interpolate(frame, [12, 62], [0, leftTarget], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const rightVal = interpolate(frame, [12, 62], [0, rightTarget], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const containerStyle: React.CSSProperties = {
    background: `linear-gradient(170deg, #0D172A 0%, ${theme.bgColor} 100%)`,
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#FFFFFF",
    padding: "110px 60px",
  };

  const imgStyle: React.CSSProperties = {
    width: 420,
    height: 340,
    objectFit: "contain",
    borderRadius: 24,
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: theme.accentColor, letterSpacing: 4 }}>
          {scene.badge}
        </div>
        <h2 style={{ fontSize: 66, fontWeight: 900, margin: "14px 0 0 0", lineHeight: 1.08 }}>
          {scene.title}
        </h2>
      </div>

      {imgSrc && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
          <Img src={imgSrc} style={imgStyle} />
        </div>
      )}

      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.06)",
          border: "2px solid rgba(255,255,255,0.14)",
          borderRadius: 32,
          padding: "46px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 42,
        }}
      >
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 34, fontWeight: 800, marginBottom: 16 }}>
            <span>{scene.leftLabel || "Opción A"}</span>
            <span style={{ color: theme.accentColor }}>{Math.round(leftVal)}%</span>
          </div>
          <div style={{ height: 54, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 16, overflow: "hidden" }}>
            <div
              style={{
                width: `${leftVal}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
              }}
            />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 34, fontWeight: 800, color: "#CBD5E1", marginBottom: 16 }}>
            <span>{scene.rightLabel || "Opción B"}</span>
            <span>{Math.round(rightVal)}%</span>
          </div>
          <div style={{ height: 54, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ width: `${rightVal}%`, height: "100%", backgroundColor: "#64748B" }} />
          </div>
        </div>
      </div>

      <SceneSubtitle
        scene={scene}
        accent={theme.accentColor}
        voiceSpeed={voiceSpeed}
        subtitleStyle={subtitleStyle}
      />
    </AbsoluteFill>
  );
};

const SceneHeadline: React.FC<SceneCommonProps> = ({
  scene,
  theme,
  voiceSpeed,
  subtitleStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardIn = spring({ frame, fps, config: { damping: 14 } });
  const stampPop = spring({ frame: Math.max(0, frame - 24), fps, config: { damping: 11, stiffness: 190 } });
  const imgSrc = resolveMediaSrc(scene.imageUrl);

  const containerStyle: React.CSSProperties = {
    background: `linear-gradient(160deg, #0D172A 0%, ${theme.bgColor} 65%, ${theme.secondaryColor} 100%)`,
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#FFFFFF",
    padding: "110px 60px",
    alignItems: "center",
  };

  const imgStyle: React.CSSProperties = {
    width: 320,
    height: 320,
    objectFit: "contain",
    marginBottom: 24,
    borderRadius: 20,
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={{ fontSize: 28, fontWeight: 800, color: theme.accentColor, letterSpacing: 4 }}>
        {scene.badge}
      </div>
      <h2 style={{ fontSize: 66, fontWeight: 900, textAlign: "center", margin: "14px 0 54px 0", lineHeight: 1.06 }}>
        {scene.title}
      </h2>

      <div
        style={{
          position: "relative",
          width: "100%",
          backgroundColor: "#F8FAFC",
          color: "#0F172A",
          borderRadius: 34,
          padding: "56px 46px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          transform: `translateY(${interpolate(cardIn, [0, 1], [60, 0])}px)`,
          opacity: cardIn,
          textAlign: "center",
        }}
      >
        {imgSrc && <Img src={imgSrc} style={imgStyle} />}

        <div style={{ fontSize: 132, fontWeight: 900, color: theme.primaryColor, lineHeight: 1 }}>
          {scene.highlightValue || "100%"}
        </div>

        {scene.stampText && (
          <div
            style={{
              display: "inline-block",
              marginTop: 28,
              border: `6px solid ${theme.secondaryColor}`,
              color: theme.secondaryColor,
              padding: "10px 28px",
              borderRadius: 14,
              fontSize: 36,
              fontWeight: 900,
              letterSpacing: 3,
              transform: `rotate(-4deg) scale(${interpolate(stampPop, [0, 1], [1.6, 1])})`,
              opacity: stampPop,
            }}
          >
            {scene.stampText}
          </div>
        )}
      </div>

      <SceneSubtitle
        scene={scene}
        accent={theme.accentColor}
        voiceSpeed={voiceSpeed}
        subtitleStyle={subtitleStyle}
      />
    </AbsoluteFill>
  );
};

const SceneCta: React.FC<SceneCommonProps> = ({
  scene,
  theme,
  voiceSpeed,
  subtitleStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ctaPop = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 14 } });

  const containerStyle: React.CSSProperties = {
    background: `linear-gradient(165deg, ${theme.primaryColor} 0%, ${theme.bgColor} 58%, ${theme.secondaryColor} 100%)`,
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#FFFFFF",
    padding: "110px 60px",
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={{ textAlign: "center", marginBottom: 46 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: theme.accentColor, letterSpacing: 4 }}>
          {scene.badge}
        </div>
        <h2 style={{ fontSize: 68, fontWeight: 900, margin: "14px 0 0 0", lineHeight: 1.06 }}>
          {scene.title}
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 48 }}>
        {(scene.bullets || []).map((bullet, idx) => {
          const itemIn = spring({
            frame: Math.max(0, frame - idx * 14),
            fps,
            config: { damping: 15 },
          });
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "2px solid rgba(255,255,255,0.16)",
                borderRadius: 24,
                padding: "30px 32px",
                fontSize: 36,
                fontWeight: 700,
                opacity: itemIn,
                transform: `translateX(${interpolate(itemIn, [0, 1], [-50, 0])}px)`,
              }}
            >
              <div
                style={{
                  minWidth: 56,
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: theme.accentColor,
                  color: "#0F172A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 30,
                  fontWeight: 900,
                }}
              >
                {idx + 1}
              </div>
              <span>{bullet}</span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          backgroundColor: theme.accentColor,
          color: "#0F172A",
          borderRadius: 28,
          padding: "34px 36px",
          textAlign: "center",
          fontSize: 42,
          fontWeight: 900,
          opacity: ctaPop,
          transform: `scale(${interpolate(ctaPop, [0, 1], [0.9, 1])})`,
        }}
      >
        OPINA EN LOS COMENTARIOS ↓
      </div>

      <SceneSubtitle
        scene={scene}
        accent={theme.accentColor}
        voiceSpeed={voiceSpeed}
        subtitleStyle={subtitleStyle}
      />
    </AbsoluteFill>
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

  const rootStyle: React.CSSProperties = {
    backgroundColor: theme.bgColor,
  };

  let cursor = 0;

  return (
    <AbsoluteFill style={rootStyle}>
      {resolvedGlobalAudio ? <Audio src={resolvedGlobalAudio} /> : null}
      {spec.scenes.map((scene, index) => {
        const durationInFrames = Math.max(
          30,
          Math.ceil((scene.durationSeconds || 5) * fps)
        );
        const from = cursor;
        cursor += durationInFrames;
        const resolvedSceneAudio = resolveMediaSrc(scene.audioUrl);

        return (
          <Sequence
            key={scene.id || index}
            from={from}
            durationInFrames={durationInFrames}
          >
            {!resolvedGlobalAudio && resolvedSceneAudio ? (
              <Sequence from={SCENE_LEAD_IN_FRAMES}>
                <Audio src={resolvedSceneAudio} playbackRate={voiceSpeed} />
              </Sequence>
            ) : null}
            <SceneFade isFirst={index === 0}>
              {scene.type === "custom" && (
                <SceneCustom
                  scene={scene}
                  theme={theme}
                  voiceSpeed={voiceSpeed}
                  subtitleStyle={subtitleStyle}
                />
              )}
              {scene.type === "hook" && (
                <SceneHook
                  scene={scene}
                  theme={theme}
                  voiceSpeed={voiceSpeed}
                  subtitleStyle={subtitleStyle}
                />
              )}
              {scene.type === "tactics" && (
                <SceneTactics
                  scene={scene}
                  theme={theme}
                  voiceSpeed={voiceSpeed}
                  subtitleStyle={subtitleStyle}
                />
              )}
              {scene.type === "versus" && (
                <SceneVersus
                  scene={scene}
                  theme={theme}
                  voiceSpeed={voiceSpeed}
                  subtitleStyle={subtitleStyle}
                />
              )}
              {scene.type === "headline" && (
                <SceneHeadline
                  scene={scene}
                  theme={theme}
                  voiceSpeed={voiceSpeed}
                  subtitleStyle={subtitleStyle}
                />
              )}
              {scene.type === "cta" && (
                <SceneCta
                  scene={scene}
                  theme={theme}
                  voiceSpeed={voiceSpeed}
                  subtitleStyle={subtitleStyle}
                />
              )}
            </SceneFade>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
