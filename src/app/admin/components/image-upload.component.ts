import { Component, OnDestroy, inject, output, signal } from '@angular/core';
import { AdminContentService } from '../services/admin-content.service';

@Component({
  selector: 'image-upload',
  standalone: true,
  template: `
    <div class="admin-image-picker">
      <label
        class="admin-upload-box"
        (dragover)="dragging.set(true)"
        (dragleave)="dragging.set(false)"
        (drop)="onDrop($event)"
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          (change)="onFile($event)"
          hidden
        />
        <span class="admin-upload-icon" aria-hidden="true">＋</span>
        <span>{{ busy() ? 'Uploading…' : 'Upload an image' }}</span>
        <small>PNG, JPG, WEBP · max 5 MB · or drag &amp; drop</small>
      </label>
      @if (error()) {
        <p class="admin-alert admin-alert-error" style="flex-basis:100%;margin:0">
          {{ error() }}
        </p>
      }
      @if (preview()) {
        <img [src]="preview()" alt="Preview of the image being uploaded" />
      }
    </div>
  `,
  styles: [
    `
      .admin-upload-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.3rem;
        min-width: 220px;
        padding: 1.4rem;
        border: 2px dashed rgba(201, 161, 95, 0.6);
        border-radius: 14px;
        background: #fdf8f1;
        cursor: pointer;
        color: #6f4e24;
        font-weight: 600;
        font-size: 0.9rem;
        text-align: center;
        transition:
          background 0.2s ease,
          border-color 0.2s ease;
      }
      .admin-upload-box:hover,
      .admin-upload-box.dragging {
        background: #f7edde;
        border-color: #c9a15f;
      }
      .admin-upload-icon {
        font-size: 1.4rem;
        line-height: 1;
      }
      .admin-upload-box small {
        font-weight: 400;
        font-size: 0.72rem;
        color: #a08b74;
      }
    `,
  ],
})
export class ImageUploadComponent implements OnDestroy {
  private readonly content = inject(AdminContentService);

  readonly uploaded = output<File>();
  readonly busy = signal(false);
  readonly error = signal('');
  readonly preview = signal<string | null>(null);
  readonly dragging = signal(false);

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.process(file);
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.process(file);
  }

  ngOnDestroy(): void {
    const current = this.preview();
    if (current) {
      URL.revokeObjectURL(current);
    }
  }

  private async process(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      this.error.set('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.error.set('Image must be under 5 MB.');
      return;
    }
    this.error.set('');
    const previous = this.preview();
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    this.busy.set(true);
    this.preview.set(URL.createObjectURL(file));
    try {
      this.uploaded.emit(file);
    } finally {
      this.busy.set(false);
    }
  }
}
