"use client";

import React from "react";
import { MotionConfig } from "framer-motion";

export function MotionConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      {children}

      {/* Textura editorial ultra-sutil de papel (Micro-Grain SVG) */}
      <svg
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-50 w-full h-full opacity-[0.025] dark:opacity-[0.03]"
      >
        <filter id="cadernin-paper-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.82"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect
          width="100%"
          height="100%"
          filter="url(#cadernin-paper-grain)"
        />
      </svg>
    </MotionConfig>
  );
}
