import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  Gem,
  Lock,
  ShieldCheck,
  Tv,
  XCircle,
} from 'lucide-react';
import {
  createGemRequest,
  updateCreatorSocialAndId,
} from '../lib/firestoreService';
import {
  evaluateClaimSchedule,
  evaluateCreatorVerification,
  normalizeSocialUsername,
  sanitizeFreeFireId,
  validateProfileInputs,
} from '../lib/verification';
import {
  type AdCampaign,
  type AdViewLog,
  type CreatorProfile,
  type GemRequest,
  type ProgramSettings,
  type SocialPlatform,
  formatMonthLabel,
  formatTimestamp,
  getCurrentMonthKey,
  getTodayDateKey,
} from '../types/domain';
import { AdWatcherStudio } from './AdWatcherStudio';

interface CreatorDashboardProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  profile: CreatorProfile;
  settings: ProgramSettings;
  campaigns: AdCampaign[];
  adViews: AdViewLog[];
  gemRequests: GemRequest[];
}

const PLATFORMS: SocialPlatform[] = ['TikTok', 'Instagram', 'YouTube', 'Twitch'];

export function CreatorDashboard({
  activeTab,
  onSelectTab,
  profile,
  settings,
  campaigns,
  adViews,
  gemRequests,
}: CreatorDashboardProps) {
  const activeMonth = getCurrentMonthKey();
  const todayKey = getTodayDateKey();

  const effectiveAdsWatched =
    profile.currentMonth === activeMonth ? profile.adsWatchedThisMonth : 0;
  const effectiveClaimsThisMonth =
    profile.currentMonth === activeMonth ? profile.claimsThisMonth : 0;

  const verification = useMemo(
    () => evaluateCreatorVerification(profile, settings),
    [profile, settings],
  );

  const schedule = useMemo(
    () => evaluateClaimSchedule(profile, settings),
    [profile, settings],
  );

  const monthRequests = useMemo(
    () => gemRequests.filter((r) => r.monthKey === activeMonth),
    [gemRequests, activeMonth],
  );

  const dailyClaimedToday = useMemo(
    () =>
      monthRequests.some(
        (r) =>
          r.requestDate === todayKey &&
          r.rewardType === 'daily_100' &&
          r.status !== 'rejected',
      ),
    [monthRequests, todayKey],
  );

  const monthlyBonusClaimed = useMemo(
    () =>
      monthRequests.some(
        (r) => r.rewardType === 'monthly_10' && r.status !== 'rejected',
      ),
    [monthRequests],
  );

  const [claimingType, setClaimingType] = useState<'daily_100' | 'monthly_10' | null>(null);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Profile form state
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>(profile.socialPlatform);
  const [socialUsername, setSocialUsername] = useState(profile.socialUsername);
  const [freeFireId, setFreeFireId] = useState(profile.freeFireId);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  async function handleRequestGems(type: 'daily_100' | 'monthly_10') {
    setClaimMessage(null);
    setClaimError(null);

    if (!verification.passed) {
      setClaimError(
        `Richiesta bloccata: completa prima i ${settings.requiredAdsPerMonth} annunci da ${settings.adDurationSeconds}s e verifica tutti i dati.`,
      );
      return;
    }

    if (!schedule.canClaimNow) {
      setClaimError(schedule.reason);
      return;
    }

    const amount =
      type === 'daily_100' ? schedule.effectiveDailyGems : settings.monthlyBonusGems;

    setClaimingType(type);
    try {
      await createGemRequest(profile, type, amount);
      setClaimMessage(
        type === 'daily_100'
          ? `Richiesta di ${amount} gemme giornaliere inviata all’amministratore!`
          : `Richiesta bonus mensile di ${amount} gemme inviata all’amministratore!`,
      );
    } catch {
      setClaimError('Impossibile inviare la richiesta in questo momento. Riprova.');
    } finally {
      setClaimingType(null);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSavedMsg(null);
    const check = validateProfileInputs({
      displayName,
      socialUsername,
      freeFireId,
    });
    if (!check.valid) {
      setProfileErrors(check.errors);
      return;
    }
    setProfileErrors({});
    setSavingProfile(true);
    try {
      await updateCreatorSocialAndId(
        profile,
        {
          displayName,
          socialPlatform,
          socialUsername: normalizeSocialUsername(socialUsername),
          freeFireId: sanitizeFreeFireId(freeFireId),
        },
        settings,
      );
      setProfileSavedMsg('Profilo social e ID Free Fire aggiornati con successo.');
    } catch {
      setProfileErrors({
        freeFireId: 'Errore durante l’aggiornamento del profilo.',
      });
    } finally {
      setSavingProfile(false);
    }
  }

  function handleCopyId() {
    navigator.clipboard?.writeText(profile.freeFireId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1800);
  }

  const remainingAds = Math.max(0, settings.requiredAdsPerMonth - effectiveAdsWatched);
  const canClaimDaily =
    verification.passed &&
    schedule.canClaimNow &&
    !dailyClaimedToday &&
    effectiveClaimsThisMonth < settings.monthlyMaxClaims;
  const canClaimMonthly =
    verification.passed &&
    schedule.canClaimNow &&
    settings.monthlyBonusGems > 0 &&
    !monthlyBonusClaimed;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Contextual header */}
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Area Creator · {formatMonthLabel(activeMonth)} · {profile.socialPlatform}{' '}
            {profile.socialUsername}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Ciao, {profile.displayName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCopyId}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <span className="text-slate-500">ID FF:</span>
            <span className="font-mono-tabular font-semibold text-slate-900">
              {profile.freeFireId}
            </span>
            <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {copiedId && <span className="text-emerald-600">Copiato</span>}
          </button>

          {activeTab !== 'ads' && (
            <button
              type="button"
              onClick={() => onSelectTab('ads')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              <Tv className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {remainingAds > 0
                  ? `Guarda Annunci (${effectiveAdsWatched}/${settings.requiredAdsPerMonth})`
                  : 'Apri Visualizzatore Annunci'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Admin notice / flag warning */}
      {(profile.verificationStatus === 'flagged' || profile.adminOverride === 'blocked') && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="font-semibold">Riscatti sospesi dall’amministratore</p>
            <p className="mt-0.5 text-xs text-red-700">
              {profile.adminNote || 'Contatta l’amministratore per verificare i dati del tuo profilo.'}
            </p>
          </div>
        </div>
      )}

      {/* Schedule status banner when window is closed or restricted */}
      {!schedule.canClaimNow &&
        profile.verificationStatus !== 'flagged' &&
        profile.adminOverride !== 'blocked' && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <p className="font-semibold">Calendario Riscatti Gemme</p>
              <p className="mt-0.5 text-xs text-amber-800">{schedule.reason}</p>
            </div>
          </div>
        )}

      {/* TAB 1: PANORAMICA */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Annunci Questo Mese</p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-mono-tabular text-2xl font-bold text-slate-900">
                  {effectiveAdsWatched} / {settings.requiredAdsPerMonth}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    remainingAds === 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {remainingAds === 0 ? 'Completato' : `-${remainingAds} rimanenti`}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Verifica Automatica</p>
              <div className="mt-2 flex items-center justify-between">
                <span
                  className={`text-lg font-bold ${
                    verification.passed ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {verification.passed ? 'Idoneo' : 'Bloccato'}
                </span>
                <span className="font-mono-tabular text-xs font-semibold text-slate-600">
                  {verification.score}/{verification.total} controlli
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Gemme Ricevute Totali</p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-mono-tabular text-2xl font-bold text-slate-900">
                  {profile.totalGemsReceived}
                </span>
                <span className="text-xs text-slate-500">Inviate su FF</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Invii Nel Mese</p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-mono-tabular text-2xl font-bold text-slate-900">
                  {effectiveClaimsThisMonth} / {settings.monthlyMaxClaims}
                </span>
                <span className="text-xs text-slate-500">
                  {schedule.effectiveDailyGems}/giorno
                </span>
              </div>
            </div>
          </div>

          {/* 2-Column split: Automatic verification + Quick gem claim */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Automatic Verification Checklist */}
            <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Sistema di Verifica Automatico
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Tutti e 4 i controlli devono risultare positivi per sbloccare le gemme
                  </p>
                </div>
                <ShieldCheck
                  className={`h-5 w-5 ${
                    verification.passed ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
              </div>

              <ul className="mt-4 divide-y divide-slate-100">
                {verification.checks.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-3.5">
                    {item.passed ? (
                      <CheckCircle2
                        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                        aria-hidden="true"
                      />
                    ) : (
                      <XCircle
                        className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <span
                          className={`text-xs font-semibold shrink-0 ${
                            item.passed ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {item.passed ? 'Superato' : 'Incompleto'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Gem Unlock & Claim Card */}
            <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Sblocco Gemme Free Fire
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Destinazione: ID <span className="font-mono-tabular">{profile.freeFireId}</span> · {schedule.scheduleSummary}
                    </p>
                  </div>
                  <Gem className="h-5 w-5 text-blue-600" aria-hidden="true" />
                </div>

                {!verification.passed ? (
                  <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Lock className="h-4 w-4 text-red-600" aria-hidden="true" />
                      <span>Nessuna gemma disponibile (0 gemme)</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      La regola è chiara: se non guardi prima tutti i{' '}
                      <strong>{settings.requiredAdsPerMonth} annunci da {settings.adDurationSeconds}s</strong>{' '}
                      del mese, non ricevi niente. Ti mancano{' '}
                      <strong className="font-mono-tabular">{remainingAds}</strong> annunci.
                    </p>
                    <button
                      type="button"
                      onClick={() => onSelectTab('ads')}
                      className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                    >
                      Inizia subito a guardare gli annunci ({effectiveAdsWatched}/{settings.requiredAdsPerMonth})
                    </button>
                  </div>
                ) : !schedule.canClaimNow ? (
                  <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                    <p className="font-semibold">Riscatto non disponibile al momento</p>
                    <p className="mt-1">{schedule.reason}</p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
                      Verifica completata! Puoi inviare la tua richiesta di gemme all’amministratore.
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        disabled={!canClaimDaily || claimingType !== null}
                        onClick={() => handleRequestGems('daily_100')}
                        className="flex w-full items-center justify-between rounded-lg bg-blue-600 px-4 py-3 text-left text-white transition-colors hover:bg-blue-700 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        <div>
                          <p className="text-sm font-semibold">
                            {dailyClaimedToday
                              ? 'Bonus giornaliero già richiesto oggi'
                              : `Richiedi ${schedule.effectiveDailyGems} Gemme (Oggi)`}
                          </p>
                          <p className="text-xs opacity-85">
                            Disponibile 1 volta al giorno · Max {settings.monthlyMaxClaims}/mese
                          </p>
                        </div>
                        <span className="font-mono-tabular text-sm font-bold">
                          +{schedule.effectiveDailyGems}
                        </span>
                      </button>

                      {settings.monthlyBonusGems > 0 && (
                        <button
                          type="button"
                          disabled={!canClaimMonthly || claimingType !== null}
                          onClick={() => handleRequestGems('monthly_10')}
                          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-slate-900 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <div>
                            <p className="text-sm font-semibold">
                              {monthlyBonusClaimed
                                ? 'Bonus mensile già richiesto'
                                : `Richiedi Bonus Mensile (+${settings.monthlyBonusGems} Gemme)`}
                            </p>
                            <p className="text-xs text-slate-500">
                              Premio fisso mensile per piccoli creator
                            </p>
                          </div>
                          <span className="font-mono-tabular text-sm font-bold text-blue-600">
                            +{settings.monthlyBonusGems}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {claimMessage && (
                  <p className="mt-3 text-xs font-medium text-emerald-700">{claimMessage}</p>
                )}
                {claimError && (
                  <p className="mt-3 text-xs font-medium text-red-600">{claimError}</p>
                )}
              </div>

              <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
                {settings.scheduleNote
                  ? settings.scheduleNote
                  : `Gli invii vengono gestiti dall’admin su ID ${profile.freeFireId}.`}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: GUARDA ANNUNCI */}
      {activeTab === 'ads' && (
        <AdWatcherStudio
          profile={profile}
          settings={settings}
          campaigns={campaigns}
          recentAdViews={adViews}
        />
      )}

      {/* TAB 3: RICHIESTE GEMME */}
      {activeTab === 'claims' && (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Richieste &amp; Storico Invii Gemme
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {!verification.passed
                  ? `Bloccato: guarda prima ${settings.requiredAdsPerMonth} annunci da ${settings.adDurationSeconds}s per sbloccare le richieste.`
                  : !schedule.canClaimNow
                    ? schedule.reason
                    : `Sei idoneo (${effectiveAdsWatched}/${settings.requiredAdsPerMonth} annunci). Finestra riscatti: ${schedule.scheduleSummary}.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!canClaimDaily || claimingType !== null}
                onClick={() => handleRequestGems('daily_100')}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {dailyClaimedToday
                  ? 'Giornaliero Richiesto'
                  : `Richiedi ${schedule.effectiveDailyGems} Gemme (Oggi)`}
              </button>
              {settings.monthlyBonusGems > 0 && (
                <button
                  type="button"
                  disabled={!canClaimMonthly || claimingType !== null}
                  onClick={() => handleRequestGems('monthly_10')}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {monthlyBonusClaimed
                    ? 'Mensile Richiesto'
                    : `Bonus Mensile (+${settings.monthlyBonusGems})`}
                </button>
              )}
            </div>
          </div>

          {claimMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {claimMessage}
            </div>
          )}
          {claimError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {claimError}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {gemRequests.length === 0 ? (
              <div className="p-10 text-center">
                <Clock className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  Nessuna richiesta di gemme ancora effettuata
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Completa i {settings.requiredAdsPerMonth} annunci mensili da{' '}
                  {settings.adDurationSeconds}s per sbloccare la tua prima richiesta.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Data</th>
                      <th className="px-5 py-3">Tipo Premio</th>
                      <th className="px-5 py-3">ID Free Fire</th>
                      <th className="px-5 py-3 text-right">Gemme</th>
                      <th className="px-5 py-3">Stato</th>
                      <th className="px-5 py-3">Note Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gemRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                          {formatTimestamp(req.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900">
                          {req.rewardType === 'daily_100'
                            ? 'Bonus Giornaliero'
                            : req.rewardType === 'monthly_10'
                              ? 'Bonus Mensile'
                              : 'Invio Admin'}
                        </td>
                        <td className="px-5 py-3.5 font-mono-tabular text-xs text-slate-700">
                          {req.freeFireId}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono-tabular font-bold text-slate-900">
                          {req.gemsAmount}
                        </td>
                        <td className="px-5 py-3.5">
                          {req.status === 'sent' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Inviato
                            </span>
                          )}
                          {req.status === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              In attesa
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
                              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              Rifiutato
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {req.adminNote || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PROFILO FF & SOCIAL */}
      {activeTab === 'profile' && (
        <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Modifica Profilo Social &amp; ID Free Fire
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Assicurati che il tuo username TikTok/social e il tuo ID numerico Free Fire siano
            corretti: l’amministratore userà questi dati per verificare i tuoi contenuti e inviare
            le gemme.
          </p>

          <form onSubmit={handleSaveProfile} className="mt-6 space-y-5">
            <div>
              <label htmlFor="editName" className="block text-sm font-medium text-slate-800">
                Nome Creator
              </label>
              <input
                id="editName"
                type="text"
                required
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              {profileErrors.displayName && (
                <p className="mt-1 text-xs text-red-600">{profileErrors.displayName}</p>
              )}
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-800">Piattaforma Social</span>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSocialPlatform(p)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer ${
                      socialPlatform === p
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="editSocial" className="block text-sm font-medium text-slate-800">
                  Username {socialPlatform}
                </label>
                <input
                  id="editSocial"
                  type="text"
                  required
                  maxLength={40}
                  value={socialUsername}
                  onChange={(e) => setSocialUsername(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                {profileErrors.socialUsername && (
                  <p className="mt-1 text-xs text-red-600">{profileErrors.socialUsername}</p>
                )}
              </div>

              <div>
                <label htmlFor="editFfId" className="block text-sm font-medium text-slate-800">
                  ID Free Fire
                </label>
                <input
                  id="editFfId"
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={15}
                  value={freeFireId}
                  onChange={(e) => setFreeFireId(sanitizeFreeFireId(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                {profileErrors.freeFireId && (
                  <p className="mt-1 text-xs text-red-600">{profileErrors.freeFireId}</p>
                )}
              </div>
            </div>

            {profileSavedMsg && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
                {profileSavedMsg}
              </div>
            )}

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60"
              >
                {savingProfile ? 'Salvataggio...' : 'Salva modifiche'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
