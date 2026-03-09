import type { ThemeConfig } from 'antd';

// ---------------------------------------------------------------------------
// SOMI Brand Colors
// ---------------------------------------------------------------------------

export const brand = {
  navy: '#1B3A4B',
  teal: '#6DB6B0',
  gold: '#D4A843',
  cream: '#E8DCC8',
  darkTeal: '#2C7A7B',
  mintBg: '#F0F5F4',
  white: '#FFFFFF',
} as const;

// ---------------------------------------------------------------------------
// Ant Design Theme Configuration
// ---------------------------------------------------------------------------

export const somiTheme: ThemeConfig = {
  token: {
    // Primary accent — teal (buttons, links, active states)
    colorPrimary: brand.teal,
    colorLink: brand.darkTeal,
    colorLinkHover: brand.teal,

    // Typography — Inter for body; Playfair Display headings handled via CSS
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",

    // Layout backgrounds
    colorBgLayout: brand.mintBg,
    colorBgContainer: brand.white,

    // Border radii
    borderRadius: 8,
    borderRadiusLG: 12,

    // Control sizing
    controlHeight: 36,
  },

  components: {
    Layout: {
      siderBg: brand.navy,
      headerBg: brand.white,
      bodyBg: brand.mintBg,
    },
    Menu: {
      darkItemBg: brand.navy,
      darkSubMenuItemBg: '#152F3D',
      darkItemSelectedBg: brand.darkTeal,
      darkItemHoverBg: 'rgba(109, 182, 176, 0.15)',
    },
    Button: {
      primaryShadow: '0 2px 4px rgba(27, 58, 75, 0.15)',
    },
    Table: {
      headerBg: brand.mintBg,
      rowHoverBg: 'rgba(109, 182, 176, 0.06)',
    },
    Card: {
      paddingLG: 24,
    },
  },
};
