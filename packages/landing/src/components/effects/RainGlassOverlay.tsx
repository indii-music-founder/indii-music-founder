import React from 'react';
import './RainGlassOverlay.css';

type DropletShape = 'round' | 'pear' | 'soft';

type Droplet = {
  left: string;
  top: string;
  size: number;
  stretch?: number;
  opacity?: number;
  drift?: boolean;
  delay?: string;
  duration?: string;
  shape?: DropletShape;
};

const droplets: Droplet[] = [
  { left: '5%', top: '14%', size: 7, opacity: 0.62, shape: 'soft' },
  { left: '11%', top: '43%', size: 13, stretch: 1.1, opacity: 0.68, drift: true, delay: '-8s', duration: '34s', shape: 'pear' },
  { left: '17%', top: '74%', size: 5, opacity: 0.54, shape: 'round' },
  { left: '23%', top: '25%', size: 9, stretch: 1.14, opacity: 0.62, shape: 'soft' },
  { left: '31%', top: '9%', size: 4, opacity: 0.48, shape: 'round' },
  { left: '37%', top: '58%', size: 18, stretch: 1.13, opacity: 0.7, drift: true, delay: '-18s', duration: '41s', shape: 'pear' },
  { left: '45%', top: '34%', size: 6, opacity: 0.52, shape: 'round' },
  { left: '52%', top: '82%', size: 10, stretch: 1.05, opacity: 0.58, shape: 'soft' },
  { left: '58%', top: '17%', size: 14, stretch: 1.16, opacity: 0.67, drift: true, delay: '-11s', duration: '37s', shape: 'pear' },
  { left: '64%', top: '49%', size: 5, opacity: 0.5, shape: 'round' },
  { left: '70%', top: '69%', size: 8, opacity: 0.58, shape: 'soft' },
  { left: '76%', top: '29%', size: 19, stretch: 1.12, opacity: 0.71, drift: true, delay: '-23s', duration: '45s', shape: 'pear' },
  { left: '82%', top: '8%', size: 6, opacity: 0.52, shape: 'round' },
  { left: '87%', top: '54%', size: 11, stretch: 1.08, opacity: 0.62, shape: 'soft' },
  { left: '92%', top: '80%', size: 5, opacity: 0.46, shape: 'round' },
  { left: '96%', top: '36%', size: 8, stretch: 1.12, opacity: 0.58, shape: 'soft' },
];

export default function RainGlassOverlay() {
  return (
    <div className="rain-glass" aria-hidden="true">
      {droplets.map((drop, index) => {
        const shape = drop.shape ?? 'round';
        const className = [
          'rain-glass__drop',
          `rain-glass__drop--${shape}`,
          drop.drift ? 'rain-glass__drop--drift' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <span
            key={index}
            className={className}
            style={{
              left: drop.left,
              top: drop.top,
              width: drop.size,
              height: drop.size * (drop.stretch ?? 1),
              opacity: drop.opacity ?? 0.62,
              animationDelay: drop.delay,
              animationDuration: drop.duration,
            }}
          />
        );
      })}
    </div>
  );
}
