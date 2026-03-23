'use client';

import { useRef, useState, useCallback } from 'react';

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt?: string;
  afterAlt?: string;
  label?: string;
}

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeAlt = 'Before',
  afterAlt = 'After',
  label,
}: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    updatePosition(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [updatePosition]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    updatePosition(e.clientX);
  }, [isDragging, updatePosition]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-2">
      {label && (
        <p className="text-sm font-medium text-gray-700">{label}</p>
      )}
      <div
        ref={containerRef}
        className="relative aspect-[4/3] w-full cursor-col-resize select-none overflow-hidden rounded-lg"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* After image (full, underneath) */}
        <img
          src={afterSrc}
          alt={afterAlt}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {/* Before image (clipped via clip-path — image stays stationary) */}
        <img
          src={beforeSrc}
          alt={beforeAlt}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          draggable={false}
        />

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 z-10 w-0.5 bg-white shadow-lg"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          {/* Handle */}
          <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-white/90 shadow-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
              <polyline points="15 18 9 12 15 6" />
              <polyline points="9 18 15 12 9 6" transform="translate(6, 0)" />
            </svg>
          </div>
        </div>

        {/* Labels */}
        <div className="pointer-events-none absolute top-3 left-3 z-20 rounded bg-black/60 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white">
          Before
        </div>
        <div className="pointer-events-none absolute top-3 right-3 z-20 rounded bg-black/60 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white">
          After
        </div>
      </div>
    </div>
  );
}
