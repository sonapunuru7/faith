const mockUseAuthRequest = jest.fn();
const mockUseIdTokenAuthRequest = jest.fn();

jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: (...args: unknown[]) => mockUseAuthRequest(...args),
  useIdTokenAuthRequest: (...args: unknown[]) => mockUseIdTokenAuthRequest(...args),
}));

jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));

const mockSignInWithGoogleIdToken = jest.fn();
jest.mock('../src/firebase/googleAuth', () => ({
  signInWithGoogleIdToken: (...args: unknown[]) => mockSignInWithGoogleIdToken(...args),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useGoogleSignIn } from '../src/hooks/useGoogleSignIn';

describe('useGoogleSignIn — id token extraction', () => {
  const originalClientId = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = 'test-client-id';
    mockUseAuthRequest.mockReset();
    mockUseIdTokenAuthRequest.mockReset();
    mockSignInWithGoogleIdToken.mockReset().mockResolvedValue({ user: { uid: 'alice' } });
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = originalClientId;
  });

  test('requests an ID token (not the generic access-token hook)', () => {
    mockUseIdTokenAuthRequest.mockReturnValue([{}, null, jest.fn()]);

    renderHook(() => useGoogleSignIn(jest.fn()));

    expect(mockUseIdTokenAuthRequest).toHaveBeenCalled();
    expect(mockUseAuthRequest).not.toHaveBeenCalled();
  });

  test('signs in using response.params.id_token (web implicit id-token flow)', async () => {
    // On web, a successful id-token response never populates `authentication`
    // (expo-auth-session's AuthRequest.ts only builds it `if (params.access_token)`)
    // — the token only ever shows up in `response.params.id_token`.
    mockUseIdTokenAuthRequest.mockReturnValue([
      {},
      { type: 'success', authentication: null, params: { id_token: 'web-id-token' } },
      jest.fn(),
    ]);

    renderHook(() => useGoogleSignIn(jest.fn()));

    await waitFor(() => expect(mockSignInWithGoogleIdToken).toHaveBeenCalledWith('web-id-token'));
  });

  test('signs in using response.authentication.idToken (native code-exchange flow)', async () => {
    mockUseIdTokenAuthRequest.mockReturnValue([
      {},
      {
        type: 'success',
        authentication: { idToken: 'native-id-token', accessToken: 'native-access-token' },
        params: { access_token: 'native-access-token' },
      },
      jest.fn(),
    ]);

    renderHook(() => useGoogleSignIn(jest.fn()));

    await waitFor(() =>
      expect(mockSignInWithGoogleIdToken).toHaveBeenCalledWith('native-id-token')
    );
  });
});
