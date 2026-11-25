/**
 * The result of a request that changes server state.
 * - `rejected`: the server refused it and nothing changed, so the user may fix and resubmit.
 * - `unknown`: the reply was lost or unreadable and it may have committed. Never resubmit
 *   blindly; reconcile with the server first.
 */
export type Outcome<T, Reason extends string> =
  | { status: 'done'; value: T }
  | { status: 'rejected'; reason: Reason; detail?: string }
  | { status: 'unknown' };

export const done = <T>(value: T) => ({ status: 'done', value }) as const;

export const rejected = <Reason extends string>(reason: Reason, detail?: string) =>
  detail === undefined
    ? ({ status: 'rejected', reason } as const)
    : ({ status: 'rejected', reason, detail } as const);

export const unknownOutcome = { status: 'unknown' } as const;
