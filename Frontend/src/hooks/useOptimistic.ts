import { useRef, useState } from 'react';

/**
 * useOptimistic — Generic hook for optimistic UI updates with rollback.
 * Applies a state change immediately and reconciles with the server truth.
 * On error, rolls back the state transparently while re-throwing the error.
 */
export function useOptimistic<T>(initialValue: T) {
  const [optimisticValue, setOptimisticValue] = useState<T>(initialValue);
  const [isPending, setIsPending] = useState(false);
  const prevValue = useRef(initialValue);

  const update = async (
    newValue: T,
    apiCall: () => Promise<T>,
  ) => {
    prevValue.current = optimisticValue;
    setOptimisticValue(newValue);  // apply immediately
    setIsPending(true);
    try {
      const serverValue = await apiCall();
      setOptimisticValue(serverValue);  // reconcile with server truth
      return serverValue;
    } catch (error) {
      setOptimisticValue(prevValue.current);  // rollback
      throw error;  // re-throw so caller can show error
    } finally {
      setIsPending(false);
    }
  };

  return { value: optimisticValue, isPending, update, setOptimisticValue };
}
