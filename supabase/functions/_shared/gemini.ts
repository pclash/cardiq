// ============================================================
// Gemini API Helper
// 
// Translates OpenAI-style chat completions to Google Gemini
// so the rest of the code can stay in the format Lovable used.
//
// Usage:
//   const result = await callGemini({
//     systemPrompt: "You are a helpful assistant",
//     userPrompt: "Hello",
//     jsonOutput: true
//   });
// ============================================================

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface GeminiCallOptions {
  systemPrompt: string;
  userPrompt: string;
  jsonOutput?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export async function callGemini({
  systemPrompt,
  userPrompt,
  jsonOutput = true,
  maxTokens = 6000,
  temperature = 0.4,
}: GeminiCallOptions): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not set");
  }

  // Combine system + user prompts (Gemini doesn't have separate system role)
  const combinedPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  const body = {
    contents: [
      {
        parts: [{ text: combinedPrompt }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(jsonOutput ? { responseMimeType: "application/json" } : {}),
      thinkingConfig: { thinkingBudget: 0 }, // Disable thinking for faster responses
    },
  };

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errorText.substring(0, 300)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  return text.replace(/```json|```/g, "").trim();
}

/**
 * Parse Gemini's response as JSON with fallback handling
 */
export function parseGeminiJSON<T = any>(text: string, fallback: T): T {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Gemini JSON:", text.substring(0, 200));
    return fallback;
  }
}
