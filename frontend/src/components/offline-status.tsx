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
          setState(navigator.onLine ? "online" : "offline");
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

  const message = pendingCount > 0
    ? "Legacy unsent review drafts are stored on this device only and will not automatically sync. Reopen the case and re-enter the review online."
    : state === "sync-error"
    ? "A legacy locally pending review needs manual re-submission. It is not a confirmed server decision."
    : state === "cache-error"
      ? "Browser storage is unavailable or full. Offline read-only copies may not be available."
      : state === "offline"
        ? "Offline: cached data may be stale. Review decisions and follow-up actions cannot be saved offline."
        : state === "stale"
          ? "The API is unavailable. This view is showing its last cached copy."
          : "Connection restored. Legacy unsent review entries will not automatically sync; reopen the case to review.";

  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-50 px-5 py-2 text-center text-xs leading-5 text-amber-950 sm:px-8"
    >
      {message}
      {pendingCount > 0 && (
        <span className="ml-1 font-semibold">
          {pendingCount} legacy unsent review{pendingCount === 1 ? "" : "s"} (not saved on the server).
        </span>
      )}
    </div>
  );
}
