import React, { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import {
  ADMIN_EMAIL,
  auth,
  db,
  handleFirestoreError,
  isAdminUser,
  logoutUser,
  OperationType,
  signInWithGoogle,
} from './lib/firebase';
import {
  adminBootstrapDefaults,
  syncMonthRollover,
} from './lib/firestoreService';
import {
  type AdCampaign,
  type AdViewLog,
  type CreatorProfile,
  type GemRequest,
  type ProgramSettings,
  DEFAULT_AD_CAMPAIGNS,
  DEFAULT_PROGRAM_SETTINGS,
  getCurrentMonthKey,
} from './types/domain';
import { TopBar, type NavItem } from './components/TopBar';
import { LandingAuthView } from './components/LandingAuthView';
import { CreatorOnboarding } from './components/CreatorOnboarding';
import { CreatorDashboard } from './components/CreatorDashboard';
import { AdminDashboard } from './components/AdminDashboard';

const CREATOR_NAV: NavItem[] = [
  { id: 'overview', label: 'Panoramica' },
  { id: 'ads', label: 'Guarda Annunci' },
  { id: 'claims', label: 'Richieste Gemme' },
  { id: 'profile', label: 'Profilo FF' },
];

const ADMIN_NAV: NavItem[] = [
  { id: 'queue', label: 'Coda Gemme' },
  { id: 'creators', label: 'Creator' },
  { id: 'campaigns', label: 'Annunci 5s' },
  { id: 'settings', label: 'Impostazioni' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isAdmin = isAdminUser(user);
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'creator'>('admin');
  const [activeCreatorTab, setActiveCreatorTab] = useState('overview');
  const [activeAdminTab, setActiveAdminTab] = useState('queue');

  // Shared state
  const [settings, setSettings] = useState<ProgramSettings>(DEFAULT_PROGRAM_SETTINGS);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>(
    DEFAULT_AD_CAMPAIGNS.map((c) => ({ ...c })),
  );

  // Creator-specific state
  const [myProfile, setMyProfile] = useState<CreatorProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [myAdViews, setMyAdViews] = useState<AdViewLog[]>([]);
  const [myRequests, setMyRequests] = useState<GemRequest[]>([]);

  // Admin-specific state
  const [allCreators, setAllCreators] = useState<CreatorProfile[]>([]);
  const [allRequests, setAllRequests] = useState<GemRequest[]>([]);
  const [settingsLoadedFromDb, setSettingsLoadedFromDb] = useState(false);
  const [campaignsLoadedFromDb, setCampaignsLoadedFromDb] = useState(false);
  const [settingsResolved, setSettingsResolved] = useState(false);
  const [campaignsResolved, setCampaignsResolved] = useState(false);
  const bootstrapAttemptedRef = useRef(false);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setMyProfile(null);
        setProfileLoaded(false);
        setMyAdViews([]);
        setMyRequests([]);
        setAllCreators([]);
        setAllRequests([]);
        setSettingsResolved(false);
        setCampaignsResolved(false);
        bootstrapAttemptedRef.current = false;
      }
    });
    return () => unsub();
  }, []);

  // Settings & Campaigns listeners (only when authenticated)
  useEffect(() => {
    if (!authReady || !user) return;

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'program'),
      (snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as ProgramSettings);
          setSettingsLoadedFromDb(true);
        } else {
          setSettings(DEFAULT_PROGRAM_SETTINGS);
          setSettingsLoadedFromDb(false);
        }
        setSettingsResolved(true);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/program'),
    );

    const campaignsQuery = isAdmin
      ? collection(db, 'campaigns')
      : query(collection(db, 'campaigns'), where('active', '==', true));

    const unsubCampaigns = onSnapshot(
      campaignsQuery,
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AdCampaign, 'id'>),
          }));
          setCampaigns(list);
          setCampaignsLoadedFromDb(true);
        } else {
          setCampaigns(DEFAULT_AD_CAMPAIGNS.map((c) => ({ ...c })));
          setCampaignsLoadedFromDb(false);
        }
        setCampaignsResolved(true);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'campaigns'),
    );

    return () => {
      unsubSettings();
      unsubCampaigns();
    };
  }, [authReady, user, isAdmin]);

  // Auto-bootstrap defaults once when Admin signs in and initial snapshots have resolved
  useEffect(() => {
    if (!authReady || !user || !isAdmin) return;
    if (!settingsResolved || !campaignsResolved) return;
    if (bootstrapAttemptedRef.current) return;
    if (!settingsLoadedFromDb || !campaignsLoadedFromDb) {
      bootstrapAttemptedRef.current = true;
      adminBootstrapDefaults(settingsLoadedFromDb, campaignsLoadedFromDb).catch((e) =>
        console.error('Bootstrap error:', e),
      );
    }
  }, [
    authReady,
    user,
    isAdmin,
    settingsResolved,
    campaignsResolved,
    settingsLoadedFromDb,
    campaignsLoadedFromDb,
  ]);

  // Creator listeners (own profile, own ad views, own gem requests)
  useEffect(() => {
    if (!authReady || !user) return;

    const unsubProfile = onSnapshot(
      doc(db, 'creators', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as CreatorProfile;
          setMyProfile(data);
          if (data.currentMonth !== getCurrentMonthKey()) {
            syncMonthRollover(data).catch(console.error);
          }
        } else {
          setMyProfile(null);
        }
        setProfileLoaded(true);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `creators/${user.uid}`),
    );

    const adViewsQuery = query(
      collection(db, 'ad_views'),
      where('creatorUid', '==', user.uid),
    );
    const unsubAdViews = onSnapshot(
      adViewsQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AdViewLog, 'id'>),
        }));
        list.sort((a, b) => (b.watchedAt?.toMillis() || 0) - (a.watchedAt?.toMillis() || 0));
        setMyAdViews(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'ad_views'),
    );

    const reqQuery = query(
      collection(db, 'gem_requests'),
      where('creatorUid', '==', user.uid),
    );
    const unsubReqs = onSnapshot(
      reqQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GemRequest, 'id'>),
        }));
        list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setMyRequests(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'gem_requests'),
    );

    return () => {
      unsubProfile();
      unsubAdViews();
      unsubReqs();
    };
  }, [authReady, user]);

  // Admin listeners (all creators + all gem requests)
  useEffect(() => {
    if (!authReady || !user || !isAdmin) return;

    const creatorsQuery = query(collection(db, 'creators'), orderBy('updatedAt', 'desc'));
    const unsubCreators = onSnapshot(
      creatorsQuery,
      (snap) => {
        setAllCreators(snap.docs.map((d) => d.data() as CreatorProfile));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'creators'),
    );

    const requestsQuery = query(collection(db, 'gem_requests'), orderBy('createdAt', 'desc'));
    const unsubRequests = onSnapshot(
      requestsQuery,
      (snap) => {
        setAllRequests(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<GemRequest, 'id'>),
          })),
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'gem_requests'),
    );

    return () => {
      unsubCreators();
      unsubRequests();
    };
  }, [authReady, user, isAdmin]);

  async function handleAuthAction() {
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (user) {
        await logoutUser();
      } else {
        await signInWithGoogle();
      }
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? 'Accesso annullato o bloccato dal browser. Riprova.'
          : 'Errore durante l’autenticazione.',
      );
    } finally {
      setAuthLoading(false);
    }
  }

  const showingAdminDashboard = isAdmin && adminViewMode === 'admin';
  const navItems: NavItem[] = !user
    ? []
    : showingAdminDashboard
      ? ADMIN_NAV
      : myProfile
        ? CREATOR_NAV
        : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        navItems={navItems}
        activeTab={showingAdminDashboard ? activeAdminTab : activeCreatorTab}
        onSelectTab={(id) =>
          showingAdminDashboard ? setActiveAdminTab(id) : setActiveCreatorTab(id)
        }
        isAuthenticated={Boolean(user)}
        onAuthAction={handleAuthAction}
        authLoading={authLoading}
      />

      {/* Admin Workspace Mode Toolbar (placed below header per Top Bar Contract) */}
      {isAdmin && (
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
            <span className="text-xs font-medium text-slate-500">
              Sessione Admin verificata ({ADMIN_EMAIL})
            </span>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setAdminViewMode('admin')}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  adminViewMode === 'admin'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dashboard Admin
              </button>
              <button
                type="button"
                onClick={() => setAdminViewMode('creator')}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  adminViewMode === 'creator'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vista Creator
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1">
        {!authReady ? (
          <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-slate-500">
            Caricamento sessione...
          </div>
        ) : !user ? (
          <LandingAuthView
            onLogin={handleAuthAction}
            loading={authLoading}
            errorMessage={authError}
          />
        ) : showingAdminDashboard ? (
          <AdminDashboard
            activeTab={activeAdminTab}
            adminEmail={user.email || ADMIN_EMAIL}
            creators={allCreators}
            gemRequests={allRequests}
            campaigns={campaigns}
            settings={settings}
          />
        ) : !profileLoaded ? (
          <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-slate-500">
            Caricamento profilo creator...
          </div>
        ) : !myProfile ? (
          <CreatorOnboarding user={user} onCompleted={() => setActiveCreatorTab('ads')} />
        ) : (
          <CreatorDashboard
            activeTab={activeCreatorTab}
            onSelectTab={setActiveCreatorTab}
            profile={myProfile}
            settings={settings}
            campaigns={campaigns}
            adViews={myAdViews}
            gemRequests={myRequests}
          />
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <span>FF Creator Hub · Programma mensile 25 annunci da 5s per piccoli creator</span>
          <span>Regola anti-abuso: nessuna gemma senza 25 annunci completati</span>
        </div>
      </footer>
    </div>
  );
}
