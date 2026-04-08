'use client'

import { useState } from 'react'
import CopyButton from './CopyButton'

const MASKED = '••••••••-••••-••••-••••-••••••••••••'

export default function ApiKeyDisplay({ apiKey }: { apiKey: string }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex items-center gap-3 bg-brand-bg border border-brand-border rounded px-4 py-3">
      <code className="flex-1 text-sm text-brand-white font-mono break-all">
        {visible ? apiKey : MASKED}
      </code>
      <button
        onClick={() => setVisible(v => !v)}
        className="p-1.5 text-brand-grey hover:text-brand-white transition-colors"
        title={visible ? 'Hide API key' : 'Show API key'}
      >
        {visible ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
      <CopyButton text={apiKey} />
    </div>
  )
}
