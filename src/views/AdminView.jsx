import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { THEME } from '../ui/theme';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function AdminView() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load users when page opens
  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    setLoading(true);
    // Call the SQL function we created
    const { data, error } = await supabase.rpc('get_pending_users');
    if (error) console.error(error);
    else setPendingUsers(data || []);
    setLoading(false);
  };

  const handleApprove = async (userEmail, firstName) => {
    const confirm = window.confirm(`Approve ${firstName} and send email?`);
    if (!confirm) return;

    // 1. Update Database to 'active'
    const { error } = await supabase.rpc('approve_user', { target_email: userEmail });
    
    if (error) {
      alert('Error approving: ' + error.message);
      return;
    }

    // 2. Refresh the list
    setPendingUsers(prev => prev.filter(u => u.email !== userEmail));

    // 3. GENERATE PROFESSIONAL EMAIL CONTENT
    const subject = "Welcome to Montessori OS - Access Granted";
    
    // Note: \n creates a new line. %0D%0A is the URL encoded version of a new line.
    const body = `Hello ${firstName},

Your account has been approved by the school administration.

You can now log in to the portal here:
https://montessori-app-eight.vercel.app

If you have any questions, please reply to this email.

Best regards,
Montessori Support Team`;
    
    // 4. Open Email Client
    // NOTE: You must manually select 'montessorios.help@gmail.com' as the sender 
    // in the window that pops up.
    window.location.href = `mailto:${userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontFamily: THEME.serifFont, color: THEME.text, marginBottom: 20 }}>
        Admin Panel
      </h1>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', background: '#f9f9f9', borderBottom: '1px solid #eee', fontWeight: 600 }}>
          Pending Approvals ({pendingUsers.length})
        </div>

        {loading ? (
          <div style={{ padding: 24 }}>Loading...</div>
        ) : pendingUsers.length === 0 ? (
          <div style={{ padding: 24, color: THEME.textMuted }}>No pending requests.</div>
        ) : (
          <div>
            {pendingUsers.map(user => (
              <div 
                key={user.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '16px 24px',
                  borderBottom: '1px solid #eee'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>
                    {user.first_name} {user.last_name}
                  </div>
                  <div style={{ color: THEME.textMuted, fontSize: 14 }}>
                    {user.email}
                  </div>
                </div>
                
                <Button onClick={() => handleApprove(user.email, user.first_name)}>
                  Approve & Email
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}