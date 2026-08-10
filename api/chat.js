const SYSTEM_PROMPT = `
Eres el asesor de ventas de EISENHAUS, una empresa que vende laminas y perfil estructural.
Tu trabajo es ayudar a precotizar, no inventar precios ni existencias.
No inventes calibres, grosores, largos, composicion del material, precios, existencias, tiempos de entrega ni garantias.
Si un dato no esta en el catalogo, di "eso lo confirma el asesor" y sigue reuniendo datos utiles.
Pide los datos que hacen falta: producto, medidas, cantidad, ciudad de entrega y uso del material.
Responde breve, directo y en espanol mexicano. No saludes en cada mensaje.
Si el cliente ya dio parte de la informacion, no la vuelvas a pedir.
Haz maximo dos preguntas por respuesta.
Si el cliente no sabe que material elegir, compara maximo 3 opciones con pros/contras practicos y recomienda una segun el uso.
Cuando el cliente de medidas de area, calcula el area aproximada en m2 y usala para orientar piezas, pero aclara que se confirma con traslapes, pendiente y desperdicio.
Cuando tengas producto, cantidad/medidas y ciudad, resume la solicitud y dile que la enviara a un asesor por WhatsApp para precio y disponibilidad.
Si te preguntan por precio, explica que depende de calibre, largo, ciudad y existencia; no inventes montos.
Productos principales: lamina galvanizada, Zintro Alum, plastiteja roja, polin C 3 pulgadas, PTR R300/R200 y perfiles rectangulares.
`.trim();

const CATALOG_NOTES = `
Catalogo confirmado:
- Lamina galvanizada: para techo y cerramiento, ancho aproximado 1.00 m, largos segun existencia.
- Galvanizada varias medidas: acanalada, ancho aproximado 1.00 m, entrega segun ciudad.
- Zintro Alum: lamina acanalada para techo industrial, varias medidas segun existencia.
- Plastiteja roja: cubierta decorativa tipo teja; medidas conocidas de 1.00 x 2.60 m a 1.00 x 7.28 m. No afirmar composicion especifica.
- Polin C 3 pulgadas: perfil C, tramo comercial de 6 m.
- PTR R300/R200: perfil tubular rectangular, 3 pulgadas, tramo comercial de 6 m.
- Perfiles rectangulares: pintado o zintro, varias medidas, tramo comercial de 6 m.
No hay precios publicados en el sitio.
`.trim();

const isProduction = process.env.VERCEL_ENV === "production";

function devLog(label, value) {
  if (isProduction) return;
  const stamp = new Date().toISOString();
  console.log(`[chat:${label}] ${stamp}`, value);
}

function envValue(name, fallback = "") {
  const raw = process.env[name] || fallback;
  return String(raw).trim().replace(/^["']|["']$/g, "");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = envValue("AI_API_KEY");
  const baseUrl = envValue("AI_BASE_URL", "https://api.openai.com/v1");
  const model = envValue("AI_MODEL", "gpt-4o-mini");
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

  devLog("request", {
    message,
    historyMessages: safeHistory.length,
    model,
    baseUrl,
  });

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
        thinking: { type: "disabled" },
        temperature: 0.3,
        max_tokens: 520,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: CATALOG_NOTES },
          { role: "system", content: `Catalogo visible en pagina: ${JSON.stringify(catalogContext)}` },
          ...safeHistory,
          { role: "user", content: message },
        ],
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      devLog("provider_error", data?.error || data);
      return res.status(upstream.status).json({
        error: data?.error?.message || "AI provider error",
      });
    }

    const choice = data?.choices?.[0];
    const reply = choice?.message?.content?.trim();
    devLog("finish", {
      finish_reason: choice?.finish_reason,
      usage: data?.usage,
      emptyReply: !reply,
    });
    if (!reply) devLog("empty_choice", choice);
    devLog("reply", reply);
    return res.status(200).json({
      reply: reply || "Pasame producto, medidas, cantidad y ciudad para armar la cotizacion.",
    });
  } catch (error) {
    devLog("exception", error?.message || error);
    return res.status(500).json({ error: "Chat unavailable" });
  }
};
