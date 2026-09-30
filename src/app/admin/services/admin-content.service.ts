import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import {
  AdminContentSectionRow,
  ContentSection,
  StoreSettings,
} from '../models';

function toCamel(row: AdminContentSectionRow): ContentSection {
  return {
    id: row.id,
    page: row.page,
    key: row.key,
    eyebrow: row.eyebrow ?? '',
    title: row.title ?? '',
    subtitle: row.subtitle ?? '',
    body: row.body ?? '',
    buttonLabel: row.button_label ?? '',
    buttonUrl: row.button_url ?? '',
    imageUrl: row.image_url ?? '',
    sort: row.sort ?? 0,
    isVisible: row.is_visible ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSnake(section: ContentSection): Record<string, unknown> {
  return {
    id: section.id || undefined,
    page: section.page,
    key: section.key,
    eyebrow: section.eyebrow ?? '',
    title: section.title ?? '',
    subtitle: section.subtitle ?? '',
    body: section.body ?? '',
    button_label: section.buttonLabel ?? '',
    button_url: section.buttonUrl ?? '',
    image_url: section.imageUrl ?? '',
    sort: section.sort ?? 0,
    is_visible: section.isVisible ?? true,
  };
}

@Injectable({ providedIn: 'root' })
export class AdminContentService {
  private readonly supabaseService = inject(SupabaseService);

  async getSections(page = 'home'): Promise<ContentSection[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('content_sections')
      .select('*')
      .eq('page', page)
      .order('sort', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as AdminContentSectionRow[]).map(toCamel);
  }

  async createSection(section: ContentSection): Promise<{ id: string }> {
    let sort = section.sort;
    if (!sort || sort < 0) {
      const { data, error } = await this.supabaseService.supabase
        .from('content_sections')
        .select('sort')
        .eq('page', section.page)
        .eq('key', section.key)
        .order('sort', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      sort = Number((data as { sort?: number } | null)?.sort ?? 0) + 10;
    }
    const { data, error } = await this.supabaseService.supabase
      .from('content_sections')
      .insert(toSnake({ ...section, sort }))
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return { id: (data as { id: string }).id };
  }

  async saveSection(section: ContentSection): Promise<void> {
    const { error } = await this.supabaseService.supabase
      .from('content_sections')
      .update(toSnake(section))
      .eq('id', section.id);
    if (error) throw new Error(error.message);
  }

  async deleteSection(id: string): Promise<void> {
    const { error } = await this.supabaseService.supabase
      .from('content_sections')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async uploadImage(file: File, folder = 'sections'): Promise<string> {
    const path = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { error } = await this.supabaseService.supabase.storage
      .from('cms-images')
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw new Error(error.message);
    return this.publicUrl(path);
  }

  publicUrl(path: string): string {
    return this.supabaseService.supabase.storage
      .from('cms-images')
      .getPublicUrl(path)
      .data.publicUrl;
  }

  async getSettings(): Promise<StoreSettings> {
    const { data, error } = await this.supabaseService.supabase
      .from('store_settings')
      .select('key, value');
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ key: string; value: unknown }>;
    const value = (key: string): string => {
      const row = rows.find((item) => item.key === key);
      if (row?.value === null || row?.value === undefined) return '';
      const text = typeof row.value === 'string' ? row.value : String(row.value);
      if (text.length > 1 && text.startsWith('"') && text.endsWith('"')) {
        try {
          return JSON.parse(text) as string;
        } catch {
          return text.slice(1, -1);
        }
      }
      return text;
    };
    const cents = (key: string, fallback: number): number => {
      const parsed = Number(value(key));
      return Number.isFinite(parsed) ? parsed / 100 : fallback;
    };
    return {
      siteName: value('site_name') || 'Zaraya Handicrafts',
      currency: value('currency') || 'usd',
      announcement: value('announcement'),
      shippingFee: cents('shipping_fee_cents', 18),
      freeShippingThreshold: cents('free_shipping_threshold_cents', 200),
      giftPackagingFee: cents('gift_packaging_cents', 12),
      supportEmail: value('support_email'),
      supportPhone: value('support_phone'),
    };
  }

  async saveSettings(settings: StoreSettings): Promise<void> {
    const { error } = await this.supabaseService.supabase.from('store_settings').upsert(
      [
        { key: 'site_name', value: settings.siteName },
        { key: 'currency', value: settings.currency.toLowerCase() },
        { key: 'announcement', value: settings.announcement },
        { key: 'shipping_fee_cents', value: Math.round(settings.shippingFee * 100) },
        { key: 'free_shipping_threshold_cents', value: Math.round(settings.freeShippingThreshold * 100) },
        { key: 'gift_packaging_cents', value: Math.round(settings.giftPackagingFee * 100) },
        { key: 'support_email', value: settings.supportEmail },
        { key: 'support_phone', value: settings.supportPhone },
      ],
      { onConflict: 'key' },
    );
    if (error) throw new Error(error.message);
  }
}
