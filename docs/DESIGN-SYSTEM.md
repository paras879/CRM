# Business CRM — Design System & UI Standards

## 1. Design Identity

**Product:** Business CRM Admin Panel  
**Design Style:** Premium SaaS, clean, modern, professional  
**Theme:** White + Blue  
**Default Mode:** Light mode  
**UI Principles:** Consistency, readability, accessibility, minimal visual noise.

The entire application must follow this design system. Do not invent different colors, font sizes, font weights, border radii, or spacing values for individual pages without a documented reason.

## 2. Color Palette

Use CSS variables and Tailwind design tokens. Never scatter arbitrary hex values throughout components.

### Primary Blue
- Primary: `#2563EB`
- Primary Hover: `#1D4ED8`
- Primary Active: `#1E40AF`
- Primary Light Background: `#EFF6FF`
- Primary Border: `#BFDBFE`

### Backgrounds
- Application Background: `#F8FAFC`
- Main Content Background: `#FFFFFF`
- Sidebar Background: `#FFFFFF`
- Header Background: `#FFFFFF`
- Muted Background: `#F1F5F9`
- Hover Background: `#F8FAFC`

### Text Colors
- Main Text: `#1E293B`
- Secondary Text: `#475569`
- Muted Text: `#64748B`
- Disabled Text: `#94A3B8`
- Text on Primary Button: `#FFFFFF`

### Borders
- Default Border: `#E2E8F0`
- Strong Border: `#CBD5E1`
- Focus Ring: `#93C5FD`

### Status Colors
- Success: `#16A34A`
- Success Background: `#F0FDF4`
- Warning: `#D97706`
- Warning Background: `#FFFBEB`
- Error: `#DC2626`
- Error Background: `#FEF2F2`
- Information: `#0284C7`
- Information Background: `#F0F9FF`

Status colors must always be paired with readable text. Do not communicate status using color alone.

## 3. Typography

**Font Family:** Inter, with a system sans-serif fallback.

Use a consistent typography scale. Do not use bold-heavy typography.

### Allowed Font Weights
- `100`: Thin — decorative use only, rarely.
- `200`: Extra Light — rarely.
- `300`: Light — secondary decorative text only.
- `400`: Regular — default body text.
- `500`: Medium — preferred weight for headings, labels, navigation and buttons.
- `600`: Semi-bold — limited use for important headings and key metrics.
- `700`: Bold — maximum permitted weight; rare emphasis only.

**Default font weight: 400.**  
**Preferred UI emphasis: 500.**  
Avoid using `700` as a default. Do not make every heading, button, label, table header or card title bold.

### Font Sizes
- `11px`: Tiny metadata, use sparingly.
- `12px`: Helper text, timestamps and compact labels.
- `14px`: Secondary UI text and table content.
- `16px`: Default body text and standard form inputs.
- `18px`: Section titles and prominent card labels.
- `20px`: Page subsection headings.
- `24px`: Main page headings.
- `30px`: Dashboard KPI values or major metrics.
- `36px`: Large dashboard metrics only.

Use a `14px` base for dense admin tables and `16px` for comfortable reading where appropriate. Form inputs must be at least `16px` on mobile to prevent unwanted browser zoom on supported mobile browsers.

## 4. Spacing System

Use a consistent 4px-based spacing scale.

- `4px`: Minimal icon/text spacing.
- `8px`: Compact control spacing.
- `12px`: Small internal gaps.
- `16px`: Standard component spacing.
- `20px`: Card internal spacing.
- `24px`: Section spacing.
- `32px`: Large section separation.
- `40px`: Page-level separation.
- `48px`: Large dashboard layout spacing.

Default page padding:
- Desktop: `32px`
- Tablet: `24px`
- Mobile: `16px`

Do not introduce arbitrary spacing values unless a specific layout requires them.

## 5. Border Radius and Shadows

- Small controls: `6px`
- Inputs and buttons: `8px`
- Cards and panels: `12px`
- Large dialogs: `16px`
- Pills and status badges: `9999px`

Use subtle borders and shadows. Avoid strong shadows, excessive gradients, glassmorphism, neon colors and unnecessary 3D effects.

Default card styling:
- White background
- `1px` solid default border
- `12px` radius
- Subtle shadow only where needed
- Consistent internal padding of `20px` or `24px`

## 6. Buttons

### Primary Button
- Blue background: `#2563EB`
- White text
- Font size: `14px`
- Font weight: `500`
- Height: `40px`
- Horizontal padding: `16px`
- Radius: `8px`

### Secondary Button
- White background
- Main text color
- Default border
- Font size: `14px`
- Font weight: `500`
- Height: `40px`

### Destructive Button
- Error color for destructive actions
- Confirm before irreversible actions
- Never use destructive styling for ordinary navigation.

All buttons need hover, active, focus, disabled and loading states. Prevent accidental double submission.

## 7. Forms and Inputs

- Input height: `40px` on desktop.
- Font size: `14px` on desktop and at least `16px` on mobile.
- Border: `1px solid #E2E8F0`.
- Radius: `8px`.
- Label font size: `14px`.
- Label weight: `500`.
- Helper text: `12px`, muted color.
- Error text: `12px`, error color.
- Focus ring: accessible blue outline.

Use consistent vertical spacing between labels, fields and validation messages. Every input must have a proper accessible label. Show validation errors next to the relevant field.

## 8. Sidebar and Header

### Sidebar
- White background.
- Subtle right border.
- Dark slate navigation text.
- Blue active item with a light blue background.
- Navigation font size: `14px`.
- Navigation font weight: `500`.
- Consistent icon size: `18px`.
- Consistent item height and padding.
- Clear active, hover and keyboard-focus states.

### Header
- White background.
- Subtle bottom border.
- Height approximately `64px`.
- Search, notifications, user profile and contextual actions.
- Avoid unnecessary decorative elements.

## 9. Dashboard Cards and Tables

### KPI Cards
- White surface and subtle border.
- Label: `14px`, weight `400` or `500`.
- Metric: `30px`, weight `500` or `600`.
- Supporting information: `12px` or `14px`.
- Use blue accents sparingly.
- Avoid oversized bold numbers.

### Data Tables
- Table header: `12px` or `14px`, weight `500`.
- Table body: `14px`, weight `400`.
- Row height: approximately `48px`.
- Subtle horizontal dividers.
- Consistent cell padding.
- Clear hover states.
- Responsive horizontal scrolling or mobile-specific layouts.
- Include pagination, loading states, empty states and error states.

### Status Badges
Use compact badges with subtle backgrounds. Keep text readable and font weight around `500`. Use the defined status palette consistently across Leads, Projects, Invoices and Support Tickets.

## 10. Modals, Dropdowns and Notifications

- Dialog radius: `16px`.
- Dialog padding: `24px`.
- Dropdown radius: `8px`.
- Toast notifications must have clear success, warning and error variants.
- Confirm dangerous actions.
- Keep modal actions consistently aligned.
- Support keyboard navigation, Escape-to-close where appropriate, and focus management.

## 11. Iconography

Use Lucide icons consistently throughout the application.

- Standard icon size: `18px`.
- Small inline icon: `16px`.
- Prominent action icon: `20px`.
- Keep stroke width consistent.
- Avoid mixing unrelated icon libraries.
- Icon-only buttons must have accessible labels or tooltips.

## 12. Responsive Design

Support:
- Mobile: `320px` and above.
- Tablet: `768px` and above.
- Desktop: `1024px` and above.
- Large desktop: `1280px` and above.

The sidebar should collapse or become a mobile drawer on smaller screens. Tables, forms, dialogs and dashboards must remain usable on mobile without accidental overflow.

## 13. Accessibility

- Follow WCAG 2.2 AA principles where applicable.
- Maintain readable color contrast.
- Provide visible keyboard focus.
- Use semantic HTML.
- Label all inputs.
- Provide accessible names for icon-only actions.
- Do not rely on color alone for errors or statuses.
- Respect reduced-motion preferences.
- Ensure dialogs and dropdowns work with keyboards and screen readers.

## 14. Motion and Interaction

- Use subtle transitions, typically `150ms–200ms`.
- Animate hover, focus and opening/closing states only when helpful.
- Avoid excessive bounce, parallax, 3D effects and distracting animations.
- Respect `prefers-reduced-motion`.
- Never let animation block important actions.

## 15. Technical Implementation

Create a central theme configuration and CSS variables for:
- Colors
- Typography
- Font weights
- Spacing
- Border radii
- Shadows
- Focus rings

Use Tailwind CSS and shadcn/ui consistently. Customize shadcn components to match this specification.

Create reusable components for:
- Buttons
- Inputs
- Selects
- Dialogs
- Dropdowns
- Tables
- Status badges
- Page headers
- KPI cards
- Empty states
- Loading skeletons
- Toast notifications

Do not duplicate styling rules across pages. Use shared components and design tokens.

## 16. Strict Coding-Agent Rules

1. Read this design system before creating any UI.
2. Apply it to every module, not just the dashboard.
3. Use white and blue as the main visual identity.
4. Keep font weight mostly between `400` and `500`; use `600` sparingly and `700` only when justified.
5. Do not use bold typography everywhere.
6. Do not introduce a different color palette for individual pages.
7. Do not hardcode arbitrary colors in components when a design token exists.
8. Do not install a second UI library if shadcn/ui already meets the requirement.
9. Verify responsive behavior and accessibility.
10. Before declaring a module complete, check visual consistency against this file.

**Final target:** A premium, clean, professional CRM interface with a consistent white-blue palette, medium-weight typography, balanced spacing and predictable interactions across every screen.