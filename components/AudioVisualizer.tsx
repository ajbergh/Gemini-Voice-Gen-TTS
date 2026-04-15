/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  color?: string;
}

const GOOGLE_COLORS = [
  '#3186FF', // Blue
  '#FC413D', // Red
  '#FEC700', // Yellow
  '#0EBC5F', // Green
];

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
}

function interpolateColor(color1: string, color2: string, factor: number) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  const r = rgb1.r + (rgb2.r - rgb1.r) * factor;
  const g = rgb1.g + (rgb2.g - rgb1.g) * factor;
  const b = rgb1.b + (rgb2.b - rgb1.b) * factor;
  
  return rgbToHex(r, g, b);
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isPlaying, color = '#18181b' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for retina displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      if (!ctx || !canvas) return;
      
      const width = rect.width;
      const height = rect.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      if (!isPlaying) {
        // Draw a flat line when not playing
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      phaseRef.current += 0.15;
      
      // Calculate current color based on phase
      // Slow down the color cycle relative to the wave animation
      const colorPhase = phaseRef.current * 0.05; 
      const colorIndex = Math.floor(colorPhase) % GOOGLE_COLORS.length;
      const nextColorIndex = (colorIndex + 1) % GOOGLE_COLORS.length;
      const colorFactor = colorPhase % 1;
      
      const currentColor = interpolateColor(
        GOOGLE_COLORS[colorIndex], 
        GOOGLE_COLORS[nextColorIndex], 
        colorFactor
      );

      ctx.beginPath();
      ctx.moveTo(0, centerY);

      const points = 100;
      for (let i = 0; i <= points; i++) {
        const x = (i / points) * width;
        
        // Combine multiple sine waves for a more complex "voice" look
        // We modulate the amplitude based on x to taper the ends
        const envelope = Math.sin((i / points) * Math.PI); 
        
        const y = centerY + 
          Math.sin(i * 0.2 + phaseRef.current) * 15 * envelope +
          Math.sin(i * 0.5 - phaseRef.current * 2) * 8 * envelope +
          Math.sin(i * 0.1 + phaseRef.current * 0.5) * 5 * envelope;

        ctx.lineTo(x, y);
      }

      ctx.strokeStyle = currentColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.8;
      ctx.stroke();
      
      // Add a second, fainter line for depth
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      for (let i = 0; i <= points; i++) {
        const x = (i / points) * width;
        const envelope = Math.sin((i / points) * Math.PI); 
        const y = centerY + 
          Math.sin(i * 0.2 + phaseRef.current + 1) * 15 * envelope;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, color]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default AudioVisualizer;