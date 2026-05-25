import { useEffect, useState } from 'react';
import { api } from './api';

/** Fetches the caller's first store id (most pages operate on one store). */
export function useFirstStore(): { storeId: string | null; loading: boolean } {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<{ stores: { id: string }[] }>('/merchant/stores').then((res) => {
      setStoreId(res.data?.stores?.[0]?.id ?? null);
      setLoading(false);
    });
  }, []);
  return { storeId, loading };
}
