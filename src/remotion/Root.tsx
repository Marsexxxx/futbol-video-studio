import React from "react";
import { Composition } from "remotion";
import { DynamicVideo, DynamicVideoProps } from "./DynamicVideo";
import { DEFAULT_VIDEO_SPEC } from "../defaultVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DynamicVideo"
      component={DynamicVideo}
      durationInFrames={30 * 28}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        spec: DEFAULT_VIDEO_SPEC,
        audioUrl: null,
      }}
      calculateMetadata={({ props }: { props: DynamicVideoProps }) => {
        const fps = 30;
        const totalFrames = (props.spec?.scenes || []).reduce(
          (acc, scene) =>
            acc + Math.max(30, Math.ceil((scene.durationSeconds || 5) * fps)),
          0
        );
        return {
          durationInFrames: Math.max(30, totalFrames),
          fps,
          width: 1080,
          height: 1920,
        };
      }}
    />
  );
};
