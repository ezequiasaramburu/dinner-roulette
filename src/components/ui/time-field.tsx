import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { ControlHeight, Fonts, Radius, Spacing } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';

type Props = {
  /** "HH:MM", 24-hour. */
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
};

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(value: string) {
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Pick a time of day. The date is irrelevant: only the hour and minute are read back, so the phone's timezone
 * never enters into it. iOS shows the system's compact picker; Android opens its dialog when tapped.
 */
export function TimeField({ value, onChange, accessibilityLabel }: Props) {
  const theme = useTheme();
  const scheme = useScheme();

  function pick(date?: Date) {
    if (date) onChange(`${pad(date.getHours())}:${pad(date.getMinutes())}`);
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.row} accessible accessibilityLabel={accessibilityLabel}>
        <DateTimePicker
          mode="time"
          display="compact"
          value={toDate(value)}
          onValueChange={(_, date) => pick(date)}
          accentColor={theme.primary}
          themeVariant={scheme}
        />
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}, ${value}. Change`}
      onPress={() =>
        DateTimePickerAndroid.open({
          value: toDate(value),
          mode: 'time',
          is24Hour: true,
          onValueChange: (_, date) => pick(date),
        })
      }
      style={({ pressed }) => [
        styles.android,
        { backgroundColor: theme.surface, borderColor: theme.borderStrong },
        pressed && { backgroundColor: theme.surfaceMuted },
      ]}>
      <Text style={[styles.time, { color: theme.text }]}>{value}</Text>
      <Text variant="label" tone="primary">
        Change
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start' },
  android: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    alignSelf: 'flex-start',
    minHeight: ControlHeight,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.xl,
  },
  time: { fontFamily: Fonts.display, fontSize: 28, lineHeight: 34 },
});
