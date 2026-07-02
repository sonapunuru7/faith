import { GoogleAuthProvider, signInWithCredential, UserCredential } from 'firebase/auth';
import { auth } from './config';

export async function signInWithGoogleIdToken(idToken: string): Promise<UserCredential> {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}
