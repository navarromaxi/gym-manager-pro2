"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";

import type { MemberAccessColor, MemberAccessStatus } from "@/lib/member-access";
import { normalizeCedula } from "@/lib/member-access";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GymInfoResponse {
  data?: {
    id?: string | null;
    name?: string | null;
    logoUrl?: string | null;
  };
  error?: string;
}

interface AccessResponse {
  found: boolean;
  memberId: string | null;
  memberName: string | null;
  status: MemberAccessStatus;
  color: MemberAccessColor;
  message: string;
  daysRemaining: number | null;
  daysExpired: number | null;
}

const AUTO_RESET_MS = 7000;
const MAX_CEDULA_LENGTH = 12;

const RESULT_STYLES: Record<
  MemberAccessColor,
  {
    shell: string;
    badge: string;
    accent: string;
  }
> = {
  green: {
    shell: "border-emerald-300 bg-emerald-50 text-emerald-950",
    badge: "bg-emerald-600 text-white",
    accent: "text-emerald-700",
  },
  yellow: {
    shell: "border-amber-300 bg-amber-50 text-amber-950",
    badge: "bg-amber-500 text-amber-950",
    accent: "text-amber-700",
  },
  red: {
    shell: "border-rose-300 bg-rose-50 text-rose-950",
    badge: "bg-rose-600 text-white",
    accent: "text-rose-700",
  },
};

const STATUS_LABELS: Record<MemberAccessStatus, string> = {
  active: "Activo",
  expiring: "Por vencer",
  expired: "Vencido",
  not_found: "No encontrado",
};

export default function MemberAccessPage() {
  const params = useParams<{ gymId: string }>();
  const searchParams = useSearchParams();
  const gymId = params?.gymId ?? "";
  const kioskMode = searchParams?.get("kiosco") === "1";
  const [gymName, setGymName] = useState<string | null>(null);
  const [gymLogoUrl, setGymLogoUrl] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [cedula, setCedula] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<AccessResponse | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchGym = async () => {
      if (!gymId) {
        setPageError("El enlace de acceso no es válido.");
        setPageLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/public-gyms/${gymId}`, {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | GymInfoResponse
          | null;

        if (!response.ok) {
          setGymName(null);
          setGymLogoUrl(null);
          setPageError(
            payload?.error ?? "No se pudo obtener la información del gimnasio."
          );
          return;
        }

        setGymName(payload?.data?.name ?? null);
        setGymLogoUrl(payload?.data?.logoUrl ?? null);
        setPageError(null);
      } catch (error) {
        console.error("Error fetching gym access info", error);
        setPageError(
          error instanceof Error
            ? error.message
            : "No se pudo obtener la información del gimnasio."
        );
      } finally {
        setPageLoading(false);
      }
    };

    fetchGym();
  }, [gymId]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const scheduleReset = () => {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCedula("");
      setResult(null);
      setSubmitError(null);
    }, AUTO_RESET_MS);
  };

  const appendDigit = (digit: string) => {
    if (submitting) return;
    setSubmitError(null);
    setResult(null);
    setCedula((current) =>
      current.length >= MAX_CEDULA_LENGTH ? current : `${current}${digit}`
    );
  };

  const handleBackspace = () => {
    if (submitting) return;
    setSubmitError(null);
    setResult(null);
    setCedula((current) => current.slice(0, -1));
  };

  const handleClear = () => {
    if (submitting) return;
    setCedula("");
    setResult(null);
    setSubmitError(null);
  };

  const numericCedula = useMemo(() => normalizeCedula(cedula), [cedula]);

  const handleSubmit = async () => {
    if (submitting) return;

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }

    if (!numericCedula) {
      setSubmitError("Ingresa una cédula válida.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/member-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gymId,
          cedula: numericCedula,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (AccessResponse & { error?: string })
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo validar el acceso.");
      }

      setResult(payload as AccessResponse);
      scheduleReset();
    } catch (error) {
      console.error("Error validating member access", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "No se pudo validar el acceso."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resultStyle = result ? RESULT_STYLES[result.color] : null;

  return (
    <main
      className={`min-h-screen bg-[linear-gradient(180deg,#eff6ff_0%,#ecfeff_42%,#f8fafc_100%)] px-4 ${
        kioskMode ? "py-4 sm:px-4" : "py-8 sm:px-6"
      }`}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section
            className={`rounded-[2rem] border border-slate-200 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur ${
              kioskMode ? "p-5 sm:p-6 lg:p-7" : "p-6 sm:p-8 lg:p-10"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <Image
                  src={gymLogoUrl ?? "/logos/demo-gym-logo.svg"}
                  alt={gymName ? `Logo de ${gymName}` : "Logo del gimnasio"}
                  fill
                  sizes="64px"
                  className="object-contain p-2"
                  unoptimized={Boolean(gymLogoUrl)}
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                  {kioskMode ? "Modo kiosco" : "Acceso de socios"}
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  {gymName ?? "Gimnasio"}
                </h1>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <div className="space-y-2">
                <p className="text-lg font-semibold text-slate-900">
                  Ingresa tu cédula
                </p>
                {!kioskMode ? (
                  <p className="text-sm text-slate-500">
                    La pantalla solo muestra tu nombre, estado y un mensaje corto.
                  </p>
                ) : null}
              </div>

              {pageLoading ? (
                <Card>
                  <CardContent className="flex items-center gap-3 p-6 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Cargando acceso del gimnasio...
                  </CardContent>
                </Card>
              ) : pageError ? (
                <Alert variant="destructive">
                  <AlertDescription>{pageError}</AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <label
                      htmlFor="member-access-cedula"
                      className="mb-2 block text-sm font-medium text-slate-600"
                    >
                      Cédula
                    </label>
                    <Input
                      id="member-access-cedula"
                      inputMode="numeric"
                      autoComplete="off"
                      value={cedula}
                      onChange={(event) =>
                        setCedula(
                          normalizeCedula(event.target.value).slice(
                            0,
                            MAX_CEDULA_LENGTH
                          )
                        )
                      }
                      className={`rounded-2xl border-slate-300 bg-white px-5 text-center font-semibold tracking-[0.32em] text-slate-950 placeholder:text-slate-400 ${
                        kioskMode ? "h-24 text-4xl" : "h-20 text-3xl"
                      }`}
                      placeholder="00000000"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(
                      (digit) => (
                        <Button
                          key={digit}
                          type="button"
                          variant="outline"
                          className={`rounded-3xl border-slate-300 bg-white font-bold text-slate-950 shadow-sm hover:bg-slate-100 hover:text-slate-950 ${
                            kioskMode ? "h-24 text-4xl" : "h-20 text-3xl"
                          }`}
                          onClick={() => appendDigit(digit)}
                          disabled={submitting || pageLoading || !!pageError}
                        >
                          {digit}
                        </Button>
                      )
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className={`rounded-3xl border-slate-300 bg-white text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-900 ${
                        kioskMode ? "h-24" : "h-20"
                      }`}
                      onClick={handleClear}
                      disabled={submitting || pageLoading || !!pageError}
                    >
                      Limpiar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={`rounded-3xl border-slate-300 bg-white font-bold text-slate-950 shadow-sm hover:bg-slate-100 hover:text-slate-950 ${
                        kioskMode ? "h-24 text-4xl" : "h-20 text-3xl"
                      }`}
                      onClick={() => appendDigit("0")}
                      disabled={submitting || pageLoading || !!pageError}
                    >
                      0
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={`rounded-3xl border-slate-300 bg-white text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-900 ${
                        kioskMode ? "h-24" : "h-20"
                      }`}
                      onClick={handleBackspace}
                      disabled={submitting || pageLoading || !!pageError}
                    >
                      <ChevronLeft className="mr-2 h-5 w-5" />
                      Borrar
                    </Button>
                  </div>

                  <Button
                    type="button"
                    className={`w-full rounded-3xl bg-cyan-700 text-lg font-semibold text-white hover:bg-cyan-800 hover:text-white ${
                      kioskMode ? "h-20 text-xl" : "h-16"
                    }`}
                    onClick={handleSubmit}
                    disabled={submitting || pageLoading || !!pageError}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Consultando...
                      </>
                    ) : (
                      "Consultar"
                    )}
                  </Button>

                  {submitError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  ) : null}
                </>
              )}
            </div>
          </section>

          <section className="flex min-h-[360px]">
            <Card
              className={`flex w-full items-center justify-center rounded-[2rem] border-2 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8 ${
                resultStyle
                  ? resultStyle.shell
                  : "border-slate-200 bg-white/90 text-slate-950"
              }`}
            >
              <CardContent className="flex w-full flex-col items-center justify-center p-0 text-center">
                {!result ? (
                  <>
                    <div className="mb-6 rounded-full bg-slate-100 p-5 text-slate-500">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">
                      Resultado
                    </p>
                    <h2
                      className={`mt-4 font-bold tracking-tight text-slate-950 ${
                        kioskMode ? "text-4xl" : "text-3xl"
                      }`}
                    >
                      Listo para validar acceso
                    </h2>
                    <p className="mt-4 max-w-md text-base leading-7 text-slate-500">
                      Cuando el socio ingrese su cédula, aquí verás el estado
                      del plan y el mensaje correspondiente.
                    </p>
                  </>
                ) : (
                  <>
                    <div
                      className={`mb-6 rounded-full px-4 py-2 text-sm font-bold uppercase tracking-[0.24em] ${resultStyle?.badge}`}
                    >
                      {STATUS_LABELS[result.status]}
                    </div>

                    <div
                      className={`mb-4 ${
                        result.color === "green"
                          ? "text-emerald-700"
                          : result.color === "yellow"
                          ? "text-amber-700"
                          : "text-rose-700"
                      }`}
                    >
                      {result.status === "not_found" ? (
                        <AlertCircle className="mx-auto h-16 w-16" />
                      ) : (
                        <CheckCircle2 className="mx-auto h-16 w-16" />
                      )}
                    </div>

                    <h2
                      className={`font-black tracking-tight ${
                        kioskMode ? "text-5xl sm:text-6xl" : "text-4xl sm:text-5xl"
                      }`}
                    >
                      {result.memberName ?? "Socio no encontrado"}
                    </h2>
                    <p
                      className={`mt-5 font-semibold ${resultStyle?.accent} ${
                        kioskMode ? "text-2xl" : "text-xl"
                      }`}
                    >
                      {result.message}
                    </p>

                    {result.status === "expiring" && result.daysRemaining !== null ? (
                      <p className="mt-4 text-sm text-slate-600">
                        Restan {result.daysRemaining} dia
                        {result.daysRemaining === 1 ? "" : "s"} de vigencia.
                      </p>
                    ) : null}

                    {result.status === "expired" && result.daysExpired !== null ? (
                      <p className="mt-4 text-sm text-slate-600">
                        El plan venció hace {result.daysExpired} dia
                        {result.daysExpired === 1 ? "" : "s"}.
                      </p>
                    ) : null}

                    <p className="mt-8 text-xs uppercase tracking-[0.22em] text-slate-500">
                      La pantalla se reinicia automáticamente en unos segundos
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
