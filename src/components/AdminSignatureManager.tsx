import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/SignaturePad";
import { getMyAdminSignature, saveMyAdminSignature } from "@/lib/admin-signatures.functions";

export function AdminSignatureManager() {
  const get = useServerFn(getMyAdminSignature);
  const saveFn = useServerFn(saveMyAdminSignature);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-admin-signature"], queryFn: () => get() });
  const [name, setName] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const legalName = name ?? q.data?.signed_name ?? "";
  const save = useMutation({ mutationFn: () => { if (!signature) throw new Error("Draw your signature first."); return saveFn({ data: { name: legalName, signature } }); }, onSuccess: () => { toast.success("Signature saved"); qc.invalidateQueries({ queryKey: ["my-admin-signature"] }); }, onError: (e: Error) => toast.error(e.message) });
  return <section className="space-y-3 border-t border-border pt-4">
    <h3 className="text-lg">My digital signature</h3>
    {q.isLoading && <p className="text-sm text-ink-muted">Loading signature…</p>}
    {q.error && <p className="text-sm text-destructive">{q.error.message}</p>}
    {q.data && <div className="space-y-2"><img src={q.data.signature_data} alt="Saved administrator signature" className="signature-pad h-20 max-w-full rounded-sm border border-border object-contain" /><Button variant="outline" size="sm" asChild><a href={q.data.signature_data} download="administrator-signature.png"><Download />Download signature PNG</a></Button></div>}
    <label className="grid gap-1 text-xs font-semibold uppercase">Full legal name<input className="rounded-sm border border-border bg-input px-3 py-2 text-sm" value={legalName} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
    <SignaturePad onChange={setSignature} />
    <Button disabled={!signature || legalName.trim().length < 3 || save.isPending} onClick={() => save.mutate()}><Save />{save.isPending ? "Saving…" : "Save my signature"}</Button>
  </section>;
}