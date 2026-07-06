import { useEffect, useState } from "react";

// Charge le plan/quotas/usage courant du compte (voir Edge Function `entitlements`).
// Ne fait aucune vérification de sécurité — c'est purement pour l'affichage front,
// le blocage réel reste toujours vérifié côté serveur au moment de l'action.
export function useEntitlements({ authedFetch, apiBase, enabled = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !authedFetch) return;
    let cancelled = false;
    setLoading(true);
    authedFetch(`${apiBase}/entitlements`)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => { if (!cancelled && payload) setData(payload); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authedFetch, apiBase, enabled]);

  return {
    plan: data?.plan ?? null,
    limits: data?.limits ?? null,
    usage: data?.usage ?? null,
    loading,
  };
}
