import { z } from 'zod';
export const APP_ROLES = [
  'super_admin', 'management', 'state_area_manager', 'nso',
  'udc', 'dealer', 'marketing_vm', 'training_admin', 'consultant',
] as const;
export const userSchema = z.object({
  name: z.string().min(1, 'Required'),
  role: z.enum(APP_ROLES),
  primary_store_id: z.string().uuid().nullable().optional(),
  active: z.boolean(),
});
export type UserFormValues = z.infer<typeof userSchema>;
