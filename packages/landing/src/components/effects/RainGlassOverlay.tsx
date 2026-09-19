import React from 'react';
import './RainGlassOverlay.css';

type DropletShape = 'round' | 'pear' | 'soft';

type Droplet = {
  left: string;
  top: string;
  size: number;
  stretch?: number;
  opacity?: number;
  shape?: DropletShape;
};

const droplets: Droplet[] = [
  { left: '6%', top: '16%', size: 5, opacity: 0.5, shape: 'round' },
  { left: '13%', top: '46%', size: 11, stretch: 1.08, opacity: 0.6, shape: 'pear' },
  { left: '21%', top: '76%', size: 4, opacity: 0.42, shape: 'round' },
  { left: '28%', top: '27%', size: 7, stretch: 1.1, opacity: 0.52, shape: 'soft' },
  { left: '36%', top: '11%', size: 3, opacity: 0.38, shape: 'round' },
  { left: '42%', top: '61%', size: 15, stretch: 1.11, opacity: 0.63, shape: 'pear' },
  { left: '51%', top: '36%', size: 5, opacity: 0.44, shape: 'round' },
  { left: '58%', top: '84%', size: 8, stretch: 1.04, opacity: 0.5, shape: 'soft' },
  { left: '65%', top: '18%', size: 12, stretch: 1.13, opacity: 0.58, shape: 'pear' },
  { left: '72%', top: '52%', size: 4, opacity: 0.4, shape: 'round' },
  { left: '79%', top: '72%', size: 6, opacity: 0.48, shape: 'soft' },
  { left: '84%', top: '31%', size: 17, stretch: 1.09, opacity: 0.64, shape: 'pear' },
  { left: '90%', top: '10%', size: 5, opacity: 0.44, shape: 'round' },
  { left: '94%', top: '58%', size: 9, stretch: 1.07, opacity: 0.54, shape: 'soft' },
];

export default function RainGlassOverlay() {
  return (
    <div className="rain-glass" aria-hidden="true">
      {droplets.map((drop, index) => {
        const shape = drop.shape ?? 'round';

        return (
          <span
            key={index}
            className={`rain-glass__drop rain-glass__drop--${shape}`}
            style={{
              left: drop.left,
              top: drop.top,
              width: drop.size,
              height: drop.size * (drop.stretch ?? 1),
              opacity: drop.opacity ?? 0.5,
            }}
          />
        );
      })}
    </div>
  );
}
