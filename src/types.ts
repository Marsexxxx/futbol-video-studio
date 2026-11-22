export type SceneType = "hook" | "tactics" | "versus" | "headline" | "cta";

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
  audioUrl?: string;
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
}
