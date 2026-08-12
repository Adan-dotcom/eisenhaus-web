const { TOOL_DEFINITIONS, runTool } = require("../lib/tools");

const FICHA_TECNICA = `
Lamina galvanizada (metalica, CON precio en catalogo): ideal para naves industriales, bodegas, techos de gran claro, cercos. Muy resistente a golpes/granizo, no se agrieta. Ligera, aislamiento termico/acustico bajo (se calienta mas, mas ruido con lluvia salvo que se agregue aislante). Generalmente mas economica por m2. Estetica industrial, no imita teja.
Zintro Alum (metalica, zinc-aluminio, SIN precio ni medidas confirmadas en catalogo todavia): en teoria mejor que galvanizada estandar en ambientes costeros/alta humedad, pero como no hay ficha confirmada, siempre que salga dile al cliente que se cotiza directo con el asesor, no le des precio ni midas piezas para este producto.
Plastiteja (PVC, CON precio en catalogo): ideal para techos residenciales visibles, cocheras, fachada con acabado tipo teja. No se oxida ni corroe, buena tolerancia a intemperie, menor resistencia a impacto fuerte que lamina metalica calibre grueso. Mejor aislamiento termico/acustico (mas silenciosa con lluvia). Vida util larga, el color puede decolorarse con años de sol intenso. Mantenimiento minimo. Generalmente mas cara por m2 que galvanizada estandar.
Regla: bodega/nave/presupuesto ajustado/area no visible -> galvanizada. Casa/cochera/fachada visible/quiere aspecto teja -> plastiteja. Prioriza silencio bajo lluvia o aislamiento -> plastiteja. Ambiente costero/alta humedad -> menciona Zintro Alum como opcion pero aclara que se cotiza directo, sin precio en catalogo. Acompaña siempre con "el calibre y la estructura final los valida el asesor".
`.trim();

const SYSTEM_PROMPT = `
Eres el asesor de ventas de EISENHAUS, empresa que vende lamina y perfil estructural, operando desde Hermosillo y Navojoa (Sonora) y alrededores. Estas respondiendo por Messenger de Facebook, en texto plano (no hay botones ni tarjetas), asi que cuando tengas que compartir un link ponlo tal cual en el texto.

REGLA 1, SIEMPRE PRIMERO: si en el historial no hay ya un nombre y un contacto (telefono o correo) del cliente, tu UNICA tarea es pedirlos de forma breve y amable. No cotices, no calcules, no des cobertura ni compares productos hasta tenerlos. En cuanto el cliente los de, llama la tool save_lead con nombre y contacto, y despues sigue la conversacion normal.

No inventes calibres, grosores, largos, composicion del material, precios, existencias, tiempos de entrega ni cobertura de zonas. Para eso usa las tools, nunca calcules ni asumas a mano:
- check_delivery_coverage: si se entrega en una ciudad, en cuanto tiempo y con que costo.
- calc_lamina_pieces / calc_lamina_pieces_from_area: piezas de lamina o plastiteja necesarias.
- calc_barras_estructurales: piezas de PTR/polin C/perfil a partir de metros lineales ya definidos.
- build_whatsapp_handoff: arma el link final para mandar la cotizacion al asesor. Llama esta tool y comparte el link (url) que te regresa tal cual en tu respuesta de texto, ya que aqui en Messenger no hay boton aparte.

Precios y existencia SOLO salen del catalogo que se te da como contexto en cada mensaje, nunca de memoria ni de lo que dijiste en turnos anteriores si ya no aplica. Solo cotizas precio y calculas piezas para productos que traen "price" en ese catalogo. Los que no traen "price" (apareceran sin ese campo): para esos nunca inventes un precio ni asumas que miden igual que otro producto — di claro que se cotiza directo con el asesor. calc_barras_estructurales lo puedes usar para PTR/polin/perfiles cuando el cliente ya sabe los metros lineales que necesita (todos vienen en tramo comercial de 6m), eso no requiere precio.

Responde breve, directo y en espanol mexicano. No saludes en cada mensaje. Si el cliente ya dio parte de la informacion, no la repitas ni la vuelvas a pedir. Haz maximo dos preguntas por respuesta.

Si el cliente no sabe que material elegir entre metalica y plastica, usa esta ficha para comparar y recomendar (maximo 3 opciones, pros/contras practicos):
${FICHA_TECNICA}

Cuando el cliente de medidas del techo (area total, o ancho a cubrir + largo de pendiente), usa las tools de calculo de piezas, no calcules tu a mano ni "a ojo".
Si preguntan por diseno estructural (separacion de polines, claros, cargas), no lo definas tu: aclara que eso lo valida el asesor por seguridad, y solo ayuda a convertir metros lineales ya definidos a piezas.
Cuando ya tengas producto, cantidad/medidas, ciudad con cobertura confirmada y datos de contacto, llama build_whatsapp_handoff con un resumen claro, comparte el link que regresa, y dile al cliente que ya quedo listo para mandarlo al asesor.
Cobertura actual: solo zona sur-centro de Sonora (Hermosillo, Navojoa y alrededores), nacional aun no disponible.
Productos principales: lamina galvanizada, Zintro Alum, plastiteja roja, polin C, PTR R300/R200 y perfiles rectangulares.
`.trim();

// Snapshot del catalogo de index.html - mismos precios que el sitio (zona Navojoa).
// Si cambian precios ahi, actualizar aqui tambien (no se leen del mismo array todavia).
const CATALOG_CONTEXT = [
  { id: "galvanizada-610", name: "Lamina galvanizada 6.10 x 0.82 m", category: "Lamina", price: 800, unit: "pieza" },
  { id: "galvanizada-550", name: "Lamina galvanizada 5.50 x 0.82 m", category: "Lamina", price: 785, unit: "pieza" },
  { id: "galvanizada-488", name: "Lamina galvanizada 4.88 x 0.82 m", category: "Lamina", price: 660, unit: "pieza" },
  { id: "galvanizada-427", name: "Lamina galvanizada 4.27 x 0.82 m", category: "Lamina", price: 580, unit: "pieza" },
  { id: "galvanizada-366", name: "Lamina galvanizada 3.66 x 0.82 m", category: "Lamina", price: 510, unit: "pieza" },
  { id: "galvanizada-305", name: "Lamina galvanizada 3.05 x 0.82 m", category: "Lamina", price: 425, unit: "pieza" },
  { id: "galvanizada-244", name: "Lamina galvanizada 2.44 x 0.82 m", category: "Lamina", price: 360, unit: "pieza" },
  { id: "zintro-alum", name: "Zintro Alum", category: "Lamina", availability: "Cotizar" },
  { id: "plastiteja-600", name: "Plastiteja roja 6.0 x 1.05 m", category: "Teja", price: 1430, unit: "pieza" },
  { id: "plastiteja-500", name: "Plastiteja roja 5.0 x 1.05 m", category: "Teja", price: 1200, unit: "pieza" },
  { id: "plastiteja-400", name: "Plastiteja roja 4.0 x 1.05 m", category: "Teja", price: 970, unit: "pieza" },
  { id: "plastiteja-300", name: "Plastiteja roja 3.0 x 1.05 m", category: "Teja", price: 740, unit: "pieza" },
  { id: "plastiteja-200", name: "Plastiteja roja 2.0 x 1.05 m", category: "Teja", price: 510, unit: "pieza" },
  { id: "caballete-plastiteja", name: "Caballete de plastiteja", category: "Teja", price: 600, unit: "pieza" },
  { id: "polin-c-3", name: "Polin C tipo 3", category: "Perfil", price: 620, unit: "pieza" },
  { id: "polin-c-4", name: "Polin C tipo 4", category: "Perfil", price: 720, unit: "pieza" },
  { id: "ptr-ternium-3x1.5", name: "PTR Ternium 3 x 1.5 pulgadas", category: "Perfil", price: 500, unit: "pieza" },
  { id: "perfiles-rectangulares", name: "Perfiles rectangulares", category: "Perfil", availability: "Cotizar" },
  { id: "pija-punta-broca", name: "Pija punta de broca", category: "Ferreteria", price: 180, unit: "ciento" },
];

function envValue(name, fallback = "") {
  const raw = process.env[name] || fallback;
  return String(raw).trim().replace(/^["']|["']$/g, "");
}

// Fallback en memoria: solo sobrevive mientras la instancia de Vercel siga
// caliente. Entre mensajes separados por minutos casi siempre se pierde, por
// eso Supabase (abajo) es la fuente real cuando esta configurado.
const conversations = new Map();

function supabaseConfig() {
  const url = envValue("SUPABASE_URL");
  const key = envValue("SUPABASE_SERVICE_KEY");
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

async function getHistory(psid) {
  const cfg = supabaseConfig();
  if (!cfg) return conversations.get(psid) || [];

  try {
    const res = await fetch(`${cfg.url}/rest/v1/bot_conversations?psid=eq.${encodeURIComponent(psid)}&select=messages`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    if (!res.ok) return conversations.get(psid) || [];
    const rows = await res.json();
    return rows?.[0]?.messages || [];
  } catch (error) {
    console.error("[messenger:history_read_error]", error?.message || error);
    return conversations.get(psid) || [];
  }
}

async function setHistory(psid, messages) {
  // Solo guarda los turnos de usuario/asistente, no el system prompt ni tool calls.
  const trimmed = messages.filter((m) => m.role === "user" || m.role === "assistant").slice(-10);
  conversations.set(psid, trimmed);

  const cfg = supabaseConfig();
  if (!cfg) return;

  try {
    await fetch(`${cfg.url}/rest/v1/bot_conversations`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify([{ psid, platform: "messenger", messages: trimmed, updated_at: new Date().toISOString() }]),
    });
  } catch (error) {
    console.error("[messenger:history_write_error]", error?.message || error);
  }
}

async function getAiReply(psid, userText) {
  const apiKey = envValue("AI_API_KEY");
  const baseUrl = envValue("AI_BASE_URL", "https://api.openai.com/v1");
  const model = envValue("AI_MODEL", "gpt-4o-mini");
  const chatUrl = baseUrl.replace(/\/$/, "").endsWith("/chat/completions")
    ? baseUrl.replace(/\/$/, "")
    : `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Catalogo actual, unica fuente de verdad (incluye precio): ${JSON.stringify(CATALOG_CONTEXT)}` },
    ...(await getHistory(psid)),
    { role: "user", content: userText },
  ];

  const MAX_ROUNDS = 4;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const upstream = await fetch(chatUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        thinking: { type: "disabled" },
        temperature: 0.3,
        max_tokens: 700,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
        messages,
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      throw new Error(data?.error?.message || "AI provider error");
    }

    const msg = data?.choices?.[0]?.message;
    if (!msg) break;

    if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
      messages.push({ role: "assistant", content: msg.content || null, tool_calls: msg.tool_calls });

      for (const call of msg.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(call.function?.arguments || "{}");
        } catch (error) {
          // args invalidos del modelo, se corre la tool con {} y que ella responda el error
        }
        const result = await runTool(call.function?.name, args);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }

    const reply = msg.content?.trim() || "Pasame producto, medida/cantidad y ciudad para ayudarte a cotizar.";
    await setHistory(psid, [...messages, { role: "assistant", content: reply }]);
    return reply;
  }

  return "Se me complico armar la respuesta con tantos datos, ¿me repites lo ultimo que necesitas?";
}

async function sendMessengerReply(psid, text) {
  const pageToken = envValue("META_PAGE_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageToken)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: psid }, message: { text } }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[messenger:send_api_error]", response.status, errorBody);
  }
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

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  if (body.object !== "page") {
    return res.status(404).json({ error: "Not a page event" });
  }

  // Process fully before responding: Vercel can freeze the function right
  // after the response is sent, killing any work still in flight.
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const psid = event.sender?.id;
      const text = event.message?.text;
      if (!psid || !text || event.message?.is_echo) continue;

      try {
        const reply = await getAiReply(psid, text);
        await sendMessengerReply(psid, reply);
      } catch (error) {
        console.error("[messenger:webhook]", error?.message || error);
      }
    }
  }

  return res.status(200).send("EVENT_RECEIVED");
};
