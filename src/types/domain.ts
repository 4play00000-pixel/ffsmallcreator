import type { Timestamp } from 'firebase/firestore';

export type SocialPlatform = 'TikTok' | 'Instagram' | 'YouTube' | 'Twitch';
export type VerificationStatus = 'locked' | 'verified' | 'flagged';
export type AdminOverride = 'auto' | 'always_allowed' | 'blocked';
export type PayoutScheduleMode = 'anytime' | 'weekdays' | 'month_days';
export type GemRequestStatus = 'pending' | 'sent' | 'rejected';
export type RewardType = 'daily_100' | 'monthly_10' | 'custom';

export interface CreatorProfile {
  uid: string;
  displayName: string;
  socialPlatform: SocialPlatform;
  socialUsername: string;
  freeFireId: string;
  currentMonth: string; // YYYY-MM
  adsWatchedThisMonth: number;
  autoVerified: boolean;
  verificationStatus: VerificationStatus;
  totalGemsReceived: number;
  claimsThisMonth: number;
  lastClaimDate: string; // YYYY-MM-DD or ''
  adminNote: string;
  adminOverride?: AdminOverride;
  allowedFromDate?: string; // YYYY-MM-DD or ''
  customDailyGems?: number; // 0 = use global settings.dailyGemsAmount
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AdViewLog {
  id: string;
  creatorUid: string;
  monthKey: string;
  campaignId: string;
  campaignTitle: string;
  durationSeconds: number;
  verified: boolean;
  watchedAt?: Timestamp;
}

export interface GemRequest {
  id: string;
  creatorUid: string;
  creatorName: string;
  socialPlatform: SocialPlatform;
  socialUsername: string;
  freeFireId: string;
  monthKey: string;
  requestDate: string;
  rewardType: RewardType;
  gemsAmount: number;
  adsWatchedSnapshot: number;
  autoCheckPassed: boolean;
  status: GemRequestStatus;
  adminNote: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ProgramSettings {
  requiredAdsPerMonth: number;
  adDurationSeconds: number;
  dailyGemsAmount: number;
  monthlyBonusGems: number;
  monthlyMaxClaims: number;
  programActive: boolean;
  claimsWindowOpen?: boolean;
  payoutScheduleMode?: PayoutScheduleMode;
  allowedWeekdays?: number[]; // 0=Dom .. 6=Sab
  allowedMonthDays?: string; // e.g. "1,15,28"
  scheduleNote?: string;
  updatedAt?: Timestamp;
}

export interface AdCampaign {
  id: string;
  title: string;
  sponsor: string;
  description: string;
  imageUrl: string;
  durationSeconds: number;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface VerificationCheckItem {
  id: 'ads' | 'ffId' | 'social' | 'integrity';
  label: string;
  passed: boolean;
  detail: string;
}

export interface AutoVerificationReport {
  passed: boolean;
  score: number;
  total: number;
  checks: VerificationCheckItem[];
  hasDuplicateFfId: boolean;
}

export interface ClaimEligibilityReport {
  canClaimNow: boolean;
  effectiveDailyGems: number;
  reason: string;
  scheduleSummary: string;
}

export const WEEKDAY_LABELS: Array<{ value: number; short: string; full: string }> = [
  { value: 1, short: 'Lun', full: 'Lunedì' },
  { value: 2, short: 'Mar', full: 'Martedì' },
  { value: 3, short: 'Mer', full: 'Mercoledì' },
  { value: 4, short: 'Gio', full: 'Giovedì' },
  { value: 5, short: 'Ven', full: 'Venerdì' },
  { value: 6, short: 'Sab', full: 'Sabato' },
  { value: 0, short: 'Dom', full: 'Domenica' },
];

export const DEFAULT_PROGRAM_SETTINGS: ProgramSettings = {
  requiredAdsPerMonth: 25,
  adDurationSeconds: 5,
  dailyGemsAmount: 100,
  monthlyBonusGems: 10,
  monthlyMaxClaims: 10,
  programActive: true,
  claimsWindowOpen: true,
  payoutScheduleMode: 'anytime',
  allowedWeekdays: [1, 2, 3, 4, 5, 6, 0],
  allowedMonthDays: '',
  scheduleNote: '',
};

export const DEFAULT_AD_CAMPAIGNS: Array<Omit<AdCampaign, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'camp_esports_arena',
    title: 'Torneo Nazionale Battle Royale',
    sponsor: 'Arena Esports Italia',
    description: 'Iscrivi la tua squadra alle qualificazioni settimanali per piccoli creator mobile.',
    imageUrl: '/src/assets/images/ad_campaign_esports_arena_1794689683798.jpg',
    durationSeconds: 5,
    active: true,
  },
  {
    id: 'camp_creator_studio',
    title: 'Kit Audio & Ripresa per TikTok Creator',
    sponsor: 'Studio Gear Pro',
    description: 'Microfoni compatti e luci da scrivania pensati per clip verticali ad alta nitidezza.',
    imageUrl: '/src/assets/images/ad_campaign_creator_studio_1794689683745.jpg',
    durationSeconds: 5,
    active: true,
  },
  {
    id: 'camp_tactical_gear',
    title: 'Cuffie Wireless a Bassa Latenza',
    sponsor: 'Pulse Audio Gaming',
    description: 'Audio direzionale nitido e microfono con cancellazione del rumore per partite classificate.',
    imageUrl: '/src/assets/images/ad_campaign_tactical_gear_1794689685257.jpg',
    durationSeconds: 5,
    active: true,
  },
];

export function getCurrentMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getTodayDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatTimestamp(ts?: Timestamp): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Ora';
  return ts.toDate().toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
