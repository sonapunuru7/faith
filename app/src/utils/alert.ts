import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert() is a no-op, so on web it's swapped for
// window.alert() — otherwise sign-in failures during browser testing are
// silently swallowed with no visible feedback at all.
export function showAlert(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}
