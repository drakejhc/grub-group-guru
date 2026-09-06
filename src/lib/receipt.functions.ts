import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  imageDataUrl: z.string().min(32).max(12_000_000),
});

export type ExtractedItem = {
  name: string;
  quantity: string | null;
  category: string;
  location: string;
  shelf_life_days: number;
};

const SYSTEM = `You read photos of grocery receipts and return the food and household items purchased.
Rules:
- Return the everyday name of the product in sentence case ("Semi-skimmed milk" -> "Milk", "BNNA LOOSE" -> "Bananas").
- Skip totals, taxes, discounts, loyalty lines, payment lines and store details.
- category must be one of: produce, meat, dairy, bakery, frozen, pantry, drinks, household, other.
- location must be one of: fridge, pantry, freezer — where the item is normally kept at home.
- shelf_life_days is a realistic estimate of how long it stays good once home.
- If the image is not a receipt, return an empty items array.`;

export const extractReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "List everything bought on this receipt." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "record_items",
              description: "Record the items purchased on the receipt",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        quantity: { type: "string" },
                        category: {
                          type: "string",
                          enum: [
                            "produce",
                            "meat",
                            "dairy",
                            "bakery",
                            "frozen",
                            "pantry",
                            "drinks",
                            "household",
                            "other",
                          ],
                        },
                        location: { type: "string", enum: ["fridge", "pantry", "freezer"] },
                        shelf_life_days: { type: "number" },
                      },
                      required: ["name", "category", "location", "shelf_life_days"],
                    },
                  },
                },
                required: ["items"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "record_items" } },
      }),
    });

    if (response.status === 429) {
      throw new Error("The scanner is busy right now — try again in a moment.");
    }
    if (response.status === 402) {
      throw new Error("Receipt scanning is out of credit for this workspace.");
    }
    if (!response.ok) {
      const detail = await response.text();
      console.error("AI gateway error", response.status, detail);
      throw new Error("Couldn't read that receipt.");
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{ function?: { arguments?: string } }>;
        };
      }>;
    };

    const args = payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { items: [] as ExtractedItem[] };

    try {
      const parsed = JSON.parse(args) as { items?: ExtractedItem[] };
      const items = (parsed.items ?? []).filter((i) => i && typeof i.name === "string");
      return { items };
    } catch {
      return { items: [] as ExtractedItem[] };
    }
  });
