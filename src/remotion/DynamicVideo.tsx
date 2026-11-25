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
  Video,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { Circle, Rect, Triangle, Star } from "@remotion/shapes";
import { noise2D } from "@remotion/noise";
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  Banknote,
  Brain,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Crown,
  Eye,
  FileText,
  Flag,
  Flame,
  Gavel,
  Globe,
  Heart,
  Landmark,
  Lock,
  MapPin,
  Megaphone,
  Newspaper,
  Phone,
  Radio,
  Rocket,
  Scale,
  Shield,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import {
  AnimationStyle,
  CameraMotion,
  RenderMode,
  SceneLayout,
  SubtitleStyle,
  TransitionType,
  VideoScene,
  VideoSpec,
  VideoTheme,
  VisualStyle,
} from "../types";

const h = React.createElement;
const RemotionVideo = Video as React.ComponentType<any>;
const TS = TransitionSeries as unknown as React.ComponentType<any>;
const TSSeq = TransitionSeries.Sequence as unknown as React.ComponentType<any>;
const TSTrans = TransitionSeries.Transition as unknown as React.ComponentType<any>;

export const SCENE_LEAD_IN_FRAMES = 6;
export const TRANSITION_FRAMES = 10;
const BRAND_HEADER_HEIGHT = 156;

export function getSceneFrames(scene: VideoScene, fps = 30): number {
  return Math.max(36, Math.ceil((scene.durationSeconds || 5) * fps));
}

export function getTotalFrames(spec: VideoSpec, fps = 30): number {
  const scenes = spec?.scenes || [];
  if (scenes.length === 0) return 30;
  const rawSum = scenes.reduce((acc, s) => acc + getSceneFrames(s, fps), 0);
  const overlap = Math.max(0, scenes.length - 1) * TRANSITION_FRAMES;
  return Math.max(36, rawSum - overlap);
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  trophy: Trophy,
  "file-text": FileText,
  scale: Scale,
  banknote: Banknote,
  gavel: Gavel,
  shield: Shield,
  flame: Flame,
  zap: Zap,
  clock: Clock,
  globe: Globe,
  brain: Brain,
  rocket: Rocket,
  alert: AlertTriangle,
  megaphone: Megaphone,
  target: Target,
  "trending-up": TrendingUp,
  lock: Lock,
  eye: Eye,
  users: Users,
  crown: Crown,
  swords: Swords,
  sparkles: Sparkles,
  newspaper: Newspaper,
  briefcase: Briefcase,
  landmark: Landmark,
  cpu: Cpu,
  heart: Heart,
  compass: Compass,
  award: Award,
  radio: Radio,
  flag: Flag,
  "user-check": UserCheck,
  "map-pin": MapPin,
  "badge-check": BadgeCheck,
  phone: Phone,
  calendar: Calendar,
  building: Building2,
  "check-circle": CheckCircle2,
  wrench: Wrench,
};

function getIconComponent(name?: string): React.ComponentType<any> {
  if (name && ICON_MAP[name]) return ICON_MAP[name];
  return Sparkles;
}

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
  renderMode: RenderMode;
  visualStyle?: VisualStyle;
  animationStyle?: AnimationStyle;
  sfxEnabled: boolean;
  showBrandHeader: boolean;
};

function getStylizedFrame(frame: number, visualStyle?: VisualStyle): number {
  if (visualStyle === "lego") return Math.floor(frame / 3) * 3;
  if (visualStyle === "pixelart") return Math.floor(frame / 2) * 2;
  return frame;
}

function getAnimationStyleFrame(
  frame: number,
  animationStyle?: AnimationStyle
): number {
  if (animationStyle === "lego") return Math.floor(frame / 3) * 3;
  if (animationStyle === "pixel-art" || animationStyle === "chalkboard") {
    return Math.floor(frame / 2) * 2;
  }
  return frame;
}

const resolveMediaSrc = (src?: string | null): string | undefined => {
  if (!src) return undefined;
  if (
    src.startsWith("blob:") ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:") ||
    src.startsWith("/")
  ) {
    return src;
  }
  const hasRemotionStaticBase =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { remotion_staticBase?: string }).remotion_staticBase);
  return hasRemotionStaticBase ? staticFile(src) : "/" + src.replace(/^\/+/, "");
};

const BrandHeaderBar: React.FC<{
  companyName: string;
  companyBadge?: string;
  logoSrc?: string;
}> = ({ companyName, companyBadge = "VACANTE DISPONIBLE", logoSrc }) => {
  return h(
    "div",
    {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: BRAND_HEADER_HEIGHT,
        zIndex: 50,
        background:
          "linear-gradient(180deg, rgba(24, 27, 26, 0.97) 0%, rgba(38, 40, 42, 0.94) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 34px 18px 38px",
        boxSizing: "border-box",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.48)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 6,
          flex: 1,
          paddingRight: 22,
        },
      },
      h(
        "div",
        {
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            color: "#BCD853",
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: 3.2,
            textTransform: "uppercase",
          },
        },
        h("span", {
          style: {
            width: 12,
            height: 12,
            borderRadius: 999,
            backgroundColor: "#7EC34A",
            display: "inline-block",
          },
        }),
        companyBadge
      ),
      h(
        "div",
        {
          style: {
            color: "#FFFFFF",
            fontSize: 31,
            fontWeight: 900,
            lineHeight: 1.12,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          },
        },
        companyName
      )
    ),
    logoSrc
      ? h(
          "div",
          {
            style: {
              width: 128,
              height: 128,
              borderRadius: 20,
              backgroundColor: "#FFFFFF",
              padding: 8,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 8px 20px rgba(0, 0, 0, 0.35)",
            },
          },
          h(Img, {
            src: logoSrc,
            style: {
              width: "100%",
              height: "100%",
              objectFit: "contain",
            },
          })
        )
      : null,
    h("div", {
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 9,
        background:
          "linear-gradient(90deg, #008F4C 0%, #7EC34A 52%, #BCD853 100%)",
      },
    })
  );
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

const ClassicSubtitle: React.FC<{
  text: string;
  accent: string;
  compact?: boolean;
  lightMode?: boolean;
}> = ({ text, accent, compact = false, lightMode = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 18, stiffness: 160 },
  });

  if (!text) return null;

  return h(
    "div",
    {
      style: {
        position: "absolute",
        bottom: compact ? 36 : 94,
        left: compact ? 40 : 52,
        right: compact ? 40 : 52,
        backgroundColor: lightMode
          ? "rgba(255, 255, 255, 0.95)"
          : "rgba(18, 22, 20, 0.88)",
        borderTop: lightMode ? "3px solid #0F172A" : "none",
        borderRight: lightMode ? "3px solid #0F172A" : "none",
        borderBottom: lightMode ? "3px solid #0F172A" : "none",
        borderLeft: lightMode ? "10px solid #0F172A" : `8px solid ${accent}`,
        borderRadius: 18,
        padding: compact ? "16px 24px" : "24px 30px",
        textAlign: "center",
        fontSize: compact ? 30 : 38,
        fontWeight: 800,
        color: lightMode ? "#0F172A" : "#FFFFFF",
        lineHeight: 1.24,
        boxShadow: lightMode
          ? "0 14px 32px rgba(15, 23, 42, 0.16)"
          : "0 16px 38px rgba(0, 0, 0, 0.5)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [18, 0])}px)`,
      },
    },
    text
  );
};

const DynamicSubtitle: React.FC<{
  scene: VideoScene;
  accent: string;
  voiceSpeed: number;
  compact?: boolean;
  lightMode?: boolean;
}> = ({ scene, accent, voiceSpeed, compact = false, lightMode = false }) => {
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

  return h(
    "div",
    {
      style: {
        position: "absolute",
        bottom: compact ? 38 : 110,
        left: 42,
        right: 42,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: compact ? "8px 10px" : "10px 14px",
          maxWidth: "100%",
          fontFamily: "system-ui, -apple-system, sans-serif",
          transform: `translateY(${interpolate(chunkPop, [0, 1], [14, 0])}px) scale(${interpolate(chunkPop, [0, 1], [0.94, 1])})`,
        },
      },
      activeChunk.words.map((word, idx) => {
        const isCurrent = frame >= word.start && frame < word.end;
        const isSpoken = frame >= word.end;
        const wordSpring = isCurrent
          ? spring({
              frame: Math.max(0, frame - Math.floor(word.start)),
              fps,
              config: { damping: 12, stiffness: 280 },
            })
          : 0;

        return h(
          "span",
          {
            key: `${activeChunkIndex}-${idx}`,
            style: {
              display: "inline-block",
              fontSize: compact ? 40 : 54,
              fontWeight: 900,
              letterSpacing: -0.5,
              lineHeight: 1.12,
              padding: isCurrent
                ? compact
                  ? "5px 14px"
                  : "6px 18px"
                : "5px 8px",
              borderRadius: 14,
              border: lightMode
                ? isCurrent
                  ? "2px solid #0F172A"
                  : "2px solid rgba(15, 23, 42, 0.16)"
                : undefined,
              backgroundColor: lightMode
                ? isCurrent
                  ? "#0F172A"
                  : "rgba(255, 255, 255, 0.9)"
                : isCurrent
                ? accent
                : "rgba(18, 22, 20, 0.72)",
              color: lightMode
                ? isCurrent
                  ? "#FFFFFF"
                  : isSpoken
                  ? "#0F172A"
                  : "rgba(15, 23, 42, 0.52)"
                : isCurrent
                ? "#111613"
                : isSpoken
                ? "#FFFFFF"
                : "rgba(255, 255, 255, 0.72)",
              transform: isCurrent
                ? `scale(${interpolate(wordSpring, [0, 1], [0.9, 1.08])})`
                : "scale(1)",
              textShadow: lightMode
                ? "none"
                : isCurrent
                ? "none"
                : "0 4px 16px rgba(0, 0, 0, 0.9)",
              boxShadow: isCurrent
                ? lightMode
                  ? "0 10px 24px rgba(15, 23, 42, 0.25)"
                  : "0 10px 26px rgba(0, 0, 0, 0.45)"
                : "none",
            },
          },
          word.text
        );
      })
    )
  );
};

const SceneSubtitle: React.FC<{
  scene: VideoScene;
  accent: string;
  voiceSpeed: number;
  subtitleStyle: SubtitleStyle;
  compact?: boolean;
  lightMode?: boolean;
}> = ({
  scene,
  accent,
  voiceSpeed,
  subtitleStyle,
  compact = false,
  lightMode = false,
}) => {
  if (subtitleStyle === "classic") {
    return h(ClassicSubtitle, { text: scene.subtitle, accent, compact, lightMode });
  }
  return h(DynamicSubtitle, { scene, accent, voiceSpeed, compact, lightMode });
};

const EditorialBackdrop: React.FC<{
  theme: VideoTheme;
  sceneIndex: number;
  showBrandHeader: boolean;
  visualStyle?: VisualStyle;
}> = ({ theme, sceneIndex, showBrandHeader, visualStyle }) => {
  const rawFrame = useCurrentFrame();
  const frame = getStylizedFrame(rawFrame, visualStyle);
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(rawFrame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const nx1 = noise2D(`orb-x-${sceneIndex}`, frame * 0.008, 0.2) * 210;
  const ny1 = noise2D(`orb-y-${sceneIndex}`, 0.4, frame * 0.008) * 240;
  const nx2 = noise2D(`orb2-x-${sceneIndex}`, frame * 0.007, 1.1) * 180;
  const ny2 = noise2D(`orb2-y-${sceneIndex}`, 1.7, frame * 0.007) * 210;
  const gridShift = (frame * 1.15) % 80;
  const rot1 = frame * 0.65 + sceneIndex * 35;
  const rot2 = -frame * 0.5 + sceneIndex * 50;

  return h(
    AbsoluteFill,
    { style: { backgroundColor: theme.bgColor, overflow: "hidden" } },
    h(AbsoluteFill, {
      style: {
        background: `radial-gradient(circle at ${520 + nx1}px ${640 + ny1}px, ${theme.primaryColor}CC 0%, ${theme.bgColor} 58%), radial-gradient(circle at ${560 + nx2}px ${1320 + ny2}px, ${theme.secondaryColor}88 0%, transparent 55%)`,
      },
    }),
    h(AbsoluteFill, {
      style: {
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.06) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.06) 2px, transparent 2px)",
        backgroundSize: "80px 80px",
        backgroundPosition: `${gridShift}px ${gridShift}px`,
      },
    }),
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: (showBrandHeader ? 320 : 260) + ny1 * 0.35,
          left: 70 + nx1 * 0.25,
          opacity: 0.22,
          transform: `rotate(${rot1}deg)`,
        },
      },
      h(Triangle, {
        length: 150,
        direction: "up",
        fill: "none",
        stroke: theme.accentColor,
        strokeWidth: 7,
      })
    ),
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: (showBrandHeader ? 490 : 440) + ny2 * 0.3,
          right: 64 + nx2 * 0.2,
          opacity: 0.2,
          transform: `rotate(${rot2}deg)`,
        },
      },
      h(Star, {
        points: 5,
        innerRadius: 34,
        outerRadius: 72,
        fill: "none",
        stroke: "#FFFFFF",
        strokeWidth: 5,
      })
    ),
    h(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 430 - ny1 * 0.25,
          left: 88,
          opacity: 0.16,
        },
      },
      h(Circle, {
        radius: 68,
        fill: "none",
        stroke: theme.accentColor,
        strokeWidth: 6,
      })
    ),
    h(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 480 + ny2 * 0.25,
          right: 90,
          opacity: 0.16,
          transform: `rotate(${rot1 * 0.7}deg)`,
        },
      },
      h(Rect, {
        width: 110,
        height: 110,
        cornerRadius: 20,
        fill: "none",
        stroke: theme.secondaryColor,
        strokeWidth: 7,
      })
    ),
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: showBrandHeader ? BRAND_HEADER_HEIGHT + 12 : 28,
          left: 44,
          right: 44,
          height: 6,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.22)",
          overflow: "hidden",
        },
      },
      h("div", {
        style: {
          width: `${progress * 100}%`,
          height: "100%",
          backgroundColor: theme.accentColor,
        },
      })
    )
  );
};

const AnimatedBackdrop: React.FC<{
  imgSrc?: string;
  videoSrc?: string;
  videoMuted?: boolean;
  theme: VideoTheme;
  motion: CameraMotion;
  sceneIndex: number;
  showBrandHeader: boolean;
  visualStyle?: VisualStyle;
}> = ({
  imgSrc,
  videoSrc,
  videoMuted = true,
  theme,
  motion,
  sceneIndex,
  showBrandHeader,
  visualStyle,
}) => {
  const rawFrame = useCurrentFrame();
  const frame = getStylizedFrame(rawFrame, visualStyle);
  const { durationInFrames } = useVideoConfig();
  const rawProgress = interpolate(rawFrame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
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
      ? interpolate(frame, [0, 9], [0.46, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  const sweepX = interpolate(progress, [0, 1], [-500, 1450]);
  const orbX = 240 + Math.sin(frame * 0.03 + sceneIndex) * 180;
  const orbY = 620 + Math.cos(frame * 0.025 + sceneIndex) * 140;

  const mediaNode = videoSrc
    ? h(RemotionVideo, {
        src: videoSrc,
        muted: videoMuted,
        loop: true,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `translate3d(${tx * 0.4}px, ${ty * 0.4}px, 0) scale(${1 + (scale - 1) * 0.45})`,
        },
      })
    : imgSrc
    ? h(Img, {
        src: imgSrc || "",
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
          ...(visualStyle === "pixelart" ? { imageRendering: "pixelated" as const } : {}),
        },
      })
    : h(AbsoluteFill, {
        style: {
          background: `radial-gradient(circle at ${orbX}px ${orbY}px, ${theme.primaryColor} 0%, ${theme.bgColor} 58%, ${theme.secondaryColor} 100%)`,
          transform: `scale(${scale})`,
        },
      });

  return h(
    AbsoluteFill,
    {
      style: {
        backgroundColor: theme.bgColor,
        overflow: "hidden",
      },
    },
    mediaNode,
    h(AbsoluteFill, {
      style: {
        background:
          "linear-gradient(180deg, rgba(14,18,16,0.78) 0%, rgba(14,18,16,0.16) 28%, rgba(14,18,16,0.06) 54%, rgba(14,18,16,0.86) 100%)",
      },
    }),
    visualStyle === "pixelart"
      ? h(AbsoluteFill, {
          style: {
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.5) 0px, rgba(0, 0, 0, 0.5) 2px, transparent 2px, transparent 6px)",
            opacity: 0.07,
            pointerEvents: "none",
          },
        })
      : null,
    visualStyle === "roblox"
      ? h(AbsoluteFill, {
          style: {
            background:
              "linear-gradient(128deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 26%, transparent 48%, rgba(255,255,255,0.06) 76%, transparent 100%)",
            pointerEvents: "none",
          },
        })
      : null,
    h("div", {
      style: {
        position: "absolute",
        top: -200,
        left: sweepX,
        width: 240,
        height: 2400,
        background:
          "linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)",
        transform: "rotate(18deg)",
        pointerEvents: "none",
      },
    }),
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: showBrandHeader ? BRAND_HEADER_HEIGHT + 12 : 28,
          left: 44,
          right: 44,
          height: 6,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.22)",
          overflow: "hidden",
        },
      },
      h("div", {
        style: {
          width: `${rawProgress * 100}%`,
          height: "100%",
          backgroundColor: theme.accentColor,
        },
      })
    ),
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

const EditorialCenterStage: React.FC<{
  scene: VideoScene;
  theme: VideoTheme;
  imgSrc?: string;
  videoSrc?: string;
  videoMuted?: boolean;
  showBrandHeader: boolean;
  visualStyle?: VisualStyle;
}> = ({
  scene,
  theme,
  imgSrc,
  videoSrc,
  videoMuted = true,
  showBrandHeader,
  visualStyle,
}) => {
  const rawFrame = useCurrentFrame();
  const frame = getStylizedFrame(rawFrame, visualStyle);
  const { fps } = useVideoConfig();
  const IconComp = getIconComponent(scene.iconName);
  const isRoblox = visualStyle === "roblox";

  const enter = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: isRoblox
      ? { damping: 8, stiffness: 215, mass: 0.85 }
      : { damping: 12, stiffness: 150 },
  });
  const floatY = Math.sin(frame * 0.065) * 10;
  const ringPulse = 1 + Math.sin(frame * 0.09) * 0.06;
  const tilt = interpolate(enter, [0, 1], [-8, -1.8]);

  if (videoSrc || imgSrc) {
    return h(
      "div",
      {
        style: {
          position: "absolute",
          top: showBrandHeader ? 535 : 470,
          left: 90,
          right: 90,
          height: showBrandHeader ? 620 : 690,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: enter,
          transform: `translateY(${floatY}px) rotate(${tilt}deg) scale(${interpolate(enter, [0, 1], [0.85, 1])})`,
        },
      },
      h(
        "div",
        {
          style: {
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 36,
            overflow: "hidden",
            border: `7px solid ${theme.accentColor}`,
            boxShadow: isRoblox
              ? "0 30px 70px rgba(0,0,0,0.65), inset 0 3px 0 rgba(255,255,255,0.45)"
              : "0 30px 70px rgba(0,0,0,0.65)",
            backgroundColor: "#060C18",
          },
        },
        videoSrc
          ? h(RemotionVideo, {
              src: videoSrc,
              muted: videoMuted,
              loop: true,
              style: { width: "100%", height: "100%", objectFit: "cover" },
            })
          : h(Img, {
              src: imgSrc || "",
              style: {
                width: "100%",
                height: "100%",
                objectFit: "cover",
                ...(visualStyle === "pixelart" ? { imageRendering: "pixelated" as const } : {}),
              },
            }),
        isRoblox
          ? h("div", {
              style: {
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(138deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.03) 34%, transparent 55%)",
                pointerEvents: "none",
              },
            })
          : null,
        h(
          "div",
          {
            style: {
              position: "absolute",
              top: 22,
              right: 22,
              width: 86,
              height: 86,
              borderRadius: 24,
              backgroundColor: theme.accentColor,
              color: "#07111F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isRoblox
                ? "0 12px 28px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.5)"
                : "0 12px 28px rgba(0,0,0,0.45)",
            },
          },
          h(IconComp, { size: 46, strokeWidth: 2.6 })
        )
      )
    );
  }

  return h(
    "div",
    {
      style: {
        position: "absolute",
        top: showBrandHeader ? 560 : 500,
        left: 0,
        right: 0,
        height: 520,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      },
    },
    h("div", {
      style: {
        position: "absolute",
        width: 450,
        height: 450,
        borderRadius: 999,
        border: `4px dashed ${theme.accentColor}66`,
        transform: `rotate(${frame * 0.45}deg) scale(${ringPulse})`,
      },
    }),
    h("div", {
      style: {
        position: "absolute",
        width: 360,
        height: 360,
        borderRadius: 999,
        background: `radial-gradient(circle, ${theme.accentColor}38 0%, transparent 72%)`,
        transform: `scale(${ringPulse})`,
      },
    }),
    h(
      "div",
      {
        style: {
          position: "relative",
          overflow: "hidden",
          width: 300,
          height: 300,
          borderRadius: 72,
          background: `linear-gradient(145deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
          border: `7px solid ${theme.accentColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isRoblox
            ? "0 28px 70px rgba(0,0,0,0.58), inset 0 4px 0 rgba(255,255,255,0.48)"
            : "0 28px 70px rgba(0,0,0,0.58)",
          opacity: enter,
          transform: `translateY(${floatY}px) scale(${interpolate(enter, [0, 1], [0.55, 1])}) rotate(${interpolate(enter, [0, 1], [-14, 0])}deg)`,
        },
      },
      isRoblox
        ? h("div", {
            style: {
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(140deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.04) 42%, transparent 56%)",
              pointerEvents: "none",
            },
          })
        : null,
      h(IconComp, { size: 150, color: "#FFFFFF", strokeWidth: 2.1 })
    )
  );
};

const MidSceneCallout: React.FC<{
  scene: VideoScene;
  theme: VideoTheme;
  isEditorial: boolean;
  visualStyle?: VisualStyle;
}> = ({ scene, theme, isEditorial, visualStyle }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const isRoblox = visualStyle === "roblox";

  if (!scene.calloutText?.trim()) return null;

  const triggerFrame = Math.min(28, Math.max(16, Math.round(durationInFrames * 0.3)));
  const pop = spring({
    frame: Math.max(0, frame - triggerFrame),
    fps,
    config: isRoblox
      ? { damping: 8, stiffness: 250, mass: 0.85 }
      : { damping: 12, stiffness: 230 },
  });

  if (frame < triggerFrame) return null;

  const IconComp = getIconComponent(scene.iconName);

  return h(
    "div",
    {
      style: {
        position: "absolute",
        bottom: isEditorial ? 420 : 390,
        left: 52,
        right: 52,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      },
    },
    h(
      "div",
      {
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 18,
          padding: "18px 30px",
          borderRadius: 999,
          backgroundColor: "rgba(24, 28, 26, 0.92)",
          border: `4px solid ${theme.accentColor}`,
          boxShadow: isRoblox
            ? "0 18px 42px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.34)"
            : "0 18px 42px rgba(0,0,0,0.6)",
          opacity: pop,
          transform: `translateY(${interpolate(pop, [0, 1], [34, 0])}px) scale(${interpolate(pop, [0, 1], [0.75, 1])})`,
        },
      },
      h(
        "div",
        {
          style: {
            width: 56,
            height: 56,
            borderRadius: 999,
            backgroundColor: theme.accentColor,
            color: "#111613",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          },
        },
        h(IconComp, { size: 32, strokeWidth: 2.6 })
      ),
      h(
        "span",
        {
          style: {
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: 1,
            color: "#FFFFFF",
            textTransform: "uppercase",
          },
        },
        scene.calloutText
      )
    )
  );
};

const FlyerEndStage: React.FC<{
  scene: VideoScene;
  theme: VideoTheme;
  imgSrc?: string;
  showBrandHeader: boolean;
}> = ({ scene, theme, imgSrc, showBrandHeader }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 150 },
  });
  const gentleScale = interpolate(
    frame,
    [0, Math.max(1, durationInFrames)],
    [0.985, 1.02],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return h(
    "div",
    {
      style: {
        position: "absolute",
        top: showBrandHeader ? BRAND_HEADER_HEIGHT + 34 : 72,
        bottom: 205,
        left: 36,
        right: 36,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [36, 0])}px) scale(${gentleScale})`,
      },
    },
    imgSrc
      ? h(
          "div",
          {
            style: {
              width: "100%",
              height: "100%",
              borderRadius: 28,
              backgroundColor: "rgba(18, 22, 20, 0.72)",
              border: `5px solid ${theme.accentColor}`,
              padding: 14,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 26px 68px rgba(0, 0, 0, 0.65)",
            },
          },
          h(Img, {
            src: imgSrc || "",
            style: {
              width: "100%",
              height: "100%",
              objectFit: "contain",
              borderRadius: 18,
            },
          })
        )
      : h(
          "div",
          {
            style: {
              width: "100%",
              height: "82%",
              borderRadius: 32,
              backgroundColor: "rgba(38, 40, 42, 0.88)",
              border: `5px dashed ${theme.accentColor}`,
              padding: "48px 44px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: 24,
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
            },
          },
          h(
            "div",
            {
              style: {
                width: 136,
                height: 136,
                borderRadius: 36,
                backgroundColor: theme.primaryColor,
                border: `5px solid ${theme.accentColor}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
            },
            h(BadgeCheck, { size: 74, color: "#FFFFFF", strokeWidth: 2.2 })
          ),
          h(
            "div",
            {
              style: {
                fontSize: 48,
                fontWeight: 900,
                color: theme.accentColor,
                letterSpacing: 1,
                textTransform: "uppercase",
              },
            },
            "ESPACIO PARA TU FLYER FINAL"
          ),
          h(
            "div",
            {
              style: {
                fontSize: 32,
                fontWeight: 600,
                color: "#E2E8F0",
                lineHeight: 1.35,
              },
            },
            scene.title
              ? `Sube la imagen del flyer de "${scene.title}" en el panel de Reclutamiento para mostrar aquí todos los datos de contacto sin recortes.`
              : "Sube la imagen de tu flyer en el panel de Reclutamiento para mostrar aquí toda la información de la vacante."
          )
        )
  );
};

const resolveAnimationStyle = (
  animationStyle?: AnimationStyle,
  visualStyle?: VisualStyle
): AnimationStyle => {
  if (animationStyle) return animationStyle;
  if (visualStyle === "pixelart") return "pixel-art";
  if (visualStyle === "lego") return "lego";
  return "flat-vector";
};

const isLightAnimationStyle = (style: AnimationStyle): boolean =>
  style === "minimal-line" || style === "3d-explainer" || style === "lego";

const sanitizeSvgScene = (rawSvg?: string): string => {
  if (!rawSvg || typeof rawSvg !== "string") return "";

  let cleaned = rawSvg
    .trim()
    .replace(/^```(?:svg|xml|html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!cleaned) return "";

  let previous = "";
  while (cleaned !== previous) {
    previous = cleaned;
    cleaned = cleaned
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
      .replace(/<script\b[^>]*\/?>/gi, "")
      .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi, "")
      .replace(/<foreignObject\b[^>]*\/?>/gi, "")
      .replace(/<(iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<(iframe|object|embed)\b[^>]*\/?>/gi, "");
  }

  cleaned = cleaned
    .replace(/\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, " ")
    .replace(
      /(\s(?:xlink:)?href\s*=\s*)(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi,
      '$1"#"'
    );

  if (/<svg\b/i.test(cleaned)) {
    cleaned = cleaned.replace(/<svg\b([^>]*)>/i, (_full, attrs: string) => {
      let nextAttrs = attrs
        .replace(/\s+(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .trim();
      if (!/\bviewBox\s*=/i.test(nextAttrs)) {
        nextAttrs = `${nextAttrs} viewBox="0 0 1080 1120"`.trim();
      }
      if (!/\bpreserveAspectRatio\s*=/i.test(nextAttrs)) {
        nextAttrs = `${nextAttrs} preserveAspectRatio="xMidYMid meet"`.trim();
      }
      return `<svg ${nextAttrs}>`;
    });
  } else {
    cleaned = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1120" preserveAspectRatio="xMidYMid meet">${cleaned}</svg>`;
  }

  cleaned = cleaned.replace(
    /<(path|line|polyline|polygon|rect|circle|ellipse)\b([^>]*?)(\/?)>/gi,
    (full, tag: string, attrs: string, slash: string) => {
      if (/\bpathLength\s*=/i.test(attrs) || /stroke-dasharray/i.test(attrs)) {
        return full;
      }
      return `<${tag}${attrs} pathLength="1000"${slash}>`;
    }
  );

  return cleaned;
};

const buildFallbackAnimatedSvg = (
  scene: VideoScene,
  theme: VideoTheme,
  animationStyle: AnimationStyle
): string => {
  const isLight = isLightAnimationStyle(animationStyle);
  const strokeColor =
    animationStyle === "neon-sketch"
      ? "#22D3EE"
      : animationStyle === "chalkboard"
      ? "#F8FAFC"
      : isLight
      ? "#0F172A"
      : "#FFFFFF";
  const accentColor =
    animationStyle === "neon-sketch"
      ? "#F59E0B"
      : animationStyle === "chalkboard"
      ? "#FDE68A"
      : theme.accentColor;
  const fillPrimary =
    animationStyle === "minimal-line" ? "none" : theme.primaryColor;

  const escapedLabel = (scene.calloutText || scene.badge || "ESCENA")
    .slice(0, 22)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1120" preserveAspectRatio="xMidYMid meet">
    <g class="anim-pan-bg" opacity="0.24">
      <circle cx="240" cy="280" r="110" fill="none" stroke="${accentColor}" stroke-width="5" />
      <circle cx="840" cy="820" r="140" fill="none" stroke="${strokeColor}" stroke-width="4" />
    </g>
    <g class="anim-enter-left">
      <path class="anim-draw" d="M 160 830 Q 540 690 920 830" fill="none" stroke="${accentColor}" stroke-width="8" stroke-linecap="round" />
    </g>
    <g class="anim-bob">
      <circle class="anim-pulse" cx="540" cy="510" r="185" fill="${fillPrimary}" fill-opacity="${animationStyle === "minimal-line" ? "0" : "0.22"}" stroke="${accentColor}" stroke-width="8" />
      <rect class="anim-draw" x="390" y="360" width="300" height="300" rx="58" fill="${fillPrimary}" fill-opacity="${animationStyle === "minimal-line" ? "0" : "0.75"}" stroke="${strokeColor}" stroke-width="8" />
      <circle class="anim-head" cx="540" cy="465" r="46" fill="none" stroke="${strokeColor}" stroke-width="8" />
      <path class="anim-draw" d="M 455 595 C 455 540, 625 540, 625 595" fill="none" stroke="${accentColor}" stroke-width="9" stroke-linecap="round" />
    </g>
    <g class="anim-float">
      <circle cx="230" cy="420" r="24" fill="${accentColor}" />
      <polygon points="850,330 885,395 815,395" fill="none" stroke="${strokeColor}" stroke-width="7" />
    </g>
    <g class="anim-pop">
      <rect x="330" y="750" width="420" height="72" rx="36" fill="${accentColor}" />
      <text x="540" y="798" text-anchor="middle" fill="#0F172A" font-size="30" font-weight="900" font-family="system-ui, sans-serif">${escapedLabel}</text>
    </g>
  </svg>`;
};

const AnimatedSvgStage: React.FC<{
  scene: VideoScene;
  theme: VideoTheme;
  animationStyle: AnimationStyle;
}> = ({ scene, theme, animationStyle }) => {
  const rawFrame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const frame = getAnimationStyleFrame(rawFrame, animationStyle);
  const rawId = React.useId();
  const stageId = React.useMemo(
    () => `stage-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [rawId]
  );

  const sanitizedSvg = React.useMemo(() => {
    const cleaned = sanitizeSvgScene(scene.svgScene);
    return cleaned || buildFallbackAnimatedSvg(scene, theme, animationStyle);
  }, [scene.svgScene, scene.badge, scene.calloutText, theme, animationStyle]);

  const scopedCss = React.useMemo(() => {
    const scope = `[data-anim-stage="${stageId}"]`;
    return `
      ${scope} svg {
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        display: block;
      }
      ${scope} .anim-bob {
        transform-box: fill-box;
        transform-origin: center center;
        transform: translateY(var(--anim-bob-y, 0px));
      }
      ${scope} .anim-walk-leg-l {
        transform-box: fill-box;
        transform-origin: top center;
        transform: rotate(var(--anim-leg-l-rot, 0deg));
      }
      ${scope} .anim-walk-leg-r {
        transform-box: fill-box;
        transform-origin: top center;
        transform: rotate(var(--anim-leg-r-rot, 0deg));
      }
      ${scope} .anim-arm-l {
        transform-box: fill-box;
        transform-origin: top center;
        transform: rotate(var(--anim-arm-l-rot, 0deg));
      }
      ${scope} .anim-arm-r {
        transform-box: fill-box;
        transform-origin: top center;
        transform: rotate(var(--anim-arm-r-rot, 0deg));
      }
      ${scope} .anim-head {
        transform-box: fill-box;
        transform-origin: bottom center;
        transform: translateY(var(--anim-head-y, 0px)) rotate(var(--anim-head-rot, 0deg));
      }
      ${scope} .anim-enter-left {
        opacity: var(--anim-enter-opacity, 1);
        transform: translateX(var(--anim-enter-left-x, 0px));
      }
      ${scope} .anim-enter-right {
        opacity: var(--anim-enter-opacity, 1);
        transform: translateX(var(--anim-enter-right-x, 0px));
      }
      ${scope} .anim-pop {
        transform-box: fill-box;
        transform-origin: center center;
        opacity: var(--anim-pop-opacity, 1);
        transform: scale(var(--anim-pop-scale, 1));
      }
      ${scope} .anim-draw {
        stroke-dasharray: 1000;
        stroke-dashoffset: calc(var(--anim-draw-inv, 0) * 1000);
      }
      ${scope} .anim-draw[pathLength="100"],
      ${scope} .anim-draw[pathlength="100"] {
        stroke-dasharray: 100;
        stroke-dashoffset: calc(var(--anim-draw-inv, 0) * 100);
      }
      ${scope} .anim-float {
        transform-box: fill-box;
        transform-origin: center center;
        transform: translate(var(--anim-float-x, 0px), var(--anim-float-y, 0px)) rotate(var(--anim-float-rot, 0deg));
      }
      ${scope} .anim-pulse {
        transform-box: fill-box;
        transform-origin: center center;
        opacity: var(--anim-pulse-opacity, 1);
        transform: scale(var(--anim-pulse-scale, 1));
      }
      ${scope} .anim-pan-bg {
        transform-box: fill-box;
        transform-origin: center center;
        transform: translateX(var(--anim-pan-x, 0px)) scale(var(--anim-pan-scale, 1.06));
      }
    `;
  }, [stageId]);

  const t = frame / Math.max(1, fps);
  const bobY = Math.sin(t * Math.PI * 2 * 0.85) * 6;
  const walkAngle = Math.sin(t * Math.PI * 2 * 1.6) * 16;
  const armLAngle = -Math.sin(t * Math.PI * 2 * 1.6) * 14;
  const armRAngle = Math.sin(t * Math.PI * 2 * 1.4 + 0.5) * 15;
  const headRot = Math.sin(t * Math.PI * 2 * 0.9 + 0.4) * 4.5;
  const headY = Math.sin(t * Math.PI * 2 * 1.8) * 2.5;

  const enterSpring = spring({
    frame: Math.max(0, frame - 2),
    fps,
    config:
      animationStyle === "lego"
        ? { damping: 10, stiffness: 200, mass: 0.85 }
        : { damping: 14, stiffness: 150 },
  });
  const enterLeftX = interpolate(enterSpring, [0, 1], [-180, 0]);
  const enterRightX = interpolate(enterSpring, [0, 1], [180, 0]);
  const enterOpacity = interpolate(enterSpring, [0, 0.35, 1], [0, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const popStart = Math.min(
    Math.round(durationInFrames * 0.38),
    Math.max(12, durationInFrames - 24)
  );
  const popSpring = spring({
    frame: Math.max(0, frame - popStart),
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.85 },
  });
  const popScale =
    frame < popStart ? 0.35 : interpolate(popSpring, [0, 1], [0.35, 1]);
  const popOpacity =
    frame < popStart
      ? 0
      : interpolate(popSpring, [0, 0.35, 1], [0, 1, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const drawEnd = Math.max(24, Math.round(durationInFrames * 0.65));
  const drawProgress = interpolate(frame, [4, drawEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const floatX = Math.cos(t * Math.PI * 2 * 0.4) * 6;
  const floatY = Math.sin(t * Math.PI * 2 * 0.6) * 12;
  const floatRot = Math.sin(t * Math.PI * 2 * 0.45) * 3;

  const pulseWave = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 1.1);
  const pulseScale = 0.96 + pulseWave * 0.08;
  const pulseOpacity = 0.72 + pulseWave * 0.28;

  const panProgress = interpolate(
    frame,
    [0, Math.max(1, durationInFrames)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  const panX = interpolate(panProgress, [0, 1], [-24, 24]);

  const cssVars = {
    "--anim-bob-y": `${bobY.toFixed(2)}px`,
    "--anim-leg-l-rot": `${walkAngle.toFixed(2)}deg`,
    "--anim-leg-r-rot": `${(-walkAngle).toFixed(2)}deg`,
    "--anim-arm-l-rot": `${armLAngle.toFixed(2)}deg`,
    "--anim-arm-r-rot": `${armRAngle.toFixed(2)}deg`,
    "--anim-head-rot": `${headRot.toFixed(2)}deg`,
    "--anim-head-y": `${headY.toFixed(2)}px`,
    "--anim-enter-left-x": `${enterLeftX.toFixed(2)}px`,
    "--anim-enter-right-x": `${enterRightX.toFixed(2)}px`,
    "--anim-enter-opacity": `${enterOpacity.toFixed(3)}`,
    "--anim-pop-scale": `${popScale.toFixed(3)}`,
    "--anim-pop-opacity": `${popOpacity.toFixed(3)}`,
    "--anim-draw-inv": `${(1 - drawProgress).toFixed(4)}`,
    "--anim-float-x": `${floatX.toFixed(2)}px`,
    "--anim-float-y": `${floatY.toFixed(2)}px`,
    "--anim-float-rot": `${floatRot.toFixed(2)}deg`,
    "--anim-pulse-scale": `${pulseScale.toFixed(3)}`,
    "--anim-pulse-opacity": `${pulseOpacity.toFixed(3)}`,
    "--anim-pan-x": `${panX.toFixed(2)}px`,
    "--anim-pan-scale": "1.06",
  } as React.CSSProperties;

  const stageFilter =
    animationStyle === "neon-sketch"
      ? "drop-shadow(0 0 10px rgba(34, 211, 238, 0.72)) drop-shadow(0 0 24px rgba(245, 158, 11, 0.4))"
      : undefined;

  return h(
    "div",
    {
      "data-anim-stage": stageId,
      style: {
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        padding: animationStyle === "neon-sketch" ? 8 : 0,
        boxSizing: "border-box",
        ...(animationStyle === "pixel-art"
          ? { imageRendering: "pixelated" as const }
          : {}),
        ...cssVars,
      },
    },
    h("style", null, scopedCss),
    h("div", {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        filter: stageFilter,
      },
      dangerouslySetInnerHTML: { __html: sanitizedSvg },
    })
  );
};

const StyleBackdrop: React.FC<{
  animationStyle: AnimationStyle;
  theme: VideoTheme;
  scene: VideoScene;
  sceneIndex: number;
  showBrandHeader: boolean;
  children?: React.ReactNode;
}> = ({
  animationStyle,
  theme,
  scene,
  sceneIndex,
  showBrandHeader,
  children,
}) => {
  const rawFrame = useCurrentFrame();
  const frame = getAnimationStyleFrame(rawFrame, animationStyle);
  const { fps, durationInFrames } = useVideoConfig();
  const rawProgress = interpolate(
    rawFrame,
    [0, Math.max(1, durationInFrames)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  const driftX = Math.sin(frame * 0.02 + sceneIndex) * 28;
  const driftY = Math.cos(frame * 0.018 + sceneIndex) * 24;
  const gridShift = (frame * 0.7) % 36;
  const bubbleSpring = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 12, stiffness: 210 },
  });

  const frameTop = showBrandHeader ? BRAND_HEADER_HEIGHT + 10 : 14;

  const renderBackgroundLayer = () => {
    switch (animationStyle) {
      case "chalkboard":
        return h(
          AbsoluteFill,
          { style: { backgroundColor: "#1b3a2d" } },
          h(AbsoluteFill, {
            style: {
              background:
                "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.06) 0%, transparent 48%), radial-gradient(circle at 75% 70%, rgba(255,255,255,0.05) 0%, transparent 52%), radial-gradient(circle at 50% 50%, transparent 45%, rgba(8, 22, 16, 0.58) 100%)",
            },
          })
        );
      case "neon-sketch":
        return h(
          AbsoluteFill,
          { style: { backgroundColor: "#060d1f" } },
          h(AbsoluteFill, {
            style: {
              background:
                "radial-gradient(circle at 50% 42%, rgba(34, 211, 238, 0.14) 0%, rgba(245, 158, 11, 0.06) 45%, transparent 78%)",
            },
          }),
          h(AbsoluteFill, {
            style: {
              backgroundImage:
                "linear-gradient(rgba(34, 211, 238, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.08) 1px, transparent 1px), linear-gradient(rgba(34, 211, 238, 0.16) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(34, 211, 238, 0.16) 1.5px, transparent 1.5px)",
              backgroundSize: "36px 36px, 36px 36px, 144px 144px, 144px 144px",
              backgroundPosition: `${gridShift}px ${gridShift}px`,
            },
          })
        );
      case "comic":
        return h(
          AbsoluteFill,
          {
            style: {
              background:
                "linear-gradient(155deg, #FACC15 0%, #38BDF8 54%, #1D4ED8 100%)",
            },
          },
          h(AbsoluteFill, {
            style: {
              backgroundImage:
                "radial-gradient(rgba(15, 23, 42, 0.2) 2.5px, transparent 2.5px)",
              backgroundSize: "18px 18px",
            },
          })
        );
      case "minimal-line":
        return h(
          AbsoluteFill,
          { style: { backgroundColor: "#f8f9fa" } },
          h(AbsoluteFill, {
            style: {
              background:
                "radial-gradient(circle at 50% 35%, #FFFFFF 0%, #F1F5F9 100%)",
            },
          })
        );
      case "flat-vector":
        return h(
          AbsoluteFill,
          {
            style: {
              background: `linear-gradient(155deg, #0f172a 0%, ${theme.primaryColor}D9 52%, #1e293b 100%)`,
            },
          },
          h("div", {
            style: {
              position: "absolute",
              top: 220 + driftY,
              left: -140 + driftX,
              width: 520,
              height: 520,
              borderRadius: 999,
              background: `linear-gradient(135deg, ${theme.accentColor}30, transparent 70%)`,
            },
          }),
          h("div", {
            style: {
              position: "absolute",
              bottom: 240 - driftY,
              right: -120 - driftX,
              width: 560,
              height: 560,
              borderRadius: 999,
              background: `linear-gradient(135deg, ${theme.secondaryColor}33, transparent 70%)`,
            },
          })
        );
      case "pixel-art":
        return h(
          AbsoluteFill,
          {
            style: {
              background: "linear-gradient(180deg, #13162b 0%, #1d1b38 60%, #101324 100%)",
              imageRendering: "pixelated",
            },
          },
          h(AbsoluteFill, {
            style: {
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.03) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.03) 2px, transparent 2px)",
              backgroundSize: "24px 24px",
            },
          })
        );
      case "ps2-retro":
        return h(
          AbsoluteFill,
          {
            style: {
              background:
                "linear-gradient(160deg, #091534 0%, #112a5c 45%, #0c1836 100%)",
            },
          },
          h(AbsoluteFill, {
            style: {
              background:
                "linear-gradient(125deg, rgba(56, 189, 248, 0.14) 0%, transparent 38%, rgba(168, 85, 247, 0.12) 72%, transparent 100%)",
              clipPath: "polygon(0 0, 100% 14%, 82% 100%, 0 86%)",
            },
          }),
          h(AbsoluteFill, {
            style: {
              background:
                "linear-gradient(35deg, rgba(14, 165, 233, 0.1) 12%, transparent 56%)",
              clipPath: "polygon(18% 0, 100% 0, 100% 100%, 40% 78%)",
            },
          })
        );
      case "cgi":
        return h(
          AbsoluteFill,
          { style: { backgroundColor: "#070b14" } },
          h(AbsoluteFill, {
            style: {
              background:
                "radial-gradient(ellipse 76% 52% at 50% 14%, rgba(186, 230, 253, 0.25) 0%, rgba(56, 189, 248, 0.08) 44%, transparent 74%)",
            },
          }),
          h("div", {
            style: {
              position: "absolute",
              top: 0,
              left: "12%",
              right: "12%",
              height: "75%",
              background:
                "linear-gradient(180deg, rgba(224, 242, 254, 0.11) 0%, transparent 100%)",
              clipPath: "polygon(32% 0, 68% 0, 100% 100%, 0% 100%)",
              pointerEvents: "none",
            },
          })
        );
      case "lego":
        return h(
          AbsoluteFill,
          {
            style: {
              background:
                "linear-gradient(180deg, #fffbeb 0%, #fef3c7 46%, #e0f2fe 100%)",
            },
          },
          h(AbsoluteFill, {
            style: {
              backgroundImage:
                "radial-gradient(circle at 24px 24px, rgba(255,255,255,0.65) 0px, rgba(255,255,255,0.65) 7px, rgba(180, 140, 60, 0.14) 8px, rgba(180, 140, 60, 0.14) 11px, transparent 12px)",
              backgroundSize: "48px 48px",
            },
          }),
          h(AbsoluteFill, {
            style: {
              background:
                "radial-gradient(circle at 26% 18%, rgba(254, 240, 138, 0.55) 0%, transparent 55%)",
            },
          })
        );
      case "3d-explainer":
      default:
        return h(
          AbsoluteFill,
          {
            style: {
              background:
                "linear-gradient(180deg, #eef2ff 0%, #f8fafc 58%, #e2e8f0 100%)",
            },
          },
          h(AbsoluteFill, {
            style: {
              background:
                "radial-gradient(circle at 50% 34%, rgba(255,255,255,0.92) 0%, rgba(199, 210, 254, 0.22) 60%, transparent 85%)",
            },
          }),
          h("div", {
            style: {
              position: "absolute",
              bottom: 335,
              left: "18%",
              right: "18%",
              height: 58,
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse at center, rgba(15, 23, 42, 0.22) 0%, rgba(15, 23, 42, 0.08) 48%, transparent 75%)",
              pointerEvents: "none",
            },
          })
        );
    }
  };

  const renderForegroundOverlays = () => {
    const overlays: React.ReactNode[] = [];

    if (animationStyle === "chalkboard") {
      overlays.push(
        h("div", {
          key: "chalk-frame",
          style: {
            position: "absolute",
            top: frameTop,
            left: 14,
            right: 14,
            bottom: 14,
            borderRadius: 34,
            border: "16px solid #7C4D2B",
            boxShadow:
              "inset 0 0 0 4px #4A2B15, inset 0 10px 28px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.45)",
            pointerEvents: "none",
            zIndex: 15,
          },
        })
      );
    }

    if (animationStyle === "comic") {
      overlays.push(
        h("div", {
          key: "comic-frame",
          style: {
            position: "absolute",
            top: frameTop,
            left: 16,
            right: 16,
            bottom: 16,
            borderRadius: 22,
            border: "11px solid #0F172A",
            boxShadow: "inset 0 0 0 5px #FFFFFF",
            pointerEvents: "none",
            zIndex: 15,
          },
        })
      );
    }

    if (animationStyle === "pixel-art") {
      overlays.push(
        h(AbsoluteFill, {
          key: "pixel-scanlines",
          style: {
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.45) 0px, rgba(0, 0, 0, 0.45) 2px, transparent 2px, transparent 6px)",
            opacity: 0.08,
            pointerEvents: "none",
            zIndex: 15,
          },
        })
      );
    }

    if (animationStyle === "ps2-retro") {
      overlays.push(
        h(AbsoluteFill, {
          key: "ps2-vignette",
          style: {
            backgroundImage:
              "radial-gradient(circle at 50% 48%, transparent 50%, rgba(2, 6, 23, 0.62) 100%), repeating-radial-gradient(circle at 17% 32%, rgba(255,255,255,0.03) 0px, transparent 2px)",
            pointerEvents: "none",
            zIndex: 15,
          },
        })
      );
    }

    if (animationStyle === "cgi") {
      overlays.push(
        h(AbsoluteFill, {
          key: "cgi-vignette",
          style: {
            background:
              "radial-gradient(circle at 50% 44%, transparent 44%, rgba(2, 6, 23, 0.72) 100%)",
            pointerEvents: "none",
            zIndex: 15,
          },
        })
      );
    }

    if (scene.speechBubble?.trim()) {
      const isComic = animationStyle === "comic";
      overlays.push(
        h(
          "div",
          {
            key: "speech-bubble",
            style: {
              position: "absolute",
              top: showBrandHeader ? BRAND_HEADER_HEIGHT + 215 : 235,
              right: 46,
              maxWidth: 480,
              zIndex: 25,
              pointerEvents: "none",
              opacity: bubbleSpring,
              transform: `scale(${interpolate(bubbleSpring, [0, 1], [0.7, 1])}) translateY(${interpolate(bubbleSpring, [0, 1], [16, 0])}px)`,
              transformOrigin: "bottom left",
            },
          },
          h(
            "div",
            {
              style: {
                position: "relative",
                backgroundColor: "#FFFFFF",
                color: "#0F172A",
                border: isComic ? "5px solid #0F172A" : "3px solid #1E293B",
                borderRadius: isComic ? 26 : 24,
                padding: "16px 24px",
                fontSize: 28,
                fontWeight: 900,
                lineHeight: 1.22,
                boxShadow: isComic
                  ? "6px 6px 0 #0F172A"
                  : "0 14px 32px rgba(15, 23, 42, 0.25)",
              },
            },
            scene.speechBubble.trim(),
            h("div", {
              style: {
                position: "absolute",
                bottom: -18,
                left: 36,
                width: 24,
                height: 24,
                backgroundColor: "#FFFFFF",
                borderRight: isComic ? "5px solid #0F172A" : "3px solid #1E293B",
                borderBottom: isComic ? "5px solid #0F172A" : "3px solid #1E293B",
                transform: "rotate(45deg)",
              },
            })
          )
        )
      );
    }

    return overlays;
  };

  return h(
    AbsoluteFill,
    {
      style: {
        overflow: "hidden",
      },
    },
    renderBackgroundLayer(),
    children,
    ...renderForegroundOverlays(),
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: showBrandHeader ? BRAND_HEADER_HEIGHT + 12 : 28,
          left: 44,
          right: 44,
          height: 6,
          borderRadius: 999,
          backgroundColor: isLightAnimationStyle(animationStyle)
            ? "rgba(15, 23, 42, 0.16)"
            : "rgba(255,255,255,0.22)",
          overflow: "hidden",
          zIndex: 30,
        },
      },
      h("div", {
        style: {
          width: `${rawProgress * 100}%`,
          height: "100%",
          backgroundColor:
            animationStyle === "minimal-line" ? "#0F172A" : theme.accentColor,
        },
      })
    )
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

const resolveSceneMode = (
  scene: VideoScene,
  globalMode: RenderMode
): RenderMode => {
  if (scene.sceneMode) return scene.sceneMode;
  return globalMode;
};

const SceneDynamic: React.FC<SceneCommonProps> = ({
  scene,
  theme,
  voiceSpeed,
  subtitleStyle,
  sceneIndex,
  renderMode,
  visualStyle,
  animationStyle,
  sfxEnabled,
  showBrandHeader,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const layout = inferLayout(scene);
  const motion = inferMotion(scene, sceneIndex);
  const isFlyerEnd = layout === "flyer-end";
  const activeVisualStyle = isFlyerEnd ? undefined : visualStyle;
  const animFrame = getStylizedFrame(frame, activeVisualStyle);
  const isRoblox = activeVisualStyle === "roblox";
  const activeMode = isFlyerEnd ? "editorial" : resolveSceneMode(scene, renderMode);
  const isEditorial = activeMode === "editorial";
  const isHybrid = activeMode === "hybrid";
  const topOffset = showBrandHeader ? 128 : 0;

  const imgSrc = resolveMediaSrc(scene.imageUrl);
  const videoSrc = resolveMediaSrc(scene.videoUrl);
  const IconComp = getIconComponent(scene.iconName);

  const hasCustomMedia = Boolean(videoSrc || imgSrc);
  const hasSvgScene = Boolean(scene.svgScene && scene.svgScene.trim().length > 0);
  const useAnimatedStage =
    !isFlyerEnd &&
    !hasCustomMedia &&
    (layout === "animated-stage" || hasSvgScene || activeMode === "animated");
  const activeAnimationStyle = resolveAnimationStyle(
    animationStyle,
    activeVisualStyle
  );
  const isLightAnimated = isLightAnimationStyle(activeAnimationStyle);

  const titleSpring = spring({
    frame: Math.max(0, frame - 2),
    fps,
    config: isRoblox
      ? { damping: 9, stiffness: 220, mass: 0.85 }
      : { damping: 14, stiffness: 170 },
  });
  const detailSpring = spring({
    frame: Math.max(0, frame - 14),
    fps,
    config: isRoblox
      ? { damping: 8, stiffness: 230, mass: 0.85 }
      : { damping: 13, stiffness: 180 },
  });

  if (useAnimatedStage) {
    const isComic = activeAnimationStyle === "comic";
    const isNeon = activeAnimationStyle === "neon-sketch";
    const headlineColor = isLightAnimated ? "#0F172A" : "#FFFFFF";
    const headlineShadow = isLightAnimated
      ? "0 2px 10px rgba(255, 255, 255, 0.85)"
      : isComic
      ? "3px 3px 0 #0F172A, -2px -2px 0 #0F172A, 2px -2px 0 #0F172A, -2px 2px 0 #0F172A, 0 8px 18px rgba(0, 0, 0, 0.45)"
      : isNeon
      ? "0 0 18px rgba(34, 211, 238, 0.55), 0 4px 16px rgba(0, 0, 0, 0.85)"
      : "0 6px 22px rgba(0, 0, 0, 0.78)";

    return h(
      AbsoluteFill,
      {
        style: {
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: headlineColor,
        },
      },
      h(
        StyleBackdrop,
        {
          animationStyle: activeAnimationStyle,
          theme,
          scene,
          sceneIndex,
          showBrandHeader,
        },
        h(
          "div",
          {
            style: {
              position: "absolute",
              top: showBrandHeader ? BRAND_HEADER_HEIGHT + 34 : 52,
              bottom: 300,
              left: 42,
              right: 42,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              zIndex: 10,
            },
          },
          h(
            "div",
            {
              style: {
                flexShrink: 0,
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 10,
                opacity: titleSpring,
                transform: `translateY(${interpolate(titleSpring, [0, 1], [-16, 0])}px)`,
              },
            },
            scene.badge
              ? h(
                  "div",
                  {
                    style: {
                      display: "inline-block",
                      padding: "6px 22px",
                      borderRadius: isComic ? 10 : 999,
                      backgroundColor: isComic
                        ? "#FFE135"
                        : isLightAnimated
                        ? "#0F172A"
                        : isNeon
                        ? "rgba(6, 13, 31, 0.85)"
                        : "rgba(18, 22, 20, 0.72)",
                      border: isComic
                        ? "3px solid #0F172A"
                        : isNeon
                        ? "2px solid #22D3EE"
                        : `2px solid ${isLightAnimated ? "#0F172A" : theme.accentColor}`,
                      color: isComic
                        ? "#0F172A"
                        : isLightAnimated
                        ? "#FFFFFF"
                        : isNeon
                        ? "#22D3EE"
                        : theme.accentColor,
                      fontSize: 21,
                      fontWeight: 900,
                      letterSpacing: 3,
                      boxShadow: isComic ? "4px 4px 0 #0F172A" : undefined,
                    },
                  },
                  scene.badge
                )
              : null,
            h(
              "h2",
              {
                style: {
                  margin: 0,
                  fontSize: showBrandHeader ? 46 : 52,
                  fontWeight: 900,
                  lineHeight: 1.06,
                  color: headlineColor,
                  textShadow: headlineShadow,
                },
              },
              scene.title
            )
          ),
          h(
            "div",
            {
              style: {
                flex: 1,
                minHeight: 0,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
            },
            h(AnimatedSvgStage, {
              scene,
              theme,
              animationStyle: activeAnimationStyle,
            })
          )
        )
      ),
      h(SceneSubtitle, {
        scene,
        accent: theme.accentColor,
        voiceSpeed,
        subtitleStyle,
        lightMode: isLightAnimated,
      })
    );
  }

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

  const showMidCallout =
    !isFlyerEnd &&
    (isEditorial || isHybrid) &&
    Boolean(scene.calloutText?.trim()) &&
    layout !== "split-versus" &&
    layout !== "stat-overlay" &&
    layout !== "quote-press" &&
    layout !== "cta-engage";

  const popFrame = Math.min(28, Math.max(16, Math.round(durationInFrames * 0.3)));

  return h(
    AbsoluteFill,
    {
      style: {
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#FFFFFF",
      },
    },
    isEditorial
      ? h(EditorialBackdrop, {
          theme,
          sceneIndex,
          showBrandHeader,
          visualStyle: activeVisualStyle,
        })
      : h(AnimatedBackdrop, {
          imgSrc,
          videoSrc,
          videoMuted: scene.videoMuted !== false,
          theme,
          motion,
          sceneIndex,
          showBrandHeader,
          visualStyle: activeVisualStyle,
        }),
    sfxEnabled && (showMidCallout || layout === "stat-overlay" || isFlyerEnd)
      ? h(
          Sequence,
          { from: isFlyerEnd ? 4 : showMidCallout ? popFrame : 14, durationInFrames: 12 },
          h(Audio, { src: resolveMediaSrc("sfx/pop.wav") || "", volume: 0.16 })
        )
      : null,
    isFlyerEnd
      ? h(FlyerEndStage, { scene, theme, imgSrc, showBrandHeader })
      : null,
    !isFlyerEnd &&
      isEditorial &&
      layout !== "split-versus" &&
      layout !== "stat-overlay" &&
      layout !== "cta-engage"
      ? h(EditorialCenterStage, {
          scene,
          theme,
          imgSrc,
          videoSrc,
          videoMuted: scene.videoMuted !== false,
          showBrandHeader,
          visualStyle: activeVisualStyle,
        })
      : null,
    !isFlyerEnd && isHybrid && !isEditorial && scene.iconName
      ? h(
          "div",
          {
            style: {
              position: "absolute",
              top: 66 + topOffset,
              right: 48,
              width: 90,
              height: 90,
              borderRadius: 26,
              background: isRoblox
                ? "linear-gradient(145deg, rgba(48, 54, 62, 0.92), rgba(20, 24, 26, 0.88))"
                : "rgba(24, 28, 26, 0.84)",
              border: `4px solid ${theme.accentColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isRoblox
                ? "0 14px 32px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.45)"
                : "0 14px 32px rgba(0,0,0,0.5)",
              opacity: detailSpring,
              transform: `scale(${interpolate(detailSpring, [0, 1], [0.5, 1])}) rotate(${Math.sin(animFrame * 0.08) * 4}deg)`,
            },
          },
          h(IconComp, { size: 46, color: theme.accentColor, strokeWidth: 2.4 })
        )
      : null,
    layout === "hero-impact"
      ? h(
          "div",
          {
            style: {
              position: "absolute",
              top: 86 + topOffset,
              left: 52,
              right: 52,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            },
          },
          h(
            "div",
            {
              style: {
                padding: "10px 28px",
                borderRadius: 999,
                backgroundColor: theme.primaryColor,
                border: `3px solid ${theme.accentColor}`,
                color: "#FFFFFF",
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: 4,
                marginBottom: 22,
                boxShadow: "0 10px 26px rgba(0,0,0,0.45)",
                opacity: titleSpring,
                transform: `translateY(${interpolate(titleSpring, [0, 1], [-24, 0])}px)`,
              },
            },
            scene.badge
          ),
          h(
            "h1",
            {
              style: {
                margin: 0,
                fontSize: showBrandHeader ? 76 : 84,
                fontWeight: 900,
                lineHeight: 0.98,
                letterSpacing: -2,
                textTransform: "uppercase",
                textShadow: "0 10px 32px rgba(0,0,0,0.85)",
                transform: `scale(${interpolate(titleSpring, [0, 1], [1.18, 1])})`,
                opacity: titleSpring,
              },
            },
            scene.title
          ),
          h("div", {
            style: {
              marginTop: 22,
              height: 8,
              width: interpolate(detailSpring, [0, 1], [0, 260]),
              borderRadius: 999,
              backgroundColor: theme.accentColor,
              boxShadow: `0 0 24px ${theme.accentColor}`,
            },
          })
        )
      : null,
    layout === "story-clean" || layout === "animated-stage"
      ? h(
          "div",
          {
            style: {
              position: "absolute",
              top: 82 + topOffset,
              left: 52,
              right: isHybrid ? 150 : 52,
            },
          },
          h(
            "div",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 22px",
                borderRadius: 12,
                backgroundColor: "rgba(20, 24, 22, 0.78)",
                borderLeft: `6px solid ${theme.accentColor}`,
                color: theme.accentColor,
                fontSize: 24,
                fontWeight: 900,
                letterSpacing: 3,
                marginBottom: 18,
                opacity: titleSpring,
                transform: `translateX(${interpolate(titleSpring, [0, 1], [-36, 0])}px)`,
              },
            },
            scene.badge
          ),
          h(
            "h2",
            {
              style: {
                margin: 0,
                fontSize: showBrandHeader ? 58 : 62,
                fontWeight: 900,
                lineHeight: 1.05,
                textShadow: "0 8px 28px rgba(0,0,0,0.9)",
                opacity: titleSpring,
                transform: `translateY(${interpolate(titleSpring, [0, 1], [24, 0])}px)`,
              },
            },
            scene.title
          )
        )
      : null,
    layout === "split-versus"
      ? h(
          React.Fragment,
          null,
          h(
            "div",
            {
              style: {
                position: "absolute",
                top: 78 + topOffset,
                left: 48,
                right: 48,
                textAlign: "center",
              },
            },
            h(
              "div",
              {
                style: {
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
                },
              },
              scene.badge
            ),
            h(
              "h2",
              {
                style: {
                  margin: 0,
                  fontSize: 64,
                  fontWeight: 900,
                  lineHeight: 1.04,
                  textShadow: "0 8px 26px rgba(0,0,0,0.9)",
                },
              },
              scene.title
            )
          ),
          h(
            "div",
            {
              style: {
                position: "absolute",
                bottom: 350,
                left: 48,
                right: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 18,
                opacity: detailSpring,
                transform: `translateY(${interpolate(detailSpring, [0, 1], [30, 0])}px)`,
              },
            },
            h(
              "div",
              {
                style: {
                  flex: 1,
                  background: `linear-gradient(135deg, ${theme.primaryColor}E6, rgba(7,17,31,0.9))`,
                  borderBottom: `6px solid ${theme.accentColor}`,
                  borderRadius: 20,
                  padding: "22px 24px",
                },
              },
              h(
                "div",
                { style: { fontSize: 30, fontWeight: 900, textTransform: "uppercase" } },
                scene.leftLabel || "A"
              ),
              typeof scene.leftValue === "number"
                ? h(
                    "div",
                    { style: { fontSize: 52, fontWeight: 900, color: theme.accentColor } },
                    Math.round(leftAnim)
                  )
                : null
            ),
            h(
              "div",
              {
                style: {
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
                },
              },
              "VS"
            ),
            h(
              "div",
              {
                style: {
                  flex: 1,
                  background: `linear-gradient(135deg, ${theme.secondaryColor}E6, rgba(7,17,31,0.9))`,
                  borderBottom: "6px solid #FFFFFF",
                  borderRadius: 20,
                  padding: "22px 24px",
                  textAlign: "right",
                },
              },
              h(
                "div",
                { style: { fontSize: 30, fontWeight: 900, textTransform: "uppercase" } },
                scene.rightLabel || "B"
              ),
              typeof scene.rightValue === "number"
                ? h(
                    "div",
                    { style: { fontSize: 52, fontWeight: 900, color: "#FFFFFF" } },
                    Math.round(rightAnim)
                  )
                : null
            )
          )
        )
      : null,
    layout === "stat-overlay"
      ? h(
          React.Fragment,
          null,
          h(
            "div",
            {
              style: {
                position: "absolute",
                top: 82 + topOffset,
                left: 52,
                right: isHybrid ? 150 : 52,
              },
            },
            h(
              "div",
              {
                style: {
                  color: theme.accentColor,
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: 4,
                  textShadow: "0 4px 16px rgba(0,0,0,0.9)",
                },
              },
              scene.badge
            ),
            h(
              "h2",
              {
                style: {
                  margin: "10px 0 0 0",
                  fontSize: showBrandHeader ? 58 : 64,
                  fontWeight: 900,
                  lineHeight: 1.05,
                  textShadow: "0 8px 26px rgba(0,0,0,0.9)",
                },
              },
              scene.title
            )
          ),
          h(
            "div",
            {
              style: {
                position: "absolute",
                bottom: isEditorial ? 520 : 360,
                left: 52,
                right: 52,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                opacity: detailSpring,
                transform: `scale(${interpolate(detailSpring, [0, 1], [0.75, 1])})`,
              },
            },
            isEditorial
              ? h(
                  "div",
                  {
                    style: {
                      marginBottom: 24,
                      width: 120,
                      height: 120,
                      borderRadius: 34,
                      backgroundColor: `${theme.accentColor}22`,
                      border: `4px solid ${theme.accentColor}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  },
                  h(IconComp, { size: 64, color: theme.accentColor, strokeWidth: 2.3 })
                )
              : null,
            h(
              "div",
              {
                style: {
                  fontSize: 142,
                  fontWeight: 900,
                  lineHeight: 0.95,
                  color: theme.accentColor,
                  textShadow: "0 14px 40px rgba(0,0,0,0.95)",
                  letterSpacing: -4,
                  textAlign: "center",
                },
              },
              scene.highlightValue || "100%"
            ),
            scene.stampText
              ? h(
                  "div",
                  {
                    style: {
                      marginTop: 14,
                      padding: "10px 30px",
                      borderRadius: 12,
                      backgroundColor: theme.primaryColor,
                      border: `3px solid ${theme.accentColor}`,
                      color: "#FFFFFF",
                      fontSize: 34,
                      fontWeight: 900,
                      letterSpacing: 4,
                      transform: "rotate(-2.5deg)",
                      boxShadow: "0 14px 32px rgba(0,0,0,0.55)",
                    },
                  },
                  scene.stampText
                )
              : null
          )
        )
      : null,
    layout === "quote-press"
      ? h(
          React.Fragment,
          null,
          h(
            "div",
            {
              style: {
                position: "absolute",
                top: 82 + topOffset,
                left: 52,
                right: isHybrid ? 150 : 52,
              },
            },
            h(
              "div",
              {
                style: {
                  display: "inline-block",
                  padding: "8px 22px",
                  borderRadius: 8,
                  backgroundColor: showBrandHeader ? theme.primaryColor : "#DC2626",
                  color: "#FFFFFF",
                  fontSize: 24,
                  fontWeight: 900,
                  letterSpacing: 3,
                  marginBottom: 16,
                },
              },
              scene.badge || "CLAVE"
            ),
            h(
              "h2",
              {
                style: {
                  margin: 0,
                  fontSize: showBrandHeader ? 58 : 64,
                  fontWeight: 900,
                  lineHeight: 1.04,
                  textShadow: "0 8px 28px rgba(0,0,0,0.9)",
                },
              },
              scene.title
            )
          ),
          scene.quoteText
            ? h(
                "div",
                {
                  style: {
                    position: "absolute",
                    bottom: 350,
                    left: 52,
                    right: 52,
                    backgroundColor: "rgba(24, 28, 26, 0.88)",
                    borderLeft: `10px solid ${theme.accentColor}`,
                    borderRadius: 20,
                    padding: "26px 32px",
                    fontSize: 36,
                    fontWeight: 800,
                    lineHeight: 1.25,
                    boxShadow: "0 18px 40px rgba(0,0,0,0.6)",
                    opacity: detailSpring,
                    transform: `translateX(${interpolate(detailSpring, [0, 1], [-45, 0])}px)`,
                  },
                },
                `“${scene.quoteText}”`
              )
            : null
        )
      : null,
    layout === "cta-engage"
      ? h(
          React.Fragment,
          null,
          h(
            "div",
            {
              style: {
                position: "absolute",
                top: 90 + topOffset,
                left: 52,
                right: 52,
                textAlign: "center",
              },
            },
            h(
              "div",
              {
                style: {
                  color: theme.accentColor,
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: 4,
                  marginBottom: 14,
                },
              },
              scene.badge
            ),
            h(
              "h2",
              {
                style: {
                  margin: 0,
                  fontSize: showBrandHeader ? 62 : 70,
                  fontWeight: 900,
                  lineHeight: 1.04,
                  textShadow: "0 10px 30px rgba(0,0,0,0.9)",
                },
              },
              scene.title
            )
          ),
          h(
            "div",
            {
              style: {
                position: "absolute",
                bottom: 350,
                left: 52,
                right: 52,
                display: "flex",
                flexDirection: "column",
                gap: 18,
                opacity: detailSpring,
                transform: `translateY(${interpolate(detailSpring, [0, 1], [28, 0])}px)`,
              },
            },
            (scene.bullets || []).slice(0, 3).map((b, i) =>
              h(
                "div",
                {
                  key: i,
                  style: {
                    backgroundColor: "rgba(24, 28, 26, 0.86)",
                    border: `3px solid ${i === 0 ? theme.accentColor : "rgba(167, 169, 172, 0.5)"}`,
                    borderRadius: 22,
                    padding: "22px 28px",
                    fontSize: 34,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    boxShadow: isRoblox
                      ? "0 12px 28px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.28)"
                      : undefined,
                  },
                },
                h(
                  "span",
                  {
                    style: {
                      minWidth: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: theme.accentColor,
                      color: "#111613",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                    },
                  },
                  i + 1
                ),
                h("span", null, b)
              )
            ),
            h(
              "div",
              {
                style: {
                  backgroundColor: theme.accentColor,
                  color: "#111613",
                  borderRadius: 24,
                  padding: "26px 30px",
                  textAlign: "center",
                  fontSize: 40,
                  fontWeight: 900,
                  boxShadow: isRoblox
                    ? "0 16px 36px rgba(0,0,0,0.55), inset 0 3px 0 rgba(255,255,255,0.45)"
                    : "0 16px 36px rgba(0,0,0,0.55)",
                },
              },
              scene.ctaText || "¿TÚ QUÉ OPINAS? COMENTA ↓"
            )
          )
        )
      : null,
    showMidCallout
      ? h(MidSceneCallout, {
          scene,
          theme,
          isEditorial,
          visualStyle: activeVisualStyle,
        })
      : null,
    h(SceneSubtitle, {
      scene,
      accent: theme.accentColor,
      voiceSpeed,
      subtitleStyle,
      compact: isFlyerEnd,
    })
  );
};

const SceneTactics: React.FC<SceneCommonProps> = ({
  scene,
  theme,
  voiceSpeed,
  subtitleStyle,
  showBrandHeader,
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
        padding: showBrandHeader ? "190px 56px 86px" : "86px 56px",
        alignItems: "center",
      },
    },
    h(
      "div",
      { style: { fontSize: 26, fontWeight: 800, color: theme.accentColor, letterSpacing: 4 } },
      scene.badge
    ),
    h(
      "h2",
      { style: { fontSize: 58, fontWeight: 900, textAlign: "center", margin: "12px 0 34px 0" } },
      scene.title
    ),
    h(
      "svg",
      {
        viewBox: "0 0 900 840",
        style: {
          width: 940,
          height: 880,
          borderRadius: 32,
          backgroundColor: "#0E2D22",
          border: "4px solid rgba(255,255,255,0.16)",
        },
      },
      h("rect", { x: 40, y: 40, width: 820, height: 760, fill: "none", stroke: "rgba(255,255,255,0.28)", strokeWidth: 4 }),
      h("rect", { x: 210, y: 40, width: 480, height: 220, fill: "none", stroke: "rgba(255,255,255,0.28)", strokeWidth: 4 }),
      h("rect", { x: 330, y: 40, width: 240, height: 86, fill: "none", stroke: "rgba(255,255,255,0.28)", strokeWidth: 4 }),
      h("rect", { x: 385, y: 18, width: 130, height: 22, fill: "rgba(255,255,255,0.22)", stroke: "#FFFFFF", strokeWidth: 3 }),
      h("line", { x1: p6X, y1: p6Y, x2: p8X, y2: p8Y, stroke: "#60A5FA", strokeWidth: 6, strokeDasharray: "260", strokeDashoffset: pass1 }),
      h("line", { x1: p8X, y1: p8Y, x2: p19X, y2: p19Y, stroke: theme.accentColor, strokeWidth: 7, strokeDasharray: "340", strokeDashoffset: pass2 }),
      h("line", { x1: p19X, y1: p19Y, x2: 465, y2: 95, stroke: "#F43F5E", strokeWidth: 8, strokeDasharray: "240", strokeDashoffset: shot }),
      defenders.map((d, i) =>
        h("circle", { key: i, cx: d.x, cy: d.y, r: 27, fill: "#E2E8F0", stroke: "#0F172A", strokeWidth: 4 })
      ),
      attackers.map((pItem) =>
        h(
          "g",
          { key: pItem.label },
          h("circle", { cx: pItem.x, cy: pItem.y, r: 34, fill: theme.primaryColor, stroke: theme.secondaryColor, strokeWidth: 6 }),
          h(
            "text",
            { x: pItem.x, y: pItem.y + 10, textAnchor: "middle", fill: "#FFFFFF", fontSize: 27, fontWeight: 900 },
            pItem.label
          )
        )
      ),
      h("circle", { cx: ballX, cy: ballY, r: 14, fill: "#FFFFFF", stroke: "#0F172A", strokeWidth: 3 })
    ),
    scene.tacticCaption
      ? h(
          "div",
          {
            style: {
              marginTop: 28,
              width: "100%",
              backgroundColor: "rgba(255,255,255,0.06)",
              borderLeft: `8px solid ${theme.secondaryColor}`,
              borderRadius: 18,
              padding: "22px 28px",
              fontSize: 32,
              fontWeight: 700,
            },
          },
          scene.tacticCaption
        )
      : null,
    h(SceneSubtitle, {
      scene,
      accent: theme.accentColor,
      voiceSpeed,
      subtitleStyle,
    })
  );
};

function getTransitionPresentation(type: TransitionType | undefined, idx: number): any {
  const cycle: TransitionType[] = ["slide-left", "wipe", "slide-up", "fade", "flip"];
  const chosen = type || cycle[idx % cycle.length];
  if (chosen === "slide-left") return slide({ direction: "from-right" });
  if (chosen === "slide-up") return slide({ direction: "from-bottom" });
  if (chosen === "wipe") return wipe({ direction: "from-left" });
  if (chosen === "flip") return flip({ direction: "from-right" });
  return fade();
}

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
  const renderMode: RenderMode = spec.renderMode || "hybrid";
  const visualStyle: VisualStyle | undefined = spec.visualStyle;
  const animationStyle: AnimationStyle | undefined = spec.animationStyle;
  const sfxEnabled = spec.sfxEnabled !== false;
  const showBrandHeader = Boolean(spec.showBrandHeader);
  const resolvedGlobalAudio = resolveMediaSrc(audioUrl);
  const resolvedLogoSrc = showBrandHeader
    ? resolveMediaSrc(spec.companyLogoUrl || "logoasr.png")
    : undefined;

  const seriesChildren: React.ReactNode[] = [];

  spec.scenes.forEach((scene, index) => {
    const durationInFrames = getSceneFrames(scene, fps);
    const resolvedSceneAudio = resolveMediaSrc(scene.audioUrl);

    const audioNode =
      !resolvedGlobalAudio && resolvedSceneAudio
        ? h(
            Sequence,
            { from: SCENE_LEAD_IN_FRAMES },
            h(Audio, { src: resolvedSceneAudio, playbackRate: voiceSpeed })
          )
        : null;

    const whooshNode =
      sfxEnabled && index > 0
        ? h(
            Sequence,
            { from: 0, durationInFrames: 14 },
            h(Audio, { src: resolveMediaSrc("sfx/whoosh.wav") || "", volume: 0.22 })
          )
        : null;

    const sceneNode =
      scene.type === "tactics" &&
      scene.layout !== "animated-stage" &&
      !scene.svgScene?.trim() &&
      !scene.imageUrl &&
      !scene.videoUrl
        ? h(SceneTactics, {
            scene,
            theme,
            voiceSpeed,
            subtitleStyle,
            sceneIndex: index,
            renderMode,
            visualStyle,
            animationStyle,
            sfxEnabled,
            showBrandHeader,
          })
        : h(SceneDynamic, {
            scene,
            theme,
            voiceSpeed,
            subtitleStyle,
            sceneIndex: index,
            renderMode,
            visualStyle,
            animationStyle,
            sfxEnabled,
            showBrandHeader,
          });

    seriesChildren.push(
      h(
        TSSeq,
        { key: `seq-${scene.id || index}`, durationInFrames },
        audioNode,
        whooshNode,
        sceneNode
      )
    );

    if (index < spec.scenes.length - 1) {
      seriesChildren.push(
        h(TSTrans, {
          key: `trans-${scene.id || index}`,
          presentation: getTransitionPresentation(scene.transition, index),
          timing: linearTiming({ durationInFrames: TRANSITION_FRAMES }),
        })
      );
    }
  });

  return h(
    AbsoluteFill,
    { style: { backgroundColor: theme.bgColor } },
    resolvedGlobalAudio ? h(Audio, { src: resolvedGlobalAudio }) : null,
    h(TS, null, ...seriesChildren),
    showBrandHeader
      ? h(BrandHeaderBar, {
          companyName:
            spec.companyName || "UNIÓN DE PRODUCTORES DE CAÑA DE JOACHÍN",
          companyBadge: spec.companyBadge || "VACANTE DISPONIBLE",
          logoSrc: resolvedLogoSrc,
        })
      : null
  );
};
