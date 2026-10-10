import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listFinanceNotes, addFinanceNote } from "@/lib/finance-notes.functions";
import { ukDateTime } from "@/lib/format-date";

export function FinanceNotes({ a, open, onClose, canWrite }: { a: any; open: boolean; onClose: () => void; canWrite: boolean }) {
  const get = useServerFn(listFinanceNotes);
  const add = useServerFn(addFinanceNote);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["finance-notes", a.id], queryFn: () => get({ data: { agreementId: a.id } }), enabled: open });
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"note" | "phone" | "in_person" | "email" | "message">("note");
  const save = useMutation({ mutationFn: () => add({ data: { agreementId: a.id, body, channel } }), onSuccess: () => { setBody(""); toast.success("Note saved"); qc.invalidateQueries({ queryKey: ["finance-notes", a.id] }); }, onError: (e: Error) => toast.error(e.message) });
  return <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}><DialogContent overlayClassName="z-[95]" className="z-[100] max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-md">
    <DialogHeader><DialogTitle>Notes · FA-{a.ref_no}</DialogTitle><DialogDescription>{a.customer_snapshot?.full_name}</DialogDescription></DialogHeader>
    {canWrite && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}><label className="grid gap-1 text-sm font-semibold">Conversation type<select className="rounded-sm border border-border bg-input px-3 py-2" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}><option value="note">Note</option><option value="phone">Phone call</option><option value="in_person">In person</option><option value="email">Email</option><option value="message">Message</option></select></label><label className="grid gap-1 text-sm font-semibold">Conversation / customer notes<textarea rows={5} maxLength={5000} className="rounded-sm border border-border bg-input px-3 py-2 font-normal" value={body} onChange={(e) => setBody(e.target.value)} /></label><Button type="submit" disabled={!body.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save note"}</Button></form>}
    {q.isLoading && <p className="text-sm text-ink-muted">Loading notes…</p>}
    {q.error && <p className="text-sm text-destructive">{q.error.message}</p>}
    {a.notes && <div className="border-t border-border pt-3"><p className="text-xs font-bold uppercase text-ink-muted">Existing agreement notes</p><p className="whitespace-pre-wrap break-words text-sm">{a.notes}</p></div>}
    {q.data?.length === 0 && <p className="text-sm text-ink-muted">No conversations recorded yet.</p>}
    <div className="space-y-3">{q.data?.map((n) => <article key={n.id} className="border-t border-border pt-3"><p className="text-xs text-ink-muted">{ukDateTime(n.created_at)} · {n.author} · {n.channel.replace(/_/g, " ")}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{n.body}</p></article>)}</div>
  </DialogContent></Dialog>;
}