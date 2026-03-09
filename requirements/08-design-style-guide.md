# SOMI Design Style Guide

Version 1.0 | Last Updated: February 2026

This document is the single source of truth for SOMI Clinic's design system. All developers should reference this guide when building features to ensure visual and functional consistency across the platform.

---

## 1. Brand Color Palette

### Color Definitions

| Color Name   | Hex Value | CSS Variable         | Usage                                    |
|--------------|-----------|----------------------|------------------------------------------|
| **Navy**     | #1B3A4B   | `--somi-navy`        | Sidebar bg, headings, primary text       |
| **Teal**     | #6DB6B0   | `--somi-teal`        | Primary accent, buttons, links, active   |
| **Dark Teal**| #2C7A7B   | `--somi-dark-teal`   | Menu selected state, hover effects       |
| **Gold**     | #D4A843   | `--somi-gold`        | Accent highlights, premium indicators   |
| **Cream**    | #E8DCC8   | `--somi-cream`       | Secondary accent, decorative            |
| **Mint**     | #F0F5F4   | `--somi-mint-bg`     | Page bg, table headers, card backgrounds|
| **White**    | #FFFFFF   | `--somi-white`       | Card backgrounds, text on dark          |

### Color Usage Guidelines

**Navy** — Use for:
- Sidebar background
- Page headings (h1–h6)
- Primary text color
- Navigation labels

**Teal** — Use for:
- Primary action buttons
- Active links and menu states
- Icon accents (within icon circles)
- Focus states
- Section labels (uppercase)

**Dark Teal** — Use for:
- Menu item selected background
- Button hover states
- Link hover effects

**Gold** — Use for:
- Status indicators (archived items, premium features)
- Accent borders
- Optional UI highlights

**Mint** — Use for:
- Page background layouts
- Table header backgrounds
- Card backgrounds (secondary)
- Container backgrounds

**White** — Use for:
- Primary card backgrounds
- Overlay containers
- Text on navy/dark backgrounds

---

## 2. Typography

### Font Stack

| Context | Font Family      | CSS Variable      | Usage                          |
|---------|------------------|-------------------|--------------------------------|
| **Headings** | Playfair Display | `--font-heading`  | All h1–h6, page titles, cards |
| **Body**     | Inter            | `--font-body`     | Paragraphs, labels, UI text   |

### Font Weights & Sizes

| Level | Font Weight | Typical Size | Usage                           |
|-------|-------------|------|--------------------------------------|
| **h1** | 700 (bold)  | 28–32px | Page titles                      |
| **h2** | 700 (bold)  | 24–28px | Section headings, cards          |
| **h3** | 600 (semibold) | 20–22px | Subsections                    |
| **Body** | 400 (regular) | 14–16px | Main text, descriptions      |
| **Label** | 600 (semibold) | 12px | Form labels, metadata        |
| **Section Label** | 600 (semibold) | 12px | Uppercase teal labels    |

### Font Usage

- All `<h1>`–`<h6>` elements automatically render in **Playfair Display**, navy color
- Body copy and UI labels use **Inter** by default
- Use `.somi-section-label` class for uppercase teal section headers (e.g., "PATIENT RECORDS")

---

## 3. Component Library

All reusable components are built as React/TypeScript modules and styled with Ant Design theme configuration.

### SomiLogo

**Purpose:** Brand identity component; appears in sidebar and login pages.

**Props:**
- `size?: 'small' | 'medium' | 'large'` — Controls logo dimensions
- `color?: string` — Optional hex color override (defaults to navy)

**Usage:**
```jsx
<SomiLogo size="medium" />
```

---

### PageHeader

**Purpose:** Standard page title bar with flexbox layout for title (left) and actions (right).

**Props:**
- `title: string` — Page title
- `subtitle?: string` — Optional subtitle
- `actions?: ReactNode` — Action buttons/controls (right-aligned)

**Usage:**
```jsx
<PageHeader
  title="Patient Dashboard"
  actions={<Button type="primary">Add Patient</Button>}
/>
```

---

### StatusTag

**Purpose:** Display status badges with color-coded backgrounds and text.

**Props:**
- `status: 'active' | 'inactive' | 'archived' | 'draft'` — Status type
- `label?: string` — Display text (defaults to status name)

**Usage:**
```jsx
<StatusTag status="active" label="Active" />
```

**Color Mapping:**
- `active` → Teal background, white text
- `inactive` → Gray background, dark text
- `archived` → Gold background, navy text
- `draft` → Light blue background, navy text

---

### DataTable

**Purpose:** Render tabular data with sorting, pagination, and consistent styling.

**Props:**
- `columns: ColumnDef[]` — Column definitions
- `data: any[]` — Row data
- `pagination?: boolean` — Enable pagination (default: true)
- `striped?: boolean` — Alternate row colors (default: false)

**Usage:**
```jsx
<DataTable
  columns={[{ key: 'name', title: 'Name' }]}
  data={patients}
/>
```

---

### FormModal

**Purpose:** Reusable modal dialog for forms (create, edit, delete confirmations).

**Props:**
- `visible: boolean` — Show/hide modal
- `title: string` — Modal title
- `onCancel: () => void` — Close handler
- `onSubmit: () => void` — Submit handler
- `children: ReactNode` — Form fields

**Usage:**
```jsx
<FormModal
  visible={isOpen}
  title="Add Patient"
  onSubmit={handleSave}
  onCancel={() => setIsOpen(false)}
>
  <Input placeholder="Name" />
</FormModal>
```

---

### SectionCard

**Purpose:** Container for grouped content with optional section label, padding, and border radius.

**Props:**
- `title?: string` — Optional section label (renders as `.somi-section-label`)
- `children: ReactNode` — Card content
- `padded?: boolean` — Apply 24px padding (default: true)

**Usage:**
```jsx
<SectionCard title="Patient Details">
  <p>Full content here</p>
</SectionCard>
```

---

### StatCard

**Purpose:** Display KPI-style statistics (number, label, optional trend).

**Props:**
- `label: string` — Stat label
- `value: string | number` — Primary number
- `trend?: { value: number; direction: 'up' | 'down' }` — Optional trend indicator

**Usage:**
```jsx
<StatCard
  label="Active Patients"
  value="247"
  trend={{ value: 12, direction: 'up' }}
/>
```

---

### EmptyState

**Purpose:** Placeholder UI for empty lists, no results, or onboarding prompts.

**Props:**
- `icon?: ReactNode` — Optional icon (defaults to empty-box icon)
- `title: string` — Empty state heading
- `description?: string` — Descriptive text
- `action?: ReactNode` — CTA button

**Usage:**
```jsx
<EmptyState
  title="No Patients Yet"
  description="Create your first patient record to get started."
  action={<Button type="primary">Add Patient</Button>}
/>
```

---

## 4. Spacing & Layout

### Consistent Spacing Units

| Unit | Size | Usage                                    |
|------|------|------------------------------------------|
| **xs** | 4px  | Micro spacing (between inline elements) |
| **sm** | 8px  | Gap between small components            |
| **md** | 12px | Small section spacing                   |
| **lg** | 16px | Gap between major blocks                |
| **xl** | 24px | Page padding, section margins           |

### Page Padding & Container Layout

- **Page padding:** 24px on all sides (mobile: 16px)
- **Gap between sections:** 16px
- **Card internal padding:** 24px (via `Card.paddingLG` in theme)
- **Form field gaps:** 12px

### Border Radius

| Size    | Value | Usage                                  |
|---------|-------|----------------------------------------|
| **sm**  | 8px   | Input fields, small buttons            |
| **md**  | 12px  | Cards, modal dialogs, large containers|

---

## 5. Status Color Mapping

Apply consistent status colors across all components:

```javascript
const statusColors = {
  active: {
    bg: 'var(--somi-teal)',     // #6DB6B0
    text: 'var(--somi-white)',  // #FFFFFF
    icon: 'CheckCircleOutlined'
  },
  inactive: {
    bg: '#D9D9D9',              // Ant Design gray
    text: '#000000',
    icon: 'StopOutlined'
  },
  archived: {
    bg: 'var(--somi-gold)',     // #D4A843
    text: 'var(--somi-navy)',   // #1B3A4B
    icon: 'LockOutlined'
  },
  draft: {
    bg: '#E6F7FF',              // Light blue
    text: 'var(--somi-navy)',
    icon: 'FileOutlined'
  }
};
```

Use these consistently in StatusTag, table status columns, and info badges.

---

## 6. Icon Usage

All icons are sourced from **@ant-design/icons**.

### Icon Guidelines

- **Icon size:** 16–20px for UI icons, 24–32px for action buttons
- **Icon color:** Match text color or use teal for primary actions
- **Icon circles:** Place icons in 36–40px circular containers with teal background
  - Example: Delete button uses `CircleOutlined` styled with `background: var(--somi-teal)`
- **Hover state:** Darken to dark teal or increase opacity

### Common Icon Usage

| Icon | Usage | Color |
|------|-------|-------|
| `CheckCircleOutlined` | Active status | Teal |
| `CloseCircleOutlined` | Inactive/error | Gray |
| `LockOutlined` | Archived/locked | Gold |
| `EditOutlined` | Edit action | Navy (text color) |
| `DeleteOutlined` | Delete action | Red (error) |
| `EyeOutlined` | View action | Teal |
| `DownloadOutlined` | Export action | Teal |

---

## 7. Sidebar Specification

### Layout & Structure

The sidebar is a persistent vertical navigation bar (left side) that:
- Uses **navy background** (#1B3A4B)
- Displays the **SOMI Logo** at the top
- Contains navigation menu items
- Remains visible on desktop; collapses on mobile

### Styling Details

| Property | Value | Notes |
|----------|-------|-------|
| **Background** | Navy (#1B3A4B) | Via `Layout.siderBg` theme token |
| **Width** | 200px | Fixed or collapsible |
| **Text Color** | White | Via Ant Design dark menu |
| **Selected Item BG** | Dark Teal (#2C7A7B) | Via `Menu.darkItemSelectedBg` |
| **Hover Item BG** | `rgba(109, 182, 176, 0.15)` | Subtle teal overlay |
| **Border Radius** | None | Clean edges on sidebar |

### Menu Item States

- **Default:** White text on navy background
- **Hover:** Faint teal overlay (15% opacity)
- **Active/Selected:** Dark teal background (#2C7A7B)
- **Icons:** White; match selected state styling

### Logo Placement

```jsx
<Layout.Sider>
  <SomiLogo size="medium" color="white" /> {/* Top of sidebar */}
  <Menu mode="vertical" theme="dark">
    {/* Menu items */}
  </Menu>
</Layout.Sider>
```

---

## 8. Login Page Specification

### Layout & Composition

The login page uses a **centered card layout** with:
- Page background: Mint (#F0F5F4)
- Card background: White (#FFFFFF)
- Card width: 400px (max-width on mobile)
- Vertical centering on screen

### Component Order (Top to Bottom)

1. **SOMI Logo** — Centered, size "large", navy color
2. **Page Title** — "Welcome to SOMI" or similar (Playfair Display, navy)
3. **Subtitle** — Optional: "Patient Management System" (Inter, gray)
4. **Form Fields** — Username/email and password inputs
   - Border radius: 8px
   - Height: 36px
   - Focus state: Teal border
5. **Submit Button** — "Sign In" (teal background, white text)
6. **Footer Links** — Optional: "Forgot password?", "Sign up" (dark teal links)

### CSS Structure

```jsx
<div className="login-container" style={{
  background: 'var(--somi-mint-bg)',
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}}>
  <Card style={{ width: 400, borderRadius: 12 }}>
    <SomiLogo size="large" />
    <h1 style={{ textAlign: 'center', marginTop: 24 }}>Welcome to SOMI</h1>
    <Form {...formProps}>
      {/* Form fields */}
    </Form>
  </Card>
</div>
```

---

## 9. Page Anatomy

All content pages follow a consistent structure for predictability and usability:

### Standard Page Layout (Top to Bottom)

```
┌─────────────────────────────────────────┐
│ Header (White background)               │
│ - Sidebar toggle (mobile)               │
│ - Title bar / breadcrumbs               │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Page Content (Mint background)          │
│ Padding: 24px                           │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ PageHeader Component              │  │
│ │ - Title (left)                    │  │
│ │ - Action buttons (right)          │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ Filter/Search Bar (if applicable)│  │
│ │ - Search input                    │  │
│ │ - Filter dropdowns                │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ Primary Content Container         │  │
│ │ - DataTable OR                    │  │
│ │ - SectionCard(s) OR               │  │
│ │ - StatCard grid                   │  │
│ └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### Spacing Rules

- **Page outer padding:** 24px
- **PageHeader → Filter bar:** 16px gap
- **Filter bar → Content:** 16px gap
- **Between SectionCards:** 16px gap
- **Within SectionCard content:** 12px gap

### Example Implementation

```jsx
<Layout>
  <Sidebar /> {/* Navy sidebar */}

  <Layout>
    <Header /> {/* White header */}

    <Content style={{ background: 'var(--somi-mint-bg)', padding: 24 }}>
      <PageHeader
        title="Patient Records"
        actions={<Button type="primary">Add Patient</Button>}
      />

      <SearchBar placeholder="Search patients..." style={{ marginBottom: 16 }} />

      <DataTable
        columns={patientColumns}
        data={patients}
      />
    </Content>
  </Layout>
</Layout>
```

---

## 10. Quick Reference: CSS Variables

Use these custom properties throughout your stylesheets:

```css
/* Colors */
--somi-navy: #1B3A4B;
--somi-teal: #6DB6B0;
--somi-gold: #D4A843;
--somi-cream: #E8DCC8;
--somi-dark-teal: #2C7A7B;
--somi-mint-bg: #F0F5F4;
--somi-white: #FFFFFF;

/* Typography */
--font-heading: 'Playfair Display', Georgia, serif;
--font-body: 'Inter', sans-serif;
```

---

## 11. Utility Classes

### Page Header

```html
<div class="somi-page-header">
  <h2>Page Title</h2>
  <div>Action buttons</div>
</div>
```

Automatically flexes title left, actions right. Bottom margin: 24px.

### Section Labels

```html
<div class="somi-section-label">PATIENT DETAILS</div>
```

Renders: uppercase, 12px, 600 weight, teal color, letter-spacing 1.5px, margin-bottom 8px.

### Divider (Teal Accent)

```html
<hr class="somi-divider-teal" />
```

Renders: 2px solid teal line.

---

## 12. Accessibility & Best Practices

- **Contrast:** All text meets WCAG AA standards (4.5:1 for body, 3:1 for large text)
- **Focus states:** Use teal border for keyboard navigation
- **Icons:** Always pair with text labels or use `aria-label`
- **Links:** Use dark teal color; underline on hover
- **Buttons:** Use `role="button"` for custom buttons; native `<button>` preferred
- **Tables:** Include `<thead>` and `<tbody>`; use semantic HTML

---

## 13. Responsive Design

### Breakpoints

| Breakpoint | Width    | Device              |
|------------|----------|---------------------|
| **xs**     | < 480px  | Small phones        |
| **sm**     | 480–768px| Tablets (portrait)  |
| **md**     | 768–1024px| Tablets (landscape)|
| **lg**     | > 1024px | Desktops            |

### Responsive Adjustments

- **Mobile padding:** Reduce from 24px to 16px
- **Sidebar:** Collapse to drawer on mobile (< 768px)
- **DataTable:** Enable horizontal scroll on mobile
- **Cards:** Stack vertically; full width on mobile

---

## End of Document

For questions or style updates, contact the design lead. This document should be reviewed quarterly and updated as the design system evolves.
