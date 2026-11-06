"use client";

import { FileText, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { api, ApiError } from "@/lib/api";

export function ShareActions({ invoiceId, phone }: { invoiceId: number; phone?: string | null }) {
  const { show } = useToast();

  async function whatsapp() {
    try {
      const r = await api.get<{ whatsappUrl: string; hasPhone: boolean }>(`/payments/share/${invoiceId}${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`);
      if (!r.hasPhone) show("Faturada müşteri telefonu yok — WhatsApp açıldığında kişiyi seçiniz", "info");
      window.open(r.whatsappUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "WhatsApp mesajı hazırlanamadı", "error");
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={whatsapp}>
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        WhatsApp ile Paylaş
      </Button>
      <a href={`/api/print/${invoiceId}/pdf?layout=a4`} download className="contents">
        <Button type="button" variant="secondary">
          <FileText className="h-4 w-4" aria-hidden="true" />
          A4 Fatura İndir
        </Button>
      </a>
    </>
  );
}
