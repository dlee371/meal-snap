// Tests the retry/validation logic with a fake client, so no API calls (or costs).
import { describe, it, expect } from "vitest";
import { analyzeMeal, AnalyzeMealError, RECORD_MEAL_TOOL } from "@/lib/analyzeMeal";
import plate from "@/lib/fixtures/ai-plate.json";
import notFood from "@/lib/fixtures/ai-not-food.json";
import invalid from "@/lib/fixtures/ai-invalid.json";

const IMAGE = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

// Fake Anthropic client: answers each call with the next response in the list,
// and remembers the requests it received.
function fakeClient(...responses) {
  const requests = [];
  return {
    requests,
    messages: {
      async create(request) {
        requests.push(request);
        return responses[requests.length - 1];
      },
    },
  };
}
const toolAnswer = (input) => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id: "t1", name: "record_meal", input }],
});

describe("analyzeMeal", () => {
  it("forces the record_meal tool and sends the image as base64", async () => {
    const client = fakeClient(toolAnswer(plate));
    await analyzeMeal(IMAGE, "image/jpeg", { client, model: "test-model" });

    const [request] = client.requests;
    expect(request.model).toBe("test-model");
    expect(request.tool_choice).toEqual({ type: "tool", name: "record_meal" });
    expect(request.tools).toEqual([RECORD_MEAL_TOOL]);
    const [image, text] = request.messages[0].content;
    expect(image.source).toEqual({ type: "base64", media_type: "image/jpeg", data: "/9j/4A==" });
    expect(text.text).toMatch(/Identify each distinct food or drink/);
  });

  it("returns validated items and the raw answer on the first try", async () => {
    const client = fakeClient(toolAnswer(plate));
    const result = await analyzeMeal(IMAGE, "image/jpeg", { client });
    expect(result.attempts).toBe(1);
    expect(result.meal.items).toHaveLength(4);
    expect(result.raw).toEqual(plate);
  });

  it("passes 'not food' answers through for the caller to handle", async () => {
    const result = await analyzeMeal(IMAGE, "image/jpeg", { client: fakeClient(toolAnswer(notFood)) });
    expect(result.meal.is_food).toBe(false);
  });

  it("retries once when the first answer is invalid", async () => {
    const client = fakeClient(toolAnswer(invalid), toolAnswer(plate));
    const result = await analyzeMeal(IMAGE, "image/jpeg", { client });
    expect(client.requests).toHaveLength(2);
    expect(result.attempts).toBe(2);
  });

  it("retries when the model doesn't call the tool", async () => {
    const noTool = { stop_reason: "end_turn", content: [{ type: "text", text: "Looks tasty!" }] };
    const client = fakeClient(noTool, toolAnswer(plate));
    const result = await analyzeMeal(IMAGE, "image/jpeg", { client });
    expect(result.attempts).toBe(2);
  });

  it("gives up after two invalid answers and keeps the raw answer for ai_raw", async () => {
    const client = fakeClient(toolAnswer(invalid), toolAnswer(invalid));
    const error = await analyzeMeal(IMAGE, "image/jpeg", { client }).catch((e) => e);
    expect(error).toBeInstanceOf(AnalyzeMealError);
    expect(error.raw).toEqual(invalid);
    expect(client.requests).toHaveLength(2); // no third call
  });

  it("stops immediately on a safety refusal", async () => {
    const client = fakeClient({ stop_reason: "refusal", content: [] });
    await expect(analyzeMeal(IMAGE, "image/jpeg", { client })).rejects.toThrow(/declined/);
    expect(client.requests).toHaveLength(1);
  });

  it("lets API errors (bad key, no credit) propagate without retrying", async () => {
    const client = {
      calls: 0,
      messages: {
        async create() {
          client.calls++;
          throw new Error("401 invalid x-api-key");
        },
      },
    };
    await expect(analyzeMeal(IMAGE, "image/jpeg", { client })).rejects.toThrow(/401/);
    expect(client.calls).toBe(1);
  });
});
