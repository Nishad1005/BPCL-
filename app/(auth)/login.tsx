import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { signInWithOtp, verifyOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async () => {
    setBusy(true); setError(null);
    const { error } = await signInWithOtp(email.trim());
    setBusy(false);
    if (error) setError(error); else setStage('code');
  };

  const submitCode = async () => {
    setBusy(true); setError(null);
    const { error } = await verifyOtp(email.trim(), token.trim());
    setBusy(false);
    if (error) setError(error); // success flips the route via the auth listener
  };

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white px-6 dark:bg-neutral-950">
      <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Store Performance</Text>
      <Text className="text-center text-neutral-500 dark:text-neutral-400">
        {stage === 'email' ? 'Sign in with your email — we’ll send a one-time code.' : `Enter the code sent to ${email}.`}
      </Text>
      {stage === 'email' ? (
        <TextInput className="w-full max-w-xs rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
          placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      ) : (
        <TextInput className="w-full max-w-xs rounded-xl border border-neutral-300 px-4 py-3 text-center text-lg tracking-widest text-neutral-900 dark:border-neutral-700 dark:text-white"
          placeholder="123456" keyboardType="number-pad" value={token} onChangeText={setToken} />
      )}
      {error && <Text className="max-w-xs text-center text-red-600 dark:text-red-400">{error}</Text>}
      <Pressable accessibilityRole="button" disabled={busy} onPress={stage === 'email' ? requestCode : submitCode}
        className="w-full max-w-xs items-center rounded-xl bg-blue-600 px-6 py-4 active:bg-blue-700">
        {busy ? <ActivityIndicator color="#fff" /> : (
          <Text className="text-base font-semibold text-white">{stage === 'email' ? 'Send code' : 'Verify & sign in'}</Text>
        )}
      </Pressable>
      {stage === 'code' && (
        <Pressable onPress={() => setStage('email')}>
          <Text className="text-blue-600 dark:text-blue-400">Use a different email</Text>
        </Pressable>
      )}
    </View>
  );
}
