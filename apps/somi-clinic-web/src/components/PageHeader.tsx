import React from 'react';
import { Breadcrumb, Typography } from 'antd';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

/**
 * Consistent page-level header used across all clinic app views.
 *
 * Renders an optional breadcrumb trail above a flex row containing the page
 * title (h2) on the left and an optional actions slot on the right.
 *
 * At narrow viewports (<768 px) the layout stacks vertically via the
 * `.somi-page-header` responsive CSS rule in global.css.
 */
export default function PageHeader({ title, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 8 }}
          items={breadcrumbs.map((crumb) => ({
            title: crumb.href ? (
              <Link to={crumb.href}>{crumb.label}</Link>
            ) : (
              crumb.label
            ),
          }))}
        />
      )}

      <div className="somi-page-header">
        <Typography.Title level={2} style={{ margin: 0, flexShrink: 0 }}>
          {title}
        </Typography.Title>

        {actions && (
          <div className="somi-page-header-actions" style={{ flexShrink: 1, minWidth: 0 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
