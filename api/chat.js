const SYSTEM_PROMPT = `
Eres el asesor de ventas de EISENHAUS, una empresa que vende laminas y perfil estructural.
Tu trabajo es ayudar a precotizar, no inventar precios ni existencias.
Pide los datos que hacen falta: producto, medidas, cantidad, ciudad de entrega y uso del material.
Responde breve, directo y en espanol mexicano.
Productos principales: lamina galvanizada, Zintro Alum, plastiteja roja, polin C 3 pulgadas, PTR R300/R200 y perfiles rectangulares.
`.trim();

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const chatUrl = baseUrl.replace(/\/$/, "").endsWith("/chat/completions")
    ? baseUrl.replace(/\/$/, "")
    : `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  if (!apiKey) {
    return res.status(500).json({ error: "Missing AI_API_KEY" });
  }

  const message = String(req.body?.message || "").trim().slice(0, 1200);
  const products = Array.isArray(req.body?.products) ? req.body.products.slice(0, 20) : [];

  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  try {
    const upstream = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 220,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              message,
              catalog: products.map(({ name, category, availability, specs }) => ({
                name,
                category,
                availability,
                specs,
              })),
            }),
          },
        ],
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data?.error?.message || "AI provider error",
      });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    return res.status(200).json({
      reply: reply || "Pasame producto, medidas, cantidad y ciudad para armar la cotizacion.",
    });
  } catch (error) {
    return res.status(500).json({ error: "Chat unavailable" });
  }
};
