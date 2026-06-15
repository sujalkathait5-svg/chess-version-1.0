import React, { useState } from 'react';
import { Download, Copy, Check } from 'lucide-react';

interface PgnExportProps {
  pgn: string;
  filename?: string;
}

export const PgnExport: React.FC<PgnExportProps> = ({ pgn, filename = 'game.pgn' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pgn);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy PGN', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([pgn], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!pgn) return null;

  return (
    <div className="pgn-export glass-panel p-4 mt-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold">PGN Export</h3>
        <div className="flex gap-2">
          <button 
            className="btn-secondary flex-center gap-2 text-sm p-2"
            onClick={handleCopy}
            title="Copy PGN to clipboard"
          >
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          <button 
            className="btn-accent flex-center gap-2 text-sm p-2"
            onClick={handleDownload}
            title="Download PGN file"
          >
            <Download size={16} />
            <span>Download</span>
          </button>
        </div>
      </div>
      <div className="pgn-text bg-black/30 p-3 rounded text-sm text-slate-300 font-mono overflow-auto max-h-32 whitespace-pre-wrap select-all">
        {pgn}
      </div>
    </div>
  );
};
