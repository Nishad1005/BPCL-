import { Pressable, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { signIn } = useAuth();

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-white px-6 dark:bg-neutral-950">
      <View className="items-center gap-2">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
          Store Performance
        </Text>
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          WP0 placeholder login. Real email + phone OTP arrives in WP1.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={signIn}
        className="w-full max-w-xs items-center rounded-xl bg-blue-600 px-6 py-4 active:bg-blue-700">
        <Text className="text-base font-semibold text-white">Sign in (stub)</Text>
      </Pressable>
    </View>
  );
}
