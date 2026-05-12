import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export type LLMProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "mistral"
  | "together"
  | "perplexity"
  | "xai"
  | "cohere";

export interface ForwardRequest {
  provider: LLMProvider;
  model: string;
  messages: unknown[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ForwardResponse {
  content: string;
  model: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

// ─── Non-streaming (existing) ────────────────────────────────────────────────

export async function forwardToLLM(req: ForwardRequest): Promise<ForwardResponse> {
  switch (req.provider) {
    case "openai":   return forwardOpenAI(req);
    case "anthropic": return forwardAnthropic(req);
    case "gemini":   return forwardGemini(req);
    case "groq":     return forwardOpenAICompatible(req, "https://api.groq.com/openai/v1", process.env.GROQ_API_KEY);
    case "mistral":  return forwardOpenAICompatible(req, "https://api.mistral.ai/v1", process.env.MISTRAL_API_KEY);
    case "together": return forwardOpenAICompatible(req, "https://api.together.xyz/v1", process.env.TOGETHER_API_KEY);
    case "perplexity": return forwardOpenAICompatible(req, "https://api.perplexity.ai", process.env.PERPLEXITY_API_KEY);
    case "xai":      return forwardOpenAICompatible(req, "https://api.x.ai/v1", process.env.XAI_API_KEY);
    case "cohere":   return forwardCohere(req);
    default:         throw new Error(`Unsupported provider: ${req.provider}`);
  }
}

// ─── Streaming ───────────────────────────────────────────────────────────────

// Returns a ReadableStream of SSE chunks in OpenAI chat.completion.chunk format.
// Gemini and Cohere fall back to non-streaming (their streaming APIs differ significantly).
export async function streamFromLLM(req: ForwardRequest): Promise<ReadableStream<Uint8Array>> {
  switch (req.provider) {
    case "anthropic": return streamAnthropic(req);
    case "gemini":
    case "cohere":
      return streamViaNonStreaming(req); // graceful fallback
    default:
      return streamOpenAICompatible(req, providerBaseURL(req.provider), providerKey(req.provider));
  }
}

function providerBaseURL(provider: LLMProvider): string {
  switch (provider) {
    case "groq":       return "https://api.groq.com/openai/v1";
    case "mistral":    return "https://api.mistral.ai/v1";
    case "together":   return "https://api.together.xyz/v1";
    case "perplexity": return "https://api.perplexity.ai";
    case "xai":        return "https://api.x.ai/v1";
    default:           return "https://api.openai.com/v1";
  }
}

function providerKey(provider: LLMProvider): string | undefined {
  switch (provider) {
    case "groq":       return process.env.GROQ_API_KEY;
    case "mistral":    return process.env.MISTRAL_API_KEY;
    case "together":   return process.env.TOGETHER_API_KEY;
    case "perplexity": return process.env.PERPLEXITY_API_KEY;
    case "xai":        return process.env.XAI_API_KEY;
    default:           return process.env.OPENAI_API_KEY;
  }
}

async function streamOpenAICompatible(
  req: ForwardRequest,
  baseURL: string,
  apiKey: string | undefined
): Promise<ReadableStream<Uint8Array>> {
  const client = new OpenAI({ apiKey: apiKey || "", baseURL });
  const stream = await client.chat.completions.create({
    model: req.model,
    messages: req.messages as OpenAI.Chat.ChatCompletionMessageParam[],
    temperature: req.temperature,
    max_tokens: req.max_tokens,
    stream: true,
  });

  const encoder = new TextEncoder();
  const id = `rgx_${Date.now()}`;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            const sseChunk = {
              id,
              object: "chat.completion.chunk",
              model: req.model,
              choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseChunk)}\n\n`));
          }
          if (chunk.choices[0]?.finish_reason) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });
}

async function streamAnthropic(req: ForwardRequest): Promise<ReadableStream<Uint8Array>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages = req.messages as Array<{ role: string; content: string }>;
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystemMsgs = messages.filter((m) => m.role !== "system");

  const stream = await client.messages.create({
    model: req.model || "claude-haiku-4-5-20251001",
    max_tokens: req.max_tokens || 4096,
    system: systemMsg?.content,
    messages: nonSystemMsgs as Anthropic.MessageParam[],
    stream: true,
  });

  const encoder = new TextEncoder();
  const id = `rgx_${Date.now()}`;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta" &&
            event.delta.text
          ) {
            const sseChunk = {
              id,
              object: "chat.completion.chunk",
              model: req.model,
              choices: [{ index: 0, delta: { content: event.delta.text }, finish_reason: null }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseChunk)}\n\n`));
          }
          if (event.type === "message_stop") {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });
}

// Fallback: run non-streaming, emit the full content as a single SSE chunk
async function streamViaNonStreaming(req: ForwardRequest): Promise<ReadableStream<Uint8Array>> {
  const response = await forwardToLLM(req);
  const encoder = new TextEncoder();
  const id = `rgx_${Date.now()}`;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const sseChunk = {
        id,
        object: "chat.completion.chunk",
        model: response.model,
        choices: [{ index: 0, delta: { content: response.content }, finish_reason: "stop" }],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseChunk)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

// ─── Non-streaming implementations ──────────────────────────────────────────

async function forwardOpenAI(req: ForwardRequest): Promise<ForwardResponse> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: req.model || "gpt-4o",
    messages: req.messages as OpenAI.Chat.ChatCompletionMessageParam[],
    temperature: req.temperature,
    max_tokens: req.max_tokens,
  });
  return {
    content: response.choices[0]?.message?.content || "",
    model: response.model,
    usage: {
      input_tokens: response.usage?.prompt_tokens,
      output_tokens: response.usage?.completion_tokens,
    },
  };
}

async function forwardAnthropic(req: ForwardRequest): Promise<ForwardResponse> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages = req.messages as Array<{ role: string; content: string }>;
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystemMsgs = messages.filter((m) => m.role !== "system");

  const response = await client.messages.create({
    model: req.model || "claude-haiku-4-5-20251001",
    max_tokens: req.max_tokens || 4096,
    system: systemMsg?.content,
    messages: nonSystemMsgs as Anthropic.MessageParam[],
  });

  return {
    content: response.content[0]?.type === "text" ? response.content[0].text : "",
    model: response.model,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

async function forwardGemini(req: ForwardRequest): Promise<ForwardResponse> {
  const modelName = req.model || "gemini-2.0-flash-lite";
  const messages = req.messages as Array<{ role: string; content: string }>;
  const systemMsg = messages.find((m) => m.role === "system");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      ...(req.max_tokens && { maxOutputTokens: req.max_tokens }),
      ...(req.temperature !== undefined && { temperature: req.temperature }),
    },
  };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GOOGLE_AI_API_KEY || ""}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);

  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || "", model: modelName };
}

async function forwardOpenAICompatible(
  req: ForwardRequest,
  baseURL: string,
  apiKey: string | undefined
): Promise<ForwardResponse> {
  const client = new OpenAI({ apiKey: apiKey || "", baseURL });
  const response = await client.chat.completions.create({
    model: req.model,
    messages: req.messages as OpenAI.Chat.ChatCompletionMessageParam[],
    temperature: req.temperature,
    max_tokens: req.max_tokens,
  });
  return {
    content: response.choices[0]?.message?.content || "",
    model: response.model,
    usage: {
      input_tokens: response.usage?.prompt_tokens,
      output_tokens: response.usage?.completion_tokens,
    },
  };
}

async function forwardCohere(req: ForwardRequest): Promise<ForwardResponse> {
  const messages = req.messages as Array<{ role: string; content: string }>;
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");
  const chatHistory = nonSystem.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "CHATBOT" : "USER",
    message: m.content,
  }));
  const lastMessage = nonSystem.at(-1);

  const res = await fetch("https://api.cohere.ai/v1/chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.COHERE_API_KEY || ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: req.model || "command-r-plus",
      message: lastMessage?.content || "",
      preamble: systemMsg?.content,
      chat_history: chatHistory,
      max_tokens: req.max_tokens,
      temperature: req.temperature,
    }),
  });
  if (!res.ok) throw new Error(`Cohere API error: ${res.status}`);
  const data = await res.json() as { text: string; meta?: { tokens?: { input_tokens?: number; output_tokens?: number } } };
  return {
    content: data.text,
    model: req.model || "command-r-plus",
    usage: {
      input_tokens: data.meta?.tokens?.input_tokens,
      output_tokens: data.meta?.tokens?.output_tokens,
    },
  };
}
