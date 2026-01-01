import { THEME, FontLoader } from '../../ui/theme';

export default function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: THEME.bg, color: THEME.text }}>
      <FontLoader />
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, border: `4px solid ${THEME.brandYellow}`, margin: '0 auto 20px', animation: 'spin 4s linear infinite', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', background: THEME.brandSecondary }} />
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: 2, fontFamily: THEME.serifFont }}>MONTESSORI</div>
      </div>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}