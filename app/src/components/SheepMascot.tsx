import { View, Text } from 'react-native';

// Placeholder visual until a real Rive/Lottie asset exists — swapping this
// component's internals for real animation playback driven by the same
// wellnessScore prop is a self-contained follow-up change.
export function SheepMascot({ wellnessScore }: { wellnessScore: number }) {
  const clamped = Math.max(0, Math.min(100, wellnessScore));
  const opacity = 0.3 + (clamped / 100) * 0.7;

  return (
    <View testID="sheep-mascot" style={{ opacity }}>
      <Text style={{ fontSize: 64 }}>🐑</Text>
    </View>
  );
}
