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
          const color = focused ? colors.secondary : colors.tabInactive;
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
  // Tab aktif = pill lavender muda (sorotan 10%) di atas bar plum (bagian 30%).
  tabActive: { backgroundColor: colors.primarySoft },
  tabPressed: { opacity: 0.75 },
  label: { ...text.tab },
  labelFocused: { fontFamily: font.bold },
});
