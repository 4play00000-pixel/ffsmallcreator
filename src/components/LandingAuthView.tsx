import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Tv, Gem } from 'lucide-react';
import { DEFAULT_PROGRAM_SETTINGS } from '../types/domain';

interface LandingAuthViewProps {
  onLogin: () => void;
  loading: boolean;
  errorMessage: string | null;
}

export function LandingAuthView({
  onLogin,
  loading,
  errorMessage,
}: LandingAuthViewProps) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
        {/* Left column: clear program rules & primary CTA */}
        <div className="flex flex-col justify-between lg:col-span-7">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Programma Ricompense Piccoli Creator · Free Fire
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl text-balance">
              Guarda 25 annunci da 5s al mese e sblocca le gemme per il tuo ID Free Fire
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600">
              Collega il tuo profilo TikTok o social media insieme al tuo ID di Free Fire.
              Ogni mese devi completare {DEFAULT_PROGRAM_SETTINGS.requiredAdsPerMonth} annunci
              verificati da {DEFAULT_PROGRAM_SETTINGS.adDurationSeconds} secondi prima di poter
              richiedere il bonus giornaliero da {DEFAULT_PROGRAM_SETTINGS.dailyGemsAmount} gemme e
              il bonus mensile da {DEFAULT_PROGRAM_SETTINGS.monthlyBonusGems} gemme inviati
              direttamente dall’amministratore.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onLogin}
                disabled={loading}
                className="inline-flex items-center gap-2.5 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
              >
                <span>{loading ? 'Accesso in corso...' : 'Accedi con Google'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="text-xs text-slate-500">
                Accesso sicuro per creator e amministratore
              </span>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {errorMessage}
              </div>
            )}
          </div>

          {/* 3-step summary strip */}
          <div className="mt-10 grid grid-cols-1 gap-6 border-t border-slate-200 pt-8 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Tv className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <span>01. 25 Annunci da 5s</span>
              </div>
              <p className="mt-1.5 text-sm text-slate-600">
                Se non guardi prima tutti i 25 annunci mensili da 5 secondi, il riscatto resta bloccato.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span>02. Verifica Automatica</span>
              </div>
              <p className="mt-1.5 text-sm text-slate-600">
                Controllo automatico su username TikTok/social, ID Free Fire numerico e durata annunci.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Gem className="h-4 w-4 text-amber-600" aria-hidden="true" />
                <span>03. 100 Gemme / Giorno</span>
              </div>
              <p className="mt-1.5 text-sm text-slate-600">
                Una volta verificato, richiedi 100 gemme al giorno (fino a 10 invii/mese + 10 bonus).
              </p>
            </div>
          </div>
        </div>

        {/* Right column: clean structural preview card */}
        <div className="lg:col-span-5">
          <div className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
            <div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                <img
                  src="/src/assets/images/ad_campaign_esports_arena_1794689683798.jpg"
                  alt="Anteprima campagna creator esports Free Fire"
                  referrerPolicy="no-referrer"
                  className="aspect-video w-full object-cover"
                />
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-sm text-slate-600">Obiettivo mensile obbligatorio</span>
                  <span className="font-mono-tabular text-sm font-semibold text-slate-900">
                    25 annunci · 5s
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-sm text-slate-600">Ricompensa giornaliera sbloccata</span>
                  <span className="font-mono-tabular text-sm font-semibold text-emerald-700">
                    100 gemme gratis
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-sm text-slate-600">Quota mensile &amp; bonus fedeltà</span>
                  <span className="font-mono-tabular text-sm font-semibold text-slate-900">
                    10 al mese
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Senza annunci completati</span>
                  <span className="font-mono-tabular text-sm font-semibold text-red-600">
                    0 gemme (Bloccato)
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>
                L’amministratore gestisce tutti gli invii dalla propria dashboard dopo il
                superamento della verifica automatica.
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
