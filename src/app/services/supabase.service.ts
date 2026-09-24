import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient | null;

  constructor() {
    this.client = this.isConfigured()
      ? createClient(environment.supabaseUrl, environment.supabaseAnonKey)
      : null;
  }

  get configured(): boolean {
    return this.client !== null;
  }

  get supabase(): SupabaseClient {
    if (!this.client) {
      throw new Error(
        'Supabase is not configured. Set supabaseUrl/supabaseAnonKey in src/environments/.',
      );
    }
    return this.client;
  }

  private isConfigured(): boolean {
    const url = environment.supabaseUrl ?? '';
    const key = environment.supabaseAnonKey ?? '';
    return url.includes('supabase.co') && key.length > 20 && !key.includes('YOUR_');
  }
}
