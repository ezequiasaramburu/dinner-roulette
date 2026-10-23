import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; active: IconName }[] = [
  { name: 'index', title: 'Tonight', icon: 'restaurant-outline', active: 'restaurant' },
  { name: 'dinners', title: 'Dinners', icon: 'calendar-outline', active: 'calendar' },
  { name: 'recipes', title: 'Recipes', icon: 'book-outline', active: 'book' },
];

/** The three places you come back to. Swiping, the reveal, a recipe and settings open above the bar. */
export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.background },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        tabBarLabelStyle: { fontFamily: Fonts.medium, fontSize: 12 },
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? tab.active : tab.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
