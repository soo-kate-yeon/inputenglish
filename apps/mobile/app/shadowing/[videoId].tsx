import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function ShadowingScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shadowing</Text>
      <Text style={styles.subtitle}>Video: {videoId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
