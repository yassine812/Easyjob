'use client';

import { useEffect } from 'react';

export function RetireLegacyWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // An older app on localhost used /sw.js to cache navigation responses.
    // Update only that registration to our retirement worker. Do not register
    // a worker for new visitors or touch cookies, accounts, or local storage.
    void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      const scriptURL = `${window.location.origin}/sw.js`;
      await Promise.all(registrations
        .filter((registration) => registration.active?.scriptURL === scriptURL)
        .map((registration) => registration.update()));
    }).catch(() => {
      // An offline update can be retried on the next visit.
    });
  }, []);

  return null;
}
