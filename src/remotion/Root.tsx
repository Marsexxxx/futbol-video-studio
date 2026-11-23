import React from "react";
import { Composition } from "remotion";
import { DynamicVideo, DynamicVideoProps, getTotalFrames } from "./DynamicVideo";
import { DEFAULT_VIDEO_SPEC } from "../defaultVideo";

const RemotionComposition = Composition as React.ComponentType<any>;

export const RemotionRoot: React.FC = () => {
  return React.createElement(RemotionComposition, {
    id: "DynamicVideo",
    component: DynamicVideo,
    durationInFrames: getTotalFrames(DEFAULT_VIDEO_SPEC, 30),
    fps: 30,
    width: 1080,
    height: 1920,
    defaultProps: {
      spec: DEFAULT_VIDEO_SPEC,
      audioUrl: null,
    },
    calculateMetadata: ({ props }: { props: DynamicVideoProps }) => {
      const fps = 30;
      return {
        durationInFrames: getTotalFrames(props.spec, fps),
        fps,
        width: 1080,
        height: 1920,
      };
    },
  });
};
