import { z } from 'zod';
import { aiHandlers, Lang, langLine, RULES } from '@/lib/ai-route';

const h = aiHandlers({
  feature: 'hr_draft', permission: 'hr.view_employee_records', maxTokens: 1500,
  schema: z.object({
    kind: z.enum(['job_description', 'interview_questions', 'policy', 'announcement']),
    details: z.string().min(5).max(3000),
    language: Lang,
  }),
  build: async ({ input }) => ({
    system: `You draft HR documents (${input.kind.replace('_', ' ')}) for a real-estate company in Egypt. Keep it professional and flag anything needing legal review under Egyptian labor law. Do not include salary figures unless the user typed them. ${langLine(input.language)} ${RULES}`,
    prompt: input.details, // user-supplied only; no employee or payroll data is sent
  }),
});
export const GET = h.GET; export const POST = h.POST;
