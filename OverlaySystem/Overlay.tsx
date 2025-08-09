import {
  Component,
  createEffect,
  createMemo,
  JSX,
  on,
  onCleanup,
  onMount,
  ParentProps,
  Show,
  useContext,
} from 'solid-js';

import { OverlayContext } from './Provider';
import { OverlayProps, OverlaySchema } from './types';
import { exeIsFunc, omitProps, RefRef } from '../createAttach';

/**
 * Overlay component - renders individual overlay with backdrop and portal support
 * Integrates with OverlayProvider for global state management
 */
export const Overlay: Component<OverlayProps> = (props): JSX.Element => {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error('Overlay must be used within an OverlayProvider');
  }

  /**
   * Backdrop component - optional overlay background
   * Handles click-to-close behavior when enabled
   */
  const Backdrop: Component<ParentProps> = (backdropProps) =>
    (props.portalTarget && (
      <div
        data-type="overlay-backdrop"
        data-has-backdrop={props.hasBackdrop ?? 'false'}
        onClick={() => {
          if (props.closeOnOutsideClick !== false) {
            context.closeOverlay(props.id);
          }
        }}
      >
        {backdropProps.children}
      </div>
    )) || <>{backdropProps.children}</>;

  /**
   * Handle overlay clicks - prevent event bubbling to backdrop
   */
  const handleOverlayClick = (e: MouseEvent) => {
    e.stopImmediatePropagation();
    exeIsFunc(props.onClick, e);
  };

  /**
   * Register overlay with provider on mount
   * Creates visibility state and animation coordination
   */
  onMount(() => {
    context.registerOverlay({
      ...props,
      id: props.id,
      contentComponent: (): JSX.Element => (
        <Show when={context.isOpen(props.id)}>
          <Backdrop>
            <div
              {...omitProps(props, OverlaySchema)}
              onClick={handleOverlayClick}
              data-type="overlay-content"
              ref={RefRef(props.ref, props.elementRef.attach)}
            />
          </Backdrop>
        </Show>
      ),
    });
  });

  /**
   * Handle conditional visibility (showWhen prop)
   * Automatically opens/closes overlay based on reactive condition
   */
  const conditionalVisibility = createMemo(() => props.showWhen && props.showWhen());

  createEffect(
    on(conditionalVisibility, () => {
      if (!props.showWhen) return;
      
      if (conditionalVisibility()) {
        context.openOverlay(props.id);
      } else {
        context.closeOverlay(props.id);
      }
    })
  );

  /**
   * Cleanup on unmount
   * Removes overlay from global registry
   */
  onCleanup(() => {
    context.unregisterOverlay(props.id);
  });

  /**
   * Get rendered content component from registry
   * Returns the registered overlay content or empty fragment
   */
  const ContentComponent = createMemo(() => {
    const overlayData = context.getOverlayById(props.id);
    return ((!props.portalTarget && overlayData && overlayData.contentComponent({})) ?? 
            ((): JSX.Element => <></>)) as Component;
  });

  return <>{ContentComponent()}</>;
};