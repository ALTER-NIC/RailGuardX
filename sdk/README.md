# RailGuardX SDK

Add AI safety guardrails to any LLM app in 5 lines of code.

## Install

```bash
npm install railguardx
```

## Quick Start

```typescript
import RailGuardX, { RailGuardXError } from 'railguardx';

const guard = new RailGuardX({
  apiKey: 'rgx_live_...',           // from your RailGuardX dashboard
  baseUrl: 'https://your-app.com',  // your deployed RailGuardX instance
});

try {
  const response = await guard.chat({
    provider: 'openai',   // 'openai' | 'anthropic' | 'gemini'
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: 'What are your competitor prices?' }
    ],
  });

  console.log(response.content);
  // response.railguardx.action → 'allowed' | 'warned'
  // response.railguardx.violations → number of triggered policies

} catch (err) {
  if (err instanceof RailGuardXError && err.status === 403) {
    // Request was blocked by a policy
    console.log('Blocked:', err.message);
    console.log('Violations:', err.violations);
  }
}
```

## Providers

| Provider | Models |
|---|---|
| `openai` | gpt-4o, gpt-4o-mini, etc. |
| `anthropic` | claude-sonnet-4-5, claude-haiku-4-5, etc. |
| `gemini` | gemini-2.0-flash, gemini-1.5-pro, etc. |

## How It Works

1. Your app sends a chat request to RailGuardX instead of directly to the LLM
2. RailGuardX evaluates the input against your custom policies
3. If blocked → throws `RailGuardXError` with details
4. If allowed → forwards to the LLM, evaluates the output
5. Returns the response + guardrail metadata
6. Everything is logged to your audit dashboard

## Error Handling

```typescript
import { RailGuardXError } from 'railguardx';

try {
  const res = await guard.chat({ ... });
} catch (err) {
  if (err instanceof RailGuardXError) {
    switch (err.status) {
      case 403: // Blocked by policy
        return "I can't help with that.";
      case 401: // Invalid API key
        throw new Error("Check your RailGuardX API key");
      case 502: // LLM provider error
        throw new Error("AI provider is unavailable");
    }
  }
}
```
