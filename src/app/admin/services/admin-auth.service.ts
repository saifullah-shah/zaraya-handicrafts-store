import { Injectable, computed, inject, signal } from '@angular/core';
import type { Session, Subscription, User } from '@supabase/supabase-js';
import { SupabaseService } from '../../services/supabase.service';

export type AuthState = 'loading' | 'authenticated' | 'anonymous';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly supabase = inject(SupabaseService);
  private subscription: Subscription | null = null;

  private readonly state = signal<AuthState>('loading');
  private readonly adminState = signal<boolean | null>(null);
  private readonly userState = signal<User | null>(null);

  readonly authState = this.state.asReadonly();
  readonly isAdmin = this.adminState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly ready = computed(
    () => this.state() !== 'loading' && this.adminState() !== null,
  );

  async init(): Promise<void> {
    const client = this.supabase.supabase;
    if (!this.subscription) {
      this.subscription = client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          this.state.set('anonymous');
          this.adminState.set(null);
          this.userState.set(null);
        } else {
          setTimeout(() => void this.refresh());
        }
      }).data.subscription;
    }
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const client = this.supabase.supabase;
    const { data } = await client.auth.getSession();
    const user = data.session?.user ?? null;
    this.userState.set(user);
    if (!user) {
      this.state.set('anonymous');
      this.adminState.set(null);
      return;
    }
    this.state.set('authenticated');
    try {
      const { data: ok } = await client.rpc('is_current_admin');
      this.adminState.set(ok === true);
    } catch {
      this.adminState.set(false);
    }
  }

  async login(email: string, password: string): Promise<{ error?: string }> {
    const client = this.supabase.supabase;
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }
    await this.refresh();
    if (!this.adminState()) {
      await client.auth.signOut();
      return { error: 'This account does not have admin access.' };
    }
    return {};
  }

  async logout(): Promise<void> {
    await this.supabase.supabase.auth.signOut();
  }
}