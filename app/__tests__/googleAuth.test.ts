jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: { credential: jest.fn().mockReturnValue({ providerId: 'google.com' }) },
  signInWithCredential: jest.fn(),
}));

jest.mock('../src/firebase/config', () => ({ auth: {} }));

import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { signInWithGoogleIdToken } from '../src/firebase/googleAuth';

describe('signInWithGoogleIdToken', () => {
  test('signs in to Firebase using the Google ID token', async () => {
    (signInWithCredential as jest.Mock).mockResolvedValue({ user: { uid: 'bob' } });

    const result = await signInWithGoogleIdToken('test-id-token');

    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith('test-id-token');
    expect(signInWithCredential).toHaveBeenCalled();
    expect((result as any).user.uid).toBe('bob');
  });
});
