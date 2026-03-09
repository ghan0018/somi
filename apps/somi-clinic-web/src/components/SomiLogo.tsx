import { brand } from '../theme/themeConfig';

interface SomiLogoProps {
  size?: number;
  showText?: boolean;
  collapsed?: boolean;
}

/**
 * SOMI brand logo mark — four overlapping teardrop/petal shapes arranged in a
 * pinwheel pattern, mirroring the four-petal design on somihealth.com.
 *
 * Petals (by quadrant):
 *   top-left  → teal   (#6DB6B0)
 *   top-right → cream  (#E8DCC8)
 *   bottom-right → gold   (#D4A843)
 *   bottom    → dark teal (#2C7A7B)
 */
export default function SomiLogo({
  size = 40,
  showText = false,
  collapsed = false,
}: SomiLogoProps) {
  // The SVG canvas is always 100×100; we scale via width/height props.
  const cx = 50;
  const cy = 50;

  // Petal dimensions — each petal is a rounded shape drawn with cubic beziers.
  // The four petals share a common centre overlap point.
  const petalDefs = [
    // top-left petal  (teal)  — tip points toward top-left
    {
      color: brand.teal,
      opacity: 0.92,
      d: 'M50,50 C38,46 28,36 32,22 C36,10 50,14 50,50 Z',
    },
    // top-right petal (cream) — tip points toward top-right
    {
      color: brand.cream,
      opacity: 0.92,
      d: 'M50,50 C54,38 64,28 78,32 C90,36 86,50 50,50 Z',
    },
    // bottom-right petal (gold) — tip points toward bottom-right
    {
      color: brand.gold,
      opacity: 0.92,
      d: 'M50,50 C62,54 72,64 68,78 C64,90 50,86 50,50 Z',
    },
    // bottom petal (dark teal) — tip points toward bottom-left
    {
      color: brand.darkTeal,
      opacity: 0.92,
      d: 'M50,50 C46,62 36,72 22,68 C10,64 14,50 50,50 Z',
    },
  ];

  const renderText = showText && !collapsed;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.3,
        lineHeight: 1,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SOMI logo mark"
        role="img"
      >
        {petalDefs.map((petal, i) => (
          <path
            key={i}
            d={petal.d}
            fill={petal.color}
            opacity={petal.opacity}
          />
        ))}
        {/* Central overlap highlight — small translucent circle */}
        <circle cx={cx} cy={cy} r={6} fill={brand.white} opacity={0.35} />
      </svg>

      {renderText && (
        <span
          style={{
            color: brand.navy,
            fontWeight: 700,
            fontSize: size * 0.5,
            letterSpacing: '0.08em',
            fontFamily: 'inherit',
            userSelect: 'none',
          }}
        >
          SOMI
        </span>
      )}
    </span>
  );
}
