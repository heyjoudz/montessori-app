import React from 'react';
import { Link } from 'react-router-dom';
import { THEME } from '../ui/theme';

export default function ObservationCard({ observation }) {
  // A helper function to safely parse the TC HTML into React elements
  const parseHtmlToReact = (htmlString) => {
    if (!htmlString) return null;
    
    // Use the browser's built-in parser
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    const nodes = Array.from(doc.body.childNodes);

    return nodes.map((node, index) => {
      // 1. Handle regular text (like " and she wrote: حفر - صرف - يد.")
      if (node.nodeType === Node.TEXT_NODE) {
        return <span key={index}>{node.textContent}</span>;
      }

      // 2. Handle <em> tags (usually the word "introduced", "practiced", or "mastered")
      if (node.nodeName === 'EM') {
        const status = node.textContent.toLowerCase();
        let bgColor = '#e2e8f0'; 
        let color = '#475569';
        
        if (status.includes('introduced')) { bgColor = '#dbeafe'; color = '#1e40af'; }
        if (status.includes('practiced')) { bgColor = '#fef08a'; color = '#854d0e'; }
        if (status.includes('mastered')) { bgColor = '#dcfce7'; color = '#166534'; }

        return (
          <span 
            key={index} 
            style={{ 
              backgroundColor: bgColor, color: color, 
              padding: '2px 8px', borderRadius: '12px', 
              fontSize: '0.85em', fontWeight: 'bold', margin: '0 4px',
              display: 'inline-block'
            }}
          >
            {node.textContent}
          </span>
        );
      }

      // 3. Handle <a> tags (Links to Students or Lessons)
      if (node.nodeName === 'A') {
        const className = node.getAttribute('class');
        const text = node.textContent;
        
        if (className === 'child-link') {
          const href = node.getAttribute('href');
          const childId = href.split('/').pop(); 
          
          return (
            <Link 
              key={index} 
              to={`/students/${childId}`} 
              style={{ color: THEME.primary, fontWeight: 600, textDecoration: 'none' }}
            >
              {text}
            </Link>
          );
        }

        if (className === 'lesson-link') {
          const lessonId = node.getAttribute('data-id');
          return (
            <Link 
              key={index} 
              to={`/curriculum/${lessonId}`} 
              style={{ color: '#4f46e5', textDecoration: 'underline' }}
            >
              {text}
            </Link>
          );
        }
      }

      return <span key={index}>{node.textContent}</span>;
    });
  };

  const formattedDate = new Date(observation.date).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });

  return (
    <div style={{ 
      padding: '20px', 
      marginBottom: '16px', 
      backgroundColor: '#fff', 
      border: `1px solid #e2e8f0`, 
      borderRadius: '12px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
    }}>
      <div style={{ fontSize: '0.85rem', color: THEME.textMuted, marginBottom: '12px', fontWeight: 500 }}>
        {formattedDate}
      </div>
      <div style={{ lineHeight: '1.8', color: THEME.text, fontSize: '1rem' }}>
        {parseHtmlToReact(observation.html_content)}
      </div>
    </div>
  );
}