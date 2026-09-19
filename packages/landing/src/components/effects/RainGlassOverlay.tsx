import React from 'react';
import './RainGlassOverlay.css';

type Droplet = {
  left: string;
  top: string;
  size: number;
  stretch?: number;
  opacity?: number;
  drift?: boolean;
  delay?: string;
  duration?: string;
};

const droplets: Droplet[] = [
  { left: '5%', top: '14%', size: 7, opacity: 0.68 },
  { left: '11%', top: '43%', size: 14, stretch: 1.08, opacity: 0.72, drift: true, delay: '-8s', duration: '31s' },
  { left: '17%', top: '74%', size: 5, opacity: 0.58 },
  { left: '23%', top: '25%', size: 9, stretch: 1.16, opacity: 0.66 },
  { left: '31%', top: '9%', size: 4, opacity: 0.52 },
  { left: '37%', top: '58%', size: 20, stretch: 1.12, opacity: 0.76, drift: true, delay: '-18s', duration: '38s' },
  { left: '45%', top: '34%', size: 6, opacity: 0.56 },
  { left: '52%', top: '82%', size: 11, stretch: 1.05, opacity: 0.64 },
  { left: '58%', top: '17%', size: 16, stretch: 1.18, opacity: 0.72, drift: true, delay: '-11s', duration: '34s' },
  { left: '64%', top: '49%', size: 5, opacity: 0.54 },
  { left: '70%', top: '69%', size: 8, opacity: 0.62 },
  { left: '76%', top: '29%', size: 24, stretch: 1.16, opacity: 0.78, drift: true, delay: '-23s', duration: '42s' },
  { left: '82%', top: '8%', size: 6, opacity: 0.56 },
  { left: '87%', top: '54%', size: 12, stretch: 1.1, opacity: 0.68 },
  { left: '92%', top: '80%', size: 5, opacity: 0.5 },
  { left: '96%', top: '36%', size: 9, stretch: 1.14, opacity: 0.64 },
];

export default function RainGlassOverlay() {
  return (
    <div className="rain-glass" aria-hidden="true">
      {droplets.map((drop, index) => (
        <span
          key={index}
          className={drop.drift ? 'rain-glass__drop rain-glass__drop--drift' : 'rain-glass__drop'}
          style={{
            left: drop.left,
            top: drop.top,
            width: drop.size,
            height: drop.size * (drop.stretch ?? 1),
            opacity: drop.opacity ?? 0.68,
            animationDelay: drop.delay,
            animationDuration: drop.duration,
          }}
        />
      ))}
    </div>
  );
}
