import { THEME } from '../../ui/theme';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div style={{ position: 'fixed', right: 30, bottom: 30, zIndex: 9999, animation: 'fadeIn 0.3s ease' }}>
      <div style={{ background: 'white', border: `2px solid ${THEME.text}`, borderRadius: 0, boxShadow: `8px 8px 0px 0px ${toast.type === 'error' ? '#EF9A9A' : THEME.brandAccent}`, padding: '20px 24px', minWidth: 320, display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 16, height: 16, background: toast.type === 'error' ? '#D32F2F' : THEME.brandSecondary, transform: 'rotate(45deg)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: THEME.text }}>{toast.title}</div>
          {toast.message && <div style={{ fontSize: 13, color: THEME.textMuted, marginTop: 4 }}>{toast.message}</div>}
        </div>
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: THEME.text, fontSize: 20, fontWeight: 'bold' }}>✕</button>
      </div>
    </div>
  );
}