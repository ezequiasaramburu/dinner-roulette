import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable } from 'react-native';
import type { z } from 'zod';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';
import { codeSchema, emailSchema } from '@/lib/validation';

type EmailValues = z.infer<typeof emailSchema>;
type CodeValues = z.infer<typeof codeSchema>;

/** Two-step passwordless sign in: request a 6-digit code, then verify it. */
export default function EmailSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  return (
    <Screen>
      <Pressable onPress={() => (email ? setEmail(null) : router.back())} hitSlop={12}>
        <ThemedText type="linkPrimary">‹ Back</ThemedText>
      </Pressable>
      {email ? <CodeStep email={email} /> : <EmailStep onSent={setEmail} />}
    </Screen>
  );
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EmailValues>({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });

  const submit = handleSubmit(async ({ email }) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setError('email', { message: error.message });
      return;
    }
    onSent(email);
  });

  return (
    <>
      <ThemedText type="subtitle">What&apos;s your email?</ThemedText>
      <ThemedText themeColor="textSecondary">
        We&apos;ll send you a 6-digit code. No password needed.
      </ThemedText>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label="Email"
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
      <Button title="Send code" onPress={submit} loading={isSubmitting} />
    </>
  );
}

function CodeStep({ email }: { email: string }) {
  const [resent, setResent] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CodeValues>({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } });

  // On success the auth listener swaps the navigator, so nothing to do here.
  const submit = handleSubmit(async ({ code }) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) setError('code', { message: 'That code is invalid or has expired.' });
  });

  async function resend() {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setError('code', { message: error.message });
    else setResent(true);
  }

  return (
    <>
      <ThemedText type="subtitle">Check your inbox</ThemedText>
      <ThemedText themeColor="textSecondary">Enter the 6-digit code we sent to {email}.</ThemedText>
      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <TextField
            label="Code"
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
      <Button title="Verify" onPress={submit} loading={isSubmitting} />
      <Pressable onPress={resend} hitSlop={12}>
        <ThemedText type="linkPrimary">{resent ? 'Code sent again' : 'Resend code'}</ThemedText>
      </Pressable>
    </>
  );
}
