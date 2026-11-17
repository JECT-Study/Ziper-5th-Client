import {
  failure,
  success,
  type Result,
  type SheetInput,
  type SheetResult,
} from '@ziper/bridge/contract';

export type SheetSnapshot = Readonly<{ token: number; input: SheetInput }>;

export class SheetSessions {
  private sequence = 0;
  private current: {
    snapshot: SheetSnapshot;
    resolve: (result: Result<SheetResult>) => void;
  } | null = null;
  private disposed = false;

  constructor(private readonly changed: (sheet: SheetSnapshot | null) => void) {}

  get active() {
    return this.current !== null;
  }

  open(input: SheetInput): Promise<Result<SheetResult>> {
    if (this.disposed || this.current) return Promise.resolve(failure('PERMISSION_DENIED'));
    return new Promise((resolve) => {
      const snapshot = Object.freeze({ token: ++this.sequence, input });
      this.current = { snapshot, resolve };
      this.changed(snapshot);
    });
  }

  settle(token: number, actionId?: string): boolean {
    const current = this.current;
    if (!current || current.snapshot.token !== token) return false;
    if (
      actionId !== undefined &&
      !current.snapshot.input.actions.some((action) => action.id === actionId)
    )
      return false;
    this.current = null;
    this.changed(null);
    current.resolve(
      success(actionId === undefined ? { status: 'cancelled' } : { status: 'selected', actionId }),
    );
    return true;
  }

  cancel(): boolean {
    return this.current ? this.settle(this.current.snapshot.token) : false;
  }

  dispose() {
    this.disposed = true;
    const current = this.current;
    this.current = null;
    current?.resolve(success({ status: 'cancelled' }));
  }
}
