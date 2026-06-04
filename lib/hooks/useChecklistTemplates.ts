import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { periodStartFor, type Frequency } from '@/lib/period';

export function useActiveTemplatesWithItems() {
  return useQuery({
    queryKey: ['checklist', 'active_templates'],
    queryFn: async () => {
      const { data: tpls, error } = await supabase.from('checklist_templates')
        .select('id, name, frequency, active').eq('active', true).order('name');
      if (error) throw error;
      const { data: items, error: iErr } = await supabase.from('checklist_items')
        .select('id, template_id, section, prompt, requires_photo, sort').order('sort');
      if (iErr) throw iErr;
      const byTpl = new Map<string, typeof items>();
      for (const it of items ?? []) {
        const arr = byTpl.get(it.template_id) ?? [];
        arr.push(it);
        byTpl.set(it.template_id, arr);
      }
      return (tpls ?? []).map((t) => ({ ...t, items: byTpl.get(t.id) ?? [] }));
    },
  });
}

export function useTodaysSubmissions(storeId: string | undefined) {
  return useQuery({
    queryKey: ['checklist', 'todays_submissions', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('store_checklist_submissions')
        .select('id, template_id, period_start, score')
        .eq('store_id', storeId!);
      if (error) throw error;
      return data;
    },
  });
}

export function isTemplateApplicable(
  freq: Frequency,
  asOf = new Date(),
): { periodStart: string } | null {
  if (freq === 'visit_based') return null;
  return { periodStart: periodStartFor(freq, asOf) };
}
