export class FilterRegistry {
  private readonly filters = new Map<string, any>();

  register<T>(name: string, filter: T): void {
    this.filters.set(name, filter);
  }

  get<T>(name: string): T | undefined {
    return this.filters.get(name) as T | undefined;
  }

  has(name: string): boolean {
    return this.filters.has(name);
  }
}
