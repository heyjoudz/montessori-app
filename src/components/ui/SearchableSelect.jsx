import { useState, useEffect, useRef } from 'react';
import { THEME } from '../../ui/theme';

export default function SearchableSelect({ options, value, onChange, placeholder, style, renderOption }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false); }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => (opt.label || '').toLowerCase().includes(search.toLowerCase()));
  const selected = options.find(o => o.value == value);
  const selectedLabel = selected?.label || placeholder;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', minWidth: 220, ...style }}>
      <div
        onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
        style={{ padding: '12px 16px', background: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 0, boxShadow: '4px 4px 0px rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, color: value === 'ALL' || value === '' || value == null ? THEME.textMuted : THEME.text, fontWeight: 600, gap: 10 }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {selected?.color && <span style={{ width: 12, height: 12, background: selected.color, border: '1px solid rgba(0,0,0,0.1)' }} />}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedLabel}</span>
        </span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
      </div>
      {isOpen && (
        <div style={{ position: 'absolute', top: '110%', left: 0, width: '100%', minWidth: 280, maxHeight: 340, overflowY: 'auto', background: 'white', borderRadius: 0, boxShadow: `8px 8px 0px 0px ${THEME.brandPrimary}`, zIndex: 9999, border: '1px solid #eee', padding: 10 }}>
          <input autoFocus placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: 10, borderRadius: 0, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box', background: '#FAFAFA' }} />
          {filteredOptions.length === 0 && <div style={{ padding: 12, fontSize: 13, color: '#aaa', textAlign: 'center' }}>No results</div>}
          {filteredOptions.map(opt => (
            <div key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 14, marginBottom: 4, background: value === opt.value ? '#f0f0f0' : 'transparent', color: THEME.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }} onMouseEnter={e => e.currentTarget.style.background = '#f7f7f7'} onMouseLeave={e => e.currentTarget.style.background = value === opt.value ? '#f0f0f0' : 'transparent'}>
              {renderOption ? renderOption(opt) : (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>{opt.color && <span style={{ width: 12, height: 12, background: opt.color, border: '1px solid rgba(0,0,0,0.1)' }} />}{opt.label}</span>)}
              {opt.hint && <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>{opt.hint}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}