"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, ExternalLink, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/Toast";
import { api, describeApiError } from "@/lib/api";

export function CustomerDisplayLink({ onClose }: { onClose: () => void }) {
  const { show } = useToast();
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [viewers, setViewers] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const r = await api.get<{ key: string; viewers: number }>("/display/link");
        if (stopped) return;
        setViewers(r.viewers);
        const link = `${window.location.origin}/display?key=${r.key}`;
        setUrl((prev) => {
          if (prev !== link) QRCode.toDataURL(link, { margin: 1, width: 240 }).then((d) => !stopped && setQr(d)).catch(() => {});
          return link;
        });
      } catch (e) {
        if (!stopped) setError(describeApiError(e, "Müşteri ekranı bağlantısı alınamadı"));
      }
    }
    load();
    const t = setInterval(load, 4000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      show("Bağlantı kopyalandı", "success");
    } catch {
      show("Kopyalama engellendi — lütfen bağlantıyı seçip elle kopyalayınız", "error");
    }
  }

  return (
    <Modal title="Müşteri Ekranı Bağlantısı" onClose={onClose} size="md">
      {error ? (
        <p role="alert" className="text-sm text-danger">{error}</p>
      ) : !url ? (
        <p className="text-sm text-foreground-muted">Yükleniyor…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground-muted">
            Aynı yerel ağdaki (Wi-Fi) herhangi bir telefon, tablet veya ikinci monitörde bu linki açın. Kasadaki sepet, indirimler ve ödeme bilgisi anlık olarak müşteriye gösterilir.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt="Müşteri ekranı QR kodu" width={160} height={160} className="rounded-lg border border-border bg-white p-1" />}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-foreground-muted"><Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> Tablet/telefonla QR okutun ya da adresi açın:</p>
              <input readOnly aria-label="Müşteri ekranı bağlantısı" value={url} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs" />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={copy}><Copy className="h-4 w-4" aria-hidden="true" /> Bağlantıyı Kopyala</Button>
                <Button type="button" variant="secondary" onClick={() => window.open(url, "nodedr-display", "popup,width=900,height=600")}>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" /> Bu Cihazda İkinci Ekranda Aç
                </Button>
              </div>
            </div>
          </div>
          <p className="flex items-center gap-2 text-sm" aria-live="polite">
            <Monitor className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
            {viewers > 0 ? <span className="text-success">{viewers} müşteri ekranı bağlı</span> : <span className="text-foreground-muted">Henüz bağlı müşteri ekranı yok</span>}
          </p>
          <p className="text-xs text-foreground-muted">İpucu: Tablette tarayıcının &ldquo;Ana Ekrana Ekle&rdquo; veya tam ekran modunu kullanarak profesyonel müşteri ekranı oluşturabilirsiniz.</p>
        </div>
      )}
    </Modal>
  );
}
