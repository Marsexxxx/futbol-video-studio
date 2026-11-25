export type SceneType =
  | "cinematic"
  | "tactics"
  | "hook"
  | "versus"
  | "headline"
  | "cta"
  | "custom";

export type SceneLayout =
  | "hero-impact"
  | "story-clean"
  | "split-versus"
  | "stat-overlay"
  | "quote-press"
  | "cta-engage"
  | "flyer-end"
  | "animated-stage";

export type CameraMotion =
  | "impact-punch"
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right";

export type RenderMode = "animated" | "hybrid" | "editorial" | "cinematic";
export type AnimationStyle =
  | "pixel-art"
  | "chalkboard"
  | "neon-sketch"
  | "ps2-retro"
  | "comic"
  | "flat-vector"
  | "minimal-line"
  | "cgi"
  | "lego"
  | "3d-explainer";
export type TransitionType = "slide-left" | "slide-up" | "wipe" | "fade" | "flip";
export type StudioMode = "general" | "recruitment";

export type SubtitleStyle = "dynamic" | "classic";
export type VisualStyle =
  | "photoreal"
  | "hyperart"
  | "editorial3d"
  | "anime"
  | "editorial"
  | "pixelart"
  | "lego"
  | "roblox";
export type TopicMode =
  | "auto"
  | "sports"
  | "story"
  | "tech"
  | "viral"
  | "cinema"
  | "recruitment";

export interface VideoScene {
  id: string;
  type: SceneType;
  sceneMode?: RenderMode;
  layout?: SceneLayout;
  cameraMotion?: CameraMotion;
  transition?: TransitionType;
  iconName?: string;
  calloutText?: string;
  durationSeconds: number;
  badge: string;
  title: string;
  subtitle: string;
  imagePrompt?: string;
  fallbackImagePrompt?: string;
  quoteText?: string;
  ctaText?: string;
  highlightValue?: string;
  stampText?: string;
  jerseyNumber?: string;
  leftLabel?: string;
  leftValue?: number;
  rightLabel?: string;
  rightValue?: number;
  bullets?: string[];
  tacticCaption?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoName?: string;
  videoMuted?: boolean;
  svgMarkup?: string;
  svgScene?: string;
  speechBubble?: string;
  audioUrl?: string;
  rawAudioDuration?: number;
  audioAssetKey?: string;
  imageAssetKey?: string;
  videoAssetKey?: string;
}

export interface VideoTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
}

export interface VideoSpec {
  title: string;
  theme: VideoTheme;
  scenes: VideoScene[];
  voiceSpeed?: number;
  subtitleStyle?: SubtitleStyle;
  renderMode?: RenderMode;
  visualStyle?: VisualStyle;
  animationStyle?: AnimationStyle;
  sfxEnabled?: boolean;
  targetDuration?: number;
  globalAudioKey?: string;
  studioMode?: StudioMode;
  showBrandHeader?: boolean;
  companyName?: string;
  companyBadge?: string;
  companyLogoUrl?: string;
  companyLogoAssetKey?: string;
}
