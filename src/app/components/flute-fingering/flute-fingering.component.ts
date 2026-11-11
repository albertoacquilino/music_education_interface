import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'flute-fingering',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <button type="button" class="diagram" (click)="open()" [attr.aria-label]="'Enlarge ' + alt">
      <img [src]="src" [alt]="alt">
      <span>Tap to enlarge</span>
    </button>
    <ion-modal [isOpen]="enlarged" (didDismiss)="enlarged = false">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Flute fingering</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="enlarged = false" aria-label="Close enlarged flute fingering">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
          <ion-toolbar>
            <ion-buttons>
              <ion-button (click)="setZoom(zoom - 0.5)" [disabled]="zoom <= 1" aria-label="Zoom out">−</ion-button>
              <ion-button (click)="setZoom(1)" aria-label="Reset zoom">{{ zoom * 100 }}%</ion-button>
              <ion-button (click)="setZoom(zoom + 0.5)" [disabled]="zoom >= 4" aria-label="Zoom in">+</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <div class="pan" tabindex="0" role="region" aria-label="Enlarged fingering; scroll to pan">
            <img [src]="enlargedSrc" [alt]="enlargedAlt" [style.width.%]="zoom * 100">
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    :host { display: block; width: 100%; min-width: 0; }
    .diagram { display: block; width: 100%; padding: 0; border: 0; border-radius: 8px;
      background: white; color: #222; cursor: zoom-in; }
    img { display: block; width: 100%; height: auto; object-fit: contain; background: white; }
    .diagram span { display: block; padding: .35rem; font-size: .85rem; }
    .diagram:focus-visible { outline: 3px solid #0079ad; outline-offset: 3px; }
    .pan { height: 100%; overflow: auto; background: white; }
    .pan img { max-width: none; }
  `]
})
export class FluteFingeringComponent {
  @Input() src = '';
  @Input() alt = 'Flute fingering';
  enlarged = false;
  enlargedSrc = '';
  enlargedAlt = '';
  zoom = 1;

  open(): void {
    // Freeze the diagram being examined; the exercise continues independently.
    this.enlargedSrc = this.src;
    this.enlargedAlt = this.alt;
    this.zoom = 1;
    this.enlarged = true;
  }

  setZoom(value: number): void {
    this.zoom = Math.max(1, Math.min(4, value));
  }
}
