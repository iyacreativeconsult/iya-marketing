"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, inMemoryPersistence, initializeAuth, type Auth } from "firebase/auth";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/**
 * Firebase client digunakan untuk log masuk SAHAJA. Token disimpan dalam memori
 * (bukan localStorage), kemudian ditukar kepada cookie httpOnly oleh server.
 */
export function clientAuth(): Auth {
  if (auth) return auth;
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_* belum diisi dalam .env.local");
  }
  app = getApps()[0] ?? initializeApp(config);
  try {
    auth = initializeAuth(app, { persistence: inMemoryPersistence });
  } catch {
    auth = getAuth(app);
  }
  return auth;
}
