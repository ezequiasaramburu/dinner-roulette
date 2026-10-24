import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { z } from 'zod';

import { Accent, BackButton, Button, Screen, Text, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { enter } from '@/hooks/use-motion';
import { isNetworkError, OFFLINE_MESSAGE } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { codeSchema, emailSchema } from '@/lib/validation';

type EmailValues = z.infer<typeof emailSchema>;
type CodeValues = z.infer<typeof codeSchema>;

// The one account that signs in with a password: the App Store and Google Play reviewers have no access to a mailbox.
// Its password is set in the Supabase dashboard; everyone else gets a code. See docs/closed-test.md.
const REVIEW_EMAIL = 'review@swipefordinner.app';

/** Two-step passwordless sign in: request a 6-digit code, then verify it. */
export default function EmailSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  if (!email) return <EmailStep onSent={setEmail} onBack={() => router.back()} />;
  return email === REVIEW_EMAIL ? (
    <PasswordStep email={email} onBack={() => setEmail(null)} />
  ) : (
    <CodeStep email={email} onBack={() => setEmail(null)} />
  );
}

function EmailStep({ onSent, onBack }: { onSent: (email: string) => void; onBack: () => void }) {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EmailValues>({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });
  // The button waits for a valid address; errors still show only on submit, not while typing.
  const canSend = emailSchema.safeParse({ email: useWatch({ control, name: 'email' }) }).success;

  const submit = handleSubmit(async ({ email }) => {
    if (email === REVIEW_EMAIL) return onSent(email);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setError('email', { message: isNetworkError(error) ? OFFLINE_MESSAGE : error.message });
      return;
    }
    onSent(email);
  });

  return (
    <Screen footer={<Button title="Send code" onPress={submit} loading={isSubmitting} disabled={!canSend} />}>
      <BackButton onPress={onBack} />
      <Animated.View entering={enter()} style={styles.stack}>
        <Text variant="title">
          What&apos;s your <Accent>email?</Accent>
        </Text>
        <Text tone="secondary">We&apos;ll send you a 6-digit code. No password needed.</Text>
        <View style={styles.field}>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <TextField
                label="Email"
                placeholder="you@example.com"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.email?.message}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="go"
                onSubmitEditing={submit}
              />
            )}
          />
        </View>
      </Animated.View>
    </Screen>
  );
}

function CodeStep({ email, onBack }: { email: string; onBack: () => void }) {
  const [resent, setResent] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CodeValues>({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } });
  const canVerify = codeSchema.safeParse({ code: useWatch({ control, name: 'code' }) }).success;

  // On success the auth listener swaps the navigator, so nothing to do here.
  const submit = handleSubmit(async ({ code }) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) setError('code', { message: isNetworkError(error) ? OFFLINE_MESSAGE : 'That code is invalid or has expired.' });
  });

  async function resend() {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setError('code', { message: isNetworkError(error) ? OFFLINE_MESSAGE : error.message });
    else setResent(true);
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Verify" onPress={submit} loading={isSubmitting} disabled={!canVerify} />
          <Button title={resent ? 'Code sent again ✓' : 'Resend code'} variant="ghost" onPress={resend} />
        </>
      }>
      <BackButton onPress={onBack} />
      <Animated.View entering={enter()} style={styles.stack}>
        <Text variant="title">
          Check your <Accent>inbox</Accent>
        </Text>
        <Text tone="secondary">
          Enter the 6-digit code we sent to <Text variant="bodyStrong">{email}</Text>.
        </Text>
        <View style={styles.field}>
          <Controller
            control={control}
            name="code"
            render={({ field }) => (
              <TextField
                label="Code"
                variant="code"
                placeholder="······"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.code?.message}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={submit}
              />
            )}
          />
        </View>
      </Animated.View>
    </Screen>
  );
}

function PasswordStep({ email, onBack }: { email: string; onBack: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  // On success the auth listener swaps the navigator, so nothing to do here.
  async function submit() {
    if (!password || busy) return;
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) setError(isNetworkError(signInError) ? OFFLINE_MESSAGE : 'That password is not right.');
  }

  return (
    <Screen footer={<Button title="Sign in" onPress={submit} loading={busy} disabled={!password} />}>
      <BackButton onPress={onBack} />
      <Animated.View entering={enter()} style={styles.stack}>
        <Text variant="title">
          Enter your <Accent>password</Accent>
        </Text>
        <Text tone="secondary">
          <Text variant="bodyStrong">{email}</Text> signs in with a password.
        </Text>
        <View style={styles.field}>
          <TextField
            label="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(undefined);
            }}
            error={error}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            autoFocus
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.md, marginTop: Spacing.lg },
  field: { marginTop: Spacing.lg },
});
