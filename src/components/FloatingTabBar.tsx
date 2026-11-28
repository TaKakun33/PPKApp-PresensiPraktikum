import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, shadow, text } from '../constants/theme';

export default function FloatingTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: Math.max(insets.bottom, 10) }]}
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const isPresensi = route.name === 'presensi';
          const color = focused ? colors.onHighlight : colors.tabInactive;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;

          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigateToTab(route.key);
            }
          };

          const onLongPress = () => {
            emitter.emit({ type: 'tabLongPress', target: route.key });
          };

          if (isPresensi) {
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                style={({ pressed }) => [styles.presensiTab, pressed && styles.tabPressed]}
              >
                <View style={[styles.presensiCircle, focused && styles.presensiCircleFocused]}>
                  <Ionicons name="qr-code" size={28} color={colors.onHighlight} />
                </View>
                <Text
                  style={[styles.label, styles.presensiLabel, focused && styles.labelFocused]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={({ pressed }) => [styles.tab, focused && styles.tabActive, pressed && styles.tabPressed]}
            >
              {options.tabBarIcon?.({
                focused,
                color,
                size: focused ? 22 : 20,
              })}
              <Text style={[styles.label, { color }, focused && styles.labelFocused]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  bar: {
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    ...shadow.floating,
  },
  tab: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: radius.pill,
  },
  presensiTab: {
    flex: 1,
    height: 66,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 13,
  },
  presensiCircle: {
    position: 'absolute',
    top: -24,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.highlightOnBrand,
    borderWidth: 3,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.floating,
  },
  presensiCircleFocused: {
    transform: [{ scale: 1.04 }],
  },
  presensiLabel: {
    color: colors.highlightOnBrand,
  },
  // Bar = brand (30%); tab aktif = pill highlightOnBrand (aksen bila kontras cukup).
  tabActive: { backgroundColor: colors.highlightOnBrand },
  tabPressed: { opacity: 0.75 },
  label: { ...text.tab },
  labelFocused: { fontFamily: font.bold },
});
