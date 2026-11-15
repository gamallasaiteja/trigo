import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { font, useTheme } from '@/theme';

type Variant = keyof typeof font;
type Tone = 'default' | 'secondary' | 'muted' | 'primary' | 'danger' | 'inverse';

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function Text({ variant = 'body', tone = 'default', color, align, style, ...rest }: Props) {
  const { colors } = useTheme();
  const toneColor = {
    default: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    primary: colors.primary,
    danger: colors.danger,
    inverse: colors.onPrimary,
  }[tone];
  return <RNText style={[font[variant], { color: color ?? toneColor, textAlign: align }, style]} {...rest} />;
}
