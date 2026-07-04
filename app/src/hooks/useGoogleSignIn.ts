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
  //
  // useIdTokenAuthRequest (not the generic useAuthRequest) is required to get
  // an ID token at all on web: useAuthRequest defaults to response_type=token
  // there, which returns only an access token. Even with the ID-token flow,
  // expo-auth-session's AuthRequest.ts only populates `authentication` when
  // `params.access_token` is present — the web implicit id-token flow never
  // sets that, so the token only shows up in `response.params.id_token`.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? '',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.authentication?.idToken ?? response.params?.id_token;
      if (idToken) {
        signInWithGoogleIdToken(idToken).catch(onError);
      }
    } else if (response?.type === 'error') {
      onError(new Error('Google sign-in failed'));
    }
  }, [response]);

  return { promptAsync: () => promptAsync(), isReady: isConfigured && !!request };
}
