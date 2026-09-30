import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminContentService } from '../services/admin-content.service';
import { ImageUploadComponent } from '../components/image-upload.component';
import { ContentSection } from '../models';

function blankSection(sort: number): ContentSection {
  return {
    id: '',
    page: 'home',
    key: 'section',
    eyebrow: '',
    title: '',
    subtitle: '',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort,
    isVisible: true,
  };
}

@Component({
  selector: 'admin-content-page',
  standalone: true,
  imports: [FormsModule, ImageUploadComponent],
  template: `
    <div class="admin-flex-between" style="margin-bottom:1rem">
      <p class="admin-muted" style="margin:0">Sections are the blocks that make up the homepage. Drag-free: use the sort number to reorder.</p>
      <button class="admin-btn admin-btn-primary" (click)="add()">＋ New section</button>
    </div>

    @if (loading()) {
      <div class="admin-loading">Loading sections…</div>
    } @else if (error()) {
      <div class="admin-empty">{{ error() }}</div>
    } @else if (sections().length === 0) {
      <div class="admin-empty">
        No sections yet. Click “New section” to add the first one.
        <div style="margin-top:1rem">
          <button class="admin-btn admin-btn-primary" (click)="add()">＋ New section</button>
        </div>
      </div>
    } @else {
      <div class="admin-sections">
        @for (section of sections(); track section.id || $index; let i = $index) {
          <div class="admin-card">
            <div class="admin-card-head">
              <div class="admin-flex">
                <strong>{{ section.title || section.key || 'Untitled section' }}</strong>
              </div>
              <div class="admin-flex admin-gap">
                <label class="admin-toggle" title="Visible on the storefront">
                  <input type="checkbox" [checked]="section.isVisible" (change)="toggleVisibility(i, $event)" />
                  <span>{{ section.isVisible ? 'Visible' : 'Hidden' }}</span>
                </label>
                <button class="admin-btn admin-btn-sm admin-btn-secondary" (click)="move(i, -1)" [disabled]="i === 0">↑</button>
                <button class="admin-btn admin-btn-sm admin-btn-secondary" (click)="move(i, 1)" [disabled]="i === sections().length - 1">↓</button>
                <button class="admin-btn admin-btn-sm admin-btn-secondary" (click)="saveSection(i)">Save</button>
                <button class="admin-btn admin-btn-sm admin-btn-danger" (click)="remove(i)">Delete</button>
              </div>
            </div>
            @if (busyIndex() === i) {
              <p class="admin-muted" style="margin:0 0 .5rem">Saving…</p>
            }

            <div class="admin-form-row">
              <div class="admin-field">
                <label [for]="'eyebrow-' + i">Eyebrow</label>
                <input [id]="'eyebrow-' + i" type="text" [(ngModel)]="section.eyebrow" [name]="'eyebrow-' + i" />
              </div>
              <div class="admin-field">
                <label [for]="'sort-' + i">Sort</label>
                <input [id]="'sort-' + i" type="number" [(ngModel)]="section.sort" [name]="'sort-' + i" />
              </div>
            </div>
            <div class="admin-field">
              <label [for]="'title-' + i">Title</label>
              <input [id]="'title-' + i" type="text" [(ngModel)]="section.title" [name]="'title-' + i" />
            </div>
            <div class="admin-field">
              <label [for]="'subtitle-' + i">Subtitle</label>
              <input [id]="'subtitle-' + i" type="text" [(ngModel)]="section.subtitle" [name]="'subtitle-' + i" />
            </div>
            <div class="admin-field">
              <label [for]="'body-' + i">Body</label>
              <textarea [id]="'body-' + i" rows="3" [(ngModel)]="section.body" [name]="'body-' + i"></textarea>
            </div>

            <div class="admin-form-row">
              <div class="admin-field">
                <label [for]="'btn-label-' + i">Button label</label>
                <input [id]="'btn-label-' + i" type="text" [(ngModel)]="section.buttonLabel" [name]="'btn-label-' + i" />
              </div>
              <div class="admin-field">
                <label [for]="'btn-url-' + i">Button URL</label>
                <input [id]="'btn-url-' + i" type="text" [(ngModel)]="section.buttonUrl" [name]="'btn-url-' + i" />
              </div>
            </div>

            <div class="admin-field">
              <label [for]="'image-' + i">Image</label>
              @if (section.imageUrl) {
                <div class="admin-flex admin-gap" style="margin-bottom:.5rem;align-items:center">
                  <img [src]="section.imageUrl" alt="" width="96" height="64" style="object-fit:cover;border-radius:8px" />
                  <button class="admin-btn admin-btn-sm admin-btn-secondary" (click)="clearImage(i)">Remove image</button>
                </div>
              }
              <image-upload (uploaded)="onImage($event, i)" />
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class AdminContentPage {
  private readonly content = inject(AdminContentService);

  readonly loading = signal(true);
  readonly busyIndex = signal<number | null>(null);
  readonly error = signal('');
  readonly sections = signal<ContentSection[]>([]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const sections = await this.content.getSections('home');
      this.sections.set(sections);
    } catch (error) {
      this.error.set('Could not load sections: ' + (error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  add(): void {
    const sections = this.sections();
    const max = sections.reduce((top, section) => Math.max(top, section.sort), 0);
    const blank: ContentSection = {
      id: crypto.randomUUID(),
      page: 'home',
      key: 'section-' + crypto.randomUUID().slice(0, 8),
      eyebrow: '',
      title: '',
      subtitle: '',
      body: '',
      buttonLabel: '',
      buttonUrl: '',
      imageUrl: '',
      sort: max + 10,
      isVisible: true,
    };
    this.sections.set([...sections, blank]);
  }

  move(index: number, delta: number): void {
    const sections = this.sections();
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const [section] = sections.splice(index, 1);
    sections.splice(target, 0, section);
    this.sections.set([...sections]);
  }

  toggleVisibility(index: number, event: Event): void {
    const sections = this.sections();
    const section = sections[index];
    section.isVisible = (event.target as HTMLInputElement).checked;
    this.sections.set([...sections]);
  }

  clearImage(index: number): void {
    const sections = this.sections();
    sections[index].imageUrl = '';
    this.sections.set([...sections]);
  }

  async onImage(file: File, index: number): Promise<void> {
    const sections = this.sections();
    const section = sections[index];
    this.busyIndex.set(index);
    try {
      const url = await this.content.uploadImage(file, 'sections');
      section.imageUrl = url;
      this.sections.set([...sections]);
    } catch (error) {
      alert('Could not upload image: ' + (error as Error).message);
    } finally {
      this.busyIndex.set(null);
    }
  }

  async saveSection(index: number): Promise<void> {
    const sections = this.sections();
    const section = sections[index];
    this.busyIndex.set(index);
    try {
      if (section.id) {
        await this.content.saveSection(section);
      } else {
        const created = await this.content.createSection(section);
        section.id = created.id;
        this.sections.set([...sections]);
      }
    } catch (error) {
      alert('Could not save section: ' + (error as Error).message);
    } finally {
      this.busyIndex.set(null);
    }
  }

  async remove(index: number): Promise<void> {
    const sections = this.sections();
    const section = sections[index];
    if (!section.id) {
      sections.splice(index, 1);
      this.sections.set([...sections]);
      return;
    }
    if (!window.confirm('Delete this section? This cannot be undone.')) return;
    try {
      await this.content.deleteSection(section.id);
      sections.splice(index, 1);
      this.sections.set([...sections]);
    } catch (error) {
      alert('Could not delete section: ' + (error as Error).message);
    }
  }
}
