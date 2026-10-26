/* Talks to the Claude API directly from the browser (the key never leaves this browser except to api.anthropic.com). */
(function () {
  const API = "https://api.anthropic.com/v1/messages";

  const TOOL = {
    name: "deliver_prompts",
    description: "Return the brand reading and one finished image prompt per requested file.",
    input_schema: {
      type: "object",
      properties: {
        brand_mood: { type: "string", description: "One short sentence on the logo's personality, e.g. 'confident, traditional, premium'." },
        colors: {
          type: "object",
          properties: {
            dark: { type: "string", description: "Natural colour name for the dark/base colour, 1-3 words, e.g. 'deep navy'." },
            main: { type: "string", description: "Natural colour name for the main colour." },
            accent: { type: "string", description: "Natural colour name for the accent/button colour." },
          },
          required: ["dark", "main", "accent"],
        },
        tips: { type: "string", description: "One or two practical tips for generating this set (optional)." },
        prompts: {
          type: "array",
          items: {
            type: "object",
            properties: { file: { type: "string" }, prompt: { type: "string" } },
            required: ["file", "prompt"],
          },
        },
      },
      required: ["brand_mood", "colors", "prompts"],
    },
  };

  function buildRequest({ model, template, rules, colors, pngDataUrl }) {
    const photos = template.photos.map((p) => `- ${p.file} (${p.size}): ${p.prompt}`).join("\n");
    const system =
      "You write image-generation prompts for small-business websites in India. " +
      "You adapt existing base prompts to a client's brand colours. Keep every base prompt's subject, framing, composition, background rules (e.g. 'pure plain white background', 'left half empty for text'), people's region and the 'no readable text or logos' rule exactly. " +
      "Work the three colours in naturally (clothes, walls, props, lighting) with clear roles: DARK = deep base tones, MAIN = the dominant brand colour, ACCENT = small touches only. Use colour NAMES, never hex codes. " +
      "Never put the client's logo, brand name or any words into the image. Each prompt must stand alone (one paragraph, 40-90 words). Return every file exactly once, with the exact file name.";
    const text =
      `Template: ${template.label}\nTemplate look: ${template.look}\nGeneral rules: ${rules}\n\n` +
      `Website colours picked from the attached logo:\n- DARK/base: ${colors.dark}\n- MAIN: ${colors.main}\n- ACCENT/buttons: ${colors.accent}\n\n` +
      `Base prompts ([DARK] [MAIN] [ACCENT] mark where colours go):\n${photos}\n\n` +
      "Look at the logo to judge its mood (traditional, modern, playful, premium...) and reflect that mood in the scenes, then call the deliver_prompts tool. " +
      "If you cannot call tools, reply with ONLY a JSON object with the same fields (brand_mood, colors {dark, main, accent}, tips, prompts [{file, prompt}]).";
    const [, mediaType, data] = pngDataUrl.match(/^data:(image\/png);base64,(.+)$/) || [];
    const content = [];
    if (data) content.push({ type: "image", source: { type: "base64", media_type: mediaType, data } });
    content.push({ type: "text", text });
    return {
      model,
      max_tokens: 16000,
      system,
      // no forced tool_choice: newer models reject it. Claude is told to call the tool,
      // and if it answers in plain text instead we read the JSON from the text.
      tools: [TOOL],
      messages: [{ role: "user", content }],
    };
  }

  async function run(apiKey, args, signal) {
    const res = await fetch(API, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(buildRequest(args)),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`;
      if (res.status === 401) throw new Error("The API key was rejected. Check it in Settings → API key.");
      if (res.status === 429) throw new Error("Rate limit or spend limit reached on your Anthropic account. Try again later.");
      if ((res.status === 404 || res.status === 400) && /model/i.test(msg)) throw new Error(`Model "${args.model}" isn't available on your API key. Pick another model in ⚙ Settings.`);
      throw new Error(msg);
    }
    const block = (body.content || []).find((b) => b.type === "tool_use" && b.name === "deliver_prompts");
    if (block) return { result: block.input, usage: body.usage };
    // fallback: JSON written as text
    const text = (body.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const start = text.indexOf("{"), end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const result = JSON.parse(text.slice(start, end + 1));
        if (Array.isArray(result.prompts)) return { result, usage: body.usage };
      } catch {}
    }
    if (body.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off (too long). Try again, or use Sonnet in ⚙ Settings.");
    throw new Error("Claude did not return prompts. Try again.");
  }

  window.Claude = { run, buildRequest };
})();
