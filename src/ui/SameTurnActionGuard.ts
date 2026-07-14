export class SameTurnActionGuard {
  private readonly acceptedAtByKey = new Map<string, number>();

  constructor(
    private readonly debounceMilliseconds = 250,
    private readonly now: () => number = () => performance.now(),
  ) {}

  isBlocked(actionKey: string): boolean {
    return this.remainingMilliseconds(actionKey) > 0;
  }

  remainingMilliseconds(actionKey: string): number {
    const acceptedAt = this.acceptedAtByKey.get(actionKey);
    if (acceptedAt === undefined) {
      return 0;
    }
    return Math.max(
      0,
      this.debounceMilliseconds - (this.now() - acceptedAt),
    );
  }

  run(actionKey: string, action: () => void): boolean {
    if (this.isBlocked(actionKey)) {
      return false;
    }
    this.acceptedAtByKey.set(actionKey, this.now());
    action();
    return true;
  }
}
