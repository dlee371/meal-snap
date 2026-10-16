// The ONLY file that talks to the AI provider (server-only).
// Input: image bytes. Output: validated food items, or a thrown AnalyzeMealError.
// Nothing else in the app knows which AI provider or model we use.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { aiMealSchema, describeZodError } from "@/lib/schemas";
import plateFixture from "@/lib/fixtures/ai-plate.json";
import drinkFixture from "@/lib/fixtures/ai-drink.json";
import notFoodFixture from "@/lib/fixtures/ai-not-food.json";
import invalidFixture from "@/lib/fixtures/ai-invalid.json";

export const DEFAULT_MODEL = "claude-haiku-5-5";
const TOOL_NAME = "record_meal";
const MAX_ATTEMPTS = 2; // first try + one retry on bad output

// The tool's input schema IS the answer format. `strict: true` makes the API
// guarantee the model's tool input matches this shape (types, required fields,
// enums). Ranges like "calories <= 3000" can't be expressed here (the API
// doesn't support min/max with strict), so Zod checks those afterwards.
const NUMBER_FIELD = (description) => ({ type: "integer", description });
export const RECORD_MEAL_TOOL = {
  name: TOOL_NAME,
  description: "Record the foods and drinks visible in the meal photo, with nutrition estimates.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["is_food", "items", "notes"],
    properties: {
      is_food: {
        type: "boolean",
        description: "false if the photo contains no food or drink at all",
      },
      items: {
        type: "array",
        description: "One entry per distinct food or drink (at most 15). Empty if is_food is false.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "portion", "grams", "calories", "protein_g", "carbs_g", "fat_g", "confidence"],
          properties: {
            name: { type: "string", description: 'Short lowercase name, e.g. "grilled chicken breast"' },
            portion: { type: "string", description: 'Human-friendly portion, e.g. "about 1 cup"' },
            grams: NUMBER_FIELD("Estimated weight in grams (0-2000)"),
            calories: NUMBER_FIELD("Estimated kcal for this portion (0-3000)"),
            protein_g: NUMBER_FIELD("Protein in whole grams"),
            carbs_g: NUMBER_FIELD("Carbohydrates in whole grams"),
            fat_g: NUMBER_FIELD("Fat in whole grams"),
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "How sure you are about this item's identity and portion",
            },
          },
        },
      },
      notes: {
        type: "string",
        description: "Anything the user should know (hidden ingredients, assumptions). Empty string if none.",
      },
    },
  },
};

// Starting-point instruction from the build plan.
const INSTRUCTION =
  "Identify each distinct food or drink in this photo. Estimate a realistic portion " +
  "and its nutrition. If you are unsure, say so with confidence \"low\" rather than " +
  "guessing confidently. If the photo contains no food, set is_food to false and " +
  "return an empty items list. Record your answer with the record_meal tool.";

export class AnalyzeMealError extends Error {
  // `raw` = the last (invalid) AI answer, if any, so it can still be stored in ai_raw.
  constructor(message, { raw = null, cause } = {}) {
    super(message, { cause });
    this.name = "AnalyzeMealError";
    this.raw = raw;
  }
}

// AI_MOCK=true (or plate / drink / not_food / invalid) → saved answers, no API cost.
const MOCK_FIXTURES = {
  true: plateFixture,
  plate: plateFixture,
  drink: drinkFixture,
  not_food: notFoodFixture,
  invalid: invalidFixture,
};
function mockMode() {
  const value = (process.env.AI_MOCK || "").trim().toLowerCase();
  return value in MOCK_FIXTURES ? value : null;
}

export function currentModelName() {
  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  const mock = mockMode();
  return mock ? `mock:${mock}` : model;
}

// A stand-in for the Anthropic client that answers with a fixture. It returns the
// same response shape as the real API, so mock mode exercises the same code path.
function createMockClient(fixture) {
  return {
    messages: {
      async create() {
        await new Promise((resolve) => setTimeout(resolve, 1500)); // feel the loading state
        return {
          stop_reason: "tool_use",
          content: [{ type: "tool_use", id: "mock", name: TOOL_NAME, input: structuredClone(fixture) }],
        };
      },
    },
  };
}

let realClient;
function getClient() {
  const mock = mockMode();
  if (mock) return createMockClient(MOCK_FIXTURES[mock]);
  // Reads ANTHROPIC_API_KEY from the environment. The SDK already retries
  // network errors, 429s and 5xx responses (2 retries by default).
  realClient ??= new Anthropic({ timeout: 45_000 });
  return realClient;
}

/**
 * Analyze a meal photo.
 * @param {Uint8Array} imageBytes - JPEG/PNG/WebP bytes
 * @param {string} mediaType - "image/jpeg" | "image/png" | "image/webp"
 * @param {{ client?: object, model?: string }} [options] - injectable for tests
 * @returns {Promise<{ meal: object, raw: object, attempts: number }>}
 */
export async function analyzeMeal(imageBytes, mediaType, options = {}) {
  const client = options.client ?? getClient();
  const model = options.model ?? (process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL);

  const request = {
    model,
    max_tokens: 4096, // room for up to 15 items; a truncated answer fails validation and retries
    tools: [RECORD_MEAL_TOOL],
    // Force the model to answer by calling record_meal, so the answer is always JSON
    // in our shape (the tool's input) rather than free text.
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: Buffer.from(imageBytes).toString("base64") },
          },
          { type: "text", text: INSTRUCTION },
        ],
      },
    ],
  };

  let lastRaw = null;
  let lastProblem = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // API errors (bad key, no credit, outage) are thrown here and not retried by us:
    // the SDK has already retried the retryable ones.
    const response = await client.messages.create(request);

    // Safety classifiers can decline a request (HTTP 200 with stop_reason "refusal").
    if (response.stop_reason === "refusal") {
      throw new AnalyzeMealError("The AI declined to analyze this photo.");
    }

    const toolUse = response.content.find(
      (block) => block.type === "tool_use" && block.name === TOOL_NAME,
    );
    if (!toolUse) {
      lastProblem = `no ${TOOL_NAME} call (stop_reason: ${response.stop_reason})`;
      continue;
    }

    lastRaw = toolUse.input;
    const parsed = aiMealSchema.safeParse(toolUse.input);
    if (parsed.success) {
      return { meal: parsed.data, raw: toolUse.input, attempts: attempt };
    }
    lastProblem = describeZodError(parsed.error);
    console.warn(`analyzeMeal attempt ${attempt} returned invalid data: ${lastProblem}`);
  }

  throw new AnalyzeMealError(`AI answer was invalid after ${MAX_ATTEMPTS} attempts: ${lastProblem}`, {
    raw: lastRaw,
  });
}
