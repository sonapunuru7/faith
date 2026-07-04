import { Alert, Platform } from 'react-native';
import { showAlert } from '../src/utils/alert';

describe('showAlert', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
    delete (window as unknown as { alert?: unknown }).alert;
    jest.restoreAllMocks();
  });

  test('uses window.alert on web, since react-native-web Alert.alert is a no-op', () => {
    Platform.OS = 'web';
    const windowAlertSpy = jest.fn();
    (window as unknown as { alert: typeof windowAlertSpy }).alert = windowAlertSpy;
    const nativeAlertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    showAlert('Sign-in failed', 'Something went wrong');

    expect(windowAlertSpy).toHaveBeenCalledWith('Sign-in failed\n\nSomething went wrong');
    expect(nativeAlertSpy).not.toHaveBeenCalled();
  });

  test('uses the native Alert on iOS/Android', () => {
    Platform.OS = 'ios';
    const nativeAlertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    showAlert('Sign-in failed', 'Something went wrong');

    expect(nativeAlertSpy).toHaveBeenCalledWith('Sign-in failed', 'Something went wrong');
  });
});
