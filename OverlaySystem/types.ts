import { Component, JSX } from 'solid-js';
import type { MakeSchema, Optional, Event } from '../type';
import type { CreateBoolLazyFalseReturn } from '../createBoolLazyFalse/createAttach';
import type { ReturnCreateAttach } from '../createAttach';

// Event type for overlay lifecycle callbacks
export type OverlayEvent = Event;

// Schema definition for overlay component properties
// Used with omitProps/pickProps utilities for prop separation
export const OverlaySchema = {
  // Core overlay identification and control
  id: undefined as unknown as string,                                    // Unique overlay identifier
  elementRef: undefined as unknown as ReturnCreateAttach<HTMLDivElement>, // Element ref from createAttach
  contentComponent: undefined as unknown as Component,                   // Rendered overlay content
  wasScrollLocked: undefined as unknown as boolean,                     // Track scroll lock state
  
  // Rendering and positioning options
  portalTarget: undefined as Optional<string>,                          // Portal container selector
  hasBackdrop: undefined as Optional<boolean>,                         // Show backdrop overlay
  showWhen: undefined as Optional<() => boolean | undefined>,          // Conditional visibility
  
  // Behavior configuration
  lockScroll: undefined as Optional<boolean>,                          // Lock body scroll when open
  closeOnRouteChange: undefined as Optional<boolean>,                  // Auto-close on navigation
  closeOnOutsideClick: undefined as Optional<boolean>,                // Close when clicking outside
  closeOnEscape: undefined as Optional<boolean>,                      // Close on Escape key
  
  // Animation and styling
  visibilityState: undefined as unknown as CreateBoolLazyFalseReturn<HTMLDivElement>, // Animation state
  animationDelay: undefined as Optional<number>,                      // Animation timing
  initiallyVisible: undefined as Optional<boolean>,                   // Start visible
  enterClass: undefined as Optional<string>,                          // CSS class for enter animation
  exitClass: undefined as Optional<string>,                           // CSS class for exit animation
  
  // Lifecycle callbacks
  onBeforeClose: undefined as Optional<(event: OverlayEvent) => void>, // Before closing (cancelable)
  onAfterClose: undefined as Optional<(event: OverlayEvent) => void>,  // After fully closed
  onBeforeOpen: undefined as Optional<(event: OverlayEvent) => void>,  // Before opening (cancelable)
};

// Generated type from schema with proper optional/required inference
export type OverlayData = MakeSchema<typeof OverlaySchema>;

// Props interface for overlay component (excludes internal state)
export interface OverlayProps
  extends Omit<OverlayData, 'visibilityState' | 'contentComponent' | 'wasScrollLocked'>,
    JSX.HTMLAttributes<HTMLDivElement> {}

// Context interface for overlay system management
export interface OverlayContextValues {
  // Overlay registration and cleanup
  registerOverlay: (overlay: Omit<OverlayData, 'visibilityState' | 'wasScrollLocked'>) => void;
  unregisterOverlay: (id: string) => void;
  
  // Overlay control methods
  openOverlay: (id: string) => void;
  closeOverlay: (id: string) => void;
  
  // State query methods
  isOpen: (id: string) => boolean;
  isTopmost: (id: string) => boolean;
  hasConditionalVisibility: (id: string) => boolean;
  
  // Behavior query methods  
  shouldCloseOnRouteChange: (id: string) => boolean;
  shouldCloseOnOutsideClick: (id: string) => boolean;
  shouldCloseOnEscape: (id: string) => boolean;
  
  // Data access methods
  getOverlayById: (id: string) => OverlayData | undefined;
  getOverlaysByPortal: (portalTarget: string) => Component[];
}
