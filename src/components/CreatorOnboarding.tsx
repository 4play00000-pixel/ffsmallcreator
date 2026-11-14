import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { createCreatorProfile } from '../lib/firestoreService';
import {
  normalizeSocialUsername,
  sanitizeFreeFireId,
  validateProfileInputs,
} from '../lib/verification';
import type { SocialPlatform } from '../types/domain';

interface CreatorOnboardingProps {
  user: User;
  onCompleted: () => void;
}

const PLATFORMS: SocialPlatform[] = ['TikTok', 'Instagram', 'YouTube', 'Twitch'];

export function CreatorOnboarding({ user, onCompleted }: CreatorOnboardingProps) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>('TikTok');
  const [socialUsername, setSocialUsername] = useState('');
  const [freeFireId, setFreeFireId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const check = validateProfileInputs({
      displayName,
      socialUsername,
      freeFireId,
    });

    if (!check.valid) {
      setErrors(check.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await createCreatorProfile(user, {
        displayName,
        socialPlatform,
        socialUsername: normalizeSocialUsername(socialUsername),
        freeFireId: sanitizeFreeFireId(freeFireId),
      });
      onCompleted();
    } catch (err) {
      setServerError(
        err instanceof Error
          ? 'Impossibile salvare il profilo. Verifica i dati inseriti e riprova.'
          : 'Errore imprevisto durante il salvataggio.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-xs font-medium text-blue-600">
          Configurazione iniziale · Account verificato ({user.email})
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-slate-900">
          Collega il tuo Social e l’ID Free Fire
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Inserisci il tuo username su TikTok o un altro social e il tuo ID numerico di Free
          Fire. Ricorda: dovrai guardare 25 annunci da 5 secondi questo mese prima di sbloccare le
          gemme.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-slate-800">
              Nome Creator
            </label>
            <input
              id="displayName"
              type="text"
              required
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Es. Marco FF"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
            {errors.displayName && (
              <p className="mt-1 text-xs text-red-600">{errors.displayName}</p>
            )}
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-800">
              Piattaforma Social Principale
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => setSocialPlatform(platform)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    socialPlatform === platform
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="socialUsername" className="block text-sm font-medium text-slate-800">
                Username {socialPlatform}
              </label>
              <input
                id="socialUsername"
                type="text"
                required
                maxLength={40}
                value={socialUsername}
                onChange={(e) => setSocialUsername(e.target.value)}
                placeholder="@tuo_username"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
              {errors.socialUsername && (
                <p className="mt-1 text-xs text-red-600">{errors.socialUsername}</p>
              )}
            </div>

            <div>
              <label htmlFor="freeFireId" className="block text-sm font-medium text-slate-800">
                ID Free Fire (solo cifre)
              </label>
              <input
                id="freeFireId"
                type="text"
                inputMode="numeric"
                required
                maxLength={15}
                value={freeFireId}
                onChange={(e) => setFreeFireId(sanitizeFreeFireId(e.target.value))}
                placeholder="2481905312"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
              {errors.freeFireId && (
                <p className="mt-1 text-xs text-red-600">{errors.freeFireId}</p>
              )}
            </div>
          </div>

          {serverError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <div className="flex items-center justify-end border-t border-slate-100 pt-5">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Salvataggio...' : 'Salva profilo e inizia i 25 annunci'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
