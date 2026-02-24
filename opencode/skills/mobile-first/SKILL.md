---
name: Mobile-First Design
trigger:
  intent: [create, refactor]
  tags: [ui, ux, mobile, responsive, component, page, dashboard, navbar, view]
inject: [planning, execution]
---

# Mobile-First Design

## When to Apply
Use when creating or modifying any UI component, page, or view.

## Breakpoint Strategy
Design for the smallest screen first, then add complexity:
- **Mobile** (<640px): Single column, large tap targets, minimal chrome
- **Tablet** (640-1024px): Two columns where appropriate
- **Desktop** (>1024px): Full layout with sidebars if needed

## Tailwind Implementation

### Grid Patterns
```html
<!-- Mobile: 1 col → Tablet: 2 cols → Desktop: 3 cols -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Touch Targets
- Minimum tap target: `min-h-[44px] min-w-[44px]`
- Button padding: `px-4 py-3` (not `py-1` or `py-2`)
- Spacing between interactive elements: `gap-3` minimum

### Typography
- Mobile body: `text-sm` or `text-base`
- Mobile headings: `text-lg` or `text-xl` (not `text-3xl`)
- Use `truncate` or `line-clamp-2` for long text on mobile

## Rules
- Use Tailwind utility classes exclusively -- no custom CSS unless strictly necessary
- Test your mental model: "Does this work on a 375px wide screen?"
- Cards should stack vertically on mobile
- Navigation should be bottom-anchored on mobile
- Modals should be full-screen on mobile (`sm:max-w-lg` pattern)
