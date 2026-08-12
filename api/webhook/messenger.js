const crypto = require("crypto");

module.exports.config = { api: { bodyParser: false } };

const SYSTEM_PROMPT = `
Eres el asesor de ventas de EISENHAUS, empresa que vende lamina y perfil estructural, operando desde Hermosillo y Navojoa (Sonora) y alrededores. Estas respondiendo por Messenger de Facebook.

No inventes calibres, grosores, largos, composicion del material, precios, existencias, tiempos de entrega ni cobertura de zonas. Los precios que puedes usar (validos solo para zona Navojoa, en Hermosillo pueden variar y se confirma por WhatsApp) son:
- Lamina galvanizada: 6.10m $800, 5.50m $785, 4.88m $660, 4.27m $580, 3.66m $510, 3.05m $425, 2.44m $360 (precio por pieza, ancho ~0.82m)
- Plastiteja roja: 6.0m $1430, 5.0m $1200, 4.0m $970, 3.0m $740, 2.0m $510 (precio por pieza), caballete $600
- Polin C: tipo 3 $620, tipo 4 $720 (tramo de 6m)
- Pija punta de broca: $180 el ciento
- Zintro Alum, PTR y perfiles rectangulares: no tienen precio confirmado todavia, dile al cliente que se cotiza directo con el asesor.

Responde breve, directo y en espanol mexicano. No saludes en cada mensaje. Haz maximo dos preguntas por respuesta.
En cuanto el cliente diga que material, medida/cantidad y ciudad, o si prefiere hablar con alguien, dile que le pasas al asesor y comparte este link: https://wa.me/14158735968
Cobertura actual: solo zona sur-centro de Sonora (Hermosillo, Navojoa y alrededores), nacional aun no disponible.
`.trim();

function envValue(name, fallback = "") {
  const raw = process.env[name] || fallback;
  return String(raw).trim().replace(/^["']|["']$/g, "");
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function isValidSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const conversations = new Map();

function getHistory(psid) {
  return conversations.get(psid) || [];
}

function pushHistory(psid, role, content) {
  const history = getHistory(psid);
  history.push({ role, content });
  conversations.set(psid, history.slice(-10));
}

async function getAiReply(psid, userText) {
  const apiKey = envValue("AI_API_KEY");
  const baseUrl = envValue("AI_BASE_URL", "https://api.openai.com/v1");
  const model = envValue("AI_MODEL", "gpt-4o-mini");
  const chatUrl = baseUrl.replace(/\/$/, "").endsWith("/chat/completions")
    ? baseUrl.replace(/\/$/, "")
    : `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...getHistory(psid),
    { role: "user", content: userText },
  ];

  const upstream = await fetch(chatUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.3, max_tokens: 400, messages }),
  });

  const data = await upstream.json();
  if (!upstream.ok) {
    throw new Error(data?.error?.message || "AI provider error");
  }
  return data?.choices?.[0]?.message?.content?.trim() || "Pasame producto, medida/cantidad y ciudad para ayudarte a cotizar.";
}

async function sendMessengerReply(psid, text) {
  const pageToken = envValue("META_PAGE_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageToken)}`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: psid }, message: { text } }),
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === envValue("META_VERIFY_TOKEN")) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers["x-hub-signature-256"];
  if (!isValidSignature(rawBody, signature, envValue("META_APP_SECRET"))) {
    return res.status(403).json({ error: "Invalid signature" });
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch (error) {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  if (body.object !== "page") {
    return res.status(404).json({ error: "Not a page event" });
  }

  res.status(200).send("EVENT_RECEIVED");

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const psid = event.sender?.id;
      const text = event.message?.text;
      if (!psid || !text || event.message?.is_echo) continue;

      try {
        pushHistory(psid, "user", text);
        const reply = await getAiReply(psid, text);
        pushHistory(psid, "assistant", reply);
        await sendMessengerReply(psid, reply);
      } catch (error) {
        console.error("[messenger:webhook]", error?.message || error);
      }
    }
  }
};
