"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Plus, KeyRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { usePasswordConfirm } from "@/components/PasswordConfirm";
import { useApiKeys, useCreateApiKey, useUpdateApiKey, useDeleteApiKey } from "@/hooks/useApiKeys";
import { describeApiError } from "@/lib/api";
import type { ApiKey, ApiKeyWithSecrets } from "@/lib/types";

const SCOPE_INFO: { key: string; label: string; hint: string }[] = [
  { key: "products:read", label: "Ürünleri ve Stoku Oku", hint: "SKU/barkod bağlı ürünleri anlık stok ve fiyatlarıyla listeler" },
  { key: "stock:write", label: "Stok Güncelle", hint: "Ürün için satış veya stok sayım düzeltmesi bildirir" },
  { key: "bills:write", label: "Fatura / Fiş Düzenle", hint: "Online mağazadan satış fişi keser (KDV ve stok otomatik işlenir)" },
  { key: "bills:read", label: "Faturaları ve PDF'leri Oku", hint: "Yalnızca bu API anahtarı ile kesilen satış dökümlerini okur" },
  { key: "orders:write", label: "Gel-Al ve Teslimat Siparişleri", hint: "Stok rezerve eden siparişler oluşturur ve durumunu yönetir" },
  { key: "warranty:read", label: "Garanti ve Seri No Sorgulama", hint: "IMEI veya seri numarasından garanti durumunu kontrol eder" },
];

function ApiGuide() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-foreground">E-ticaret veya Yapay Zeka (AI / MCP) Entegrasyonu</h2>
      <p className="mt-1 text-sm text-foreground-muted">Yukarıdan bir API anahtarı oluşturun, ardından REST API veya MCP (Model Context Protocol) istemcisine bağlayın. Her iki yöntem de aynı güvenlik kurallarına tabidir.</p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs leading-relaxed">{`# web sitenizden fatura/fiş oluşturma
curl -X POST ${origin}/api/external/bills \\
  -H "Authorization: Bearer nk_live_…" -H "Content-Type: application/json" \\
  -d '{"externalRef":"siparis-1001","customer":{"name":"Ali Demir","phone":"05551234567"},
       "items":[{"sku":"TELEFON-1","quantity":1,"serials":["490154203237518"]}],
       "paymentMethod":"CARD"}'

# PDF fatura indirme        GET /api/external/bills/siparis-1001/pdf?layout=a4
# anlık stok dökümü         GET /api/external/products?updatedSince=2026-01-01T00:00:00Z
# IMEI ile garanti sorgusu  GET /api/external/warranty/490154203237518`}</pre>
      <p className="mt-3 text-sm font-medium">Model Context Protocol (MCP)</p>
      <pre className="mt-1 overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs leading-relaxed">{`# Uzak HTTP: POST ${origin}/mcp (Authorization: Bearer nk_live_…)
# Masaüstü yerel istemci (stdio):
{ "mcpServers": { "nodedr-pos": {
    "command": "node", "args": ["backend/src/mcp/stdio.js"],
    "env": { "NODEDR_API_KEY": "nk_live_…", "DATABASE_URL": "file:./data/pos.db" } } } }`}</pre>
    </Card>
  );
}

export function IntegrationsTab() {
  const { data: keys, isLoading } = useApiKeys();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApiKey | null>(null);
  const [revealed, setRevealed] = useState<ApiKeyWithSecrets | null>(null);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Harici Stok &amp; Satış API&apos;si</h2>
            <p className="mt-1 text-sm text-foreground/60">
              E-ticaret sitenizin veya harici uygulamalarınızın barkod/SKU ile eşleşen ürünlerin canlı stoklarını okumasına ve satış bildirmesine olanak tanır. Yalnızca Stok sayfasında SKU/Barkod tanımlanmış ürünler API üzerinden sunulur.
            </p>
          </div>
          <KeyRound className="h-5 w-5 shrink-0 text-foreground/30" aria-hidden="true" />
        </div>
        <Button
          className="mt-4"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Yeni API Anahtarı
        </Button>

        {isLoading ? (
          <p className="mt-4 text-sm text-foreground/50">Yükleniyor…</p>
        ) : !keys || keys.length === 0 ? (
          <p className="mt-4 text-sm text-foreground/50">Henüz oluşturulmuş bir API anahtarı yok.</p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {keys.map((k) => (
              <ApiKeyRow
                key={k.id}
                apiKey={k}
                onEdit={() => {
                  setEditing(k);
                  setFormOpen(true);
                }}
                onRevealed={setRevealed}
              />
            ))}
          </ul>
        )}
      </Card>

      <ApiGuide />

      {formOpen && (
        <ApiKeyFormModal
          editing={editing}
          onClose={() => setFormOpen(false)}
          onCreated={(result) => {
            setFormOpen(false);
            setRevealed(result);
          }}
        />
      )}
      {revealed && <SecretRevealModal result={revealed} onClose={() => setRevealed(null)} />}
    </div>
  );
}

function ApiKeyRow({
  apiKey,
  onEdit,
  onRevealed,
}: {
  apiKey: ApiKey;
  onEdit: () => void;
  onRevealed: (r: ApiKeyWithSecrets) => void;
}) {
  const { show } = useToast();
  const { withPasswordConfirm } = usePasswordConfirm();
  const update = useUpdateApiKey();
  const del = useDeleteApiKey();

  async function toggleRevoke() {
    const result = await withPasswordConfirm(apiKey.revoked ? "bu anahtarı yeniden etkinleştirmek" : "bu anahtarı iptal etmek", (confirmPassword) =>
      update.mutateAsync({ id: apiKey.id, revoked: !apiKey.revoked, confirmPassword })
    );
    if (result) show(apiKey.revoked ? "Anahtar yeniden aktifleştirildi" : "Anahtar iptal edildi", "success");
  }

  async function remove() {
    if (!window.confirm(`"${apiKey.name}" anahtarını silmek istediğinize emin misiniz? Bu anahtarı kullanan entegrasyonlar derhal çalışmayı durduracaktır.`)) return;
    const result = await withPasswordConfirm("bu API anahtarını silmek", (confirmPassword) =>
      del.mutateAsync({ id: apiKey.id, confirmPassword })
    );
    if (result !== undefined) show("Anahtar silindi", "success");
  }

  void onRevealed;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{apiKey.name}</p>
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand" title={apiKey.scopes.join(", ")}>
            {apiKey.scopes.length} yetki
          </span>
          {apiKey.revoked && (
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">İptal Edildi</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-foreground/50">
          nk_live_{apiKey.keyPrefix}… · {apiKey.webhookUrl ? "webhook tanımlı" : "webhook yok"} ·{" "}
          {apiKey.lastUsedAt ? `son kullanım: ${new Date(apiKey.lastUsedAt).toLocaleString("tr-TR")}` : "hiç kullanılmadı"}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onEdit}>
          Düzenle
        </Button>
        <Button variant="secondary" onClick={toggleRevoke} disabled={update.isPending}>
          {apiKey.revoked ? "Etkinleştir" : "İptal Et"}
        </Button>
        <Button variant="danger" onClick={remove} disabled={del.isPending}>
          Sil
        </Button>
      </div>
    </li>
  );
}

function ApiKeyFormModal({
  editing,
  onClose,
  onCreated,
}: {
  editing: ApiKey | null;
  onClose: () => void;
  onCreated: (result: ApiKeyWithSecrets) => void;
}) {
  const { show } = useToast();
  const { withPasswordConfirm } = usePasswordConfirm();
  const create = useCreateApiKey();
  const update = useUpdateApiKey();
  const [name, setName] = useState(editing?.name ?? "");
  const [scopes, setScopes] = useState<string[]>(editing?.scopes ?? ["products:read"]);
  const [webhookUrl, setWebhookUrl] = useState(editing?.webhookUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        const webhookChanged = webhookUrl !== (editing.webhookUrl ?? "");
        const result = await withPasswordConfirm("bu API anahtarını güncellemek", (confirmPassword) =>
          update.mutateAsync({
            id: editing.id,
            name,
            scopes,
            confirmPassword,
            ...(webhookChanged ? { webhookUrl } : {}),
          })
        );
        if (result) {
          if (result.webhookSecret) {
            onCreated(result);
          } else {
            show("API anahtarı güncellendi", "success");
            onClose();
          }
        }
      } else {
        const result = await withPasswordConfirm("yeni API anahtarı oluşturmak", (confirmPassword) =>
          create.mutateAsync({ name, scopes, webhookUrl, confirmPassword })
        );
        if (result) onCreated(result);
      }
    } catch (err) {
      setError(describeApiError(err, "API anahtarı kaydedilemedi"));
    }
  }

  return (
    <div className="backdrop-in fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[rgb(8_28_18/0.32)] px-4 py-6" role="dialog" aria-modal="true">
      <Card className="dialog-in w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-foreground">{editing ? "API Anahtarını Düzenle" : "Yeni API Anahtarı"}</h2>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
          <Field
            label="Entegrasyon Adı"
            placeholder="örn: Web Sitemiz / WooCommerce"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <legend className="px-1 text-sm font-medium text-foreground">Yetkiler (Yalnızca gereken yetkileri seçin)</legend>
            {SCOPE_INFO.map((sc) => (
              <label key={sc.key} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--brand)]" checked={scopes.includes(sc.key)} onChange={(e) => setScopes((cur) => (e.target.checked ? [...cur, sc.key] : cur.filter((x) => x !== sc.key)))} />
                <span><span className="font-medium">{sc.label}</span><span className="block text-xs text-foreground/50">{sc.hint}</span></span>
              </label>
            ))}
          </fieldset>
          <div>
            <Field
              label="Webhook URL (isteğe bağlı)"
              type="url"
              placeholder="https://siteniz.com/api/webhooks/pos"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="mt-1 text-xs text-foreground/50">
              Belirtilirse, mağazada satış veya iade olduğunda bu URL&apos;e anında imzalı stok güncelleme bildirimi gönderilir.
            </p>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="mt-1 flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
              Vazgeç
            </Button>
            <Button type="submit" className="flex-1" disabled={busy || !name || scopes.length === 0}>
              {busy ? "Kaydediliyor…" : editing ? "Değişiklikleri Kaydet" : "Anahtarı Oluştur"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function SecretRevealModal({ result, onClose }: { result: ApiKeyWithSecrets; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-lg p-6">
        <h2 className="text-base font-semibold text-foreground">
          {result.apiKey ? "API Anahtarı Oluşturuldu" : "Webhook Anahtarı Yenilendi"}
        </h2>
        <p className="mt-1 text-sm text-warning">
          Bu anahtarları şimdi kopyalayın — güvenliğiniz için yalnızca bir kez gösterilir ve tekrar görüntülenemez.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {result.apiKey && <SecretField label="API Anahtarı (Bearer Token)" value={result.apiKey} />}
          {result.webhookSecret && <SecretField label="Webhook İmza Gizli Anahtarı (HMAC Secret)" value={result.webhookSecret} />}
        </div>
        {result.apiKey && (
          <p className="mt-3 text-xs text-foreground/50">
            İsteklerde <code className="rounded bg-surface-muted px-1 py-0.5">Authorization: Bearer &lt;anahtar&gt;</code> başlığı ile birlikte gönderin.
          </p>
        )}
        <Button className="mt-5 w-full" onClick={onClose}>
          Kopyaladım, Kapat
        </Button>
      </Card>
    </div>
  );
}

function SecretField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-xs text-foreground">
          {value}
        </code>
        <Button type="button" variant="secondary" onClick={copy} aria-label={`${label} kopyala`}>
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
