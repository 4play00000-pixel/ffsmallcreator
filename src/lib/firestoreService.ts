import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  type AdCampaign,
  type AdminOverride,
  type CreatorProfile,
  type GemRequest,
  type ProgramSettings,
  type RewardType,
  type SocialPlatform,
  DEFAULT_AD_CAMPAIGNS,
  DEFAULT_PROGRAM_SETTINGS,
  getCurrentMonthKey,
  getTodayDateKey,
} from '../types/domain';
import {
  FREE_FIRE_ID_REGEX,
  normalizeSocialUsername,
  sanitizeFreeFireId,
  SOCIAL_USERNAME_REGEX,
} from './verification';

export async function createCreatorProfile(
  user: User,
  input: {
    displayName: string;
    socialPlatform: SocialPlatform;
    socialUsername: string;
    freeFireId: string;
  },
): Promise<void> {
  const uid = user.uid;
  const currentMonth = getCurrentMonthKey();
  const cleanName = input.displayName.trim().slice(0, 80);
  const cleanUsername = normalizeSocialUsername(input.socialUsername).slice(0, 40);
  const cleanFfId = sanitizeFreeFireId(input.freeFireId);

  const creatorPath = `creators/${uid}`;
  try {
    await setDoc(doc(db, 'creators', uid), {
      uid,
      displayName: cleanName,
      socialPlatform: input.socialPlatform,
      socialUsername: cleanUsername,
      freeFireId: cleanFfId,
      currentMonth,
      adsWatchedThisMonth: 0,
      autoVerified: false,
      verificationStatus: 'locked',
      totalGemsReceived: 0,
      claimsThisMonth: 0,
      lastClaimDate: '',
      adminNote: '',
      adminOverride: 'auto',
      allowedFromDate: '',
      customDailyGems: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, creatorPath);
  }

  const privatePath = `creator_private/${uid}`;
  try {
    await setDoc(doc(db, 'creator_private', uid), {
      uid,
      email: (user.email || '').slice(0, 160),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, privatePath);
  }
}

export async function updateCreatorSocialAndId(
  profile: CreatorProfile,
  input: {
    displayName: string;
    socialPlatform: SocialPlatform;
    socialUsername: string;
    freeFireId: string;
  },
  settings: ProgramSettings,
): Promise<void> {
  const cleanName = input.displayName.trim().slice(0, 80);
  const cleanUsername = normalizeSocialUsername(input.socialUsername).slice(0, 40);
  const cleanFfId = sanitizeFreeFireId(input.freeFireId);

  const activeMonth = getCurrentMonthKey();
  const effectiveAds = profile.currentMonth === activeMonth ? profile.adsWatchedThisMonth : 0;
  const autoVerified =
    effectiveAds >= settings.requiredAdsPerMonth &&
    FREE_FIRE_ID_REGEX.test(cleanFfId) &&
    SOCIAL_USERNAME_REGEX.test(cleanUsername);

  const path = `creators/${profile.uid}`;
  try {
    await updateDoc(doc(db, 'creators', profile.uid), {
      displayName: cleanName,
      socialPlatform: input.socialPlatform,
      socialUsername: cleanUsername,
      freeFireId: cleanFfId,
      autoVerified,
      verificationStatus: autoVerified ? 'verified' : 'locked',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordVerifiedAdView(
  profile: CreatorProfile,
  campaign: AdCampaign,
  durationSeconds: number,
  settings: ProgramSettings,
): Promise<number> {
  const activeMonth = getCurrentMonthKey();
  const isNewMonth = profile.currentMonth !== activeMonth;
  const nextAdsCount = isNewMonth ? 1 : profile.adsWatchedThisMonth + 1;
  const nextClaimsCount = isNewMonth ? 0 : profile.claimsThisMonth;

  const autoVerified =
    nextAdsCount >= settings.requiredAdsPerMonth &&
    FREE_FIRE_ID_REGEX.test(profile.freeFireId) &&
    SOCIAL_USERNAME_REGEX.test(profile.socialUsername);

  try {
    await addDoc(collection(db, 'ad_views'), {
      creatorUid: profile.uid,
      monthKey: activeMonth,
      campaignId: campaign.id,
      campaignTitle: campaign.title.slice(0, 100),
      durationSeconds: Math.max(5, Math.round(durationSeconds)),
      verified: true,
      watchedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'ad_views');
  }

  const creatorPath = `creators/${profile.uid}`;
  try {
    await updateDoc(doc(db, 'creators', profile.uid), {
      currentMonth: activeMonth,
      adsWatchedThisMonth: nextAdsCount,
      claimsThisMonth: nextClaimsCount,
      autoVerified,
      verificationStatus: autoVerified ? 'verified' : 'locked',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, creatorPath);
  }

  return nextAdsCount;
}

export async function syncMonthRollover(profile: CreatorProfile): Promise<void> {
  const activeMonth = getCurrentMonthKey();
  if (profile.currentMonth === activeMonth) return;
  const path = `creators/${profile.uid}`;
  try {
    await updateDoc(doc(db, 'creators', profile.uid), {
      currentMonth: activeMonth,
      adsWatchedThisMonth: 0,
      claimsThisMonth: 0,
      autoVerified: false,
      verificationStatus: profile.verificationStatus === 'flagged' ? 'flagged' : 'locked',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createGemRequest(
  profile: CreatorProfile,
  rewardType: RewardType,
  gemsAmount: number,
): Promise<void> {
  const monthKey = getCurrentMonthKey();
  const requestDate = getTodayDateKey();

  try {
    await addDoc(collection(db, 'gem_requests'), {
      creatorUid: profile.uid,
      creatorName: profile.displayName.slice(0, 80),
      socialPlatform: profile.socialPlatform,
      socialUsername: profile.socialUsername.slice(0, 40),
      freeFireId: profile.freeFireId,
      monthKey,
      requestDate,
      rewardType,
      gemsAmount,
      adsWatchedSnapshot: profile.adsWatchedThisMonth,
      autoCheckPassed: profile.autoVerified || profile.adminOverride === 'always_allowed',
      status: 'pending',
      adminNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'gem_requests');
  }
}

export async function adminProcessGemRequest(
  request: GemRequest,
  newStatus: 'sent' | 'rejected',
  adminNote: string,
  creatorProfile?: CreatorProfile,
  overrideGemsAmount?: number,
): Promise<void> {
  const finalGems =
    typeof overrideGemsAmount === 'number' && overrideGemsAmount >= 1
      ? Math.round(overrideGemsAmount)
      : request.gemsAmount;

  const reqPath = `gem_requests/${request.id}`;
  try {
    await updateDoc(doc(db, 'gem_requests', request.id), {
      status: newStatus,
      adminNote: adminNote.trim().slice(0, 200),
      gemsAmount: finalGems,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, reqPath);
  }

  if (newStatus === 'sent' && creatorProfile && request.status !== 'sent') {
    const activeMonth = getCurrentMonthKey();
    const sameMonth = creatorProfile.currentMonth === activeMonth;
    const creatorPath = `creators/${creatorProfile.uid}`;
    try {
      await updateDoc(doc(db, 'creators', creatorProfile.uid), {
        totalGemsReceived: creatorProfile.totalGemsReceived + finalGems,
        claimsThisMonth: sameMonth ? creatorProfile.claimsThisMonth + 1 : 1,
        lastClaimDate: request.requestDate,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, creatorPath);
    }
  }
}

export async function adminDeleteGemRequest(requestId: string): Promise<void> {
  const path = `gem_requests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'gem_requests', requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function adminSendDirectGems(
  creator: CreatorProfile,
  gemsAmount: number,
  rewardType: RewardType,
  adminNote: string,
): Promise<void> {
  const monthKey = getCurrentMonthKey();
  const requestDate = getTodayDateKey();
  const cleanAmount = Math.max(1, Math.min(10000, Math.round(gemsAmount)));

  try {
    await addDoc(collection(db, 'gem_requests'), {
      creatorUid: creator.uid,
      creatorName: creator.displayName.slice(0, 80),
      socialPlatform: creator.socialPlatform,
      socialUsername: creator.socialUsername.slice(0, 40),
      freeFireId: creator.freeFireId,
      monthKey,
      requestDate,
      rewardType,
      gemsAmount: cleanAmount,
      adsWatchedSnapshot: creator.adsWatchedThisMonth,
      autoCheckPassed: true,
      status: 'sent',
      adminNote: adminNote.trim().slice(0, 200) || 'Invio diretto dall’amministratore',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'gem_requests');
  }

  const sameMonth = creator.currentMonth === monthKey;
  const creatorPath = `creators/${creator.uid}`;
  try {
    await updateDoc(doc(db, 'creators', creator.uid), {
      totalGemsReceived: creator.totalGemsReceived + cleanAmount,
      claimsThisMonth: sameMonth ? creator.claimsThisMonth + 1 : 1,
      lastClaimDate: requestDate,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, creatorPath);
  }
}

export async function adminUpdateCreatorControl(
  creator: CreatorProfile,
  updates: {
    adminOverride: AdminOverride;
    allowedFromDate: string;
    customDailyGems: number;
    adsWatchedThisMonth: number;
    claimsThisMonth: number;
    totalGemsReceived: number;
    adminNote: string;
    flagged: boolean;
  },
  settings: ProgramSettings,
): Promise<void> {
  const cleanAds = Math.max(0, Math.min(1000, Math.round(updates.adsWatchedThisMonth)));
  const cleanClaims = Math.max(0, Math.min(100, Math.round(updates.claimsThisMonth)));
  const cleanTotal = Math.max(0, Math.min(10000000, Math.round(updates.totalGemsReceived)));
  const cleanCustomGems = Math.max(0, Math.min(10000, Math.round(updates.customDailyGems)));

  const canVerify =
    !updates.flagged &&
    updates.adminOverride !== 'blocked' &&
    (updates.adminOverride === 'always_allowed' || cleanAds >= settings.requiredAdsPerMonth) &&
    FREE_FIRE_ID_REGEX.test(creator.freeFireId) &&
    SOCIAL_USERNAME_REGEX.test(creator.socialUsername);

  const path = `creators/${creator.uid}`;
  try {
    await updateDoc(doc(db, 'creators', creator.uid), {
      adminOverride: updates.adminOverride,
      allowedFromDate: updates.allowedFromDate.trim().slice(0, 10),
      customDailyGems: cleanCustomGems,
      adsWatchedThisMonth: cleanAds,
      claimsThisMonth: cleanClaims,
      totalGemsReceived: cleanTotal,
      adminNote: updates.adminNote.trim().slice(0, 200),
      autoVerified: canVerify,
      verificationStatus: updates.flagged ? 'flagged' : canVerify ? 'verified' : 'locked',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminToggleCreatorFlag(
  creator: CreatorProfile,
  flagged: boolean,
  adminNote: string,
  settings: ProgramSettings,
): Promise<void> {
  const activeMonth = getCurrentMonthKey();
  const effectiveAds = creator.currentMonth === activeMonth ? creator.adsWatchedThisMonth : 0;
  const canVerify =
    !flagged &&
    creator.adminOverride !== 'blocked' &&
    (creator.adminOverride === 'always_allowed' || effectiveAds >= settings.requiredAdsPerMonth) &&
    FREE_FIRE_ID_REGEX.test(creator.freeFireId) &&
    SOCIAL_USERNAME_REGEX.test(creator.socialUsername);

  const path = `creators/${creator.uid}`;
  try {
    await updateDoc(doc(db, 'creators', creator.uid), {
      autoVerified: canVerify,
      verificationStatus: flagged ? 'flagged' : canVerify ? 'verified' : 'locked',
      adminNote: adminNote.trim().slice(0, 200),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminSaveProgramSettings(settings: ProgramSettings): Promise<void> {
  const path = 'settings/program';
  try {
    await setDoc(doc(db, 'settings', 'program'), {
      requiredAdsPerMonth: settings.requiredAdsPerMonth,
      adDurationSeconds: settings.adDurationSeconds,
      dailyGemsAmount: settings.dailyGemsAmount,
      monthlyBonusGems: settings.monthlyBonusGems,
      monthlyMaxClaims: settings.monthlyMaxClaims,
      programActive: settings.programActive,
      claimsWindowOpen: settings.claimsWindowOpen ?? true,
      payoutScheduleMode: settings.payoutScheduleMode || 'anytime',
      allowedWeekdays: settings.allowedWeekdays || [1, 2, 3, 4, 5, 6, 0],
      allowedMonthDays: (settings.allowedMonthDays || '').trim().slice(0, 100),
      scheduleNote: (settings.scheduleNote || '').trim().slice(0, 200),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminBootstrapDefaults(
  hasSettings: boolean,
  hasCampaigns: boolean,
): Promise<void> {
  if (!hasSettings) {
    const settingsSnap = await getDoc(doc(db, 'settings', 'program'));
    if (!settingsSnap.exists()) {
      await adminSaveProgramSettings(DEFAULT_PROGRAM_SETTINGS);
    }
  }
  if (!hasCampaigns) {
    for (const camp of DEFAULT_AD_CAMPAIGNS) {
      const path = `campaigns/${camp.id}`;
      try {
        const existingSnap = await getDoc(doc(db, 'campaigns', camp.id));
        if (!existingSnap.exists()) {
          await setDoc(doc(db, 'campaigns', camp.id), {
            title: camp.title,
            sponsor: camp.sponsor,
            description: camp.description,
            imageUrl: camp.imageUrl,
            durationSeconds: camp.durationSeconds,
            active: camp.active,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  }
}

export async function adminCreateCampaign(input: {
  title: string;
  sponsor: string;
  description: string;
  imageUrl: string;
  durationSeconds: number;
}): Promise<void> {
  const id = `camp_${Date.now()}`;
  const path = `campaigns/${id}`;
  try {
    await setDoc(doc(db, 'campaigns', id), {
      title: input.title.trim().slice(0, 100),
      sponsor: input.sponsor.trim().slice(0, 60),
      description: input.description.trim().slice(0, 240),
      imageUrl: input.imageUrl.trim().slice(0, 300),
      durationSeconds: Math.max(5, Math.min(60, Math.round(input.durationSeconds))),
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminToggleCampaignActive(
  campaign: AdCampaign,
  active: boolean,
): Promise<void> {
  const path = `campaigns/${campaign.id}`;
  try {
    await updateDoc(doc(db, 'campaigns', campaign.id), {
      active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteCampaign(campaignId: string): Promise<void> {
  const path = `campaigns/${campaignId}`;
  try {
    await deleteDoc(doc(db, 'campaigns', campaignId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
