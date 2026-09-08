// Lazy Firebase client. Credentials come ONLY from env — never hard-coded.
//   VITE_FIREBASE_API_KEY
//   VITE_FIREBASE_AUTH_DOMAIN
//   VITE_FIREBASE_DATABASE_URL
//   VITE_FIREBASE_PROJECT_ID
//   VITE_FIREBASE_APP_ID
// If absent, hasFirebase() is false and the game uses LocalTransport.
// Identity: Firebase Anonymous Authentication — each tablet gets a stable uid
// (persisted by the Auth SDK) with no login step for the kids.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth, type User } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';

function env(key: string): string {
  return (import.meta as unknown as { env: Record<string, string> }).env?.[key] ?? '';
}

export function firebaseApiKey(): string {
  return env('VITE_FIREBASE_API_KEY');
}

export function firebaseDatabaseUrl(): string {
  return env('VITE_FIREBASE_DATABASE_URL');
}

export function hasFirebase(): boolean {
  return (
    firebaseDatabaseUrl().startsWith('https://') &&
    firebaseApiKey().length > 10 &&
    env('VITE_FIREBASE_PROJECT_ID').length > 0 &&
    env('VITE_FIREBASE_APP_ID').length > 0
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!hasFirebase()) return null;
  if (!app) {
    const existing = getApps();
    app =
      existing.length > 0
        ? existing[0]!
        : initializeApp({
            apiKey: env('VITE_FIREBASE_API_KEY'),
            authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
            databaseURL: env('VITE_FIREBASE_DATABASE_URL'),
            projectId: env('VITE_FIREBASE_PROJECT_ID'),
            appId: env('VITE_FIREBASE_APP_ID')
          });
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const a = getFirebaseApp();
  if (!a) return null;
  if (!auth) auth = getAuth(a);
  return auth;
}

export function getFirebaseDb(): Database | null {
  const a = getFirebaseApp();
  if (!a) return null;
  if (!db) db = getDatabase(a);
  return db;
}

/** Anonymous sign-in (idempotent). Returns the stable per-tablet user. */
export async function ensureAnonAuth(): Promise<User> {
  const a = getFirebaseAuth();
  if (!a) throw new Error('firebase not configured');
  if (a.currentUser) return a.currentUser;
  const cred = await signInAnonymously(a);
  return cred.user;
}
