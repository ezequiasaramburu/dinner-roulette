import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

/**
 * Native Sign in with Apple, exchanged for a Supabase session.
 * Returns false if the user cancelled the Apple sheet.
 */
export async function signInWithApple(): Promise<boolean> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }

  if (!credential.identityToken) throw new Error('Apple did not return an identity token.');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Apple only sends the name on the very first authorization, so save it now.
  const { givenName, familyName } = credential.fullName ?? {};
  const name = [givenName, familyName].filter(Boolean).join(' ').trim();
  if (name && data.user) {
    await supabase
      .from('profiles')
      .update({ display_name: name.slice(0, 40) })
      .eq('id', data.user.id);
  }
  return true;
}
