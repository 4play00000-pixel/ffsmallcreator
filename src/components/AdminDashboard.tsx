import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  Gem,
  Lock,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Unlock,
  XCircle,
} from 'lucide-react';
import {
  adminCreateCampaign,
  adminDeleteCampaign,
  adminDeleteGemRequest,
  adminProcessGemRequest,
  adminSaveProgramSettings,
  adminSendDirectGems,
  adminToggleCampaignActive,
  adminUpdateCreatorControl,
} from '../lib/firestoreService';
import { evaluateCreatorVerification } from '../lib/verification';
import {
  type AdCampaign,
  type AdminOverride,
  type CreatorProfile,
  type GemRequest,
  type PayoutScheduleMode,
  type ProgramSettings,
  WEEKDAY_LABELS,
  formatMonthLabel,
  formatTimestamp,
  getCurrentMonthKey,
} from '../types/domain';

interface AdminDashboardProps {
  activeTab: string;
  adminEmail: string;
  creators: CreatorProfile[];
  gemRequests: GemRequest[];
  campaigns: AdCampaign[];
  settings: ProgramSettings;
}

export function AdminDashboard({
  activeTab,
  adminEmail,
  creators,
  gemRequests,
  campaigns,
  settings,
}: AdminDashboardProps) {
  const activeMonth = getCurrentMonthKey();

  const duplicateFfIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of creators) {
      counts.set(c.freeFireId, (counts.get(c.freeFireId) || 0) + 1);
    }
    const dups = new Set<string>();
    for (const [id, count] of counts.entries()) {
      if (count > 1) dups.add(id);
    }
    return dups;
  }, [creators]);

  const creatorsById = useMemo(() => {
    const map = new Map<string, CreatorProfile>();
    for (const c of creators) map.set(c.uid, c);
    return map;
  }, [creators]);

  const creatorReports = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateCreatorVerification>>();
    for (const c of creators) {
      map.set(c.uid, evaluateCreatorVerification(c, settings, duplicateFfIds));
    }
    return map;
  }, [creators, settings, duplicateFfIds]);

  const kpis = useMemo(() => {
    const verifiedCount = creators.filter((c) => creatorReports.get(c.uid)?.passed).length;
    const pendingRequests = gemRequests.filter((r) => r.status === 'pending').length;
    const totalGemsSent = gemRequests
      .filter((r) => r.status === 'sent')
      .reduce((acc, r) => acc + r.gemsAmount, 0);
    return {
      totalCreators: creators.length,
      verifiedCount,
      pendingRequests,
      totalGemsSent,
    };
  }, [creators, creatorReports, gemRequests]);

  // Queue filters & state
  const [queueFilter, setQueueFilter] = useState<'pending' | 'sent' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [editedRequestGems, setEditedRequestGems] = useState<Record<string, number>>({});
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Creators filters & inspector
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'verified' | 'in_progress' | 'flagged'>('all');
  const [selectedCreatorUid, setSelectedCreatorUid] = useState<string | null>(null);
  const [directGemAmount, setDirectGemAmount] = useState<number>(settings.dailyGemsAmount);
  const [directNote, setDirectNote] = useState('');
  const [busyCreatorAction, setBusyCreatorAction] = useState(false);

  // Per-creator full decision state
  const [ctrlOverride, setCtrlOverride] = useState<AdminOverride>('auto');
  const [ctrlAllowedFromDate, setCtrlAllowedFromDate] = useState('');
  const [ctrlCustomDailyGems, setCtrlCustomDailyGems] = useState(0);
  const [ctrlAdsCount, setCtrlAdsCount] = useState(0);
  const [ctrlClaimsCount, setCtrlClaimsCount] = useState(0);
  const [ctrlTotalGems, setCtrlTotalGems] = useState(0);
  const [ctrlAdminNote, setCtrlAdminNote] = useState('');
  const [ctrlFlagged, setCtrlFlagged] = useState(false);

  // Campaigns form state
  const [campTitle, setCampTitle] = useState('');
  const [campSponsor, setCampSponsor] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [campImage, setCampImage] = useState('/src/assets/images/ad_campaign_esports_arena_1794689683798.jpg');
  const [campDuration, setCampDuration] = useState(5);
  const [creatingCamp, setCreatingCamp] = useState(false);

  // Settings form state
  const [formSettings, setFormSettings] = useState<ProgramSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setFormSettings(settings);
  }, [settings]);

  const selectedCreator = selectedCreatorUid ? creatorsById.get(selectedCreatorUid) || null : null;
  const selectedCreatorReport = selectedCreator ? creatorReports.get(selectedCreator.uid) || null : null;

  useEffect(() => {
    if (!selectedCreator) return;
    setCtrlOverride(selectedCreator.adminOverride || 'auto');
    setCtrlAllowedFromDate(selectedCreator.allowedFromDate || '');
    setCtrlCustomDailyGems(selectedCreator.customDailyGems || 0);
    setCtrlAdsCount(
      selectedCreator.currentMonth === activeMonth ? selectedCreator.adsWatchedThisMonth : 0,
    );
    setCtrlClaimsCount(
      selectedCreator.currentMonth === activeMonth ? selectedCreator.claimsThisMonth : 0,
    );
    setCtrlTotalGems(selectedCreator.totalGemsReceived);
    setCtrlAdminNote(selectedCreator.adminNote || '');
    setCtrlFlagged(selectedCreator.verificationStatus === 'flagged');
  }, [selectedCreator, activeMonth]);

  function copyFfId(ffId: string) {
    navigator.clipboard?.writeText(ffId);
    setCopiedId(ffId);
    setTimeout(() => setCopiedId(null), 1600);
  }

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return gemRequests.filter((req) => {
      if (queueFilter !== 'all' && req.status !== queueFilter) return false;
      if (!q) return true;
      return (
        req.creatorName.toLowerCase().includes(q) ||
        req.socialUsername.toLowerCase().includes(q) ||
        req.freeFireId.includes(q)
      );
    });
  }, [gemRequests, queueFilter, searchQuery]);

  const filteredCreators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return creators.filter((c) => {
      const report = creatorReports.get(c.uid);
      if (creatorFilter === 'verified' && !report?.passed) return false;
      if (creatorFilter === 'in_progress' && (report?.passed || c.verificationStatus === 'flagged')) return false;
      if (creatorFilter === 'flagged' && c.verificationStatus !== 'flagged') return false;
      if (!q) return true;
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.socialUsername.toLowerCase().includes(q) ||
        c.freeFireId.includes(q)
      );
    });
  }, [creators, creatorReports, creatorFilter, searchQuery]);

  async function handleToggleGlobalWindow() {
    const nextOpen = settings.claimsWindowOpen === false;
    setSavingSettings(true);
    try {
      await adminSaveProgramSettings({
        ...settings,
        claimsWindowOpen: nextOpen,
      });
      setActionFeedback(
        nextOpen
          ? 'Finestra richieste gemme APERTA per i creator.'
          : 'Finestra richieste gemme CHIUSA: nessun creator può richiedere gemme finché non la riapri.',
      );
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleProcessRequest(req: GemRequest, status: 'sent' | 'rejected') {
    setBusyRequestId(req.id);
    setActionFeedback(null);
    const creator = creatorsById.get(req.creatorUid);
    const finalAmount = editedRequestGems[req.id] ?? req.gemsAmount;
    try {
      await adminProcessGemRequest(
        req,
        status,
        status === 'sent' ? 'Gemme inviate dall’admin' : 'Richiesta rifiutata dall’admin',
        creator,
        finalAmount,
      );
      setActionFeedback(
        status === 'sent'
          ? `Confermato invio di ${finalAmount} gemme a ${req.socialUsername} (ID ${req.freeFireId}).`
          : `Richiesta di ${req.socialUsername} rifiutata.`,
      );
    } finally {
      setBusyRequestId(null);
    }
  }

  async function handleDeleteRequest(reqId: string) {
    setBusyRequestId(reqId);
    try {
      await adminDeleteGemRequest(reqId);
      setActionFeedback('Richiesta rimossa dallo storico.');
    } finally {
      setBusyRequestId(null);
    }
  }

  async function handleDirectSend(
    creator: CreatorProfile,
    amount: number,
    type: 'daily_100' | 'monthly_10' | 'custom',
  ) {
    setBusyCreatorAction(true);
    setActionFeedback(null);
    try {
      await adminSendDirectGems(
        creator,
        amount,
        type,
        directNote || `Invio diretto admin (${amount} gemme)`,
      );
      setActionFeedback(
        `Inviate ${amount} gemme a ${creator.socialUsername} (ID ${creator.freeFireId}).`,
      );
      setDirectNote('');
    } finally {
      setBusyCreatorAction(false);
    }
  }

  async function handleSaveCreatorControl(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCreator) return;
    setBusyCreatorAction(true);
    setActionFeedback(null);
    try {
      await adminUpdateCreatorControl(
        selectedCreator,
        {
          adminOverride: ctrlOverride,
          allowedFromDate: ctrlAllowedFromDate,
          customDailyGems: ctrlCustomDailyGems,
          adsWatchedThisMonth: ctrlAdsCount,
          claimsThisMonth: ctrlClaimsCount,
          totalGemsReceived: ctrlTotalGems,
          adminNote: ctrlAdminNote,
          flagged: ctrlFlagged,
        },
        settings,
      );
      setActionFeedback(
        `Decisioni salvate per ${selectedCreator.displayName} (${selectedCreator.socialUsername}).`,
      );
    } finally {
      setBusyCreatorAction(false);
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!campTitle.trim() || !campSponsor.trim()) return;
    setCreatingCamp(true);
    try {
      await adminCreateCampaign({
        title: campTitle,
        sponsor: campSponsor,
        description: campDesc || 'Annuncio sponsorizzato da 5 secondi per piccoli creator.',
        imageUrl: campImage,
        durationSeconds: campDuration,
      });
      setCampTitle('');
      setCampSponsor('');
      setCampDesc('');
      setActionFeedback('Nuova campagna 5s creata e attivata.');
    } finally {
      setCreatingCamp(false);
    }
  }

  function toggleWeekday(day: number) {
    const current = formSettings.allowedWeekdays || [1, 2, 3, 4, 5, 6, 0];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    setFormSettings({ ...formSettings, allowedWeekdays: next });
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setActionFeedback(null);
    try {
      await adminSaveProgramSettings(formSettings);
      setActionFeedback('Impostazioni e calendario riscatti aggiornati.');
    } finally {
      setSavingSettings(false);
    }
  }

  const windowIsOpen = settings.claimsWindowOpen !== false;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header + 1-click Window Switch */}
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-medium text-blue-600">
            Admin Unico · {adminEmail} · {formatMonthLabel(activeMonth)}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Controllo Totale Creator &amp; Gemme
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={savingSettings}
            onClick={handleToggleGlobalWindow}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              windowIsOpen
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            {windowIsOpen ? (
              <>
                <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Richieste Gemme: APERTE (Chiudi ora)</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Richieste Gemme: CHIUSE (Apri ora)</span>
              </>
            )}
          </button>

          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca @username o ID FF..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Piccoli Creator Registrati</p>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-slate-900">
            {kpis.totalCreators}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Idonei al Ritiro Gemme</p>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-emerald-700">
            {kpis.verifiedCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Richieste Gemme in Attesa</p>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-amber-600">
            {kpis.pendingRequests}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Gemme Totali Inviate</p>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-blue-600">
            {kpis.totalGemsSent}
          </p>
        </div>
      </div>

      {actionFeedback && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{actionFeedback}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* TAB 1: CODA INVIO GEMME */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
              {(
                [
                  { id: 'pending', label: 'In Attesa' },
                  { id: 'sent', label: 'Inviate' },
                  { id: 'rejected', label: 'Rifiutate' },
                  { id: 'all', label: 'Tutte' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setQueueFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    queueFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-500">
              Puoi modificare l’importo di qualsiasi richiesta prima di confermare l’invio.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {filteredRequests.length === 0 ? (
              <div className="p-12 text-center">
                <Gem className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  Nessuna richiesta in questa vista
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Le richieste dei creator idonei appariranno qui per la tua approvazione.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Creator &amp; Social</th>
                      <th className="px-4 py-3">ID Free Fire</th>
                      <th className="px-4 py-3">Annunci</th>
                      <th className="px-4 py-3">Verifica Auto</th>
                      <th className="px-4 py-3 text-right">Gemme</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Stato</th>
                      <th className="px-4 py-3 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.map((req) => {
                      const creator = creatorsById.get(req.creatorUid);
                      const report = creator ? creatorReports.get(creator.uid) : null;
                      const isDup = duplicateFfIds.has(req.freeFireId);
                      const rowGems = editedRequestGems[req.id] ?? req.gemsAmount;

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-slate-900">{req.creatorName}</p>
                            <p className="text-xs text-slate-500">
                              {req.socialPlatform} · {req.socialUsername}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              onClick={() => copyFfId(req.freeFireId)}
                              className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono-tabular text-xs font-semibold text-slate-900 hover:bg-slate-100 cursor-pointer"
                            >
                              <span>{req.freeFireId}</span>
                              <Copy className="h-3 w-3 text-slate-400" aria-hidden="true" />
                              {copiedId === req.freeFireId && (
                                <span className="text-emerald-600">OK</span>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 font-mono-tabular text-xs text-slate-700">
                            {req.adsWatchedSnapshot}/{settings.requiredAdsPerMonth}
                          </td>
                          <td className="px-4 py-3.5">
                            {isDup ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                ID Duplicato
                              </span>
                            ) : report?.passed || req.autoCheckPassed ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                Verificato
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-amber-700">Da controllare</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {req.status === 'pending' ? (
                              <input
                                type="number"
                                min={1}
                                max={10000}
                                value={rowGems}
                                onChange={(e) =>
                                  setEditedRequestGems({
                                    ...editedRequestGems,
                                    [req.id]: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                className="w-20 rounded border border-slate-300 px-2 py-1 text-right font-mono-tabular text-xs font-bold text-slate-900"
                              />
                            ) : (
                              <span className="font-mono-tabular font-bold text-slate-900">
                                {req.gemsAmount}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                            {req.rewardType === 'daily_100'
                              ? 'Giornaliero'
                              : req.rewardType === 'monthly_10'
                                ? 'Mensile'
                                : 'Diretto'}
                            <div className="text-slate-400">{formatTimestamp(req.createdAt)}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            {req.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                In attesa
                              </span>
                            )}
                            {req.status === 'sent' && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Inviato
                              </span>
                            )}
                            {req.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                Rifiutato
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="inline-flex items-center gap-2">
                              {req.status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busyRequestId === req.id}
                                    onClick={() => handleProcessRequest(req, 'sent')}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                                  >
                                    <Send className="h-3 w-3" aria-hidden="true" />
                                    <span>Segna Inviate</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyRequestId === req.id}
                                    onClick={() => handleProcessRequest(req, 'rejected')}
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                                  >
                                    Rifiuta
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                disabled={busyRequestId === req.id}
                                onClick={() => handleDeleteRequest(req.id)}
                                aria-label="Elimina richiesta"
                                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CREATOR & CONTROLLO TOTALE */}
      {activeTab === 'creators' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className={selectedCreator ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
            <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 w-fit">
              {(
                [
                  { id: 'all', label: 'Tutti' },
                  { id: 'verified', label: 'Idonei' },
                  { id: 'in_progress', label: 'In Corso' },
                  { id: 'flagged', label: 'Segnalati' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCreatorFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    creatorFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {filteredCreators.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  Nessun creator trovato per i filtri selezionati.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Creator &amp; Social</th>
                        <th className="px-4 py-3">ID Free Fire</th>
                        <th className="px-4 py-3">Annunci</th>
                        <th className="px-4 py-3">Regola Admin</th>
                        <th className="px-4 py-3 text-right">Gemme</th>
                        <th className="px-4 py-3 text-right">Gestisci</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCreators.map((c) => {
                        const report = creatorReports.get(c.uid)!;
                        const adsCount = c.currentMonth === activeMonth ? c.adsWatchedThisMonth : 0;
                        const isSelected = selectedCreatorUid === c.uid;
                        const override = c.adminOverride || 'auto';
                        return (
                          <tr
                            key={c.uid}
                            className={`hover:bg-slate-50/70 ${isSelected ? 'bg-blue-50/50' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-900">{c.displayName}</p>
                              <p className="text-xs text-slate-500">
                                {c.socialPlatform} · {c.socialUsername}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => copyFfId(c.freeFireId)}
                                className="inline-flex items-center gap-1.5 font-mono-tabular text-xs font-semibold text-slate-800 hover:text-blue-600 cursor-pointer"
                              >
                                <span>{c.freeFireId}</span>
                                <Copy className="h-3 w-3 text-slate-400" aria-hidden="true" />
                              </button>
                            </td>
                            <td className="px-4 py-3 font-mono-tabular text-xs text-slate-700">
                              {adsCount}/{settings.requiredAdsPerMonth}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {c.verificationStatus === 'flagged' ? (
                                <span className="font-semibold text-red-600">Sospeso</span>
                              ) : override === 'always_allowed' ? (
                                <span className="font-semibold text-blue-600">Autorizzato Admin</span>
                              ) : override === 'blocked' ? (
                                <span className="font-semibold text-red-600">Bloccato Admin</span>
                              ) : report.hasDuplicateFfId ? (
                                <span className="font-semibold text-red-600">ID Duplicato</span>
                              ) : report.passed ? (
                                <span className="font-semibold text-emerald-700">Idoneo</span>
                              ) : (
                                <span className="text-slate-500">In attesa ({report.score}/4)</span>
                              )}
                              {c.allowedFromDate && (
                                <div className="text-slate-400">Dal {c.allowedFromDate}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono-tabular font-semibold text-slate-900">
                              {c.totalGemsReceived}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedCreatorUid(isSelected ? null : c.uid)
                                }
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                {isSelected ? 'Chiudi' : 'Decidi'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Full Power Creator Inspector Drawer */}
          {selectedCreator && selectedCreatorReport && (
            <aside className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 h-fit space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-medium text-slate-500">
                  {selectedCreator.socialPlatform} · {selectedCreator.socialUsername}
                </p>
                <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
                  {selectedCreator.displayName}
                </h3>
                <p className="mt-1 font-mono-tabular text-xs text-slate-600">
                  ID Free Fire: {selectedCreator.freeFireId}
                </p>
              </div>

              {/* Direct Gem Sending — ALWAYS unlocked for Admin */}
              <div className="space-y-3 border-b border-slate-100 pb-5">
                <h4 className="text-xs font-semibold text-slate-900">
                  Invia Gemme Adesso (Potere Admin)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busyCreatorAction}
                    onClick={() =>
                      handleDirectSend(
                        selectedCreator,
                        selectedCreator.customDailyGems && selectedCreator.customDailyGems > 0
                          ? selectedCreator.customDailyGems
                          : settings.dailyGemsAmount,
                        'daily_100',
                      )
                    }
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                  >
                    Invia{' '}
                    {selectedCreator.customDailyGems && selectedCreator.customDailyGems > 0
                      ? selectedCreator.customDailyGems
                      : settings.dailyGemsAmount}{' '}
                    Gemme
                  </button>
                  <button
                    type="button"
                    disabled={busyCreatorAction}
                    onClick={() =>
                      handleDirectSend(selectedCreator, settings.monthlyBonusGems || 10, 'monthly_10')
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                  >
                    Invia +{settings.monthlyBonusGems || 10} Bonus
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={directGemAmount}
                    onChange={(e) => setDirectGemAmount(Number(e.target.value) || 0)}
                    className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono-tabular text-xs text-slate-900"
                  />
                  <button
                    type="button"
                    disabled={busyCreatorAction || directGemAmount < 1}
                    onClick={() =>
                      handleDirectSend(selectedCreator, directGemAmount, 'custom')
                    }
                    className="flex-1 rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer disabled:opacity-50"
                  >
                    Invia Importo Scelto
                  </button>
                </div>

                <input
                  type="text"
                  maxLength={200}
                  value={directNote}
                  onChange={(e) => setDirectNote(e.target.value)}
                  placeholder="Nota per il creator (opzionale)..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Per-Person Permission & Schedule Decision Form */}
              <form onSubmit={handleSaveCreatorControl} className="space-y-4">
                <h4 className="text-xs font-semibold text-slate-900">
                  Decidi Quando &amp; Come Può Prendere Gemme
                </h4>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Regola di Accesso
                  </label>
                  <select
                    value={ctrlOverride}
                    onChange={(e) => setCtrlOverride(e.target.value as AdminOverride)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                  >
                    <option value="auto">Automatico (deve guardare {settings.requiredAdsPerMonth} annunci)</option>
                    <option value="always_allowed">Autorizzato dall’Admin (può prendere gemme subito)</option>
                    <option value="blocked">Bloccato dall’Admin (non può richiedere gemme)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Sblocco dal giorno
                    </label>
                    <input
                      type="date"
                      value={ctrlAllowedFromDate}
                      onChange={(e) => setCtrlAllowedFromDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono-tabular text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Gemme dedicate (0=default)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      value={ctrlCustomDailyGems}
                      onChange={(e) => setCtrlCustomDailyGems(Number(e.target.value) || 0)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono-tabular text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600">
                      Annunci mese
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={ctrlAdsCount}
                      onChange={(e) => setCtrlAdsCount(Number(e.target.value) || 0)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono-tabular text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600">
                      Invii mese
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={ctrlClaimsCount}
                      onChange={(e) => setCtrlClaimsCount(Number(e.target.value) || 0)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono-tabular text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600">
                      Gemme totali
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10000000}
                      value={ctrlTotalGems}
                      onChange={(e) => setCtrlTotalGems(Number(e.target.value) || 0)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono-tabular text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nota visibile al creator
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={ctrlAdminNote}
                    onChange={(e) => setCtrlAdminNote(e.target.value)}
                    placeholder="Es. Ricarica prevista ogni venerdì..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                </div>

                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <span>Account Sospeso (Flag)</span>
                  <input
                    type="checkbox"
                    checked={ctrlFlagged}
                    onChange={(e) => setCtrlFlagged(e.target.checked)}
                    className="h-4 w-4 accent-red-600"
                  />
                </label>

                <button
                  type="submit"
                  disabled={busyCreatorAction}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  {busyCreatorAction ? 'Salvataggio...' : 'Salva Decisioni per Questo Creator'}
                </button>
              </form>
            </aside>
          )}
        </div>
      )}

      {/* TAB 3: CAMPAGNE 5S */}
      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Annunci Attivi nel Visualizzatore ({campaigns.length})
            </h2>
            <div className="space-y-3">
              {campaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
                >
                  <img
                    src={camp.imageUrl}
                    alt={camp.title}
                    referrerPolicy="no-referrer"
                    className="h-20 w-36 shrink-0 rounded-lg object-cover bg-slate-100"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-500">
                      {camp.sponsor} · <span className="font-mono-tabular">{camp.durationSeconds}s</span>
                    </p>
                    <h3 className="truncate font-semibold text-slate-900">{camp.title}</h3>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{camp.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => adminToggleCampaignActive(camp, !camp.active)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                        camp.active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      {camp.active ? 'Attivo' : 'Disattivato'}
                    </button>
                    <button
                      type="button"
                      onClick={() => adminDeleteCampaign(camp.id)}
                      aria-label={`Elimina ${camp.title}`}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleCreateCampaign}
            className="h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <h3 className="font-display text-base font-bold text-slate-900">
                Aggiungi Nuovo Annuncio 5s
              </h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Titolo Annuncio</label>
              <input
                type="text"
                required
                maxLength={100}
                value={campTitle}
                onChange={(e) => setCampTitle(e.target.value)}
                placeholder="Es. Evento Stagione Free Fire"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Nome Sponsor</label>
              <input
                type="text"
                required
                maxLength={60}
                value={campSponsor}
                onChange={(e) => setCampSponsor(e.target.value)}
                placeholder="Es. Creator Network IT"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Descrizione</label>
              <textarea
                rows={2}
                maxLength={240}
                value={campDesc}
                onChange={(e) => setCampDesc(e.target.value)}
                placeholder="Breve testo mostrato durante i 5 secondi..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Immagine Banner</label>
                <select
                  value={campImage}
                  onChange={(e) => setCampImage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                >
                  <option value="/src/assets/images/ad_campaign_esports_arena_1794689683798.jpg">
                    Arena Esports
                  </option>
                  <option value="/src/assets/images/ad_campaign_creator_studio_1794689683745.jpg">
                    Studio Creator
                  </option>
                  <option value="/src/assets/images/ad_campaign_tactical_gear_1794689685257.jpg">
                    Setup Gaming
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Durata (secondi)</label>
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={campDuration}
                  onChange={(e) => setCampDuration(Number(e.target.value) || 5)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={creatingCamp}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60"
            >
              {creatingCamp ? 'Creazione...' : 'Pubblica Annuncio'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: IMPOSTAZIONI PROGRAMMA & CALENDARIO */}
      {activeTab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="max-w-3xl space-y-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8"
        >
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Regole Programma, Orari &amp; Calendario Invio Gemme
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Decidi quanti annunci servono, quante gemme inviare e in quali giorni le persone
              possono richiedere le gemme.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-800">
                Annunci obbligatori al mese
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={formSettings.requiredAdsPerMonth}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    requiredAdsPerMonth: Number(e.target.value) || 25,
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono-tabular text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800">
                Durata singolo annuncio (secondi)
              </label>
              <input
                type="number"
                min={5}
                max={60}
                value={formSettings.adDurationSeconds}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    adDurationSeconds: Math.max(5, Number(e.target.value) || 5),
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono-tabular text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800">
                Gemme gratis giornaliere
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                value={formSettings.dailyGemsAmount}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    dailyGemsAmount: Number(e.target.value) || 100,
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono-tabular text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800">
                Bonus gemme mensile
              </label>
              <input
                type="number"
                min={0}
                max={10000}
                value={formSettings.monthlyBonusGems}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    monthlyBonusGems: Number(e.target.value) || 0,
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono-tabular text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800">
                Invii massimi al mese per creator
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={formSettings.monthlyMaxClaims}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    monthlyMaxClaims: Number(e.target.value) || 10,
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono-tabular text-sm"
              />
            </div>

            <div className="flex flex-col justify-end gap-2">
              <label className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <span>Finestra Richieste Gemme Aperta</span>
                <input
                  type="checkbox"
                  checked={formSettings.claimsWindowOpen !== false}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, claimsWindowOpen: e.target.checked })
                  }
                  className="h-4 w-4 accent-blue-600"
                />
              </label>
              <label className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <span>Programma Attivo</span>
                <input
                  type="checkbox"
                  checked={formSettings.programActive}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, programActive: e.target.checked })
                  }
                  className="h-4 w-4 accent-blue-600"
                />
              </label>
            </div>
          </div>

          {/* Schedule Section */}
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <h3 className="font-display text-base font-bold text-slate-900">
                Quando Possono Prendere le Gemme
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { id: 'anytime', label: 'Tutti i giorni' },
                  { id: 'weekdays', label: 'Giorni della settimana' },
                  { id: 'month_days', label: 'Giorni del mese' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() =>
                    setFormSettings({
                      ...formSettings,
                      payoutScheduleMode: mode.id as PayoutScheduleMode,
                    })
                  }
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer ${
                    (formSettings.payoutScheduleMode || 'anytime') === mode.id
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {formSettings.payoutScheduleMode === 'weekdays' && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-600">
                  Seleziona i giorni della settimana in cui i creator possono richiedere le gemme:
                </p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_LABELS.map((d) => {
                    const active = (formSettings.allowedWeekdays || []).includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleWeekday(d.value)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                          active
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {formSettings.payoutScheduleMode === 'month_days' && (
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Giorni del mese consentiti (separati da virgola, es: 1, 10, 20, 30)
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={formSettings.allowedMonthDays || ''}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, allowedMonthDays: e.target.value })
                  }
                  placeholder="1, 10, 20"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono-tabular text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Avviso orari / messaggio per i creator (opzionale)
              </label>
              <input
                type="text"
                maxLength={200}
                value={formSettings.scheduleNote || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, scheduleNote: e.target.value })
                }
                placeholder="Es. Invio gemme attivo ogni giorno dalle 17:00 alle 21:00"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={savingSettings}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60"
            >
              {savingSettings ? 'Salvataggio...' : 'Salva Tutte le Regole'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
