"use client";

import { useState } from "react";
import { Download, Printer, Usb } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { openReceiptPrint } from "@/lib/print";
import { api, ApiError } from "@/lib/api";

export function ReceiptActions({ invoiceId, className }: { invoiceId: number; className?: string }) {
  const { show } = useToast();
  const [printingUsb, setPrintingUsb] = useState(false);

  async function printViaUsb() {
    setPrintingUsb(true);
    try {
      await api.post(`/print/${invoiceId}/usb`);
      show("USB fiş yazıcıya gönderildi", "success");
    } catch (err) {
      show(
        err instanceof ApiError
          ? err.message
          : "USB yazıcıya gönderilemedi",
        "error"
      );
    } finally {
      setPrintingUsb(false);
    }
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className || ""}`}>
      <Button type="button" variant="secondary" onClick={() => openReceiptPrint(invoiceId)}>
        <Printer className="h-4 w-4" aria-hidden="true" />
        Yazdır
      </Button>
      <a href={`/api/print/${invoiceId}/pdf`} download className="contents">
        <Button type="button" variant="secondary">
          <Download className="h-4 w-4" aria-hidden="true" />
          PDF İndir
        </Button>
      </a>
      <Button type="button" variant="secondary" onClick={printViaUsb} disabled={printingUsb}>
        <Usb className="h-4 w-4" aria-hidden="true" />
        {printingUsb ? "Yazdırılıyor…" : "Doğrudan Termal Bas"}
      </Button>
    </div>
  );
}
