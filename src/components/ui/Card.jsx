import { THEME } from '../../ui/theme';

export default function Card({ children, style, onClick, onDrop, onDragOver, id }) {
  return (
    <div
      id={id}
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      style={{
        background: THEME.cardBg,
        borderRadius: THEME.radius,
        boxShadow: THEME.cardShadow,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        overflow: 'hidden',
        position: 'relative',
        color: THEME.text,
        ...style
      }}
      onMouseEnter={(e) => {
          if(onClick) {
             e.currentTarget.style.transform = 'translate(-2px, -2px)';
             e.currentTarget.style.boxShadow = THEME.cardShadowHover;
          }
      }}
      onMouseLeave={(e) => {
        if(onClick) {
             e.currentTarget.style.transform = 'translate(0, 0)';
             e.currentTarget.style.boxShadow = THEME.cardShadow;
        }
      }}
    >
      {children}
    </div>
  );
}