import {
  type AutoVerificationReport,
  type ClaimEligibilityReport,
  type CreatorProfile,
  type ProgramSettings,
  WEEKDAY_LABELS,
  getCurrentMonthKey,
  getTodayDateKey,
} from '../types/domain';

export const FREE_FIRE_ID_REGEX = /^[0-9]{6,15}$/;
export const SOCIAL_USERNAME_REGEX = /^@?[a-zA-Z0-9._]{2,35}$/;

export function normalizeSocialUsername(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, '');
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

export function sanitizeFreeFireId(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 15);
}

export function validateProfileInputs(input: {
  displayName: string;
  socialUsername: string;
  freeFireId: string;
}): { valid: boolean; errors: Partial<Record<'displayName' | 'socialUsername' | 'freeFireId', string>> } {
  const errors: Partial<Record<'displayName' | 'socialUsername' | 'freeFireId', string>> = {};
  const name = input.displayName.trim();
  const username = normalizeSocialUsername(input.socialUsername);
  const ffId = sanitizeFreeFireId(input.freeFireId);

  if (name.length < 2 || name.length > 80) {
    errors.displayName = 'Inserisci un nome creator tra 2 e 80 caratteri.';
  }
  if (!SOCIAL_USERNAME_REGEX.test(username) || username.length < 2 || username.length > 40) {
    errors.socialUsername = 'Username non valido (usa lettere, numeri, punti o _).';
  }
  if (!FREE_FIRE_ID_REGEX.test(ffId)) {
    errors.freeFireId = 'L’ID Free Fire deve contenere solo cifre (da 6 a 15 numeri).';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function evaluateCreatorVerification(
  profile: CreatorProfile,
  settings: ProgramSettings,
  duplicateFreeFireIds?: Set<string>,
): AutoVerificationReport {
  const activeMonth = getCurrentMonthKey();
  const effectiveAds = profile.currentMonth === activeMonth ? profile.adsWatchedThisMonth : 0;
  const requiredAds = settings.requiredAdsPerMonth;

  const override = profile.adminOverride || 'auto';
  const adsPassed = override === 'always_allowed' || effectiveAds >= requiredAds;
  const ffIdPassed = FREE_FIRE_ID_REGEX.test(profile.freeFireId);
  const socialPassed =
    ['TikTok', 'Instagram', 'YouTube', 'Twitch'].includes(profile.socialPlatform) &&
    SOCIAL_USERNAME_REGEX.test(profile.socialUsername);

  const hasDuplicateFfId = duplicateFreeFireIds ? duplicateFreeFireIds.has(profile.freeFireId) : false;
  const integrityPassed =
    profile.verificationStatus !== 'flagged' &&
    override !== 'blocked' &&
    !hasDuplicateFfId;

  const checks = [
    {
      id: 'ads' as const,
      label:
        override === 'always_allowed'
          ? 'Autorizzazione speciale Admin attiva'
          : `Annunci mensili (${Math.min(effectiveAds, requiredAds)}/${requiredAds} da ${settings.adDurationSeconds}s)`,
      passed: adsPassed,
      detail:
        override === 'always_allowed'
          ? 'L’amministratore ha autorizzato direttamente questo profilo al ritiro gemme.'
          : adsPassed
            ? `Obiettivo mensile completato (${effectiveAds} annunci verificati).`
            : `Mancano ${Math.max(0, requiredAds - effectiveAds)} annunci da ${settings.adDurationSeconds}s: finché non completi i ${requiredAds} annunci non puoi ricevere gemme.`,
    },
    {
      id: 'ffId' as const,
      label: 'ID Free Fire numerico',
      passed: ffIdPassed,
      detail: ffIdPassed
        ? `ID ${profile.freeFireId} formattato correttamente.`
        : 'ID Free Fire non valido o incompleto.',
    },
    {
      id: 'social' as const,
      label: `Profilo ${profile.socialPlatform} (${profile.socialUsername})`,
      passed: socialPassed,
      detail: socialPassed
        ? `Handle ${profile.socialUsername} su ${profile.socialPlatform} verificato.`
        : 'Username social mancante o non valido.',
    },
    {
      id: 'integrity' as const,
      label: 'Controllo anti-abuso & stato account',
      passed: integrityPassed,
      detail: hasDuplicateFfId
        ? 'Attenzione: questo ID Free Fire risulta associato a più account.'
        : override === 'blocked'
          ? 'Richieste bloccate manualmente dall’amministratore.'
          : profile.verificationStatus === 'flagged'
            ? 'Profilo sospeso manualmente dall’amministratore.'
            : 'Nessuna anomalia rilevata.',
    },
  ];

  const score = checks.filter((c) => c.passed).length;

  return {
    passed: score === checks.length,
    score,
    total: checks.length,
    checks,
    hasDuplicateFfId,
  };
}

export function evaluateClaimSchedule(
  profile: CreatorProfile,
  settings: ProgramSettings,
  now = new Date(),
): ClaimEligibilityReport {
  const effectiveDailyGems =
    profile.customDailyGems && profile.customDailyGems > 0
      ? profile.customDailyGems
      : settings.dailyGemsAmount;

  const mode = settings.payoutScheduleMode || 'anytime';
  const windowOpen = settings.claimsWindowOpen !== false;
  const todayKey = getTodayDateKey(now);

  let scheduleSummary = 'Tutti i giorni';
  if (mode === 'weekdays') {
    const allowed = settings.allowedWeekdays || [];
    const names = WEEKDAY_LABELS.filter((d) => allowed.includes(d.value)).map((d) => d.short);
    scheduleSummary = names.length > 0 ? `Solo: ${names.join(', ')}` : 'Nessun giorno attivo';
  } else if (mode === 'month_days') {
    scheduleSummary = settings.allowedMonthDays?.trim()
      ? `Giorni del mese: ${settings.allowedMonthDays}`
      : 'Giorni del mese non impostati';
  }

  if (!settings.programActive) {
    return {
      canClaimNow: false,
      effectiveDailyGems,
      reason: 'Il programma gemme è temporaneamente disattivato dall’amministratore.',
      scheduleSummary,
    };
  }

  if (!windowOpen) {
    return {
      canClaimNow: false,
      effectiveDailyGems,
      reason:
        settings.scheduleNote?.trim() ||
        'L’amministratore ha chiuso temporaneamente la finestra richieste gemme.',
      scheduleSummary,
    };
  }

  if (profile.adminOverride === 'blocked' || profile.verificationStatus === 'flagged') {
    return {
      canClaimNow: false,
      effectiveDailyGems,
      reason:
        profile.adminNote?.trim() ||
        'L’amministratore ha bloccato temporaneamente i riscatti per questo account.',
      scheduleSummary,
    };
  }

  if (profile.allowedFromDate && todayKey < profile.allowedFromDate) {
    return {
      canClaimNow: false,
      effectiveDailyGems,
      reason: `L’amministratore ha impostato il tuo sblocco gemme a partire dal ${profile.allowedFromDate}.`,
      scheduleSummary,
    };
  }

  if (mode === 'weekdays') {
    const allowed = settings.allowedWeekdays || [];
    if (!allowed.includes(now.getDay())) {
      return {
        canClaimNow: false,
        effectiveDailyGems,
        reason: `Oggi le richieste non sono attive (${scheduleSummary}).`,
        scheduleSummary,
      };
    }
  } else if (mode === 'month_days') {
    const dayNum = now.getDate();
    const parsedDays = (settings.allowedMonthDays || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 31);
    if (!parsedDays.includes(dayNum)) {
      return {
        canClaimNow: false,
        effectiveDailyGems,
        reason: `Oggi (${dayNum}) non rientra nei giorni di riscatto decisi dall’admin (${scheduleSummary}).`,
        scheduleSummary,
      };
    }
  }

  return {
    canClaimNow: true,
    effectiveDailyGems,
    reason: 'Finestra riscatti aperta.',
    scheduleSummary,
  };
}
