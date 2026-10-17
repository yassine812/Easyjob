'use client';

import React, { useId } from 'react';

export function EasyJobLoader({
  width = 220,
  height = 75,
  className = '',
  label = 'EasyJob loading',
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
  label?: string;
}) {
  const gradientId = `easyjob-gradient-${useId().replace(/:/g, '')}`;
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className={`easyjob-loader flex items-center justify-center ${className}`}
      style={{ visibility: 'visible', opacity: 1 }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 340 100"
        width={width}
        height={height}
        className="max-w-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3F5FDE" />
            <stop offset="50%" stopColor="#5B73E8" />
            <stop offset="100%" stopColor="#4F46C8" />
          </linearGradient>
        </defs>

        {/* Base Stroke Guides (Ensures EasyJob wordmark is ALWAYS 100% visible on screen) */}
        <g stroke="#3F5FDE" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.25">
          {/* E */}
          <path d="M 62 26 H 26 V 78 H 64 M 26 52 H 58" />
          {/* a */}
          <path d="M 102 46 C 84 46 84 78 102 78 C 116 78 116 58 116 46 V 78" />
          {/* s */}
          <path d="M 154 48 C 132 42 130 60 142 64 C 156 68 153 84 132 78" />
          {/* y */}
          <path d="M 166 46 L 180 70 M 194 46 L 168 96 C 160 108 146 104 142 98" />
          {/* J */}
          <path d="M 206 26 H 238 M 226 26 V 74 C 226 88 210 88 200 78" />
          {/* o */}
          <path d="M 264 62 C 264 44 240 44 240 62 C 240 80 264 80 264 62 Z" />
          {/* b */}
          <path d="M 284 24 V 78 C 284 78 308 78 308 60 C 308 42 284 42 284 56" />
        </g>

        {/* Animated Drawing Overlay (E -> a -> s -> y -> J -> o -> b) */}
        <g stroke={`url(#${gradientId})`} strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round">
          {/* E */}
          <path
            d="M 62 26 H 26 V 78 H 64 M 26 52 H 58"
            className="easyjob-stroke-E"
          />
          {/* a */}
          <path
            d="M 102 46 C 84 46 84 78 102 78 C 116 78 116 58 116 46 V 78"
            className="easyjob-stroke-a"
          />
          {/* s */}
          <path
            d="M 154 48 C 132 42 130 60 142 64 C 156 68 153 84 132 78"
            className="easyjob-stroke-s"
          />
          {/* y */}
          <path
            d="M 166 46 L 180 70 M 194 46 L 168 96 C 160 108 146 104 142 98"
            className="easyjob-stroke-y"
          />
          {/* J */}
          <path
            d="M 206 26 H 238 M 226 26 V 74 C 226 88 210 88 200 78"
            className="easyjob-stroke-J"
          />
          {/* o */}
          <path
            d="M 264 62 C 264 44 240 44 240 62 C 240 80 264 80 264 62 Z"
            className="easyjob-stroke-o"
          />
          {/* b */}
          <path
            d="M 284 24 V 78 C 284 78 308 78 308 60 C 308 42 284 42 284 56"
            className="easyjob-stroke-b"
          />
        </g>
      </svg>
    </div>
  );
}

export function EasyJobLoadingScreen({
  text,
}: {
  text?: string;
}) {
  return (
    <div className="easyjob-loading-screen bg-background text-foreground">
      <EasyJobLoader width={220} height={75} label={text} />
    </div>
  );
}

export function EasyJobLoading({ label, className = '' }: { label?: string; className?: string }) {
  return <div className={`flex min-h-28 items-center justify-center py-6 ${className}`}><EasyJobLoader label={label} /></div>;
}
