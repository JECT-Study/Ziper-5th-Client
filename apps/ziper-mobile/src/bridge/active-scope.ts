// Render-safe slot: allocate resources in effect-owned activate(), never during render.
export class ActiveScope<T extends { dispose(): void }> {
  current: T | null = null;
  private cleanup?: () => void;

  deactivate(): void {
    this.cleanup?.();
  }

  activate(create: () => T): () => void {
    this.cleanup?.();
    const scope = create();
    this.current = scope;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (this.current === scope) {
        this.current = null;
        this.cleanup = undefined;
      }
      scope.dispose();
    };
    this.cleanup = cleanup;
    return cleanup;
  }
}
