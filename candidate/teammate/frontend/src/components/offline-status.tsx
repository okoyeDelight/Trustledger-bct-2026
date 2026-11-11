"use client";

import { useEffect, useState } from "react";
import { getPendingReviews, syncPendingReviews } from "@/lib/api";
import type { AuthenticatedUser } from "@/lib/types";

type ConnectionState = "online" | "offline" | "stale" | "sync-error" | "cache-error";
const CONNECTION_EVENT = "trustledger:offline-state";

export function OfflineStatus({ user }: { user: AuthenticatedUser }) {
  const [state, setState] = useState<ConnectionState>("online");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const updatePendingCount = () => setPendingCount(getPendingReviews(user).length);
    const onConnectionChange = (event: Event) => {
      const detail = (event as CustomEvent<{ state: ConnectionState }>).detail;
      setState(detail.state);
      updatePendingCount();
    };
    const sync = () => {
      void syncPendingReviews(user)
        .then(() => {
          updatePendingCount();
          setState(
            !navigator.onLine
              ? "offline"
              : getPendingReviews(user).length > 0
                ? "stale"
                : "online",
          );
        })
        .catch(() => setState("sync-error"));
    };
    const onOnline = () => sync();
    const onOffline = () => setState("offline");

    updatePendingCount();
    window.addEventListener(CONNECTION_EVENT, onConnectionChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (!navigator.onLine) window.dispatchEvent(new Event("offline"));
    else sync();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js").catch(() => setState("cache-error"));
    }

    return () => {
      window.removeEventListener(CONNECTION_EVENT, onConnectionChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [user]);

  if (state === "online" && pendingCount === 0) return null;

  const message = state === "sync-error"
    ? "A saved review could not sync. Sign in as its original reviewer and check the audit log."
    : state === "cache-error"
      ? "Browser storage is unavailable or full. Offline copies and queued reviews may not be saved."
      : state === "offline"
        ? "Offline mode: showing cached data where available. New reviews are stored on this device until sync."
        : state === "stale"
          ? "The API is unavailable. This view is showing its last cached copy."
          : "Connection restored. Pending review entries are being synced.";

  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-50 px-5 py-2 text-center text-xs leading-5 text-amber-950 sm:px-8"
    >
      {message}
      {pendingCount > 0 && (
        <span className="ml-1 font-semibold">
          {pendingCount} pending review{pendingCount === 1 ? "" : "s"}.
        </span>
      )}
    </div>
  );
}
