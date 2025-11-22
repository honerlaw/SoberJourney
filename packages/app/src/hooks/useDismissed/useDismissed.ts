import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useReportError } from "../useReportError";

export type UseDismissedOptions = {
  storageKey: string;
  id: string;
  // If omitted, dismissals never expire
  durationMs?: number;
};

export type UseDismissed = {
  isReady: boolean;
  isDismissed: boolean;
  dismiss: (customDurationMs?: number) => void;
};

/**
 * AsyncStorage-backed dismissal hook for a single id with optional expiration.
 *
 * Storage format per id:
 *   expiresAtEpochMs | null // null means never expires
 *
 * Each id is stored under a composite key: `${storageKey}:${id}`.
 */
export const useDismissed = (options: UseDismissedOptions): UseDismissed => {
  const { storageKey, id, durationMs } = options;
  const compositeKey = useMemo(() => `${storageKey}:${id}`, [storageKey, id]);
  const { report } = useReportError();

  const [expiresAt, setExpiresAt] = useState<number | null | undefined>(
    undefined,
  );
  const [isReady, setIsReady] = useState(false);

  // Load from storage on mount or when key changes
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(compositeKey);
        const parsed: unknown = raw ? JSON.parse(raw) : undefined;
        let next: number | null | undefined = undefined;
        if (parsed === null) {
          next = null; // never expires
        } else if (typeof parsed === "number") {
          next = parsed;
        } else if (parsed === undefined) {
          next = undefined;
        }

        if (!mounted) return;

        // Prune expired timestamp if needed
        if (typeof next === "number" && next <= Date.now()) {
          setExpiresAt(undefined);
          await AsyncStorage.removeItem(compositeKey);
        } else {
          setExpiresAt(next);
        }
        setIsReady(true);
      } catch (error) {
        report(error);
        if (mounted) setIsReady(true);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [compositeKey, report]);

  const isDismissed = useMemo(() => {
    if (expiresAt === undefined) return false;
    if (expiresAt === null) return true;
    return expiresAt > Date.now();
  }, [expiresAt]);

  const dismiss = useCallback(
    (customDurationMs?: number) => {
      const effectiveDuration = customDurationMs ?? durationMs;
      const nextExpiresAt =
        effectiveDuration != null ? Date.now() + effectiveDuration : null;
      setExpiresAt(nextExpiresAt);
      AsyncStorage.setItem(compositeKey, JSON.stringify(nextExpiresAt)).catch(
        (error) => {
          report(error);
        },
      );
    },
    [compositeKey, durationMs, report],
  );

  return {
    isReady,
    isDismissed,
    dismiss,
  };
};

export default useDismissed;
