import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import type { AuthChangeEvent, Session, Subscription, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class CustomerAuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);
  private subscription: Subscription | null = null;
  readonly user = signal<User | null>(null);
  readonly ready = signal(!this.browser);

  constructor() {
    if (this.browser) {
      void this.init();
    }
  }

  async init(): Promise<void> {
    if (!this.supabase.configured) {
      this.ready.set(true);
      return;
    }
    const client = this.supabase.supabase;
    if (!this.subscription) {
      this.subscription = client.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
        this.user.set(session?.user ?? null);
        this.ready.set(true);
      }).data.subscription;
    }
    try {
      const { data, error } = await client.auth.getSession();
      if (!error) {
        this.user.set(data.session?.user ?? null);
      }
    } finally {
      this.ready.set(true);
    }
  }

  async signIn(email: string, password: string): Promise<string | null> {
    if (!this.supabase.configured) return 'Accounts are temporarily unavailable.';
    const { error } = await this.supabase.supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async signUp(
    name: string,
    email: string,
    password: string,
  ): Promise<{ error: string | null; message: string | null }> {
    if (!this.supabase.configured) {
      return { error: 'Accounts are temporarily unavailable.', message: null };
    }
    const { data, error } = await this.supabase.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: this.browser ? `${window.location.origin}/account` : undefined,
      },
    });
    return {
      error: error?.message ?? null,
      message: data.session
        ? 'Your account is ready.'
        : 'Check your email to confirm your account.',
    };
  }

  async signOut(): Promise<void> {
    if (this.supabase.configured) {
      await this.supabase.supabase.auth.signOut();
    }
  }
}
