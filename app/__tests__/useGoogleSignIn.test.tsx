import { renderHook, waitFor } from '@testing-library/react-native';
import { useGoogleSignIn } from '../src/hooks/useGoogleSignIn';

describe('useGoogleSignIn', () => {
  const originalClientId = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

  afterEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = originalClientId;
  });

  test('does not throw and reports not ready when the client ID is unset', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

    const { result } = renderHook(() => useGoogleSignIn(jest.fn()));

    await waitFor(() => expect(result.current.isReady).toBe(false));
  });

  test('reports ready once the request loads when the client ID is set', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = 'test-client-id';

    const { result } = renderHook(() => useGoogleSignIn(jest.fn()));

    await waitFor(() => expect(result.current.isReady).toBe(true));
  });
});
