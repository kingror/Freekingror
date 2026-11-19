import React, { useId } from 'react';

interface RornLogoProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

export const RornLogo: React.FC<RornLogoProps> = ({
  size = 48,
  animated = false,
  className = '',
}) => {
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const coolRId = `rorn-cool-r-${uid}`;
  const coolBgId = `rorn-cool-bg-${uid}`;
  const orbitGradId = `rorn-orbit-${uid}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${
        animated ? 'rorn-logo-cool' : ''
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {animated && (
        <svg
          width={size + 14}
          height={size + 14}
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[7px] h-[calc(100%+14px)] w-[calc(100%+14px)] rorn-orbit-cool"
        >
          <defs>
            <linearGradient id={orbitGradId} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#6366F1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect
            x="3"
            y="3"
            width="94"
            height="94"
            rx="26"
            stroke={`url(#${orbitGradId})`}
            strokeWidth="2.5"
            strokeDasharray="110 180"
          />
        </svg>
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="relative z-10"
      >
        <defs>
          <linearGradient id={coolRId} x1="168" y1="128" x2="394" y2="384" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#67E8F9" />
            <stop offset="50%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          <linearGradient id={coolBgId} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#121B2E" />
            <stop offset="100%" stopColor="#080C16" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="116" fill="#070A12" />
        <rect
          x="24"
          y="24"
          width="464"
          height="464"
          rx="96"
          fill={`url(#${coolBgId})`}
          stroke="#1E3A5F"
          strokeWidth="6"
        />
        {/* Vertical stem of R */}
        <rect x="136" y="128" width="60" height="256" rx="12" fill="#E0F2FE" />
        {/* Bowl + dynamic blade of R in cool cyan-azure-indigo */}
        <path
          d="M214 128H304C354.8 128 388 159.2 388 205C388 242.4 364.6 270.2 326.8 279.2L394 384H324.4L265.2 284H214V232H296C317.6 232 330 221.2 330 205C330 188.8 317.6 178 296 178H214V128Z"
          fill={`url(#${coolRId})`}
        />
        {/* Cool glacial optical node */}
        <circle cx="294" cy="205" r="14" fill="#A5F3FC" />
      </svg>
    </div>
  );
};
