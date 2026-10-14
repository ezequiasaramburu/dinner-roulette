import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BackButton, Screen, Text } from '@/components/ui';
import { LEGAL, type LegalDoc } from '@/constants/legal';
import { Spacing } from '@/constants/theme';

/** Terms of Use and Privacy Policy. Reachable signed out (from the welcome screen) and signed in (from Settings). */
export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = LEGAL[doc as LegalDoc] ?? LEGAL.terms;

  return (
    <Screen>
      <BackButton />
      <Text variant="title" style={styles.title}>
        {content.title}
      </Text>
      {content.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text variant="heading">{section.heading}</Text>
          {section.body.map((paragraph) => (
            <Text key={paragraph} tone="secondary">
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: Spacing.lg },
  section: { gap: Spacing.sm, marginTop: Spacing.lg },
});
