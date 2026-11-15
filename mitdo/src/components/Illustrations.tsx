import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** Friendly mountain-and-path scene for the dashboard hero card. */
export function MountainIllustration({ width = 150, height = 110 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 150 110" accessibilityLabel="Mountain with a winding path">
      <Defs>
        <LinearGradient id="mtn" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#9C8F86" />
          <Stop offset="1" stopColor="#6E625B" />
        </LinearGradient>
        <LinearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7CC57F" />
          <Stop offset="1" stopColor="#3F9A55" />
        </LinearGradient>
      </Defs>
      <Circle cx="124" cy="22" r="11" fill="#FFD25A" />
      <Circle cx="124" cy="22" r="16" fill="#FFD25A" opacity={0.25} />
      <G opacity={0.95}>
        <Ellipse cx="30" cy="26" rx="14" ry="6" fill="#FFFFFF" />
        <Ellipse cx="40" cy="22" rx="10" ry="6" fill="#FFFFFF" />
      </G>
      <Path d="M18 92 L66 18 L114 92 Z" fill="url(#mtn)" />
      <Path d="M66 18 L80 40 L72 37 L66 44 L60 37 L53 39 Z" fill="#FFFFFF" />
      <Path d="M66 18 L114 92 L92 92 L70 40 Z" fill="#000" opacity={0.08} />
      <Path d="M0 96 C25 76 55 80 80 88 C105 96 125 80 150 84 L150 110 L0 110 Z" fill="url(#hill)" />
      <Path
        d="M74 108 C70 100 92 98 86 92 C80 86 62 90 66 82 C70 74 80 74 72 66"
        stroke="#F4E2B8"
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
      <G>
        <Rect x="22" y="86" width="3" height="8" fill="#6B4A2E" />
        <Path d="M23.5 70 L32 88 L15 88 Z" fill="#2F8048" />
        <Rect x="122" y="80" width="3" height="8" fill="#6B4A2E" />
        <Path d="M123.5 64 L132 82 L115 82 Z" fill="#2F8048" />
        <Rect x="134" y="84" width="2.5" height="6" fill="#6B4A2E" />
        <Path d="M135.2 72 L141 86 L129.5 86 Z" fill="#3E9A58" />
        <Circle cx="44" cy="98" r="5" fill="#2F8048" />
        <Circle cx="104" cy="100" r="4" fill="#2F8048" />
      </G>
      <Path d="M71 66 L71 54" stroke="#6B4A2E" strokeWidth={1.5} />
      <Path d="M71 54 L80 57 L71 60 Z" fill="#E5484D" />
    </Svg>
  );
}

/** Small trophy for the monthly progress card. */
export function TrophyIllustration({ size = 84 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 84 84" accessibilityLabel="Trophy">
      <Defs>
        <LinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFD86B" />
          <Stop offset="1" stopColor="#F0A030" />
        </LinearGradient>
      </Defs>
      <Circle cx="12" cy="18" r="3" fill="#8B5CF6" />
      <Circle cx="72" cy="12" r="2.5" fill="#E0577F" />
      <Circle cx="76" cy="40" r="2" fill="#3B82F6" />
      <Path d="M8 46 l4 -2 l-1 4 z" fill="#218C52" />
      <Path d="M66 26 l5 1 l-3 3 z" fill="#F0A030" />
      <Path d="M24 22 C12 22 12 42 30 42" stroke="#F0A030" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Path d="M60 22 C72 22 72 42 54 42" stroke="#F0A030" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Path d="M24 14 H60 V30 C60 42 52 50 42 50 C32 50 24 42 24 30 Z" fill="url(#gold)" />
      <Path d="M30 18 V30 C30 36 33 41 37 44" stroke="#FFF1C2" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.8} />
      <Rect x="38" y="50" width="8" height="10" fill="#F0A030" />
      <Rect x="28" y="60" width="28" height="7" rx="2" fill="#7A5AE0" />
      <Rect x="24" y="66" width="36" height="8" rx="3" fill="#5B3FC4" />
    </Svg>
  );
}
