"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { usePasswordConfirm } from "@/components/PasswordConfirm";
import { useUpdateStatus } from "@/hooks/useUpdate";
import { api, ApiError } from "@/lib/api";

type Phase = "idle" | "updating" | "unchanged" | "failed";

const POLL_MS = 3000;
const GIVE_UP_MS = 6 * 60_000;

export function UpdatesTab() {
  const { data, isLoading, isFetching, refetch } = useUpdateStatus(true);
  const qc = useQueryClient();
  const { show } = useToast();
  const { withPasswordConfirm } = usePasswordConfirm();
  const [phase, setPhase] = useState<Phase>("idle");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function checkNow() {
    try {
      const fresh = await api.get("/update/status?refresh=1");
      qc.setQueryData(["update-status"], fresh);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Güncellemeler kontrol edilemedi", "error");
    }
  }

  function waitForRestart(startVersion: string) {
    const started = Date.now();
    let sawDown = false;
    timer.current = setInterval(async () => {
      let version: string | null = null;
      try {
        const h = await api.get<{ status: string; version?: string }>("/health");
        version = h.version ?? null;
      } catch {
        sawDown = true;
        return;
      }
      try {
        const p = await api.get<{ state: string; error?: string | null }>("/update/progress");
        if (p.state === "error") {
          if (timer.current) clearInterval(timer.current);
          setFailure(p.error || "Güncelleme başarısız oldu");
          setPhase("failed");
          return;
        }
      } catch {}
      if ((version && version !== startVersion) || sawDown) {
        if (timer.current) clearInterval(timer.current);
        window.location.reload();
      } else if (Date.now() - started > GIVE_UP_MS) {
        if (timer.current) clearInterval(timer.current);
        setPhase("unchanged");
        qc.invalidateQueries({ queryKey: ["update-status"] });
      }
    }, POLL_MS);
  }

  async function update() {
    if (!data) return;
    setFailure(null);
    const ok = await withPasswordConfirm("sistemi güncellemek", async (confirmPassword) => {
      await api.post("/update/apply", { confirmPassword });
      return true;
    });
    if (!ok) return;
    setPhase("updating");
    waitForRestart(data.current);
  }

  if (isLoading) return <p className="text-sm text-foreground/50">Güncellemeler denetleniyor…</p>;

  return (
    <Card className="flex max-w-2xl flex-col gap-5 p-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Yazılım Güncellemeleri</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Yüklü Sürüm: <span className="tabular font-medium text-foreground">{data?.current ?? "—"}</span>
          {data?.latest && (
            <>
              {" "}· En Son Sürüm: <span className="tabular font-medium text-foreground">{data.latest}</span>
            </>
          )}
        </p>
      </div>

      {phase === "failed" && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
          <p className="font-medium text-danger">Güncelleme uygulanamadı — sistemde herhangi bir değişiklik yapılmadı.</p>
          <p className="mt-1 break-words text-foreground-muted">{failure} Lütfen internet bağlantınızı kontrol edip tekrar deneyin.</p>
        </div>
      )}

      {phase === "updating" ? (
        <div className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand-soft p-4 text-sm">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">Güncelleniyor… Uygulama otomatik olarak yeniden başlatılacaktır.</p>
            <p className="mt-1 text-foreground-muted">Bu işlem yaklaşık 1 dakika sürer. Verileriniz tamamen güvendedir. Lütfen bu sayfayı kapatmayın veya cihazı kapatmayın.</p>
          </div>
        </div>
      ) : data?.updateAvailable ? (
        <div className="flex flex-col gap-3 rounded-xl border border-brand/30 bg-brand-soft p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ArrowUpCircle className="h-4 w-4 text-brand" aria-hidden="true" />
            Yeni {data.latest} sürümü mevcut!
          </p>
          {data.canUpdate ? (
            <div>
              <Button onClick={update}>Şimdi Güncelle</Button>
              <p className="mt-2 text-xs text-foreground-muted">
                Yeni sürümü indirir ve sistemi yeniden başlatır (yaklaşık 1 dakika). Kasada satış işlemi yokken yapılması önerilir.
              </p>
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">
              Bu kurulum doğrudan otomatik güncellemeyi desteklemiyor. Kurulum yaptığınız yöntemle güncelleyiniz.
            </p>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
          {phase === "unchanged" ? "Sistem kontrol edildi — en son sürümdasınız." : "En güncel sürümü kullanıyorsunuz."}
        </p>
      )}

      {data?.checkError && !data.latest && (
        <p className="text-xs text-warning">GitHub sunucularına erişilemedi ({data.checkError}). Güncellemeler internet gerektirir; diğer tüm satış ve stok fonksiyonları çevrimdışı çalışmaya devam eder.</p>
      )}

      <div>
        <Button variant="secondary" onClick={checkNow} disabled={isFetching || phase === "updating"}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Güncellemeleri Denetle
        </Button>
        {data?.checkedAt && <span className="ml-3 text-xs text-foreground-muted">Son kontrol: {new Date(data.checkedAt).toLocaleTimeString("tr-TR")}</span>}
      </div>
    </Card>
  );
}
