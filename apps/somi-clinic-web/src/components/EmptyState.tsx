import React from 'react';
import { Typography } from 'antd';
import { brand } from '../theme/themeConfig';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Centered empty/zero-data placeholder used when a list or section has no
 * content to display.
 *
 * Renders a teal icon (48 px), a navy title, an optional gray description,
 * and an optional action element (typically a Button).
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      {icon && (
        <div
          style={{
            fontSize: 48,
            color: brand.teal,
            lineHeight: 1,
            marginBottom: 16,
          }}
        >
          {icon}
        </div>
      )}

      <Typography.Title
        level={4}
        style={{ color: brand.navy, margin: 0, marginBottom: description ? 8 : 0 }}
      >
        {title}
      </Typography.Title>

      {description && (
        <Typography.Text
          type="secondary"
          style={{ fontSize: 14, marginBottom: action ? 24 : 0 }}
        >
          {description}
        </Typography.Text>
      )}

      {action && <div style={{ marginTop: 24 }}>{action}</div>}
    </div>
  );
}
