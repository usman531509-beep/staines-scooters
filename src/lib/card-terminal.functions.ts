import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Read the shop's card machine (terminal) configuration. */
export const getCardTerminal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("card_terminals")
      .select("*")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { terminal: data ?? null };
  });

export const saveCardTerminal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(80),
        provider: z.string().min(1).max(40),
        protocol: z.enum(["http", "https"]),
        host: z.string().max(120).nullable().optional(),
        port: z.number().int().min(1).max(65535),
        path: z.string().max(120),
        serial_number: z.string().max(60).nullable().optional(),
        ecr_id: z.string().min(1).max(40),
        currency: z.string().length(3),
        enabled: z.boolean(),
        notes: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { id, ...fields } = data;
    if (id) {
      const { error } = await supabase.from("card_terminals").update(fields).eq("id", id);
      if (error) throw error;
      return { ok: true, id };
    }
    const { data: row, error } = await supabase.from("card_terminals").insert(fields).select("id").single();
    if (error) throw error;
    return { ok: true, id: row.id as string };
  });

/** Issue a fresh integration key (the shared secret typed into the terminal). */
export const rotateTerminalKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const key = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { error } = await supabase.from("card_terminals").update({ integration_key: key }).eq("id", data.id);
    if (error) throw error;
    return { ok: true, integration_key: key };
  });

/** Create the payment request row the POS will push to the terminal. */
export const startTerminalPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        amountPence: z.number().int().min(1),
        saleId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: terminal, error: tErr } = await supabase
      .from("card_terminals")
      .select("*")
      .eq("enabled", true)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!terminal) throw new Error("No card machine is set up yet. Add one in Admin → Card Terminal.");
    if (!terminal.host) throw new Error("Card machine IP address is missing. Set it in Admin → Card Terminal.");

    const { data: tx, error } = await supabase
      .from("card_terminal_transactions")
      .insert({
        terminal_id: terminal.id,
        sale_id: data.saleId ?? null,
        amount_pence: data.amountPence,
        status: "pending",
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;

    return {
      transactionId: tx.id as string,
      reference: tx.reference as string,
      endpoint: `${terminal.protocol}://${terminal.host}:${terminal.port}${terminal.path.startsWith("/") ? terminal.path : `/${terminal.path}`}`,
      payload: {
        ecrId: terminal.ecr_id,
        integrationKey: terminal.integration_key,
        transactionType: "sale",
        amount: (data.amountPence / 100).toFixed(2),
        amountMinor: data.amountPence,
        currency: terminal.currency,
        reference: tx.reference,
      },
    };
  });

/** Record the outcome the terminal reported back to the POS. */
export const finishTerminalPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        transactionId: z.string().uuid(),
        status: z.enum(["approved", "declined", "cancelled", "error"]),
        message: z.string().max(300).nullable().optional(),
        authCode: z.string().max(40).nullable().optional(),
        cardScheme: z.string().max(40).nullable().optional(),
        cardLast4: z.string().max(4).nullable().optional(),
        raw: z.any().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("card_terminal_transactions")
      .update({
        status: data.status,
        message: data.message ?? null,
        auth_code: data.authCode ?? null,
        card_scheme: data.cardScheme ?? null,
        card_last4: data.cardLast4 ?? null,
        raw: data.raw ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", data.transactionId);
    if (error) throw error;
    return { ok: true };
  });

export const listTerminalTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("card_terminal_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw error;
    return { transactions: data ?? [] };
  });
