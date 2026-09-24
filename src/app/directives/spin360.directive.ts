import { Directive, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';

export type Spin360Mode = 'spin' | 'tilt';

/**
 * Adds a hover-driven 3D effect to any element.
 * - mode "spin": the element rotates 360° on the Y axis while hovered.
 * - mode "tilt": the element tilts toward the cursor (rotateX/rotateY via CSS vars).
 * Automatically disabled on touch-only devices and respects prefers-reduced-motion.
 */
@Directive({
  selector: '[app360]',
  standalone: true,
})
export class Spin360Directive implements OnInit, OnDestroy {
  @Input() app360: Spin360Mode = 'tilt';
  @Input() maxTilt = 9;

  private readonly el = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly cleanup: Array<() => void> = [];
  private readonly supportsHover =
    typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
  private readonly reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private raf = 0;
  private tiltX = 0;
  private tiltY = 0;

  ngOnInit(): void {
    if (!this.supportsHover) {
      return;
    }

    if (this.app360 === 'tilt') {
      this.el.classList.add('spin-tilt');
      this.cleanup.push(this.on('mousemove', (event: Event) => this.track(event as MouseEvent)));
      this.cleanup.push(this.on('mouseleave', () => this.resetTilt()));
    } else if (this.app360 === 'spin' && !this.reduceMotion) {
      this.el.classList.add('spin-image');
      this.cleanup.push(this.on('mouseenter', () => this.el.classList.add('is-spinning')));
      this.cleanup.push(this.on('mouseleave', () => this.el.classList.remove('is-spinning')));
    }
  }

  private on(event: string, handler: EventListener): () => void {
    this.el.addEventListener(event, handler);
    return () => this.el.removeEventListener(event, handler);
  }

  private track(event: MouseEvent): void {
    if (this.reduceMotion) {
      return;
    }
    const rect = this.el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    this.tiltY = x * 2 * this.maxTilt;
    this.tiltX = -y * 2 * this.maxTilt;
    this.schedule();
  }

  private schedule(): void {
    if (this.raf) {
      return;
    }
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.el.style.setProperty('--tilt-x', `${this.tiltX.toFixed(2)}deg`);
      this.el.style.setProperty('--tilt-y', `${this.tiltY.toFixed(2)}deg`);
    });
  }

  private resetTilt(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.el.style.setProperty('--tilt-x', '0deg');
    this.el.style.setProperty('--tilt-y', '0deg');
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((remove) => remove());
  }
}