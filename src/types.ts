export type SceneType = "custom" | "hook" | "tactics" | "versus" | "headline" | "cta";
export type SubtitleStyle = "dynamic" | "classic";

export interface VideoScene {
  id: string;
  type: SceneType;
  durationSeconds: number;
  badge: string;
  title: string;
  subtitle: string;
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
