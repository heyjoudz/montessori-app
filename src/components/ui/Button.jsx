import { THEME } from '../../ui/theme'; // Adjust path if needed (e.g. ../../utils/theme)

export default function Button({ children, onClick, variant = 'primary', style, disabled, title }) {
  const base = {
    padding: '10px 20px',
    borderRadius: '0px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none',
    fontWeight: 600,
    fontSize: '13px',
    opacity: disabled ? 0.6 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.15s ease',
    outline: 'none',
    fontFamily: THEME.serifFont,
    userSelect: 'none',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  const variants = {
    primary: { background: '#FFFFFF', color: THEME.text, boxShadow: `4px 4px 0px 0px ${THEME.brandAccent}`, border: '1px solid #eee' },
    secondary: { background: THEME.brandSecondary, color: THEME.text, boxShadow: `4px 4px 0px 0px ${THEME.brandPrimary}` },
    ghost: { background: 'transparent', color: THEME.text, padding: '8px 12px', border: '1px solid transparent', boxShadow: 'none', textTransform: 'none', fontWeight: 600 },
    danger: { background: '#FFEBEB', color: '#D32F2F', boxShadow: `3px 3px 0px 0px #FFCDD2` },
    active: { background: THEME.brandPrimary, color: '#FFF', boxShadow: `4px 4px 0px 0px ${THEME.brandSecondary}` }
  };

  const finalStyle = { ...base, ...(variants[variant] || variants.primary), ...style };

  return (
    <button
      title={title}
      onClick={disabled ? undefined : onClick}
      style={finalStyle}
      onMouseEnter={(e) => {
        if (variant !== 'ghost' && !disabled) {
           e.currentTarget.style.transform = 'translate(-1px, -1px)';
           const currentShadow = variants[variant]?.boxShadow || variants.primary.boxShadow;
           const parts = currentShadow.split('0px 0px');
           if(parts.length > 1) e.currentTarget.style.boxShadow = `5px 5px 0px 0px ${parts[1]}`;
        }
        if (variant === 'ghost') e.currentTarget.style.background = 'rgba(255,255,255,0.5)';
      }}
      onMouseLeave={(e) => {
        if (variant !== 'ghost' && !disabled) {
           e.currentTarget.style.transform = 'translate(0, 0)';
           e.currentTarget.style.boxShadow = variants[variant]?.boxShadow || variants.primary.boxShadow;
        }
        if (variant === 'ghost') e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}