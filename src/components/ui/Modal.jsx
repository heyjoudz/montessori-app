import { THEME } from '../../ui/theme';

export default function Modal({ title, subtitle, children, onClose, width = 720 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(22, 58, 95, 0.4)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }} onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width, maxWidth: '95vw', background: 'white', borderRadius: 2, border: `none`, boxShadow: '15px 15px 0px 0px #BFD8D2', overflow: 'hidden' }}>
        <div style={{ padding: '24px 30px', borderBottom: '2px solid #F9F3EF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: THEME.serifFont, fontWeight: 600, fontSize: 20, color: THEME.text }}>{title}</div>
            {subtitle && <div style={{ marginTop: 4, fontSize: 14, color: THEME.textMuted, fontWeight: 500 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: THEME.brandSecondary, fontSize: 24, fontWeight: 'bold' }}>✕</button>
        </div>
        <div style={{ padding: 30 }}>{children}</div>
      </div>
    </div>
  );
}