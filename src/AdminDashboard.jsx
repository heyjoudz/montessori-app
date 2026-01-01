import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const THEME = {
  bg: '#F3F4F6',
  sidebar: '#1F2937', 
  sidebarText: '#E5E7EB',
  active: '#374151',
  header: '#FFFFFF',
  primary: '#5D703A',
  danger: '#EF4444',
  warning: '#F59E0B'
};

export default function AdminDashboard() {
  const [activeTable, setActiveTable] = useState('schools');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);

  const [foreignData, setForeignData] = useState({
    schools: [],
    classrooms: [],
    profiles: [] // Added profiles for Teacher/Supervisor selection
  });

  const SCHEMAS = {
    schools: {
      label: 'Schools',
      columns: ['id', 'name', 'address', 'school_code'],
      required: ['name', 'school_code']
    },
    classrooms: {
      label: 'Classrooms',
      // Added teacher_id
      columns: ['id', 'name', 'code', 'school_id', 'teacher_id'],
      required: ['name', 'code', 'school_id'],
      foreignKeys: { school_id: 'schools', teacher_id: 'profiles' }
    },
    students: {
      label: 'Students',
      columns: ['id', 'first_name', 'last_name', 'student_code', 'classroom_id', 'dob'],
      required: ['first_name', 'last_name'],
      foreignKeys: { classroom_id: 'classrooms' }
    },
    profiles: {
      label: 'Users',
      // Added supervisor_id
      columns: ['id', 'email', 'full_name', 'role', 'user_code', 'school_id', 'supervisor_id'],
      required: ['email', 'role'],
      foreignKeys: { school_id: 'schools', supervisor_id: 'profiles' }
    }
  };

  useEffect(() => {
    fetchTableData();
    fetchForeignData();
  }, [activeTable]);

  async function fetchForeignData() {
    const { data: schools } = await supabase.from('schools').select('id, name');
    const { data: classrooms } = await supabase.from('classrooms').select('id, name');
    // Fetch profiles to use as Teachers or Supervisors
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email');
    
    setForeignData({ 
        schools: schools || [], 
        classrooms: classrooms || [],
        profiles: profiles ? profiles.map(p => ({ id: p.id, name: p.full_name || p.email })) : []
    });
  }

  async function fetchTableData() {
    setLoading(true);
    const { data, error } = await supabase
      .from(activeTable)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error fetching:', error);
    else setData(data || []);
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    const { error } = await supabase.from(activeTable).delete().eq('id', id);
    if (error) alert(`Error: ${error.message}`);
    else fetchTableData();
  }

  function openEdit(row) {
    setFormData(row);
    setEditingId(row.id);
    setShowModal(true);
  }

  function openAdd() {
    setFormData({});
    setEditingId(null);
    setShowModal(true);
  }

  async function handleSave() {
    const missing = SCHEMAS[activeTable].required.find(field => !formData[field]);
    if (missing) return alert(`Please fill in ${missing}`);

    let error;
    if (editingId) {
      const { error: updateError } = await supabase
        .from(activeTable)
        .update(formData)
        .eq('id', editingId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from(activeTable)
        .insert([formData]);
      error = insertError;
    }
    
    if (error) {
      alert(`Error saving: ${error.message}`);
    } else {
      setShowModal(false);
      setFormData({});
      setEditingId(null);
      fetchTableData();
    }
  }

  const renderInput = (col) => {
    const foreignTable = SCHEMAS[activeTable].foreignKeys?.[col];
    if (foreignTable) {
      const options = foreignData[foreignTable] || [];
      return (
        <select
          value={formData[col] || ''}
          onChange={e => setFormData({ ...formData, [col]: e.target.value })}
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D1D1D1' }}
        >
          <option value="">Select {col.replace('_id', '')}...</option>
          {options.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.name} (ID: {opt.id})</option>
          ))}
        </select>
      );
    }
    return (
      <input
        value={formData[col] || ''}
        onChange={e => setFormData({ ...formData, [col]: e.target.value })}
        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D1D1D1' }}
        placeholder={`Enter ${col}...`}
      />
    );
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)', fontFamily: 'system-ui' }}>
      <div style={{ width: '220px', background: THEME.sidebar, color: THEME.sidebarText, padding: '20px' }}>
        <h3 style={{ marginTop: 0, color: '#9CA3AF', fontSize: '12px', textTransform: 'uppercase' }}>Database Tables</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {Object.keys(SCHEMAS).map(key => (
            <button
              key={key}
              onClick={() => setActiveTable(key)}
              style={{
                textAlign: 'left',
                padding: '10px 15px',
                background: activeTable === key ? THEME.primary : 'transparent',
                color: activeTable === key ? 'white' : THEME.sidebarText,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: activeTable === key ? 'bold' : 'normal'
              }}
            >
              {SCHEMAS[key].label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '30px', background: THEME.bg, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: 0, color: '#111827' }}>Manage {SCHEMAS[activeTable].label}</h1>
          <button 
            onClick={openAdd}
            style={{ padding: '10px 20px', background: THEME.primary, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Add New Record
          </button>
        </div>

        {loading ? (
          <div>Loading data...</div>
        ) : (
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <tr>
                  {SCHEMAS[activeTable].columns.map(col => (
                    <th key={col} style={{ textAlign: 'left', padding: '12px 16px', color: '#6B7280', textTransform: 'uppercase', fontSize: '11px' }}>{col.replace('_', ' ')}</th>
                  ))}
                  <th style={{ width: '100px', textAlign:'right', paddingRight:'20px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    {SCHEMAS[activeTable].columns.map(col => (
                      <td key={col} style={{ padding: '12px 16px', color: '#374151' }}>
                        {row[col] || <span style={{color:'#CCC'}}>-</span>}
                      </td>
                    ))}
                    <td style={{ textAlign:'right', paddingRight:'20px' }}>
                      <button 
                        onClick={() => openEdit(row)}
                        style={{ color: THEME.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight:'bold', marginRight:'10px' }}
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(row.id)}
                        style={{ color: THEME.danger, background: 'none', border: 'none', cursor: 'pointer', fontWeight:'bold' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '500px', maxWidth: '90%' }}>
            <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit' : 'Add'} {SCHEMAS[activeTable].label}</h2>
            <div style={{ display: 'grid', gap: '15px', marginTop: '20px' }}>
              {SCHEMAS[activeTable].columns.map(col => {
                if (col === 'id') return null;
                return (
                  <div key={col}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', textTransform: 'uppercase' }}>{col.replace('_', ' ')}</label>
                    {renderInput(col)}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#666' }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '12px', background: THEME.primary, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight:'bold' }}>{editingId ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}