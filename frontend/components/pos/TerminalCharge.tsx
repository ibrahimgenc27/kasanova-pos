"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";

export function TerminalCharge({
  amount,
  reference,
  paymentId,
  onPaid,
}: {
  amount: number;
  reference: string;
  paymentId: string | null;
  onPaid: (id: string | null) => void;
}) {
  const [state, setState] = useState<"idle" | "waiting" | "failed">("idle");
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const current = useRef<string | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function start() {
    setError("");
    setState("waiting");
    try {
      const { id } = await api.post<{ id: string }>("/payments/terminal/charge", { amount, reference });
      current.current = id;
      timer.current = setInterval(async () => {
        try {
          const s = await api.get<{ status: string }>(`/payments/terminal/status/${encodeURIComponent(id)}`);
          if (s.status === "PAID") {
            if (timer.current) clearInterval(timer.current);
            setState("idle");
            onPaid(id);
          } else if (s.status === "FAILED" || s.status === "CANCELED") {
            if (timer.current) clearInterval(timer.current);
            setState("failed");
            setError(s.status === "CANCELED" ? "Ödeme POS cihazında iptal edildi" : "Kart reddedildi / işlem başarısız");
          }
        } catch {
          /* transient */
        }
      }, 2000);
    } catch (e) {
      setState("failed");
      setError(e instanceof ApiError ? e.message : "Kart okuyucuya bağlanılamadı");
    }
  }

  async function cancel() {
    if (timer.current) clearInterval(timer.current);
    if (current.current) await api.post(`/payments/terminal/cancel/${encodeURIComponent(current.current)}`).catch(() => {});
    setState("idle");
  }

  if (paymentId) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">
        <CreditCard className="h-4 w-4" aria-hidden="true" /> Kart ödemesi onaylandı — satışı tamamlayabilirsiniz
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {state === "waiting" ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-soft px-3 py-2.5 text-sm text-brand">
          <span className="flex items-center gap-2" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Müşterinin kartı temassız okutması veya takması bekleniyor…
          </span>
          <Button variant="ghost" onClick={cancel}>
            İptal
          </Button>
        </div>
      ) : (
        <Button variant="secondary" disabled={!(amount > 0)} onClick={start}>
          <CreditCard className="h-4 w-4" aria-hidden="true" /> Tutarı Kart Okuyucuya Gönder
        </Button>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
