import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: true }} />;
}
