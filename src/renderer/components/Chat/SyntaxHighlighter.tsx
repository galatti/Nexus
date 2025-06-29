import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface OptimizedSyntaxHighlighterProps {
  children: string;
  language?: string;
  className?: string;
}

// Map of common language aliases to standardized names
const languageMap: { [key: string]: string } = {
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'sh': 'bash',
  'shell': 'bash',
  'yml': 'yaml',
  'md': 'markdown',
  'htm': 'markup',
  'html': 'markup',
};

// List of languages that Prism supports by default (no additional imports needed)
const defaultLanguages = new Set([
  'javascript', 'typescript', 'jsx', 'tsx', 'python', 'json', 
  'bash', 'sql', 'yaml', 'markdown', 'css', 'markup', 'text'
]);

export const OptimizedSyntaxHighlighter: React.FC<OptimizedSyntaxHighlighterProps> = ({ 
  children, 
  language = 'text',
  className = '' 
}) => {
  // Normalize language name
  const normalizedLanguage = language.toLowerCase();
  const mappedLanguage = languageMap[normalizedLanguage] || normalizedLanguage;
  
  // Use 'text' for unsupported languages to avoid errors
  const finalLanguage = defaultLanguages.has(mappedLanguage) ? mappedLanguage : 'text';
  
  return (
    <SyntaxHighlighter
      language={finalLanguage}
      style={oneDark}
      className={className}
      showLineNumbers={false}
      wrapLines={true}
      customStyle={{
        margin: 0,
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        lineHeight: '1.5'
      }}
    >
      {children}
    </SyntaxHighlighter>
  );
}; 