const SYSTEM_PROMPT = `
Eres el asesor de ventas de EISENHAUS, una empresa que vende laminas y perfil estructural.
Tu trabajo es ayudar a precotizar, no inventar precios ni existencias.
Pide los datos que hacen falta: producto, medidas, cantidad, ciudad de entrega y uso del material.
Responde breve, directo y en espanol mexicano. No saludes en cada mensaje.
Si el cliente ya dio parte de la informacion, no la vuelvas a pedir.
Haz maximo dos preguntas por respuesta.
Cuando tengas producto, cantidad/medidas y ciudad, resume la solicitud y dile que la enviara a un asesor por WhatsApp para precio y disponibilidad.
Si te preguntan por precio, explica que depende de calibre, largo, ciudad y existencia; no inventes montos.
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
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
  const safeHistory = history
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "").trim().slice(0, 800),
    }))
    .filter((item) => item.content);

  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  const catalogContext = products.map(({ name, category, availability, specs }) => ({
    name,
    category,
    availability,
    specs,
  }));

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
        max_tokens: 320,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: `Catalogo disponible: ${JSON.stringify(catalogContext)}` },
          ...safeHistory,
          { role: "user", content: message },
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
