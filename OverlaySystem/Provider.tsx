/**
 * OverlaySystem Provider with createAttach approach
 * =================================================
 * 
 * ## When createAttach excels in complex overlay coordination:
 * 
 * ### 1. **Multi-Ref Coordination**
 * - Overlay element, trigger element, backdrop element refs
 * - Each overlay manages multiple DOM elements with different behaviors
 * - `onAttach` centralizes setup/cleanup for all overlay DOM interactions
 * - No manual tracking of element states across overlay lifecycle
 * 
 * ### 2. **Advanced Event Management**
 * - Click outside detection across multiple elements
 * - Escape key handling with proper event cleanup
 * - Document-level listeners that need coordination with element lifecycle
 * - Focus management and keyboard navigation setup
 * 
 * ### 3. **Portal and Dynamic DOM**
 * - Overlays render in different DOM locations (portals)
 * - Elements can be moved, recreated, or swapped during animations
 * - createAttach handles element references that survive DOM changes
 * - Automatic cleanup when overlay elements are removed from DOM
 * 
 * ### 4. **Animation and Timing Coordination**
 * - Complex enter/exit animations with multiple DOM elements
 * - Backdrop animations, content animations, focus animations
 * - createBoolLazyFalse integration for sophisticated timing control
 * - Cleanup coordination between animation states and DOM events
 * 
 * ### 5. **Global State with Local DOM**
 * - Central overlay management with distributed DOM elements
 * - Each overlay has its own DOM lifecycle but shared global state
 * - createAttach bridges the gap between global store and local DOM
 * 
 * ## Trade-offs:
 * 
 * ### 1. **Complexity Infrastructure**
 * - ~1KB createAttach + overlay system infrastructure
 * - Worth it for production-grade overlay systems
 * 
 * **Essential for**: Modal systems, dropdown menus, tooltips, popovers,
 * any UI requiring portal rendering with complex event coordination.
 */

import { createStore } from 'solid-js/store';
import {
  Component,
  createContext,
  createEffect,
  JSX,
  on,
  onCleanup,
  onMount,
  ParentProps,
  untrack,
  useContext,
} from 'solid-js';

import { Overlay } from './Overlay';
import { OverlayContextValues, OverlayEvent, OverlayData, OverlayProps } from './types';
import { createBoolLazyFalse } from '../createBoolLazyFalse/createAttach';
import { createAttach } from '../createAttach';

// Prefix for auto-generated overlay IDs
const OVERLAY_ID_PREFIX = 'overlay-';

// Context for overlay system state and methods
export const OverlayContext = createContext<OverlayContextValues>();

/**
 * Global overlay management provider
 * Handles overlay registration, state coordination, and scroll locking
 */
export const OverlayProvider: Component<ParentProps> = (props): JSX.Element => {
  // Central overlay store with efficient Map-based lookups (O(1))
  const [overlayStore, setOverlayStore] = createStore<{
    overlays: Map<string, OverlayData>;        // All registered overlays
    openOverlays: Set<string>;                 // Currently visible overlays  
    topmostOverlay: string | undefined;        // Last opened overlay (z-index)
    scrollLockCount: number;                   // Number of overlays requesting scroll lock
  }>({
    overlays: new Map(),
    openOverlays: new Set(),
    topmostOverlay: undefined,
    scrollLockCount: 0,
  });

  // Track saved scroll position for scroll lock restoration
  let savedScrollY = -1;

  /**
   * Global scroll lock management
   * Automatically locks/unlocks body scroll based on overlay count
   * Restores exact scroll position when all overlays close
   */
  createEffect(() => {
    const scrollLockCount = overlayStore.scrollLockCount;
    
    // Lock scroll when first overlay with scroll lock opens
    if (scrollLockCount > 0 && savedScrollY === -1) {
      savedScrollY = window.scrollY;
      document.documentElement.dataset.scrollLocked = 'true';
    } 
    // Restore scroll when last overlay with scroll lock closes
    else if (scrollLockCount <= 0 && savedScrollY !== -1) {
      document.documentElement.dataset.scrollLocked = 'false';
      window.scrollTo(0, savedScrollY);
      savedScrollY = -1;
    }
    
    // Defensive: prevent negative count
    if (scrollLockCount < 0) setOverlayStore('scrollLockCount', 0);
  });

  /**
   * Global cleanup on provider unmount
   * Ensures no memory leaks from overlay system
   */
  onCleanup(() => {
    // Restore scroll if locked
    if (savedScrollY !== -1) {
      document.documentElement.dataset.scrollLocked = 'false';
      window.scrollTo(0, savedScrollY);
    }
    
    // Cleanup all overlay states and refs
    for (const overlay of overlayStore.overlays.values()) {
      overlay.visibilityState.cleanup();
      overlay.elementRef.detach();
    }
    
    // Clear store
    setOverlayStore('overlays', new Map());
    setOverlayStore('openOverlays', new Set());
  });

  /**
   * Internal helper for overlay visibility state management
   * Handles scroll lock counting and topmost overlay tracking
   */
  const updateOverlayVisibilityState = (
    id: string,
    shouldLockScroll: boolean,
    isOpening: boolean
  ) => {
    const wasAlreadyOpen = overlayStore.openOverlays.has(id);

    // Update open overlays set
    setOverlayStore('openOverlays', (prev) => {
      const newSet = new Set(prev);
      if (isOpening) {
        newSet.delete(id);  // Remove first to ensure it's added at end
        newSet.add(id);     // Add at end (becomes topmost)
        setOverlayStore('topmostOverlay', id);
      } else {
        newSet.delete(id);
        // Set new topmost (last in set)
        const remainingOverlays = Array.from(newSet);
        setOverlayStore('topmostOverlay', remainingOverlays.at(-1) || undefined);
      }
      return newSet;
    });

    // Update scroll lock count
    if (shouldLockScroll) {
      if (isOpening && !wasAlreadyOpen) {
        setOverlayStore('scrollLockCount', (prev) => prev + 1);
      } else if (!isOpening && wasAlreadyOpen) {
        setOverlayStore('scrollLockCount', (prev) => prev - 1);
      }
    }
  };

  /**
   * Register a new overlay in the system
   * Creates visibility state and sets up animation coordination
   */
  const registerOverlay = (overlay: Omit<OverlayData, 'visibilityState' | 'wasScrollLocked'>) => {
    // Handle initial visibility and onBeforeOpen callback
    let shouldStartVisible = overlay.initiallyVisible ?? false;
    if (overlay.onBeforeOpen) {
      const event: OverlayEvent = { cancel: false };
      overlay.onBeforeOpen(event);
      if (event.cancel) shouldStartVisible = false;
    }

    // Track scroll lock state for this overlay
    let wasScrollLocked = false;
    untrack(() => {
      wasScrollLocked = shouldStartVisible && (overlay.lockScroll ?? true);
    });

    // Register overlay with visibility state
    setOverlayStore('overlays', (prev) => {
      const newMap = new Map(prev);
      newMap.set(overlay.id, {
        ...overlay,
        visibilityState: createBoolLazyFalse(shouldStartVisible, {
          ref: overlay.elementRef,
          delay: overlay.animationDelay ?? 0,
          classIn: overlay.enterClass,
          classOut: overlay.exitClass,
        }),
        wasScrollLocked,
      });
      return newMap;
    });

    // Update global state if starting visible
    if (shouldStartVisible) {
      untrack(() => {
        updateOverlayVisibilityState(overlay.id, wasScrollLocked, true);
      });
    }
  };

  /**
   * Unregister overlay from system
   * Cleans up all state and refs
   */
  const unregisterOverlay = (id: string) => {
    const overlay = overlayStore.overlays.get(id);
    if (!overlay) return;

    let shouldUpdateScrollLock = false;
    
    setOverlayStore('overlays', (prev) => {
      const newMap = new Map(prev);
      const overlay = prev.get(id);
      if (!overlay) return newMap;
      
      // Track scroll lock for cleanup
      untrack(() => {
        shouldUpdateScrollLock = overlay.wasScrollLocked;
      });
      
      // Cleanup overlay state
      overlay.visibilityState.cleanup();
      overlay.elementRef.detach();
      newMap.delete(id);
      return newMap;
    });

    // Update global visibility state
    untrack(() => {
      updateOverlayVisibilityState(id, shouldUpdateScrollLock, false);
    });
  };

  /**
   * Open an overlay
   * Handles animation and state coordination
   */
  const openOverlay = (id: string) => {
    const overlay = overlayStore.overlays.get(id);
    if (!overlay) return;

    // Handle onBeforeOpen callback (cancelable)
    if (overlay.onBeforeOpen) {
      const event: OverlayEvent = { cancel: false };
      overlay.onBeforeOpen(event);
      if (event.cancel) return;
    }

    // Start visibility animation with callback for state update
    overlay.visibilityState.set(true, () => {
      untrack(() => {
        overlay.wasScrollLocked = overlay.lockScroll ?? true;
        updateOverlayVisibilityState(id, overlay.wasScrollLocked, true);
      });
    });
  };

  /**
   * Close an overlay
   * Handles animation and cleanup
   */
  const closeOverlay = (id: string) => {
    const overlay = overlayStore.overlays.get(id);
    if (!overlay) return;

    // Handle onBeforeClose callback (cancelable)
    if (overlay.onBeforeClose) {
      const event: OverlayEvent = { cancel: false };
      overlay.onBeforeClose(event);
      if (event.cancel) return;
    }

    // Start exit animation with cleanup callback
    overlay.visibilityState.set(false, () => {
      // Handle onAfterClose callback
      if (overlay.onAfterClose) {
        const event: OverlayEvent = { cancel: false };
        overlay.onAfterClose(event);
        if (event.cancel) return;
      }
      
      // Cleanup element refs
      overlay.elementRef.detach();
      
      // Update global state
      untrack(() => {
        updateOverlayVisibilityState(id, overlay.wasScrollLocked, false);
      });
    });
  };

  /**
   * Query methods for overlay state
   * All O(1) lookups using Map/Set
   */
  const isOpen = (id: string): boolean => overlayStore.openOverlays.has(id);
  const isTopmost = (id: string): boolean => overlayStore.topmostOverlay === id;
  const hasConditionalVisibility = (id: string): boolean => {
    const overlay = overlayStore.overlays.get(id);
    return !!(overlay?.showWhen);
  };

  /**
   * Behavior query methods
   * Returns overlay configuration with safe defaults
   */
  const getBehaviorProps = (id: string) => {
    const overlay = overlayStore.overlays.get(id);
    const defaults = {
      closeOnRouteChange: true,
      closeOnOutsideClick: true,
      closeOnEscape: true,
    };
    if (!overlay) return defaults;
    
    return {
      closeOnRouteChange: overlay.closeOnRouteChange ?? defaults.closeOnRouteChange,
      closeOnOutsideClick: overlay.closeOnOutsideClick ?? defaults.closeOnOutsideClick,
      closeOnEscape: overlay.closeOnEscape ?? defaults.closeOnEscape,
    };
  };

  const shouldCloseOnRouteChange = (id: string) => getBehaviorProps(id).closeOnRouteChange;
  const shouldCloseOnOutsideClick = (id: string) => getBehaviorProps(id).closeOnOutsideClick;
  const shouldCloseOnEscape = (id: string) => getBehaviorProps(id).closeOnEscape;

  /**
   * Data access methods
   */
  const getOverlayById = (id: string): OverlayData | undefined => overlayStore.overlays.get(id);
  
  const getOverlaysByPortal = (portalTarget: string): Component[] => {
    return Array.from(overlayStore.overlays.values())
      .filter((overlay) => overlay.portalTarget === portalTarget)
      .map((overlay) => overlay.contentComponent);
  };

  // Context value with all methods
  const contextValue: OverlayContextValues = {
    registerOverlay,
    unregisterOverlay,
    openOverlay,
    closeOverlay,
    isOpen,
    isTopmost,
    hasConditionalVisibility,
    shouldCloseOnRouteChange,
    shouldCloseOnOutsideClick,
    shouldCloseOnEscape,
    getOverlayById,
    getOverlaysByPortal,
  };

  return (
    <OverlayContext.Provider value={contextValue}>
      {props.children}
    </OverlayContext.Provider>
  );
};

/**
 * Hook for using overlay system
 * Creates a new overlay instance with unique ID and coordinated refs
 */
export function useOverlay() {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error('useOverlay must be used within an OverlayProvider');
  }

  // Generate unique ID for this overlay instance
  const overlayId = `${OVERLAY_ID_PREFIX}${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;

  // Create refs using createAttach for automatic lifecycle management
  const overlayElementRef = createAttach<HTMLDivElement>();
  const triggerElementRef = createAttach<HTMLElement>((el) => {
    // No need to check if element exists - onAttach guarantees it
    el.addEventListener('click', toggleOverlay);
    
    // Return cleanup function - called automatically by createAttach
    return () => el.removeEventListener('click', toggleOverlay);
  });

  /**
   * Auto-close on route changes (if enabled)
   * Uses simple route detection - in real app would integrate with router
   */
  createEffect(
    on(
      () => window.location.pathname, // Simple route tracking for demo
      () => {
        if (context.shouldCloseOnRouteChange(overlayId)) {
          closeOverlay();
        }
      },
      { defer: true }
    )
  );

  // Control methods
  const openOverlay = () => context.openOverlay(overlayId);
  const closeOverlay = () => context.closeOverlay(overlayId);
  const toggleOverlay = () => {
    if (context.hasConditionalVisibility(overlayId)) return;
    if (context.isOpen(overlayId)) {
      closeOverlay();
    } else {
      openOverlay();
    }
  };

  /**
   * Click outside detection
   * Uses createAttach refs for safe element access
   */
  const handleClickOutside = (e: MouseEvent | FocusEvent) => {
    const overlayElement = overlayElementRef.attachment();
    const triggerElement = triggerElementRef.attachment();
    
    if (
      context.isTopmost(overlayId) &&
      context.shouldCloseOnOutsideClick(overlayId) &&
      overlayElement &&
      triggerElement &&
      e.target instanceof Node &&
      !overlayElement.contains(e.target) &&
      !triggerElement.contains(e.target)
    ) {
      closeOverlay();
    }
  };

  /**
   * Escape key handling
   */
  const handleEscapeKey = (e: KeyboardEvent) => {
    if (
      e.key === 'Escape' &&
      context.isTopmost(overlayId) &&
      context.shouldCloseOnEscape(overlayId)
    ) {
      e.preventDefault();
      closeOverlay();
    }
  };

  /**
   * Setup global event listeners
   * Automatic cleanup on component disposal
   */
  onMount(() => {
    if (!globalThis.document) return;
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('focusin', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
  });

  onCleanup(() => {
    if (!globalThis.document) return;
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('focusin', handleClickOutside);
    document.removeEventListener('keydown', handleEscapeKey);
    
    // Close if still open and cleanup
    if (context.isOpen(overlayId)) closeOverlay();
    overlayElementRef.detach();
    
    const triggerEl = triggerElementRef.attachment();
    if (triggerEl) triggerEl.removeEventListener('click', toggleOverlay);
    triggerElementRef.detach();
  });

  return {
    // State accessors
    isOpen: () => context.isOpen(overlayId),
    isVisible: () => context.getOverlayById(overlayId)?.visibilityState.bool(),
    
    // Control methods
    open: openOverlay,
    close: closeOverlay,
    toggle: toggleOverlay,
    
    // Component factory with pre-configured ID and ref
    Overlay: (props: Omit<OverlayProps, 'id' | 'elementRef'>) => (
      <Overlay {...props} id={overlayId} elementRef={overlayElementRef} />
    ),
    
    // Trigger ref setter for consumer elements
    setTrigger: triggerElementRef.attach,
  };
}