import { THEME } from '../../ui/theme';

export default function MiniChip({ label, color, style, title }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        borderRadius: 0, background: '#FFFFFF', border: '1px solid #eee',
        boxShadow: `3px 3px 0px 0px ${color || THEME.brandAccent}`,
        fontSize: 12, fontWeight: 600, color: THEME.text, ...style
      }}
    >
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{label}</span>
    </span>
  );
}