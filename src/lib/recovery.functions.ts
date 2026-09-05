import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const answersSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  answers: z.record(z.string(), z.string().trim().max(120)),
  password: z.string().min(8).max(72),
});

/**
 * Reset a password by answering the account's security questions.
 * Answers are matched server-side, case-insensitively, with an 85% similarity margin.
 */
export const resetPasswordWithSecurityAnswers = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => answersSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userId, error } = await (supabaseAdmin.rpc as any)("verify_security_answers", {
      _email: data.email,
      _answers: data.answers,
    });
    if (error) throw new Error(error.message);
    if (!userId) return { ok: false as const, message: "Those answers don't match our records." };

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId as string, {
      password: data.password,
    });
    if (updErr) throw new Error(updErr.message);
    return { ok: true as const };
  });
