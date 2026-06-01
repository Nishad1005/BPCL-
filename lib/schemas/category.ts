import { z } from 'zod';
export const categorySchema = z.object({
  name: z.string().min(1, 'Required'),
  active: z.boolean(),
});
export type CategoryFormValues = z.infer<typeof categorySchema>;
