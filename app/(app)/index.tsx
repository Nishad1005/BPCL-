import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';

export default function HomeScreen() {
  const { profile, signOut, isAdmin } = useAuth();
  return (
    <ScrollView contentContainerClassName="flex-grow gap-6 bg-white px-6 py-16 dark:bg-neutral-950">
      <View className="gap-1">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
          Welcome{profile?.name ? `, ${profile.name}` : ''}
        </Text>
        <Text className="text-base text-neutral-500 dark:text-neutral-400">Role: {profile?.role ?? '—'}</Text>
      </View>
      {isAdmin && (
        <View className="gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Admin</Text>
          <Link href="/admin/stores" className="text-blue-600 dark:text-blue-400">Manage stores</Link>
          <Link href="/admin/users" className="text-blue-600 dark:text-blue-400">Manage users</Link>
        </View>
      )}
      <Pressable accessibilityRole="button" onPress={signOut}
        className="items-center rounded-xl border border-neutral-300 px-6 py-4 active:bg-neutral-100 dark:border-neutral-700 dark:active:bg-neutral-900">
        <Text className="text-base font-semibold text-neutral-900 dark:text-white">Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
