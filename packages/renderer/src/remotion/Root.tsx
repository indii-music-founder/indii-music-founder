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

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
