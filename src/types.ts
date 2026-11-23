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
  | "cta-engage";

export type CameraMotion =
  | "impact-punch"
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right";

export type SubtitleStyle = "dynamic" | "classic";
export type VisualStyle = "photoreal" | "hyperart" | "editorial3d";

export interface VideoScene {
  id: string;
  type: SceneType;
  layout?: SceneLayout;
  cameraMotion?: CameraMotion;
  durationSeconds: number;
  badge: string;
  title: string;
  subtitle: string;
  imagePrompt?: string;
  fallbackImagePrompt?: string;
  quoteText?: string;
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
  svgMarkup?: string;
  audioUrl?: string;
  rawAudioDuration?: number;
  audioAssetKey?: string;
  imageAssetKey?: string;
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
  globalAudioKey?: string;
}
