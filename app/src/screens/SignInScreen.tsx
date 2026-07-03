import { View, Text, Button, Alert } from 'react-native';
import { signInWithApple } from '../firebase/appleAuth';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';

export function SignInScreen() {
  const { promptAsync, isReady } = useGoogleSignIn((error) =>
    Alert.alert('Sign-in failed', error.message)
  );

  const handleApplePress = async () => {
    try {
      await signInWithApple();
    } catch (error) {
      Alert.alert('Sign-in failed', (error as Error).message);
    }
  };

  return (
    <View>
      <Text>Sign in to Faith</Text>
      <Button title="Sign in with Apple" onPress={handleApplePress} />
      <Button title="Sign in with Google" onPress={promptAsync} disabled={!isReady} />
    </View>
  );
}
