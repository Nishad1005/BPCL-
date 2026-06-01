import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useCategories() {
  return useQuery({
    queryKey: ['product_categories', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories').select('id, name, active').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });
}
