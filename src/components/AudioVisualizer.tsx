import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  colorTheme?: 'purple' | 'cyan' | 'amber';
  barCount?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  audioRef,
  colorTheme = 'purple',
  barCount = 36,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const bars = new Array(barCount).fill(0).map(() => ({
      height: 10,
      targetHeight: 10,
      velocity: 0,
      speed: 0.05 + Math.random() * 0.08,
      freqMultiplier: 0.8 + Math.random() * 1.4,
    }));

    const render = () => {
      time += 0.05;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const gap = 3;
      const barWidth = (width - gap * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        const bar = bars[i];
        if (isPlaying) {
          // Dynamic organic wave calculation simulating high-res spectrum
          const sine1 = Math.sin(time * bar.speed * 4 + i * 0.28);
          const sine2 = Math.cos(time * 2.5 + i * 0.5);
          const noise = Math.sin(time * 6 + i * 1.2) * 0.25;
          const normalized = Math.max(0.12, (sine1 * 0.5 + sine2 * 0.35 + noise + 0.95) / 2);
          bar.targetHeight = normalized * (height * 0.85);
        } else {
          bar.targetHeight = 4;
        }

        // Smooth damping
        bar.height += (bar.targetHeight - bar.height) * 0.2;

        const x = i * (barWidth + gap);
        const y = height - bar.height;

        // Gradient based on colorTheme
        const gradient = ctx.createLinearGradient(0, height, 0, y);
        if (colorTheme === 'cyan') {
          gradient.addColorStop(0, '#06b6d4');
          gradient.addColorStop(0.6, '#3b82f6');
          gradient.addColorStop(1, '#a855f7');
        } else if (colorTheme === 'amber') {
          gradient.addColorStop(0, '#f59e0b');
          gradient.addColorStop(0.7, '#ec4899');
          gradient.addColorStop(1, '#ef4444');
        } else {
          gradient.addColorStop(0, '#8b5cf6');
          gradient.addColorStop(0.5, '#ec4899');
          gradient.addColorStop(1, '#06b6d4');
        }

        ctx.fillStyle = gradient;

        // Rounded bar top
        const radius = Math.min(barWidth / 2, 3);
        ctx.beginPath();
        ctx.moveTo(x, height);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, height);
        ctx.closePath();
        ctx.fill();

        // Little floating peak dot if active
        if (isPlaying && bar.height > 15) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + barWidth / 2 - 1, y - 4, 2, 2);
        }
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPlaying, colorTheme, barCount]);

  return (
    <div className="w-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={380}
        height={50}
        className="w-full h-12 max-w-md filter drop-shadow-[0_0_12px_rgba(168,85,247,0.3)]"
      />
    </div>
  );
};
