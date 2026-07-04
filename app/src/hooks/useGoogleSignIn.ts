import { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { signInWithGoogleIdToken } from '../firebase/googleAuth';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleSignIn(onError: (error: Error) => void) {
  const isConfigured = !!process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

  // expo-auth-session throws if its clientId is undefined, so a missing env
  // var gets an empty-string fallback here — `isConfigured` (not `request`)
  // is what gates readiness, so an unconfigured client ID never prompts.
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? '',
  });

  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.idToken) {
      signInWithGoogleIdToken(response.authentication.idToken).catch(onError);
    } else if (response?.type === 'error') {
      onError(new Error('Google sign-in failed'));
    }
  }, [response]);

  return { promptAsync: () => promptAsync(), isReady: isConfigured && !!request };
}
