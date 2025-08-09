## Solid 2.0 Core Implementation Proposal: `createAttachment`

### Core API Example

```typescript
import { createAttachment, createEffect, Show, For } from 'solid-js';

function CompleteExample(props: { ref?: any }) {
  // Basic usage - single element attachment
  const containerAttachment = createAttachment<HTMLDivElement>();
  
  // Multiple attachments for complex coordination
  const headerAttachment = createAttachment<HTMLElement>();
  const listAttachment = createAttachment<HTMLUListElement>();
  const inputAttachment = createAttachment<HTMLInputElement>();
  
  // ===== Reactive Access (for effects) =====
  createEffect(() => {
    // .current is reactive - triggers on attach/detach
    const container = containerAttachment.current;
    if (container) {
      console.log('Container mounted:', container.clientHeight);
    }
  });
  
  // ===== Non-Reactive Access (for event handlers) =====
  const handleScroll = (e: Event) => {
    // .get() is non-reactive - no tracking
    const header = headerAttachment.get();
    const container = containerAttachment.get();
    
    if (header && container) {
      header.classList.toggle('shadow', container.scrollTop > 0);
    }
  };
  
  // ===== Lifecycle Management =====
  
  // Named handler for easy debugging
  containerAttachment.on('attach', (el) => {
    console.log('Setting up container');
    
    // Multiple observers on same element
    const resizeObs = new ResizeObserver(() => {
      console.log('Container resized');
    });
    resizeObs.observe(el);
    
    const intersectionObs = new IntersectionObserver((entries) => {
      console.log('Visibility changed:', entries[0].isIntersecting);
    });
    intersectionObs.observe(el);
    
    // Return cleanup - runs on detach
    return () => {
      resizeObs.disconnect();
      intersectionObs.disconnect();
    };
  }, 'observers'); // Named key for granular control
  
  // One-time initialization
  inputAttachment.once('attach', (input) => {
    input.focus();
    input.select();
  });
  
  // ===== Advanced Patterns =====
  
  // Conditional attachment with Show
  const [showExtra, setShowExtra] = createSignal(false);
  const extraAttachment = createAttachment<HTMLDivElement>();
  
  extraAttachment.on('attach', () => {
    console.log('Extra panel attached');
    return () => console.log('Extra panel detached');
  });
  
  // Dynamic list with multiple attachments
  const [items, setItems] = createSignal([
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' }
  ]);
  
  // Map to store attachments per item
  const itemAttachments = new Map<number, ReturnType<typeof createAttachment>>();
  
  // ===== Ref Composition (Array Refs) =====
  // Native support for multiple refs on same element
  return (
    <div 
      ref={[containerAttachment, props.ref]} 
      class="container"
      onScroll={handleScroll}
    >
      <header ref={headerAttachment}>
        <h1>Solid 2.0 Attachment System</h1>
      </header>
      
      <div class="toolbar">
        <input
          ref={inputAttachment}
          placeholder="Auto-focused input"
          onBlur={() => {
            // Access in event without reactivity
            const input = inputAttachment.get();
            console.log('Input value:', input?.value);
          }}
        />
        
        <button onClick={() => setShowExtra(!showExtra())}>
          Toggle Extra Panel
        </button>
        
        <button onClick={() => {
          // Manually detach specific handler
          containerAttachment.off('attach', 'observers');
        }}>
          Stop Observing
        </button>
      </div>
      
      <Show when={showExtra()}>
        <div ref={extraAttachment} class="extra-panel">
          Extra content that tracks mount/unmount
        </div>
      </Show>
      
      <ul ref={listAttachment}>
        <For each={items()}>
          {(item) => {
            // Create attachment for each item if not exists
            if (!itemAttachments.has(item.id)) {
              const attachment = createAttachment<HTMLLIElement>();
              
              attachment.on('attach', (el) => {
                console.log(`Item ${item.id} mounted`);
                el.style.opacity = '0';
                requestAnimationFrame(() => {
                  el.style.transition = 'opacity 0.3s';
                  el.style.opacity = '1';
                });
              });
              
              itemAttachments.set(item.id, attachment);
            }
            
            return (
              <li ref={itemAttachments.get(item.id)}>
                {item.name}
              </li>
            );
          }}
        </For>
      </ul>
      
      {/* Traditional refs still work! */}
      <footer ref={(el) => console.log('Footer:', el)}>
        <p>© 2025 - Backward compatible with all ref patterns</p>
      </footer>
    </div>
  );
}

// ===== Usage in Library Code =====
// How primitives could be built on top of createAttachment

export function createClickOutside<T extends Element>(
  attachment: ReturnType<typeof createAttachment<T>>,
  handler: () => void
) {
  const handleClick = (e: MouseEvent) => {
    const el = attachment.get();
    if (el && !el.contains(e.target as Node)) {
      handler();
    }
  };
  
  attachment.on('attach', () => {
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, 'click-outside');
}

// ===== Utility for Migration =====
// Helper to convert old refs to attachments

export function refToAttachment<T extends Element>(
  refSetter: (el: T) => void
): ReturnType<typeof createAttachment<T>> {
  const attachment = createAttachment<T>();
  attachment.on('attach', refSetter);
  return attachment;
}

// ===== TypeScript Support =====
// Full type inference and safety

type AttachmentType<T extends Element> = {
  readonly current: T | undefined;  // Reactive getter
  get(): T | undefined;             // Non-reactive getter
  attach(el: T | undefined): void;  // Used by JSX
  on(event: 'attach', handler: (el: T) => void | (() => void), key?: string | symbol): () => void;
  on(event: 'detach', handler: () => void, key?: string | symbol): () => void;
  off(event?: 'attach' | 'detach', key?: string | symbol): void;
  once(event: 'attach', handler: (el: T) => void): () => void;
};

// ===== Performance Note =====
/*
 * Zero overhead for existing code - only pay for what you use
 * Attachments are lazy - no cost until actually attached
 * Named keys enable surgical cleanup without affecting other handlers
 * Non-reactive .get() prevents unnecessary computations
 */
```

### Key Features in Solid 2.0 Core:

1. **Native Array Ref Support**: `ref={[attachment1, attachment2, callback, signal]}`
2. **Dual Access Patterns**: `.current` (reactive) vs `.get()` (non-reactive)
3. **Named Handlers**: Granular control with debugging benefits
4. **Automatic Cleanup**: Return cleanup functions from handlers
5. **Full Backward Compatibility**: All existing ref patterns continue working
6. **TypeScript First**: Complete type inference and safety
7. **Zero Breaking Changes**: Purely additive API
