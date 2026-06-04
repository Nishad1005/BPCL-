import { z } from 'zod';

export const checklistFrequency = z.enum(['daily', 'weekly', 'monthly', 'visit_based']);
export const checklistAnswer = z.enum(['done', 'not_done', 'needs_support', 'na']);

export const templateSchema = z.object({
  name: z.string().min(1, 'Required'),
  frequency: checklistFrequency,
  active: z.boolean(),
});
export type TemplateFormValues = z.infer<typeof templateSchema>;

export const itemSchema = z.object({
  section: z.string().optional().or(z.literal('')),
  prompt: z.string().min(1, 'Required'),
  requires_photo: z.boolean(),
  sort: z.coerce.number().int().nonnegative(),
});
export type ItemFormValues = z.infer<typeof itemSchema>;

export type StagedAnswer = {
  itemId: string;
  answer: 'done' | 'not_done' | 'needs_support' | 'na' | null;
  remarks: string;
  photo?: { blob: Blob; ext: string } | null;
};
