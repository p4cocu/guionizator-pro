import Anthropic from "@anthropic-ai/sdk";
import type { BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import fs from "fs";
import path from "path";

export const MODEL_DEFAULT = "claude-sonnet-4-6";
export const MODEL_QUALITY = "claude-opus-4-8";
export const MODEL_FAST = "claude-haiku-4-5-20251001";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function readDefaultBrain(): string {
  const brainPath = path.join(process.cwd(), "brain", "system-prompt.md");
  return fs.readFileSync(brainPath, "utf-8");
}

export interface GenerateOptions {
  userMessage: string;
  brainContent?: string;
  clientContext?: string;
  model?: string;
  maxTokens?: number;
}

export interface GenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export async function generateWithBrain(
  opts: GenerateOptions
): Promise<GenerateResult> {
  const {
    userMessage,
    brainContent,
    clientContext,
    model = MODEL_DEFAULT,
    maxTokens = 4096,
  } = opts;

  const brain = brainContent ?? readDefaultBrain();

  const systemBlocks: BetaTextBlockParam[] = [
    {
      type: "text",
      text: brain,
      cache_control: { type: "ephemeral" },
    },
  ];

  if (clientContext) {
    systemBlocks.push({
      type: "text",
      text: clientContext,
    });
  }

  const response = await client.beta.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemBlocks,
    messages: [{ role: "user", content: userMessage }],
    betas: ["prompt-caching-2024-07-31"],
  });

  const text =
    response.content
      .filter(
        (b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text"
      )
      .map((b) => b.text)
      .join("") ?? "";

  const usage = response.usage;

  return {
    text,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
  };
}
