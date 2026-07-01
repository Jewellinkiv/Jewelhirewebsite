export type StorageRuntime = "local" | "postgres";

export class StorageAdapterUnavailableError extends Error {
  constructor(storeName: string, runtime: StorageRuntime) {
    super(`${runtime} storage adapter is not implemented for ${storeName}`);
    this.name = "StorageAdapterUnavailableError";
  }
}

export function getStorageRuntime(): StorageRuntime {
  if (process.env.JEWELHIRE_STORAGE !== "postgres") return "local";
  return process.env.DATABASE_URL || process.env.POSTGRES_URL ? "postgres" : "local";
}

export function selectStoreAdapter<T>(storeName: string, adapters: { local: T; postgres?: T }): T {
  const runtime = getStorageRuntime();
  if (runtime === "local") return adapters.local;
  if (adapters.postgres) return adapters.postgres;
  throw new StorageAdapterUnavailableError(storeName, runtime);
}
