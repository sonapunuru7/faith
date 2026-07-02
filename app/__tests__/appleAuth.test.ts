jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('firebase/auth', () => ({
  OAuthProvider: jest.fn().mockImplementation(() => ({
    credential: jest.fn().mockReturnValue({ providerId: 'apple.com' }),
  })),
  signInWithCredential: jest.fn(),
}));

jest.mock('../src/firebase/config', () => ({ auth: {} }));

import * as AppleAuthentication from 'expo-apple-authentication';
import { signInWithCredential } from 'firebase/auth';
import { signInWithApple, AppleSignInError } from '../src/firebase/appleAuth';

describe('signInWithApple', () => {
  test('signs in to Firebase using the Apple identity token', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      identityToken: 'test-identity-token',
    });
    (signInWithCredential as jest.Mock).mockResolvedValue({ user: { uid: 'alice' } });

    const result = await signInWithApple();

    expect(signInWithCredential).toHaveBeenCalled();
    expect((result as any).user.uid).toBe('alice');
  });

  test('throws AppleSignInError when no identity token is returned', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      identityToken: null,
    });

    await expect(signInWithApple()).rejects.toThrow(AppleSignInError);
  });
});
