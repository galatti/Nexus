import React from 'react';

interface OptimizedSyntaxHighlighterProps {
  children: string;
  language?: string;
  className?: string;
}

// Simple syntax highlighting using CSS classes only
const languageColors: { [key: string]: string } = {
  'javascript': '#f7df1e',
  'typescript': '#3178c6', 
  'python': '#3776ab',
  'json': '#000000',
  'bash': '#4eaa25',
  'sql': '#e38c00',
  'yaml': '#cb171e',
  'css': '#1572b6',
  'html': '#e34c26',
  'xml': '#e34c26'
};

export const OptimizedSyntaxHighlighter: React.FC<OptimizedSyntaxHighlighterProps> = ({ 
  children, 
  language = 'text',
  className = '' 
}) => {
  const normalizedLanguage = language.toLowerCase();
  const color = languageColors[normalizedLanguage] || '#ffffff';
  
  return (
    <div className={`relative ${className}`}>
      {/* Language badge */}
      {language && language !== 'text' && (
        <div 
          className="absolute top-2 right-2 px-2 py-1 text-xs rounded font-mono opacity-75"
          style={{ 
            backgroundColor: color,
            color: '#ffffff',
            fontSize: '0.7rem'
          }}
        >
          {normalizedLanguage}
        </div>
      )}
      
      {/* Code block */}
      <pre
        className="overflow-x-auto p-4 rounded-md text-sm font-mono leading-relaxed"
        style={{
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          margin: 0,
          fontSize: '0.875rem',
          lineHeight: '1.5'
        }}
      >
        <code className="block whitespace-pre">
          {children}
        </code>
      </pre>
    </div>
  );
}; 