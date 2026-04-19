import React from 'react';
import { Composition } from 'remotion';
import { LogoReveal } from './LogoReveal';
import {
  BannerCinematic,
  BannerZoomThrough,
  BannerOrbit,
  BannerGlitch,
  BannerPulse,
} from './BannerAnimations';
import { MyComposition } from '../modules/video/remotion/MyComposition';
import type { VideoProject } from '../modules/video/store/videoEditorStore';

const DEFAULT_VIDEO_PROJECT: VideoProject = {
  id: 'default',
  name: 'Default Project',
  fps: 30,
  durationInFrames: 300,
  width: 1920,
  height: 1080,
  tracks: [],
  clips: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Video Project — Full timeline composition for user projects & Veo stitching */}
      <Composition
        id="VideoProject"
        component={MyComposition}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ project: DEFAULT_VIDEO_PROJECT }}
        calculateMetadata={({ props }) => ({
          durationInFrames: props.project.durationInFrames || 300,
          fps: props.project.fps || 30,
          width: props.project.width || 1920,
          height: props.project.height || 1080,
        })}
      />

      {/* Logo Reveal — original */}
      <Composition
        id="LogoReveal"
        component={LogoReveal}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="LogoRevealSquare"
        component={LogoReveal}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="LogoRevealVertical"
        component={LogoReveal}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
      />

      {/* Banner Animations — 5 variants */}
      <Composition
        id="BannerCinematic"
        component={BannerCinematic}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="BannerZoomThrough"
        component={BannerZoomThrough}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="BannerOrbit"
        component={BannerOrbit}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="BannerGlitch"
        component={BannerGlitch}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="BannerPulse"
        component={BannerPulse}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1080}
      />
    </>
  );
};
