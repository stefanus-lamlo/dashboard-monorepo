import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient(context: string): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(`OPENAI_API_KEY is not set. Add it to apps/api/.env to enable ${context}.`);
  }
  if (!client) client = new OpenAI({ apiKey });
  return client;
}
