import * as AppleAuthentication from 'expo-apple-authentication';
import { OAuthProvider, signInWithCredential, UserCredential } from 'firebase/auth';
import { auth } from './config';

export class AppleSignInError extends Error {}

export async function signInWithApple(): Promise<UserCredential> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new AppleSignInError('Apple sign-in did not return an identity token');
  }

  const provider = new OAuthProvider('apple.com');
  const firebaseCredential = provider.credential({
    idToken: credential.identityToken,
  });

  return signInWithCredential(auth, firebaseCredential);
}
