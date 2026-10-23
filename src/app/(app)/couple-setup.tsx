import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AccountActions } from '@/components/account-actions';
import { PartnerLeftNotice } from '@/components/notice-card';
import { Accent, Card, Screen, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { enter } from '@/hooks/use-motion';
import { useCreateCouple } from '@/hooks/use-couple';
import { useNotices } from '@/hooks/use-notices';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/lib/errors';
import { usePendingInvite } from '@/lib/pending-invite';

export default function CoupleSetup() {
  const router = useRouter();
  const theme = useTheme();
  const createCouple = useCreateCouple();
  const pendingCode = usePendingInvite((s) => s.code);
  const notices = useNotices(true);
  const ended = notices.data?.filter((n) => n.kind === 'couple_ended') ?? [];

  // Opened an invite link: skip straight to joining.
  useEffect(() => {
    if (pendingCode) router.push('/join');
  }, [pendingCode, router]);

  async function onCreate() {
    if (createCouple.isPending) return;
    try {
      await createCouple.mutateAsync();
    } catch (e) {
      Alert.alert('Could not create your couple', friendlyError(e));
    }
  }

  return (
    <Screen>
      <Animated.View entering={enter()} style={styles.header}>
        <Text variant="overline" tone="primary">
          Better together
        </Text>
        <Text variant="title">
          Who&apos;s joining you <Accent>for dinner?</Accent>
        </Text>
        <Text tone="secondary">
          Swipe for Dinner is made for two. One of you starts the couple and invites the other with a code.
        </Text>
      </Animated.View>
      {ended.map((n) => (
        <PartnerLeftNotice key={n.id} notice={n} />
      ))}

      <Animated.View entering={enter(1)} style={styles.options}>
        <Card onPress={onCreate} accessibilityLabel="Start a couple and invite your partner">
          <View style={styles.option}>
            <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
              <Text style={styles.badgeEmoji}>💌</Text>
            </View>
            <View style={styles.optionText}>
              <Text variant="heading">Start a couple</Text>
              <Text variant="caption" tone="secondary">
                Create your couple and invite your partner with a code.
              </Text>
            </View>
            {createCouple.isPending ? <ActivityIndicator color={theme.primary} /> : <Text tone="tertiary">›</Text>}
          </View>
        </Card>

        <Card onPress={() => router.push('/join')} accessibilityLabel="I have an invite code">
          <View style={styles.option}>
            <View style={[styles.badge, { backgroundColor: theme.successSoft }]}>
              <Text style={styles.badgeEmoji}>🎟️</Text>
            </View>
            <View style={styles.optionText}>
              <Text variant="heading">Join with a code</Text>
              <Text variant="caption" tone="secondary">
                Your partner already started. Join them for free.
              </Text>
            </View>
            <Text tone="tertiary">›</Text>
          </View>
        </Card>
      </Animated.View>

      <AccountActions />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.md, marginTop: Spacing.xxl },
  options: { gap: Spacing.lg, marginTop: Spacing.xl },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  optionText: { flex: 1, gap: Spacing.xs },
  badge: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  badgeEmoji: { fontSize: 26, lineHeight: 32 },
});
