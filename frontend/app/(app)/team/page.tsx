"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Badge, EmptyState, PageHeader } from "@/components/ui/Bits";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/Toast";
import { usePasswordConfirm } from "@/components/PasswordConfirm";
import { useCreateUser, useMe, useUpdateUser, useUsers } from "@/hooks/useAuth";
import { describeApiError } from "@/lib/api";
import type { AuthUser, Permission, Role } from "@/lib/types";

const PERMS: { key: Permission; label: string; hint: string }[] = [
  { key: "discount", label: "İndirim Yapabilme", hint: "Aşağıda belirlenen üst sınıra kadar" },
  { key: "returns", label: "İade İşlemleri", hint: "Nakit/kart iadesi ve borç mahsubu" },
  { key: "inventory", label: "Stok & Ürün Yönetimi", hint: "Ürün ekleme, barkod/seri no ve stok düzenleme" },
  { key: "customers", label: "Müşteri Yönetimi", hint: "Müşteri kartı açma, borç ve bakiye takibi" },
  { key: "orders", label: "Online Sipariş Yönetimi", hint: "Hazırlama, teslim etme ve faturalandırma" },
  { key: "purchasing", label: "Satın Alma & Tedarikçiler", hint: "Tedarikçi kartları ve mal kabul işlemleri" },
  { key: "reports", label: "Raporları Görüntüleme", hint: "Ciro, kâr marjı, KDV ve mali raporlar" },
];
const PASTELS = ["#e8f3ea", "#fdf0d5", "#e3eef9", "#f6e3ee", "#ece6f7", "#e0f3f0"];

export default function TeamPage() {
  const { data: users = [], isLoading } = useUsers();
  const { data: me } = useMe();
  const [open, setOpen] = useState<AuthUser | "new" | null>(null);

  return (
    <div>
      <PageHeader
        title="Ekip ve Yetkiler"
        subtitle="Personel hesapları, kullanıcı rolleri ve işlem yetkileri."
        actions={
          <Button onClick={() => setOpen("new")}>
            <UserPlus className="h-4 w-4" aria-hidden="true" /> Personel Ekle
          </Button>
        }
      />
      {isLoading && <p className="text-foreground-muted">Yükleniyor…</p>}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {users.map((u, i) => (
          <li key={u.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
            <button type="button" onClick={() => setOpen(u)} className="card-surface card-lift flex h-full w-full flex-col gap-3 p-5 text-left">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-[#0d3b28]" style={{ background: PASTELS[i % PASTELS.length] }} aria-hidden="true">{u.name.trim()[0]?.toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{u.name}{u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-foreground-muted">(siz)</span>}</p>
                  <p className="truncate text-sm text-foreground-muted">{u.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={u.role === "admin" ? "brand" : u.role === "franchisor" ? "warn" : "neutral"}>
                  {u.role === "admin" ? "Yönetici" : u.role === "franchisor" ? "Merkez / Franchise" : "Kasiyer"}
                </Badge>
                {!u.active && <Badge tone="bad">Pasif</Badge>}
                {u.role === "cashier" && u.permissions.length === 0 && <Badge>Sadece Satış</Badge>}
                {u.role === "cashier" && u.maxDiscountPercent != null && <Badge tone="warn">≤ %{u.maxDiscountPercent} İndirim</Badge>}
              </div>
              <p className="mt-auto text-xs text-foreground-muted">
                {u.role === "admin" ? "Tam Sistem Yetkisi" : u.role === "franchisor" ? "Şubeler arası salt okunur raporlama" : `${u.permissions.length} ek yetki tanımlı`}
              </p>
            </button>
          </li>
        ))}
      </ul>
      {!isLoading && users.length === 0 && <EmptyState title="Henüz personel kaydı yok" />}
      {open && <MemberDrawer user={open === "new" ? null : open} isSelf={open !== "new" && open.id === me?.id} onClose={() => setOpen(null)} />}
    </div>
  );
}

function MemberDrawer({ user, isSelf, onClose }: { user: AuthUser | null; isSelf: boolean; onClose: () => void }) {
  const { show } = useToast();
  const { withPasswordConfirm } = usePasswordConfirm();
  const create = useCreateUser();
  const update = useUpdateUser();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user?.role ?? "cashier");
  const [perms, setPerms] = useState<Permission[]>(user?.permissions ?? ["discount", "returns", "customers", "orders"]);
  const [cap, setCap] = useState(user?.maxDiscountPercent != null ? String(user.maxDiscountPercent) : "");
  const [active, setActive] = useState(user?.active ?? true);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const maxDiscountPercent = cap.trim() === "" ? null : Math.min(100, Math.max(0, Number(cap) || 0));
      const done = await withPasswordConfirm(user ? "bu personeli güncellemek" : "yeni personel oluşturmak", async (confirmPassword) => {
        if (!user) return create.mutateAsync({ name, email, password, role, permissions: perms, maxDiscountPercent, confirmPassword });
        return update.mutateAsync({ id: user.id, data: { name, role, active, permissions: perms, maxDiscountPercent, ...(password ? { password } : {}), confirmPassword } });
      });
      if (done) {
        show(user ? "Personel bilgileri güncellendi" : "Yeni personel eklendi", "success");
        onClose();
      }
    } catch (e) {
      show(describeApiError(e, "Kaydedilemedi"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={user ? user.name : "Personel Ekle"} variant="drawer" onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Ad Soyad" required value={name} onChange={(e) => setName(e.target.value)} />
        {!user && <Field label="E-posta Adresi" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        <Field
          label={user ? "Yeni Şifre (aynı kalması için boş bırakın)" : "Giriş Şifresi"}
          type="password"
          minLength={8}
          required={!user}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <label className="flex flex-col gap-1.5 text-sm font-medium">Kullanıcı Rolü
          <select value={role} disabled={isSelf} onChange={(e) => setRole(e.target.value as Role)} className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
            <option value="cashier">Kasiyer</option>
            <option value="admin">Yönetici (Tam Yetkili)</option>
            <option value="franchisor">Merkez / Franchise (Yalnızca Rapor Görüntüleme)</option>
          </select>
        </label>
        {role === "cashier" && (
          <fieldset className="flex flex-col gap-2.5 rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-semibold">Özel Yetkiler</legend>
            {PERMS.map((p) => (
              <label key={p.key} className="flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                  checked={perms.includes(p.key)}
                  onChange={(e) => setPerms((cur) => (e.target.checked ? [...cur, p.key] : cur.filter((x) => x !== p.key)))}
                />
                <span>
                  <span className="font-medium">{p.label}</span>
                  {p.hint && <span className="block text-xs text-foreground-muted">{p.hint}</span>}
                </span>
              </label>
            ))}
            <Field
              label="Maksimum İndirim Sınırı (% cinsinden, sınırsız için boş bırakın)"
              type="number"
              min={0}
              max={100}
              step="0.5"
              disabled={!perms.includes("discount")}
              value={cap}
              onChange={(e) => setCap(e.target.value)}
            />
          </fieldset>
        )}
        {user && !isSelf && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Hesap Aktif (Giriş Yapabilir)
          </label>
        )}
        <Button type="submit" disabled={busy || !name.trim() || (!user && (!email || password.length < 8))}>
          {busy ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </form>
    </Modal>
  );
}
