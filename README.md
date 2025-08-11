# solid-createAttach-showcase

Practical examples comparing `createAttach` with traditional Solid.js approaches for DOM reference management.

Created to help the Solid.js team evaluate real-world usage patterns and understand where each approach excels.

## Background

This showcase emerged from discussions in [PR #807](https://github.com/solidjs-community/solid-primitives/pull/807) where I proposed `createAttach` as a solution for SSR-safe DOM interactions. The Solid team provided valuable feedback about use cases, trade-offs, and design considerations.

Rather than theoretical examples, this repository demonstrates both approaches in realistic scenarios I've encountered in production.

## Project Structure

Each component has two implementations side-by-side:

```
ComponentName/
├── createAttach.tsx    # Using createAttach approach
└── solidDefault.tsx    # Using traditional Solid.js primitives
```

## Components Demonstrated

### **Button** (`/Button/`)
- **Scenario**: Polymorphic button with ripple effects
- **Complexity**: DOM manipulation + event coordination
- **Key differences**: Ref composition, cleanup management

### **LazyImg** (`/LazyImg/`)  
- **Scenario**: Lazy loading with IntersectionObserver
- **Complexity**: Observer lifecycle + element swapping
- **Key differences**: Observer setup/cleanup patterns

### **OverlaySystem** (`/OverlaySystem/`)
- **Scenario**: Modal system with global state management
- **Complexity**: Multi-ref coordination, portal rendering, event delegation
- **Note**: Only `createAttach` version provided - traditional approach would be impractical

### **createPagedScroll** (`/createPagedScroll/`)
- **Scenario**: Horizontal scroll with navigation buttons  
- **Complexity**: Multiple observers (Resize, Mutation, Scroll) + debouncing
- **Key differences**: Observer coordination, cleanup complexity

### **createBoolLazyFalse** (`/createBoolLazyFalse/`)
- **Scenario**: Animation-aware boolean state for exit transitions
- **Complexity**: Element querying, animation timing
- **Key differences**: Element access patterns within effects

## Core Utilities

### **createAttach** (`/createAttach.ts`)
The main primitive providing:
- `attach`: JSX callback-ref 
- `attachment()`: Non-reactive element accessor
- `onAttach()`: Lifecycle handlers with cleanup
- `detach()`: Granular cleanup control
- `RefRef()`: Ref composition utility

### **Supporting Types & Utils** 
- `type.ts`: TypeScript utilities for schema-based props
- `utils.ts`: Prop filtering and data attribute helpers

## When Each Approach Works Best

### Traditional Solid.js primitives excel when:
- Simple, direct DOM operations
- One-time setup without complex lifecycle needs  
- Full transparency and control are priorities
- Zero abstraction overhead is important

### createAttach excels when:
- Multiple refs need coordination
- Complex observer setup/cleanup is required
- Element swapping during development (HMR)
- Ref composition with consumer code is needed
- Late-mounting elements need queued operations

## Running the Examples

This is a showcase repository - examples are meant to be read and analyzed rather than executed. Each file contains extensive comments explaining the approach and trade-offs.

## Architecture Benefits

This showcase demonstrates both **high-level design system components** and **simple wrapper patterns**, showing how `createAttach` scales from basic utilities to complex orchestration.

### Global Performance Benefits
- **Shared Foundation**: One `createAttach` can handle multiple wrappers and DOM manipulations
- **Zero Overhead Composition**: Multiple primitives share the same ref system instead of each creating their own
- **Reduced Bundle Size**: Eliminates duplicate SSR safety and cleanup logic across components

### Scale Impact
Multiply these benefits across dozens of components and pages in a real application - the performance and maintenance advantages compound significantly.

### Developer Safety & Confidence
`createAttach` provides a **formal contract** that guarantees:
- Elements exist when your code runs
- Automatic cleanup prevents memory leaks
- SSR safety without defensive programming
- No more `if (!element) return` checks


### Proposal for Solid 2.0, preferably read after studying the showcase code. [Link](https://github.com/italoalmeida0/solid-createattach-showcase/blob/main/SOLID2..md)


Developers can focus on business logic instead of worrying about element existence, lifecycle management, or SSR edge cases.
