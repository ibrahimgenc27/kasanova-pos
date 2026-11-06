"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Bits";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/Toast";
import { usePasswordConfirm } from "@/components/PasswordConfirm";
import { api, describeApiError } from "@/lib/api";

export function OnlineTab() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <StoresCard />
      <CustomWebsiteCard />
      <AnnouncementsCard />
    </div>
  );
}

interface Store { id: number; platform: "woocommerce" | "shopify" | "generic"; name: string; active: boolean; lastEventAt: string | null; webhookUrl: string; outboundConfigured: boolean; baseUrl: string; shopDomain: string; locationId: string }

function CustomWebsiteCard() {
  const base = typeof window === "undefined" ? "" : `${window.location.origin}/api/external`;
  const example = `curl -X POST ${base}/orders \\
  -H "Authorization: Bearer nk_live_…" -H "Content-Type: application/json" \\
  -d '{"externalId":"siparis-1001","customer":{"name":"Ahmet Yılmaz","phone":"05321112233"},"items":[{"sku":"KOLA-1","quantity":2}],"paid":true}'`;
  return (
    <Card className="flex flex-col gap-3 p-6">
      <div>
        <h2 className="text-base font-semibold">Özel Web Siteniz (REST API Entegrasyonu)</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Kendi e-ticaret sitenizi veya mobil uygulamanızı mı kullanıyorsunuz? Siparişlerinizi basit bir REST API çağrısıyla POS sistemine aktarabilirsiniz. POS stoku rezerve eder, paketleme ve teslimat sürecini yönetir. Sitede ödendiyse <code className="text-xs">paid: true</code>; kapıda veya mağazada ödenecekse <code className="text-xs">paid: false</code> gönderin.
        </p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground-muted">
        <li>Online sattığınız ürünlere Stok sayfasından bir <b>Barkod / SKU</b> belirleyin.</li>
        <li><b>Entegrasyonlar</b> sekmesinden <b>products:read</b> ve <b>orders:write</b> yetkili bir API anahtarı oluşturun.</li>
        <li>Siparişleri <code className="rounded bg-surface-muted px-1 font-mono text-xs">{base || "/api/external"}/orders</code> adresine POST edin.</li>
      </ol>
      <pre className="overflow-x-auto rounded-lg bg-surface-muted p-3 font-mono text-xs leading-relaxed">{example}</pre>
    </Card>
  );
}

function StoresCard() {
  const { show } = useToast();
  const qc = useQueryClient();
  const { withPasswordConfirm } = usePasswordConfirm();
  const { data: stores = [] } = useQuery({ queryKey: ["stores"], queryFn: () => api.get<Store[]>("/integrations") });
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ url: string; secret: string } | null>(null);
  const [cfg, setCfg] = useState<Store | null>(null);
  const [platform, setPlatform] = useState("woocommerce");
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => withPasswordConfirm("bu mağazayı bağlamak", (confirmPassword) => api.post<Store & { webhookSecret: string }>("/integrations", { platform, name, confirmPassword })),
    onSuccess: (r) => { if (r) { setAdding(false); setName(""); setSecret({ url: r.webhookUrl, secret: r.webhookSecret }); qc.invalidateQueries({ queryKey: ["stores"] }); } },
    onError: (e) => show(describeApiError(e, "Bağlanamadı"), "error"),
  });
  const remove = useMutation({
    mutationFn: (id: number) => withPasswordConfirm("bu mağaza bağlantısını kesmek", (confirmPassword) => api.delete(`/integrations/${id}`, { confirmPassword })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stores"] }),
  });

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">WooCommerce, Shopify ve E-ticaret Entegrasyonları</h2>
          <p className="mt-1 text-sm text-foreground-muted">Gelen siparişler anında POS ekranına teslimat/gel-al siparişi olarak düşer; mağazada yapılan satışlar da e-ticaret sitenizdeki stoku günceller.</p>
        </div>
        <Button onClick={() => setAdding(true)}>Mağaza Bağla</Button>
      </div>
      <ul className="divide-y divide-border">
        {stores.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{s.name} <Badge tone="brand">{s.platform}</Badge> {!s.active && <Badge tone="bad">Duraklatıldı</Badge>}</p>
              <p className="truncate text-xs text-foreground-muted">{s.outboundConfigured ? "stok eşitleme aktif" : "stok eşitleme kapalı"} · {s.lastEventAt ? `son sipariş: ${new Date(s.lastEventAt).toLocaleString("tr-TR")}` : "henüz sipariş yok"}</p>
              <code className="block truncate text-[11px] text-foreground-muted">{s.webhookUrl}</code>
            </div>
            <div className="flex gap-2">
              {s.platform !== "generic" && <Button variant="secondary" onClick={() => setCfg(s)}>Stok Eşitleme</Button>}
              <Button variant="ghost" aria-label={`${s.name} bağlantısını kes`} onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4 text-danger" aria-hidden="true" /></Button>
            </div>
          </li>
        ))}
        {stores.length === 0 && <li className="py-3 text-sm text-foreground-muted">Bağlı e-ticaret mağazası bulunmuyor.</li>}
      </ul>
      {adding && (
        <Modal title="Online Mağaza Bağla" onClose={() => setAdding(false)} size="sm">
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <Select label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)} options={[{ value: "woocommerce", label: "WooCommerce" }, { value: "shopify", label: "Shopify" }, { value: "generic", label: "Özel Web Sitesi (Webhook)" }]} />
            <Field label="Mağaza Tanım Adı" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: E-ticaret Sitem" />
            <Button type="submit" disabled={!name.trim() || create.isPending}>Bağlantıyı Oluştur</Button>
          </form>
        </Modal>
      )}
      {secret && (
        <Modal title="Bu Webhook Adresini Mağazanıza Ekleyin" onClose={() => setSecret(null)} closeOnBackdrop={false}>
          <p className="mb-2 text-sm text-warning">Gizli anahtarı şimdi kopyalayın — yalnızca bir kez gösterilir.</p>
          <p className="text-xs font-medium">Hedef Webhook URL</p><code className="mb-2 block break-all rounded-lg bg-surface-muted p-2 text-xs">{secret.url}</code>
          <p className="text-xs font-medium">İmza Anahtarı (Secret)</p><code className="block break-all rounded-lg bg-surface-muted p-2 text-xs">{secret.secret}</code>
          <p className="mt-3 text-xs text-foreground-muted">WooCommerce için: Ayarlar → Gelişmiş → Webhook&apos;lar → &ldquo;Sipariş oluşturuldu&rdquo; konusu. Shopify için: Ayarlar → Bildirimler → Webhook&apos;lar → &ldquo;Sipariş oluşturma&rdquo;.</p>
          <Button className="mt-3 w-full" onClick={() => setSecret(null)}>Kopyaladım, Kapat</Button>
        </Modal>
      )}
      {cfg && <OutboundDialog store={cfg} onClose={() => setCfg(null)} />}
    </Card>
  );
}

function OutboundDialog({ store, onClose }: { store: Store; onClose: () => void }) {
  const { show } = useToast();
  const qc = useQueryClient();
  const { withPasswordConfirm } = usePasswordConfirm();
  const [f, setF] = useState({ baseUrl: store.baseUrl, consumerKey: "", consumerSecret: "", shopDomain: store.shopDomain, accessToken: "", locationId: store.locationId });
  const save = useMutation({
    mutationFn: () => {
      const body = store.platform === "woocommerce" ? { baseUrl: f.baseUrl, ...(f.consumerKey ? { consumerKey: f.consumerKey } : {}), ...(f.consumerSecret ? { consumerSecret: f.consumerSecret } : {}) } : { shopDomain: f.shopDomain, locationId: f.locationId, ...(f.accessToken ? { accessToken: f.accessToken } : {}) };
      return withPasswordConfirm("stok eşitleme bilgilerini kaydetmek", (confirmPassword) => api.put(`/integrations/${store.id}`, { ...body, confirmPassword }));
    },
    onSuccess: (r) => { if (r) { show("Kaydedildi — stok değişiklikleri online mağazaya aktarılacaktır", "success"); qc.invalidateQueries({ queryKey: ["stores"] }); onClose(); } },
    onError: (e) => show(describeApiError(e, "Kaydedilemedi"), "error"),
  });
  return (
    <Modal title={`Stok Eşitleme Yapılandırması · ${store.name}`} onClose={onClose} size="sm">
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        {store.platform === "woocommerce" ? (
          <>
            <Field label="Mağaza Web Adresi (https://…)" type="url" value={f.baseUrl} onChange={(e) => setF({ ...f, baseUrl: e.target.value })} />
            <Field label="WooCommerce Consumer Key" type="password" autoComplete="off" value={f.consumerKey} onChange={(e) => setF({ ...f, consumerKey: e.target.value })} />
            <Field label="WooCommerce Consumer Secret" type="password" autoComplete="off" value={f.consumerSecret} onChange={(e) => setF({ ...f, consumerSecret: e.target.value })} />
          </>
        ) : (
          <>
            <Field label="Shopify Alan Adı (xxx.myshopify.com)" value={f.shopDomain} onChange={(e) => setF({ ...f, shopDomain: e.target.value })} />
            <Field label="Admin API Erişim Belirteci" type="password" autoComplete="off" value={f.accessToken} onChange={(e) => setF({ ...f, accessToken: e.target.value })} />
            <Field label="Konum Kimliği (Location ID)" value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })} />
          </>
        )}
        <Button type="submit" disabled={save.isPending}>Kaydet</Button>
      </form>
    </Modal>
  );
}

interface Ann { id: number; title: string; body: string; active: boolean }
function AnnouncementsCard() {
  const qc = useQueryClient();
  const { show } = useToast();
  const { data = [] } = useQuery({ queryKey: ["announcements"], queryFn: () => api.get<Ann[]>("/announcements") });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const add = useMutation({
    mutationFn: () => api.post("/announcements", { title, body }),
    onSuccess: () => { setTitle(""); setBody(""); qc.invalidateQueries({ queryKey: ["announcements"] }); },
    onError: (e) => show(describeApiError(e, "Eklenemedi"), "error"),
  });
  const toggle = useMutation({ mutationFn: (a: Ann) => api.put(`/announcements/${a.id}`, { active: !a.active }), onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }) });
  const del = useMutation({ mutationFn: (id: number) => api.delete(`/announcements/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }) });
  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-base font-semibold">Müşteri Kampanya &amp; Duyuruları</h2>
      <p className="text-sm text-foreground-muted">Müşteri sadakat sayfasında ve dijital fişlerde görüntülenir.</p>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <Field label="Duyuru Başlığı" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <label className="flex flex-col gap-1.5 text-sm font-medium">Kampanya Mesajı<textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={600} rows={2} className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm" /></label>
        <div><Button type="submit" disabled={!title.trim() || !body.trim() || add.isPending}>Yayınla</Button></div>
      </form>
      <ul className="divide-y divide-border">
        {data.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
            <span className={a.active ? "" : "text-foreground-muted line-through"}><b>{a.title}</b> — {a.body}</span>
            <span className="flex shrink-0 gap-1">
              <Button variant="ghost" onClick={() => toggle.mutate(a)}>{a.active ? "Gizle" : "Göster"}</Button>
              <Button variant="ghost" aria-label="Duyuruyu sil" onClick={() => del.mutate(a.id)}><Trash2 className="h-4 w-4 text-danger" aria-hidden="true" /></Button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
