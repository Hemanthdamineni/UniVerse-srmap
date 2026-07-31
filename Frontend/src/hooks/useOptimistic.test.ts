import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOptimistic } from './useOptimistic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a promise that resolves on the next microtask. */
const tick = () => new Promise<void>((resolve) => resolve());

/** An API that never returns (use to assert that isPending stays true). */
const neverResolve = (): Promise<number> => new Promise(() => void 0);

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useOptimistic', () => {
  // ---- initial state -------------------------------------------------------
  describe('initial state', () => {
    it('returns the initial value', () => {
      const { result } = renderHook(() => useOptimistic('hello'));
      expect(result.current.value).toBe('hello');
    });

    it('starts with isPending = false', () => {
      const { result } = renderHook(() => useOptimistic(42));
      expect(result.current.isPending).toBe(false);
    });

    it('accepts a falsy initial value (0)', () => {
      const { result } = renderHook(() => useOptimistic(0));
      expect(result.current.value).toBe(0);
    });

    it('accepts a falsy initial value (false)', () => {
      const { result } = renderHook(() => useOptimistic(false));
      expect(result.current.value).toBe(false);
    });

    it('accepts an empty string as initial value', () => {
      const { result } = renderHook(() => useOptimistic(''));
      expect(result.current.value).toBe('');
    });

    it('accepts null as initial value', () => {
      const { result } = renderHook(() => useOptimistic(null));
      expect(result.current.value).toBeNull();
    });

    it('accepts undefined as initial value', () => {
      const { result } = renderHook(() => useOptimistic(undefined));
      expect(result.current.value).toBeUndefined();
    });

    it('accepts an empty array as initial value', () => {
      const { result } = renderHook(() => useOptimistic([]));
      expect(result.current.value).toEqual([]);
    });

    it('accepts an empty object as initial value', () => {
      const { result } = renderHook(() => useOptimistic({}));
      expect(result.current.value).toEqual({});
    });

    it('exposes setOptimisticValue as a function', () => {
      const { result } = renderHook(() => useOptimistic(10));
      expect(typeof result.current.setOptimisticValue).toBe('function');
    });

    it('exposes update as a function', () => {
      const { result } = renderHook(() => useOptimistic(10));
      expect(typeof result.current.update).toBe('function');
    });
  });

  // ---- direct setter -------------------------------------------------------
  describe('setOptimisticValue', () => {
    it('immediately updates the value', () => {
      const { result } = renderHook(() => useOptimistic('a'));
      act(() => {
        result.current.setOptimisticValue('b');
      });
      expect(result.current.value).toBe('b');
    });

    it('does not set isPending when called directly', () => {
      const { result } = renderHook(() => useOptimistic('a'));
      act(() => {
        result.current.setOptimisticValue('b');
      });
      expect(result.current.isPending).toBe(false);
    });

    it('accepts a function updater like useState', () => {
      const { result } = renderHook(() => useOptimistic(0));
      act(() => {
        result.current.setOptimisticValue((prev: number) => prev + 5);
      });
      expect(result.current.value).toBe(5);
    });
  });

  // ---- optimistic update ---------------------------------------------------
  describe('optimistic update', () => {
    it('immediately reflects the new value before the API resolves', async () => {
      const api = vi.fn().mockImplementation(neverResolve);
      const { result } = renderHook(() => useOptimistic('old'));

      act(() => {
        result.current.update('optimistic', api);
      });

      // Value flips immediately — no await needed.
      expect(result.current.value).toBe('optimistic');
    });

    it('sets isPending true during the API call', async () => {
      const api = vi.fn().mockImplementation(neverResolve);
      const { result } = renderHook(() => useOptimistic('old'));

      act(() => {
        result.current.update('new', api);
      });

      expect(result.current.isPending).toBe(true);
    });

    it('reconciles with the server value on success', async () => {
      const api = vi.fn().mockResolvedValue('server-value');
      const { result } = renderHook(() => useOptimistic('old'));

      await act(async () => {
        await result.current.update('optimistic', api);
      });

      expect(result.current.value).toBe('server-value');
    });

    it('returns the server value from the update call', async () => {
      const api = vi.fn().mockResolvedValue('server-value');
      const { result } = renderHook(() => useOptimistic('old'));

      let returned: string | undefined;
      await act(async () => {
        returned = await result.current.update('optimistic', api);
      });

      expect(returned).toBe('server-value');
    });

    it('sets isPending false after successful reconciliation', async () => {
      const api = vi.fn().mockResolvedValue('ok');
      const { result } = renderHook(() => useOptimistic('old'));

      await act(async () => {
        await result.current.update('x', api);
      });

      expect(result.current.isPending).toBe(false);
    });
  });

  // ---- rollback on error ---------------------------------------------------
  describe('rollback on error / rejection', () => {
    it('reverts to the value before the update when the API rejects', async () => {
      const api = vi.fn().mockRejectedValue(new Error('Network failure'));
      const { result } = renderHook(() => useOptimistic('original'));

      await act(async () => {
        try {
          await result.current.update('broken', api);
        } catch {
          // expected
        }
      });

      expect(result.current.value).toBe('original');
    });

    it('re-throws the error so the caller can handle it', async () => {
      const theError = new Error('Server 500');
      const api = vi.fn().mockRejectedValue(theError);
      const { result } = renderHook(() => useOptimistic('x'));

      let caught: unknown = null;
      await act(async () => {
        try {
          await result.current.update('y', api);
        } catch (e) {
          caught = e;
        }
      });

      expect(caught).toBe(theError);
    });

    it('rolls back to the correct snapshot after multiple updates', async () => {
      // Sequence: value = a → update to b (fail) → should be a again
      const failApi = vi.fn().mockRejectedValue(new Error('fail'));
      const { result } = renderHook(() => useOptimistic('a'));

      await act(async () => {
        try {
          await result.current.update('b', failApi);
        } catch {
          // expected
        }
      });

      expect(result.current.value).toBe('a');
    });

    it('sets isPending false after a rollback', async () => {
      const api = vi.fn().mockRejectedValue(new Error('fail'));
      const { result } = renderHook(() => useOptimistic('stable'));

      await act(async () => {
        try {
          await result.current.update('risky', api);
        } catch {
          // expected
        }
      });

      expect(result.current.isPending).toBe(false);
    });

    it('rolls back correctly even when the error is not an Error object', async () => {
      const api = vi.fn().mockRejectedValue('string error');
      const { result } = renderHook(() => useOptimistic('before'));

      await act(async () => {
        try {
          await result.current.update('after', api);
        } catch {
          // expected
        }
      });

      expect(result.current.value).toBe('before');
    });

    it('rolls back correctly for null rejection', async () => {
      const api = vi.fn().mockRejectedValue(null);
      const { result } = renderHook(() => useOptimistic('before'));

      await act(async () => {
        try {
          await result.current.update('after', api);
        } catch {
          // expected
        }
      });

      expect(result.current.value).toBe('before');
    });
  });

  // ---- multiple sequential updates -----------------------------------------
  describe('sequential updates', () => {
    it('chains successful updates', async () => {
      const { result } = renderHook(() => useOptimistic(0));

      await act(async () => {
        await result.current.update(10, () => Promise.resolve(10));
      });
      expect(result.current.value).toBe(10);
      expect(result.current.isPending).toBe(false);

      await act(async () => {
        await result.current.update(20, () => Promise.resolve(20));
      });
      expect(result.current.value).toBe(20);
      expect(result.current.isPending).toBe(false);

      await act(async () => {
        await result.current.update(30, () => Promise.resolve(30));
      });
      expect(result.current.value).toBe(30);
    });

    it('rolls back to the most recent committed value on failure in a chain', async () => {
      const { result } = renderHook(() => useOptimistic('start'));

      // First update succeeds
      await act(async () => {
        await result.current.update('step-1', () => Promise.resolve('step-1'));
      });

      // Second update fails — should roll back to 'step-1'
      await act(async () => {
        try {
          await result.current.update('step-2-fail', () =>
            Promise.reject(new Error('fail')),
          );
        } catch {
          // expected
        }
      });

      expect(result.current.value).toBe('step-1');
    });

    it('preserves isPending correctly across a success-then-failure chain', async () => {
      const { result } = renderHook(() => useOptimistic('a'));

      await act(async () => {
        await result.current.update('b', () => Promise.resolve('b'));
      });
      expect(result.current.isPending).toBe(false);

      await act(async () => {
        try {
          await result.current.update('c', () =>
            Promise.reject(new Error('fail')),
          );
        } catch {
          // expected
        }
      });
      expect(result.current.isPending).toBe(false);
    });
  });

  // ---- concurrent updates --------------------------------------------------
  describe('concurrent updates', () => {
    it('handles two concurrent updates where both succeed (last wins)', async () => {
      const { result } = renderHook(() => useOptimistic('initial'));

      let resolveA!: (v: string) => void;
      let resolveB!: (v: string) => void;

      const apiA = () =>
        new Promise<string>((resolve) => {
          resolveA = resolve;
        });
      const apiB = () =>
        new Promise<string>((resolve) => {
          resolveB = resolve;
        });

      // Fire both updates
      act(() => {
        result.current.update('fromA', apiA);
        result.current.update('fromB', apiB);
      });

      // Both optimistic values were set immediately; last write wins in the state
      expect(result.current.value).toBe('fromB');

      // Resolve A first, then B
      await act(async () => {
        resolveA('serverA');
        await tick();
      });
      // Now A's resolution applied — but B hasn't resolved yet, so value is
      // whatever B set optimistically, then A's reconciliation wrote 'serverA'.
      // Because of the way the closure captures `prevValue`, after A resolves
      // it sets the value to serverA, overwriting B's optimistic value.
      // That's an edge case the hook doesn't protect against — the test documents it.
      expect(result.current.value).toBe('serverA');

      await act(async () => {
        resolveB('serverB');
        await tick();
      });
      expect(result.current.value).toBe('serverB');
    });

    it('rolls back the failing update and overwrites the concurrent success optimistic value', async () => {
      const { result } = renderHook(() => useOptimistic('base'));

      let resolveSuccess!: (v: string) => void;
      let rejectPromise!: (e: Error) => void;
      const successApi = () =>
        new Promise<string>((resolve) => {
          resolveSuccess = resolve;
        });
      const failApi = () =>
        new Promise<string>((_resolve, reject) => {
          rejectPromise = reject;
        });

      // Start both concurrently inside act so state updates flush
      act(() => {
        const fP = result.current.update('fail-optimistic', failApi);
        // Attach catch immediately so the rejection is never unhandled
        fP.catch(() => void 0);
        result.current.update('success-optimistic', successApi);
      });

      // Last optimistic write visible
      expect(result.current.value).toBe('success-optimistic');

      // Reject the failing one first
      await act(async () => {
        rejectPromise(new Error('fail'));
        await tick();
      });

      // The hook captures prevValue when update is called, so the fail update
      // rolls back to 'base' (its snapshot). This overwrites the optimistic
      // 'success-optimistic' value. This is a known race — the test documents it.
      expect(result.current.value).toBe('base');

      // Now let success resolve
      await act(async () => {
        resolveSuccess('server-success');
        await tick();
      });

      expect(result.current.value).toBe('server-success');
      expect(result.current.isPending).toBe(false);
    });

    it('isPending is a single boolean — concurrent calls interfere', async () => {
      const { result } = renderHook(() => useOptimistic('x'));

      let resolveSlow!: (v: string) => void;
      const slowApi = () =>
        new Promise<string>((resolve) => {
          resolveSlow = resolve;
        });
      const fastApi = vi.fn().mockResolvedValue('fast');

      act(() => {
        result.current.update('slow', slowApi);
        result.current.update('fast', fastApi);
      });

      // Both started — at least one set isPending true
      expect(result.current.isPending).toBe(true);

      // Flush microtasks so the already-resolved fastApi settles
      await act(async () => {
        await tick();
      });

      // fastApi has settled, so its finally block set isPending to false,
      // even though slowApi is still pending. This documents the hook's
      // limitation: isPending is a single boolean, not a counter.
      expect(result.current.isPending).toBe(false);

      await act(async () => {
        resolveSlow('slow');
        await tick();
      });

      expect(result.current.isPending).toBe(false);
    });
  });

  // ---- edge cases ----------------------------------------------------------
  describe('edge cases', () => {
    it('rolls back to the correct prior value when a previous setOptimisticValue call modified state', async () => {
      const { result } = renderHook(() => useOptimistic('a'));

      // Use the direct setter to change value
      act(() => {
        result.current.setOptimisticValue('b');
      });
      expect(result.current.value).toBe('b');

      // Now an update that fails should roll back to 'b' (the current value
      // when update was called), not 'a'.
      await act(async () => {
        try {
          await result.current.update('c', () =>
            Promise.reject(new Error('fail')),
          );
        } catch {
          // expected
        }
      });

      expect(result.current.value).toBe('b');
    });

    it('does not mutate the previous value reference across updates', async () => {
      const { result } = renderHook(() => useOptimistic([1, 2, 3]));

      // Sanity: initial value
      expect(result.current.value).toEqual([1, 2, 3]);

      const api = vi.fn().mockResolvedValue([4, 5, 6]);
      await act(async () => {
        await result.current.update([7, 8, 9], api);
      });

      // Reconciles to server value
      expect(result.current.value).toEqual([4, 5, 6]);
      // And the reference is the server's
      expect(result.current.value).toBe(await api.mock.results[0].value);
    });

    it('supports object values', async () => {
      interface User {
        name: string;
        role: string;
      }

      const initial: User = { name: 'Alice', role: 'student' };
      const { result } = renderHook(() => useOptimistic(initial));

      await act(async () => {
        await result.current.update(
          { name: 'Alice', role: 'admin' },
          () => Promise.resolve({ name: 'Alice', role: 'admin' }),
        );
      });

      expect(result.current.value).toEqual({ name: 'Alice', role: 'admin' });
    });

    it('handles the API throwing synchronously before returning a promise', async () => {
      const syncThrower = vi.fn(() => {
        throw new Error('sync boom');
      });
      const { result } = renderHook(() => useOptimistic('stable'));

      await act(async () => {
        try {
          // Even though the apiCall throws synchronously, we need to see
          // that the value is still rolled back. However, because the function
          // is async, the throw inside the non-async wrapper will reject the
          // promise returned by the async update function — or crash outside.
          // We wrap in a try-catch.
          await result.current.update('risky', syncThrower as unknown as () => Promise<string>);
        } catch {
          // expected
        }
      });

      // The optimistic value was set before the api call, but the synchronous
      // throw will reject the promise. The catch block should roll back.
      expect(result.current.value).toBe('stable');
      expect(result.current.isPending).toBe(false);
    });
  });
});
