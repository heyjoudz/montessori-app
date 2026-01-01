import { THEME } from '../../ui/theme';

export default function NavItem({ label, active, onClick, hint }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '16px 24px', 
        margin: '0',
        borderRadius: 0,
        border: 'none',
        background: active ? '#F9F3EF' : 'transparent', 
        borderLeft: active ? `5px solid ${THEME.brandSecondary}` : '5px solid transparent',
        cursor: 'pointer',
        color: active ? THEME.text : THEME.textMuted,
        fontWeight: active ? 700 : 500,
        fontSize: '16px', 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        transition: 'all 0.2s',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        {label}
      </span>
      {hint && (
        <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 600, background: THEME.brandAccent, padding: '2px 6px', borderRadius: 4, color: THEME.text }}>
          {hint}
        </span>
      )}
    </button>
  );
}