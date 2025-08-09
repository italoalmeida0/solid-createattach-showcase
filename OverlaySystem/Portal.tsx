import { Component, createMemo, For, JSX, useContext } from 'solid-js';

import { OverlayContext } from './Provider';

/**
 * Portal component - renders overlays in a specific DOM location
 * Used for rendering modals, tooltips, and other overlays outside normal flow
 */
export const Portal: Component<{ target: string }> = (props): JSX.Element => {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error('Portal must be used within an OverlayProvider');
  }

  /**
   * Get all overlay components that should render in this portal
   * Efficient lookup using the overlay system's portal targeting
   */
  const PortalOverlays = createMemo(() => context.getOverlaysByPortal(props.target));

  return <For each={PortalOverlays()}>{(OverlayComponent) => <OverlayComponent />}</For>;
};