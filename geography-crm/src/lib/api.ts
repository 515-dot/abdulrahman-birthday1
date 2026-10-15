import type { z } from 'zod';
import { HttpError } from './auth';

/** Parse and validate a JSON body; anything unexpected becomes a 400. */
export async function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  const r = schema.safeParse(await req.json().catch(() => null));
  if (!r.success) throw new HttpError(400, 'Invalid input');
  return r.data;
}
