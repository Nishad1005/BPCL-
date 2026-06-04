import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { uploadAttachmentObject } from '@/lib/storage';
import { periodStartFor, type Frequency } from '@/lib/period';
import type { StagedAnswer } from '@/lib/schemas/checklist';

export function useChecklistSubmission(id: string | undefined) {
  return useQuery({
    queryKey: ['checklist', 'submission', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: sub, error } = await supabase
        .from('store_checklist_submissions')
        .select('*, checklist_templates(name, frequency), stores(store_name), checklist_answers(*)')
        .eq('id', id!).single();
      if (error) throw error;
      const { data: atts } = await supabase.from('attachments').select('*')
        .eq('entity_type', 'checklist_submission').eq('entity_id', id!);
      const itemIds = (sub.checklist_answers ?? []).map((a: { item_id: string }) => a.item_id);
      const { data: items } = itemIds.length
        ? await supabase.from('checklist_items').select('id, section, prompt, requires_photo, sort').in('id', itemIds)
        : { data: [] };
      return { ...sub, attachments: atts ?? [], items: items ?? [] };
    },
  });
}

export function useSubmitChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      templateId: string;
      frequency: Frequency;
      storeId: string;
      answers: StagedAnswer[];
    }) => {
      const { templateId, frequency, storeId, answers } = args;
      if (frequency === 'visit_based') {
        throw new Error('Visit-based templates submit via NSO visit (M3).');
      }
      const periodStart = periodStartFor(frequency, new Date());

      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error('Not signed in');

      const { data: sub, error } = await supabase.from('store_checklist_submissions').insert({
        template_id: templateId, store_id: storeId, period_start: periodStart,
        submitted_by: me.user.id, score: 0,
      }).select('id').single();
      if (error) {
        if (error.code === '23505') throw new Error('Already submitted for this period');
        throw error;
      }

      const uploaded: Record<string, string> = {};
      for (const a of answers) {
        if (!a.photo) continue;
        const path = await uploadAttachmentObject({
          entityType: 'checklist_submission', entityId: sub.id, file: a.photo.blob, ext: a.photo.ext,
        });
        uploaded[a.itemId] = path;
      }

      const answersPayload = answers
        .filter((a) => a.answer != null)
        .map((a) => ({
          submission_id: sub.id,
          item_id: a.itemId,
          answer: a.answer!,
          remarks: a.remarks || null,
          has_photo: !!uploaded[a.itemId],
        }));
      const { error: aErr } = await supabase.from('checklist_answers').insert(answersPayload);
      if (aErr) {
        await supabase.from('store_checklist_submissions').delete().eq('id', sub.id);
        throw aErr;
      }

      const attRows = Object.entries(uploaded).map(([_itemId, path]) => ({
        entity_type: 'checklist_submission' as const,
        entity_id: sub.id,
        storage_path: path,
        uploaded_by: me.user!.id,
      }));
      if (attRows.length > 0) {
        const { error: attErr } = await supabase.from('attachments').insert(attRows);
        if (attErr) throw attErr;
      }

      const applicable = answersPayload.filter((a) => a.answer !== 'na').length;
      const done = answersPayload.filter((a) => a.answer === 'done').length;
      const score = applicable > 0 ? Math.round((done / applicable) * 100) / 100 : 0;
      const { error: sErr } = await supabase
        .from('store_checklist_submissions').update({ score }).eq('id', sub.id);
      if (sErr) throw sErr;

      return { id: sub.id };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist'] }),
  });
}
