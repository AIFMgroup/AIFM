/**
 * Storage adapter interface for Fund Registry.
 * Implementations: InMemoryStorage (fund-registry.ts), DynamoDBStorage (dynamo-storage.ts).
 */

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list<T>(prefix: string): Promise<T[]>;
  query<T>(prefix: string, filter: (item: T) => boolean): Promise<T[]>;
}
