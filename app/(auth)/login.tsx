import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { signInWithOtp, verifyOtp, signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState<null | 'otp' | 'password' | 'verify'>(null);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async () => {
    setBusy('otp'); setError(null);
    const { error } = await signInWithOtp(email.trim());
    setBusy(null);
    if (error) setError(error); else setStage('code');
  };

  const submitCode = async () => {
    setBusy('verify'); setError(null);
    const { error } = await verifyOtp(email.trim(), token.trim());
    setBusy(null);
    if (error) setError(error);
  };

  const submitPassword = async () => {
    setBusy('password'); setError(null);
    const { error } = await signInWithPassword(email.trim(), password);
    setBusy(null);
    if (error) setError(error);
  };

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-white px-6 dark:bg-neutral-950">
      <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Store Performance</Text>
      <Text className="max-w-xs text-center text-neutral-500 dark:text-neutral-400">
        {stage === 'email'
          ? 'Sign in with email — OTP code (real domain) or password (test users).'
          : `Enter the code sent to ${email}.`}
      </Text>

      {stage === 'email' ? (
        <>
          <TextInput
            className="w-full max-w-xs rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
            placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address"
            value={email} onChangeText={setEmail}
          />
          <TextInput
            className="w-full max-w-xs rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
            placeholder="Password (test users)" secureTextEntry
            value={password} onChangeText={setPassword}
          />
        </>
      ) : (
        <TextInput
          className="w-full max-w-xs rounded-xl border border-neutral-300 px-4 py-3 text-center text-lg tracking-widest text-neutral-900 dark:border-neutral-700 dark:text-white"
          placeholder="123456" keyboardType="number-pad" value={token} onChangeText={setToken}
        />
      )}

      {error && <Text className="max-w-xs text-center text-red-600 dark:text-red-400">{error}</Text>}

      {stage === 'email' ? (
        <View className="w-full max-w-xs gap-2">
          <Pressable accessibilityRole="button" disabled={busy !== null || !password} onPress={submitPassword}
            className="items-center rounded-xl bg-blue-600 px-6 py-4 active:bg-blue-700 disabled:opacity-50">
            {busy === 'password' ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Sign in with password</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy !== null} onPress={requestCode}
            className="items-center rounded-xl border border-neutral-300 px-6 py-3 active:bg-neutral-100 dark:border-neutral-700 dark:active:bg-neutral-900">
            {busy === 'otp' ? <ActivityIndicator /> : <Text className="text-neutral-700 dark:text-neutral-300">Send OTP code instead</Text>}
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={submitCode}
          className="w-full max-w-xs items-center rounded-xl bg-blue-600 px-6 py-4 active:bg-blue-700">
          {busy === 'verify' ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Verify & sign in</Text>}
        </Pressable>
      )}

      {stage === 'code' && (
        <Pressable onPress={() => setStage('email')}>
          <Text className="text-blue-600 dark:text-blue-400">Use a different email</Text>
        </Pressable>
      )}
    </View>
  );
}
