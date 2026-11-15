import React from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

interface Props extends ScrollViewProps {
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  /** Rendered above the scroll view (e.g. a fixed header). */
  header?: React.ReactNode;
  /** Rendered below the scroll view (e.g. a sticky footer). */
  footer?: React.ReactNode;
}

/** Page container: safe area, background colour, centred max width for tablets/web. */
export function Screen({ scroll = true, edges = ['top'], contentStyle, header, footer, children, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.column}>
        {header}
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            {...rest}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, contentStyle]}>{children}</View>
        )}
        {footer}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  flex: { flex: 1 },
});
