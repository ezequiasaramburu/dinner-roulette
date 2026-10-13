import { z } from 'zod';

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
});

export const codeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const nameSchema = z.object({
  name: z.string().trim().min(1, 'Tell us what to call you').max(40, 'Keep it under 40 characters'),
});
