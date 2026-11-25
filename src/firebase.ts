import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

const firestoreDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = (() => {
  try {
    return firestoreDatabaseId
      ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, firestoreDatabaseId)
      : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    return firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
  }
})();
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const gmailProvider = new GoogleAuthProvider();
gmailProvider.addScope('https://www.googleapis.com/auth/gmail.send');
gmailProvider.setCustomParameters({ prompt: 'consent' });

// Strict in-memory cache for Gmail OAuth token (never written to localStorage/sessionStorage)
let cachedGmailAccessToken: string | null = null;
const gmailTokenListeners = new Set<(token: string | null) => void>();

function notifyGmailTokenListeners() {
  for (const listener of gmailTokenListeners) {
    listener(cachedGmailAccessToken);
  }
}

export function subscribeGmailToken(listener: (token: string | null) => void): () => void {
  gmailTokenListeners.add(listener);
  listener(cachedGmailAccessToken);
  return () => {
    gmailTokenListeners.delete(listener);
  };
}

export function setGmailAccessToken(token: string | null) {
  cachedGmailAccessToken = token;
  notifyGmailTokenListeners();
}

export function getGmailAccessToken(): string | null {
  return cachedGmailAccessToken;
}

export function clearGmailAccessToken() {
  cachedGmailAccessToken = null;
  notifyGmailTokenListeners();
}

export async function connectGmailWithPopup(): Promise<string> {
  const result = await signInWithPopup(auth, gmailProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Could not obtain Gmail send authorization token. Please try again and allow Gmail send permission.');
  }
  setGmailAccessToken(credential.accessToken);
  return credential.accessToken;
}

onAuthStateChanged(auth, (currentUser) => {
  if (!currentUser) {
    clearGmailAccessToken();
  }
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. Client is offline.');
    }
    return false;
  }
}

export const BOOTSTRAPPED_ADMIN_EMAIL = 'midulhasan000888@gmail.com';
