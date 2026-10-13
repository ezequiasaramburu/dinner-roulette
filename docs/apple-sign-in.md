# Enabling Sign in with Apple

Removed from the app for now: free personal Apple teams can't sign the Sign in with Apple capability, and the
`expo-apple-authentication` package adds that entitlement automatically just by being installed. The Supabase side
is already configured (`[auth.external.apple]` in `supabase/config.toml`, bundle id `com.ezequias.dinnerroulette`).

## Steps once you have a paid Apple Developer account

1. `npx expo install expo-apple-authentication`
2. Add `"usesAppleSignIn": true` under `expo.ios` in `app.json`.
3. Create `src/lib/apple-auth.ts` with the code below.
4. In `src/app/(auth)/index.tsx`, add the button below the "Continue with email" button's sibling (see snippet 2) and make
   the email button `variant="secondary"` when Apple is available.
5. `npx expo prebuild --clean --platform ios`, then `npx expo run:ios`.
6. For production, add your Apple client secret to Supabase (`SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`).

## 1. `src/lib/apple-auth.ts`

```ts
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
```

## 2. Welcome screen additions

```tsx
import * as AppleAuthentication from 'expo-apple-authentication';
import { signInWithApple } from '@/lib/apple-auth';

const [appleAvailable, setAppleAvailable] = useState(false);
const [appleLoading, setAppleLoading] = useState(false);

useEffect(() => {
  if (Platform.OS !== 'ios') return;
  AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
}, []);

async function onApple() {
  setAppleLoading(true);
  try {
    await signInWithApple();
  } catch (e) {
    Alert.alert('Sign in failed', e instanceof Error ? e.message : 'Please try again.');
  } finally {
    setAppleLoading(false);
  }
}

// In the JSX, above the email button:
{appleAvailable ? (
  <AppleAuthentication.AppleAuthenticationButton
    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
    cornerRadius={14}
    style={{ height: 52, width: '100%' }}
    onPress={appleLoading ? () => {} : onApple}
  />
) : null}
```
