import { z } from 'zod';

export const LoginInputSchema = z.strictObject({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });
export type LoginInput = z.infer<typeof LoginInputSchema>;
export const UserViewSchema = z.strictObject({ id: z.string(), name: z.string(), email: z.string().email(), role: z.enum(['employee', 'analyst']) });
export type UserView = z.infer<typeof UserViewSchema>;
