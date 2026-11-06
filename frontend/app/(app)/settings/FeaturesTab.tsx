"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import type { ShopSettings } from "@/lib/types";
import { useSaver } from "./useSaver";

export function FeaturesTab({ settings }: { settings: ShopSettings }) {
  const save = useSaver();
  const [serial, setSerial] = useState(settings.serialTracking);
  return (
    <Card className="flex max-w-2xl flex-col gap-5 p-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold">IMEI / Seri Numarası ve Garanti Takibi</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Telefon, bilgisayar, elektronik veya beyaz eşya satan işletmeler için tasarlanmıştır. Bu özellik açık olduğunda, Stok bölümünde <b>Seri No Takipli</b> olarak işaretlediğiniz ürünlerin satışı esnasında her birimin seri numarası / IMEI bilgisi istenir. Cihazın seri no ve garanti bitiş süresi fişte yer alır ve daha sonra Garanti Sorgulama sayfasından taranabilir.
          </p>
          <p className="mt-2 text-sm text-foreground-muted">İhtiyacınız yoksa kapalı tutabilirsiniz; menüdeki Garanti sayfası ve kasadaki seri no uyarıları gizli kalır.</p>
        </div>
      </div>
      <Toggle
        label="Satışlarda IMEI / Seri Numarası Takibini Etkinleştir"
        description={serial ? "Açık — Ürünleri Stok → Düzenle ekranından seri no takipli yapabilirsiniz." : "Kapalı"}
        checked={serial}
        onChange={setSerial}
      />
      <div>
        <Button onClick={() => save({ serialTracking: serial })} disabled={serial === settings.serialTracking}>
          Kaydet
        </Button>
      </div>
    </Card>
  );
}
