import { z } from 'zod';
import { aiHandlers, Lang, langLine, RULES } from '@/lib/ai-route';

const h = aiHandlers({
  feature: 'marketing_copy', permission: 'marketing.view_campaigns',
  schema: z.object({
    brief: z.string().min(5).max(2000),
    platform: z.enum(['facebook', 'instagram', 'tiktok', 'google_ads', 'whatsapp', 'other']).default('facebook'),
    tone: z.enum(['professional', 'friendly', 'luxury', 'urgent']).default('professional'),
    variants: z.number().int().min(1).max(5).default(3),
    language: Lang,
  }),
  build: async ({ input }) => ({
    system: `You write real-estate marketing copy for ${input.platform}. Tone: ${input.tone}. Produce ${input.variants} distinct variants with a headline and body. ${langLine(input.language)} ${RULES}`,
    prompt: input.brief, // user-supplied only; no CRM data is sent
  }),
});
export const GET = h.GET; export const POST = h.POST;
