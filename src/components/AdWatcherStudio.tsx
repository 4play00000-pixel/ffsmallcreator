import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Eye, Lock, PauseCircle, Play, ShieldCheck } from 'lucide-react';
import { recordVerifiedAdView } from '../lib/firestoreService';
import {
  type AdCampaign,
  type AdViewLog,
  type CreatorProfile,
  type ProgramSettings,
  DEFAULT_AD_CAMPAIGNS,
  formatTimestamp,
  getCurrentMonthKey,
} from '../types/domain';

interface AdWatcherStudioProps {
  profile: CreatorProfile;
  settings: ProgramSettings;
  campaigns: AdCampaign[];
  recentAdViews: AdViewLog[];
}

export function AdWatcherStudio({
  profile,
  settings,
  campaigns,
  recentAdViews,
}: AdWatcherStudioProps) {
  const activeCampaigns = useMemo(() => {
    const filtered = campaigns.filter((c) => c.active);
    if (filtered.length > 0) return filtered;
    return DEFAULT_AD_CAMPAIGNS.map((c) => ({ ...c }));
  }, [campaigns]);

  const activeMonth = getCurrentMonthKey();
  const effectiveAdsWatched =
    profile.currentMonth === activeMonth ? profile.adsWatchedThisMonth : 0;
  const requiredAds = settings.requiredAdsPerMonth;
  const targetDurationMs = Math.max(5, settings.adDurationSeconds) * 1000;
  const progressPercent = Math.min(100, Math.round((effectiveAdsWatched / requiredAds) * 100));
  const isCompleted = effectiveAdsWatched >= requiredAds;

  const [campaignIdx, setCampaignIdx] = useState(0);
  const [isWatching, setIsWatching] = useState(false);
  const [isPausedByTab, setIsPausedByTab] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const accumulatedMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const currentCampaign = activeCampaigns[campaignIdx % activeCampaigns.length];

  async function finalizeAdView(durationSec: number) {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsWatching(false);
    setSaving(true);
    setErrorMsg(null);

    try {
      const updatedCount = await recordVerifiedAdView(
        profile,
        currentCampaign,
        durationSec,
        settings,
      );
      setFeedback(
        updatedCount >= requiredAds
          ? `Annuncio verificato (${updatedCount}/${requiredAds}). Obiettivo mensile completato: ora sei idoneo per ricevere le gemme!`
          : `Annuncio #${updatedCount} da ${durationSec}s verificato automaticamente.`,
      );
      setCampaignIdx((prev) => (prev + 1) % activeCampaigns.length);
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.message.includes('permission')
          ? 'Attendi qualche secondo prima di registrare il prossimo annuncio.'
          : 'Errore nel salvataggio della verifica. Riprova.',
      );
    } finally {
      setSaving(false);
      setElapsedMs(0);
      accumulatedMsRef.current = 0;
      lastTickRef.current = null;
    }
  }

  useEffect(() => {
    if (!isWatching) return;

    function handleVisibility() {
      if (document.visibilityState !== 'visible') {
        setIsPausedByTab(true);
        lastTickRef.current = null;
      } else {
        setIsPausedByTab(false);
        lastTickRef.current = performance.now();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    lastTickRef.current = document.visibilityState === 'visible' ? performance.now() : null;

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        setIsPausedByTab(true);
        lastTickRef.current = null;
        return;
      }
      setIsPausedByTab(false);
      const now = performance.now();
      if (lastTickRef.current !== null) {
        accumulatedMsRef.current += now - lastTickRef.current;
      }
      lastTickRef.current = now;

      const currentElapsed = Math.min(targetDurationMs, accumulatedMsRef.current);
      setElapsedMs(currentElapsed);

      if (currentElapsed >= targetDurationMs && !completedRef.current) {
        window.clearInterval(interval);
        finalizeAdView(Math.round(targetDurationMs / 1000));
      }
    }, 100);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isWatching, targetDurationMs]);

  function handleStartAd() {
    if (profile.verificationStatus === 'flagged') {
      setErrorMsg('Il tuo profilo è stato sospeso dall’amministratore.');
      return;
    }
    setFeedback(null);
    setErrorMsg(null);
    completedRef.current = false;
    accumulatedMsRef.current = 0;
    setElapsedMs(0);
    setIsPausedByTab(false);
    setIsWatching(true);
  }

  const remainingSeconds = Math.max(0, (targetDurationMs - elapsedMs) / 1000).toFixed(1);
  const timerProgress = Math.min(100, Math.round((elapsedMs / targetDurationMs) * 100));

  return (
    <div className="space-y-6">
      {/* Progress summary strip */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Visualizzatore Annunci Mensili ({settings.adDurationSeconds}s ciascuno)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {isCompleted
                ? `Hai completato tutti i ${requiredAds} annunci richiesti questo mese. Puoi richiedere le gemme nella sezione Richieste Gemme.`
                : `Devi completare ${requiredAds} annunci da ${settings.adDurationSeconds} secondi prima di poter sbloccare qualsiasi gemma.`}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="font-mono-tabular text-2xl font-bold text-slate-900">
              {effectiveAdsWatched} / {requiredAds}
            </div>
            <p className="text-xs text-slate-500">Annunci verificati questo mese</p>
          </div>
        </div>

        <div className="mt-5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full transition-all duration-300 ${
                isCompleted ? 'bg-emerald-600' : 'bg-blue-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono-tabular">{progressPercent}% completato</span>
            <span>
              {isCompleted ? 'Sblocco attivo' : `Mancano ${Math.max(0, requiredAds - effectiveAdsWatched)} annunci`}
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-column ad player + recent audit log */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {/* Campaign artwork viewport */}
            <div className="relative aspect-video w-full bg-slate-900">
              <img
                src={currentCampaign.imageUrl}
                alt={currentCampaign.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent" />

              {/* Top-right live timer overlay */}
              <div className="absolute top-4 right-4 flex items-center gap-2 rounded-lg bg-slate-950/85 px-3 py-1.5 text-white backdrop-blur-xs">
                <span className="text-xs text-slate-300">Verifica</span>
                <span className="font-mono-tabular text-sm font-bold">
                  {isWatching ? `${remainingSeconds}s` : `${settings.adDurationSeconds}.0s`}
                </span>
              </div>

              {/* Campaign details on contrast scrim */}
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <p className="text-xs font-medium text-blue-300">
                  Sponsor: {currentCampaign.sponsor} · Durata minima {settings.adDurationSeconds}s
                </p>
                <h3 className="mt-1 font-display text-lg font-bold">{currentCampaign.title}</h3>
                <p className="mt-1 text-sm text-slate-200">{currentCampaign.description}</p>
              </div>
            </div>

            {/* Linear timer bar during watch */}
            <div className="h-1.5 w-full bg-slate-100">
              <div
                className="h-full bg-blue-600 transition-all duration-100"
                style={{ width: `${timerProgress}%` }}
              />
            </div>

            <div className="p-5">
              {isPausedByTab && isWatching && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800">
                  <PauseCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Timer in pausa: mantieni aperta questa scheda per completare i{' '}
                    {settings.adDurationSeconds} secondi.
                  </span>
                </div>
              )}

              {feedback && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{feedback}</span>
                </div>
              )}

              {errorMsg && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                  <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">Controllo automatico attivo:</span>{' '}
                  ogni visione viene registrata dopo {settings.adDurationSeconds} secondi effettivi.
                </div>

                <button
                  type="button"
                  onClick={handleStartAd}
                  disabled={isWatching || saving || profile.verificationStatus === 'flagged'}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {saving
                      ? 'Registrazione...'
                      : isWatching
                        ? `Visione in corso (${remainingSeconds}s)`
                        : isCompleted
                          ? 'Guarda annuncio extra (5s)'
                          : `Avvia annuncio ${effectiveAdsWatched + 1} di ${requiredAds} (5s)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Recent verified ad views */}
        <div className="lg:col-span-5">
          <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Registro Verifiche Annunci
                </h3>
                <p className="text-xs text-slate-500">
                  Ultime visioni convalidate automaticamente
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            </div>

            {recentAdViews.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <Eye className="h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-slate-800">
                  Nessun annuncio guardato questo mese
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Avvia il primo annuncio da 5 secondi qui accanto. Ricorda che senza 25 annunci
                  completati non puoi ricevere gemme.
                </p>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 overflow-y-auto max-h-80">
                {recentAdViews.slice(0, 25).map((view, idx) => (
                  <li key={view.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="min-w-0 pr-3">
                      <p className="truncate font-medium text-slate-800">{view.campaignTitle}</p>
                      <p className="text-xs text-slate-500">
                        {formatTimestamp(view.watchedAt)} · Durata {view.durationSeconds}s
                      </p>
                    </div>
                    <span className="font-mono-tabular text-xs font-semibold text-emerald-700 shrink-0">
                      #{recentAdViews.length - idx} OK
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
