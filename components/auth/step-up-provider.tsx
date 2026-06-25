"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  clearStepUpResolver,
  registerStepUpResolver,
  type StepUpResolver,
} from "@/lib/api/step-up";
import { StepUpModal } from "@/components/auth/step-up-modal";

type PendingStepUp = {
  id: number;
  resolve: (token: string | null) => void;
};

/**
 * Registers the app-wide step-up resolver and renders the code modal. The
 * `client.ts` interceptor calls the resolver on a 403 from a gated action; this
 * provider shows the modal and resolves with the minted token (or null on
 * cancel). Requests are serialized into a queue so concurrent gated actions each
 * get their own one-time token without stacking modals. — M4 §1.
 */
export function StepUpProvider({ children }: { children: ReactNode }) {
  const queueRef = useRef<PendingStepUp[]>([]);
  const activeRef = useRef<PendingStepUp | null>(null);
  const idRef = useRef(0);
  const [active, setActive] = useState<PendingStepUp | null>(null);

  const pump = useCallback(() => {
    if (activeRef.current) {
      return;
    }
    const head = queueRef.current[0];
    if (!head) {
      return;
    }
    activeRef.current = head;
    setActive(head);
  }, []);

  const finishActive = useCallback(
    (token: string | null) => {
      const current = activeRef.current;
      if (current) {
        current.resolve(token);
        queueRef.current = queueRef.current.filter(
          (pending) => pending.id !== current.id,
        );
      }
      activeRef.current = null;
      setActive(null);
      pump();
    },
    [pump],
  );

  useEffect(() => {
    const resolver: StepUpResolver = () =>
      new Promise<string | null>((resolve) => {
        idRef.current += 1;
        queueRef.current.push({ id: idRef.current, resolve });
        pump();
      });

    registerStepUpResolver(resolver);
    return () => {
      clearStepUpResolver(resolver);
      // Resolve any outstanding requests so awaiting callers never hang.
      queueRef.current.forEach((pending) => pending.resolve(null));
      queueRef.current = [];
      activeRef.current = null;
    };
  }, [pump]);

  return (
    <>
      {children}
      {active ? (
        <StepUpModal
          key={active.id}
          open
          onResolved={(token) => finishActive(token)}
          onCancel={() => finishActive(null)}
        />
      ) : null}
    </>
  );
}
