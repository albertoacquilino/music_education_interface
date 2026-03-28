/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Haptics } from '@capacitor/haptics';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CommonModule } from '@angular/common';
import { Howl } from 'howler';

const TICK_SOUND = new Howl({ src: ['assets/sounds/tick_weak.m4a'] });

/**
 * ScrollImageComponent is a component that allows users to scroll through a list of images.
 * It provides a smooth scrolling experience and updates the currently displayed image based on the scroll position or by clicking.
 * 
 * @example
 * <scroll-image-component [images]="imageList" [index]="currentIndex" (indexChange)="onIndexChange($event)"></scroll-image-component>
 */
@Component({
    selector: 'scroll-image-component',
    template: `
    <div class="container">
      <div class="scroll-hint">Drag ↑ ↓</div>
      <div class="image-container">
        <img [src]="image">
      </div>

      <div class="scrollable" 
            #scrollContainer 
            (scroll)="onScroll()"
            (click)="onClick($event)">
            <div *ngFor="let image of images;" class="scroll-element" [style.height]="scrollElementHeight + 'px'">
            </div>
            <div *ngFor="let i of images" class="scroll-element" [style.height]="scrollElementHeight + 'px'"></div>
      </div>
    </div>
    `,
    styles: [`
    .container {
      --note-preview-scale: 1;
      --note-preview-inset-top: 0.45rem;
      --note-preview-inset-inline: 0.75rem;
      --note-preview-inset-bottom: 0.75rem;
      position: relative;
      height: 300px; /* Set the desired height */
      width: 100%; /* Set the desired width */
      padding-top: 2rem;
      background-color: var(--note-modal-bg, #ffffff);
      color: var(--note-modal-text, #000000);
      overscroll-behavior-y: contain;
      box-sizing: border-box;
    }

    .scroll-hint {
      position: absolute;
      top: 0.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2;
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-align: center;
      white-space: nowrap;
      color: var(--note-modal-text, #000000);
    }

    .scrollable {
      position: absolute;
      top: 2rem;
      left: 0;
      overflow-y: scroll;
      height: calc(100% - 2rem);
      width: 100%;
      scroll-snap-type: y proximity;
    }

    .scroll-element {
        width: 100%;
    }

    .image-container {
      position: absolute;
      top: 2rem;
      left: 0;
      height: calc(100% - 2rem);
      width: 100%;
      background-color: var(--note-modal-bg, #ffffff);
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      padding:
        var(--note-preview-inset-top)
        var(--note-preview-inset-inline)
        var(--note-preview-inset-bottom);
    }

    .image-container img {
      height: 100%;
      width: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      object-position: center;
      transform: scale(var(--note-preview-scale));
      transform-origin: center center;
    }

    @media screen and (max-width: 480px) {
      .container {
        padding-top: 1.75rem;
      }

      .scroll-hint {
        top: 0.35rem;
        font-size: 0.78rem;
      }

      .scrollable,
      .image-container {
        top: 1.75rem;
        height: calc(100% - 1.75rem);
      }
    }

    @media screen and (orientation: landscape) and (max-height: 520px) {
      .container {
        --note-preview-scale: 0.88;
        --note-preview-inset-top: 0.9rem;
        --note-preview-inset-inline: 1.25rem;
        --note-preview-inset-bottom: 1rem;
      }

      .scroll-hint {
        top: 0.3rem;
        font-size: 0.76rem;
      }
    }
    `],
    standalone: true,
    imports: [IonicModule, CommonModule, FontAwesomeModule],
})
export class ScrollImageComponent implements AfterViewInit, OnChanges {
    /** 
     * Input property for the list of image URLs.
     * 
     * This property accepts an array of strings representing the image URLs to be displayed.
     */
    @Input() images: string[] = [];

    /** 
     * Input property for the currently selected index.
     * 
     * This property determines which image is currently displayed based on its index in the images array.
     */
    @Input() index: number = 0;

    /** 
     * Input property for the height of each scrollable element.
     * 
     * This property sets the height of each image element in the scrollable area.
     */
    @Input() scrollElementHeight: number = 30;

    /** 
     * Output event emitter that emits the current index when it changes.
     * 
     * This event is emitted whenever the user scrolls or clicks to select a new image.
     */
    @Output() indexChange: EventEmitter<number> = new EventEmitter<number>();

    /** 
     * The currently displayed image URL.
     * 
     * This property is updated based on the current index.
     */
    image!: string;

    /** 
     * Timeout reference for snapping the scroll position.
     */
    snapTimeout: ReturnType<typeof setTimeout> | null = null;

    /** 
     * Reference to the scroll container element.
     */
    @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

    /**
     * Constructor for the ScrollImageComponent.
     */
    constructor() {}

    private isCompactLandscape(): boolean {
        return window.matchMedia('(orientation: landscape)').matches && window.innerHeight <= 520;
    }

    private getSelectionBounds(containerHeight: number) {
        const topInsetRatio = this.isCompactLandscape() ? 0.15 : 0.08;
        const bottomInsetRatio = this.isCompactLandscape() ? 0.12 : 0.06;
        const top = containerHeight * topInsetRatio;
        const height = Math.max(containerHeight * (1 - topInsetRatio - bottomInsetRatio), 1);
        return { top, height };
    }

    /**
     * Lifecycle hook that is called after the view has been initialized.
     * 
     * This method sets the initial image based on the provided index and adjusts the scroll position.
     */
    ngAfterViewInit() {
        if (this.index <= 0) {
            this.index = 0;
        }
        this.image = this.images[this.index];
        this.setScrollPositionFromIndex(this.index);
    }

    /**
     * Sets the scroll position based on the provided index.
     * 
     * This method calculates the scroll position and scrolls the container to that position.
     * 
     * @param idx - The index of the image to scroll to.
     */
    setScrollPositionFromIndex(idx: number) {
        const position = idx * this.scrollElementHeight;
        console.log('scroll to', position);
        setTimeout(() => {
            this.scrollContainer.nativeElement.scrollTo({ top: position, behavior: 'auto' });    
        }, 100);
    }

    /**
     * Lifecycle hook that is called when any data-bound property of a directive changes.
     * 
     * This method updates the current index and image when the input properties change.
     * 
     * @param changes - An object that contains the changed properties.
     */
    ngOnChanges(changes: SimpleChanges): void {
        if (changes['index']) {
            const idx = changes['index'].currentValue;
            if (idx !== this.index) {
                this.index = idx;
                this.image = this.images[idx];
                this.setScrollPositionFromIndex(idx);
            }
        }

        if (changes['images']) {
            this.images = changes['images'].currentValue;
        }
    }

    drag($event: any) {
        console.log('dragging', $event);
    }
    /**
     * Handles the scroll event of the scrollable container.
     * 
     * This method updates the current index based on the scroll position and emits the indexChange event.
     */
    onScroll() {
        // cancel timeout
        if (this.snapTimeout) {
            clearTimeout(this.snapTimeout);
            this.snapTimeout = null;
        }

        const element = this.scrollContainer.nativeElement;
        const scrollPosition = element.scrollTop;

        console.log('scroll position', scrollPosition);

        let idx = Math.round(scrollPosition / this.scrollElementHeight);
        idx = Math.min(idx, this.images.length - 1);
        idx = Math.max(idx, 0);

        if(idx !== this.index) {
            //TICK_SOUND.play();
            Haptics.selectionChanged();
        }
        
        this.index = idx;
        this.image = this.images[this.index];
        this.indexChange.emit(this.index);

              this.snapTimeout = setTimeout(() => {
            // snap to the nearest note
            const snapTo = idx * this.scrollElementHeight;
            element.scrollTo({ top: snapTo, behavior: 'smooth' });
            this.snapTimeout = null;
        }, 100);
    }

    /**
     * Handles the click event on the scrollable container.
     * 
     * This method calculates the index based on the click position and updates the current index and image.
     * 
     * @param event - The mouse click event.
     */
    onClick(event: MouseEvent) {
        const element = this.scrollContainer.nativeElement;
        const containerHeight = element.clientHeight; // Height of the scrollable container
        const clickPosition = event.clientY - element.getBoundingClientRect().top; // Y-position relative to container
        const { top, height } = this.getSelectionBounds(containerHeight);
        const relativePosition = Math.max(0, Math.min(1, (clickPosition - top) / height));

        // Map the visible staff height to the full note range, with higher taps selecting higher notes.
        const idx = Math.round((1 - relativePosition) * (this.images.length - 1));

        // Ensure the index stays within valid bounds
        const boundedIndex = Math.max(0, Math.min(this.images.length - 1, idx));

        if (boundedIndex !== this.index) {
            Haptics.selectionChanged();
        }

        this.index = boundedIndex;
        this.image = this.images[this.index];
        this.indexChange.emit(this.index);

        // Scroll smoothly to the selected image position
        const snapTo = boundedIndex * this.scrollElementHeight;
        element.scrollTo({ top: snapTo, behavior: 'smooth' });
    }
}
