import type { AppData } from '@/models/types';

/**
 * Persistence boundary. The app only talks to this interface, so swapping the
 * local store for a cloud-backed one (e.g. Supabase) doesn't touch UI or logic.
 */
export interface DataRepository {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
  clear(): Promise<void>;
}
