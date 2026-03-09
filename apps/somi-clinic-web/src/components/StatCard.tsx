import React from 'react';
import { Card, Typography } from 'antd';
import { brand } from '../theme/themeConfig';

type ColorKey = 'teal' | 'gold' | 'navy';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: ColorKey;
}

const colorMap: Record<ColorKey, string> = {
  teal: brand.teal,
  gold: brand.gold,
  navy: brand.navy,
};

/**
 * Compact metric card used on dashboard and summary views.
 *
 * Displays a colored icon circle (40 px), a large value, and a descriptive
 * label beneath it. The accent color is derived from the `color` prop and
 * maps to SOMI brand tokens.
 */
export default function StatCard({
  label,
  value,
  icon,
  color = 'teal',
}: StatCardProps) {
  const accentColor = colorMap[color];

  return (
    <Card
      style={{ textAlign: 'center' }}
      styles={{ body: { padding: '20px 16px' } }}
    >
      {icon && (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            color: brand.white,
            fontSize: 18,
          }}
        >
          {icon}
        </div>
      )}

      <Typography.Title
        level={3}
        style={{ margin: 0, color: brand.navy, lineHeight: 1.2 }}
      >
        {value}
      </Typography.Title>

      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        {label}
      </Typography.Text>
    </Card>
  );
}
