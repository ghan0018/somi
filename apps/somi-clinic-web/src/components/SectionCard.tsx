import React from 'react';
import { Card, Typography } from 'antd';
import { brand } from '../theme/themeConfig';

interface SectionCardProps {
  title?: string;
  /** Uppercase teal label rendered above the title */
  sectionLabel?: string;
  /** Content placed in the top-right corner of the card header */
  extra?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Branded card container used to group related content within a page section.
 *
 * Renders an optional `sectionLabel` (uppercase, teal) above the card title,
 * and supports an `extra` slot in the top-right for actions or supplementary
 * info — mirrors the antd Card `extra` prop but composable with the label.
 */
export default function SectionCard({
  title,
  sectionLabel,
  extra,
  children,
}: SectionCardProps) {
  const cardTitle =
    title || sectionLabel ? (
      <div>
        {sectionLabel && (
          <Typography.Text
            className="somi-section-label"
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: brand.teal,
              marginBottom: 2,
            }}
          >
            {sectionLabel}
          </Typography.Text>
        )}
        {title && (
          <Typography.Text strong style={{ fontSize: 16, color: brand.navy }}>
            {title}
          </Typography.Text>
        )}
      </div>
    ) : undefined;

  return (
    <Card title={cardTitle} extra={extra}>
      {children}
    </Card>
  );
}
