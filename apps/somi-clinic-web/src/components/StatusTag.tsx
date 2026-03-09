import { Tag } from 'antd';
import { brand } from '../theme/themeConfig';

type StatusValue =
  | 'active'
  | 'inactive'
  | 'disabled'
  | 'archived'
  | 'draft'
  | 'published'
  | string;

interface StatusTagProps {
  status: StatusValue;
}

function resolveColor(status: string): string | undefined {
  switch (status.toLowerCase()) {
    case 'active':
    case 'published':
      return brand.teal;
    case 'inactive':
    case 'disabled':
      // Use antd default gray — returning undefined falls back to default Tag styling
      return undefined;
    case 'archived':
      return brand.gold;
    case 'draft':
      // antd built-in "blue" preset
      return 'blue';
    default:
      return undefined;
  }
}

/**
 * Brand-aware status badge built on the antd Tag component.
 *
 * Supported statuses:
 *   active / published  → teal
 *   inactive / disabled → gray (default)
 *   archived            → gold
 *   draft               → blue (antd preset)
 */
export default function StatusTag({ status }: StatusTagProps) {
  const color = resolveColor(status);
  const label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  return <Tag color={color}>{label}</Tag>;
}
