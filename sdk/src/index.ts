export type LLMProvider = "openai" | "anthropic" | "gemini";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  provider: LLMProvider;
  model?: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  railguardx: {
    latency_ms: number;
    action: "allowed" | "warned";
    violations: number;
  };
}

export interface GuardBlockedError {
  error: true;
  reason: string;
  violations: Array<{ policy: string; reason: string }>;
  status: 403;
}

export interface RailGuardXConfig {
  apiKey: string;
  baseUrl?: string;
}

export class RailGuardXError extends Error {
  public readonly status: number;
  public readonly violations?: Array<{ policy: string; reason: string }>;

  constructor(message: string, status: number, violations?: Array<{ policy: string; reason: string }>) {
    super(message);
    this.name = "RailGuardXError";
    this.status = status;
    this.violations = violations;
  }
}

export class RailGuardX {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: RailGuardXConfig) {
    if (!config.apiKey) throw new Error("RailGuardX: apiKey is required");
    if (!config.apiKey.startsWith("rgx_live_")) {
      throw new Error("RailGuardX: invalid apiKey format");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || "https://your-railguardx-domain.com").replace(/\/$/, "");
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/guard`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        messages: options.messages,
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
      }),
    });

    const data = await response.json() as Record<string, unknown>;

    if (response.status === 403) {
      throw new RailGuardXError(
        (data.error as string) || "Request blocked by guardrail policy",
        403,
        data.violations as Array<{ policy: string; reason: string }> | undefined
      );
    }

    if (!response.ok) {
      throw new RailGuardXError(
        (data.error as string) || "RailGuardX request failed",
        response.status
      );
    }

    // Parse OpenAI-compatible response format
    const choices = data.choices as Array<{ message: { content: string } }> | undefined;
    const content = choices?.[0]?.message?.content || "";
    const railguardx = data.railguardx as ChatResponse["railguardx"];

    return {
      content,
      model: data.model as string,
      usage: data.usage as ChatResponse["usage"],
      railguardx,
    };
  }
}

export default RailGuardX;
