"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { usePasswordConfirm } from "@/components/PasswordConfirm";
import { useUsers, useCreateUser, useUpdateUser } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useAuth";

const createSchema = z.object({
  name: z.string().trim().min(1, "Ad Soyad alanı zorunludur"),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  role: z.enum(["admin", "cashier"]),
});
type CreateForm = z.infer<typeof createSchema>;

export function UsersPanel() {
  const { data: users } = useUsers();
  const { data: me } = useMe();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const { show } = useToast();
  const { withPasswordConfirm } = usePasswordConfirm();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema), defaultValues: { role: "cashier" } });

  const [showForm, setShowForm] = useState(false);

  async function onCreate(values: CreateForm) {
    const result = await withPasswordConfirm("bu personel hesabını oluşturmak", (confirmPassword) =>
      createUser.mutateAsync({ ...values, confirmPassword })
    );
    if (result) {
      show("Personel hesabı oluşturuldu", "success");
      reset({ role: "cashier" });
      setShowForm(false);
    }
  }

  async function toggleActive(id: number, active: boolean) {
    const result = await withPasswordConfirm(active ? "bu kullanıcıyı aktifleştirmek" : "bu kullanıcıyı devre dışı bırakmak", (confirmPassword) =>
      updateUser.mutateAsync({ id, data: { active, confirmPassword } })
    );
    if (result) show(active ? "Kullanıcı aktifleştirildi" : "Kullanıcı devre dışı bırakıldı", "success");
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Personel Hesapları</h2>
        <Button onClick={() => setShowForm((s) => !s)}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Personel Ekle
        </Button>
      </div>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleSubmit(onCreate)} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Ad Soyad" error={errors.name?.message} {...register("name")} />
            <Field label="E-posta Adresi" type="email" error={errors.email?.message} {...register("email")} />
            <Field label="Giriş Şifresi" type="password" error={errors.password?.message} {...register("password")} />
            <Select
              label="Kullanıcı Rolü"
              options={[
                { value: "cashier", label: "Kasiyer" },
                { value: "admin", label: "Yönetici (Tam Yetkili)" },
              ]}
              {...register("role")}
            />
            <div className="sm:col-span-2">
              <Button type="submit" disabled={isSubmitting}>Hesabı Oluştur</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-foreground/50">
                <th className="py-2 pr-4">Ad Soyad</th>
                <th className="py-2 pr-4">E-posta</th>
                <th className="py-2 pr-4">Rol</th>
                <th className="py-2 pr-4">Durum</th>
                <th className="py-2 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users?.map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 pr-4 font-medium text-foreground">
                    {u.name}
                    {u.id === me?.id && <span className="ml-2 text-xs text-foreground/40">(siz)</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-foreground/70">{u.email}</td>
                  <td className="py-2.5 pr-4 capitalize text-foreground/70">
                    {u.role === "admin" ? "Yönetici" : u.role === "cashier" ? "Kasiyer" : u.role}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={
                        u.active
                          ? "rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success"
                          : "rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-semibold text-foreground/50"
                      }
                    >
                      {u.active ? "Aktif" : "Devre Dışı"}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    {u.id !== me?.id && (
                      <button
                        onClick={() => toggleActive(u.id, !u.active)}
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        {u.active ? "Pasife Al" : "Aktifleştir"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
