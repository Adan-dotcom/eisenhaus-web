const { TOOL_DEFINITIONS, runTool } = require("../lib/tools");

// Reemplaza el webhook directo de Meta: ese solo recibe eventos de gente que
// es admin/tester de la app (sin App Review avanzado para pages_messaging,
// Meta no entrega el evento a apps de terceros para desconocidos). Zernio ya
// tiene ese acceso resuelto en su propia app, asi que aqui escuchamos su
// webhook "message.received" (le llega TODO, de cualquiera) y contestamos
// usando la API de Zernio en vez de la API directa de Meta.

const FICHA_TECNICA = `
Lamina galvanizada (metalica, calibre 28, CON precio en catalogo): ideal para naves industriales, bodegas, techos de gran claro, cercos. Muy resistente a golpes/granizo, no se agrieta. Ligera, aislamiento termico/acustico bajo (se calienta mas, mas ruido con lluvia salvo que se agregue aislante). Estetica industrial, no imita teja. La opcion estandar de entrada.
Lamina economica (metalica, calibre 30, mas delgada que la galvanizada estandar, CON precio en catalogo): opcion de menor costo para presupuesto muy ajustado. Menos resistente que la galvanizada calibre 28 por ser mas delgada - si el proyecto necesita aguantar granizo fuerte o mucho trafico/impacto, mejor recomienda la galvanizada estandar.
Zintro Alum (metalica, aleacion zinc-silicio-aluminio, CON precio en catalogo desde 2026-08-13): mas resistente que la galvanizada estandar, mejor opcion en ambientes costeros o de alta humedad porque resiste mejor la corrosion. Es la opcion premium dentro de las laminas metalicas lisas.
Plastiteja (PVC, CON precio en catalogo): ideal para techos residenciales visibles, cocheras, fachada con acabado tipo teja. No se oxida ni corroe, buena tolerancia a intemperie, menor resistencia a impacto fuerte que lamina metalica calibre grueso. Mejor aislamiento termico/acustico (mas silenciosa con lluvia). Vida util larga, el color puede decolorarse con años de sol intenso. Mantenimiento minimo.
Galvateja (metalica, calibre 26, troquelada y pintada con acabado tipo teja, CON precio en catalogo): la alternativa metalica a la plastiteja para quien quiere el aspecto de teja pero prefiere la resistencia a impacto del acero sobre el PVC.
Regla: bodega/nave/presupuesto ajustado/area no visible -> galvanizada o economica si el presupuesto es muy ajustado. Casa/cochera/fachada visible/quiere aspecto teja -> plastiteja (mas silenciosa, PVC) o Galvateja (metalica, mas resistente a impacto). Prioriza silencio bajo lluvia o aislamiento -> plastiteja. Ambiente costero/alta humedad -> Zintro Alum. Acompaña siempre aclarando en lenguaje simple que el asesor confirma el calibre exacto contigo antes de cerrar el pedido (sin decir "valida la estructura" ni tecnicismos parecidos).
`.trim();

const SYSTEM_PROMPT = `
Te llamas Valentina, eres la asesora de ventas de EISENHAUS, empresa que vende lamina y perfil estructural, operando desde Hermosillo y Navojoa (Sonora) y alrededores. Estas respondiendo por Messenger de Facebook, en texto plano (no hay botones ni tarjetas), asi que cuando tengas que compartir un link ponlo tal cual en el texto. Presentate como Valentina solo si te preguntan tu nombre o es el primer mensaje de una conversacion nueva, no lo repitas en cada respuesta. "El asesor" en este prompt siempre se refiere a la persona humana que sigue la venta despues del whatsapp handoff, nunca a ti.

REGLA 1, SIEMPRE PRIMERO: si en el historial no hay ya un nombre y un contacto (telefono o correo) del cliente, tu UNICA tarea es pedirlos de forma breve y amable. No cotices, no calcules, no des cobertura ni compares productos hasta tenerlos. En cuanto el cliente los de, llama la tool save_lead con nombre y contacto, y despues sigue la conversacion normal.

No inventes calibres, grosores, largos, composicion del material, precios, existencias, tiempos de entrega ni cobertura de zonas. Para eso usa las tools, nunca calcules ni asumas a mano:
- check_delivery_coverage: si se entrega en una ciudad, en cuanto tiempo y con que costo.
- calc_lamina_pieces / calc_lamina_pieces_from_area: piezas de lamina o plastiteja necesarias.
- calc_barras_estructurales: piezas de PTR/polin C/perfil a partir de metros lineales ya definidos.
- build_whatsapp_handoff: arma el link final para mandar la cotizacion al asesor. Llama esta tool y comparte el link (url) que te regresa tal cual en tu respuesta de texto, ya que aqui en Messenger no hay boton aparte.

Precios y existencia SOLO salen del catalogo que se te da como contexto en cada mensaje, nunca de memoria ni de lo que dijiste en turnos anteriores si ya no aplica. Solo cotizas precio y calculas piezas para productos que traen "price" en ese catalogo. Los que no traen "price" (apareceran sin ese campo): para esos nunca inventes un precio ni asumas que miden igual que otro producto — di claro que se cotiza directo con el asesor. calc_barras_estructurales lo puedes usar para PTR/polin/perfiles cuando el cliente ya sabe los metros lineales que necesita (todos vienen en tramo comercial de 6m), eso no requiere precio.

Responde breve, directo y en espanol mexicano. No saludes en cada mensaje. Si el cliente ya dio parte de la informacion, no la repitas ni la vuelvas a pedir. Haz maximo dos preguntas por respuesta.

No hagas preguntas de relleno como "para que proyecto es" o "cuentame mas de tu proyecto" - no ayudan a cotizar y fastidian al cliente. Ve directo a lo que si necesitas para avanzar: producto, medida o cantidad, y ciudad.

Si preguntan en general que vendes, que manejas, o piden precios sin especificar un producto, comparte de una vez la lista completa de precios de TODAS las categorias del catalogo (lamina galvanizada, plastiteja, polin C, PTR, pija), no nada mas una parte.

Si el cliente no sabe que material elegir entre metalica y plastica, usa esta ficha para comparar y recomendar (maximo 3 opciones, pros/contras practicos):
${FICHA_TECNICA}

Cuando el cliente de medidas del techo (area total, o ancho a cubrir + largo de pendiente), usa las tools de calculo de piezas, no calcules tu a mano ni "a ojo".
Si preguntan por diseno estructural (separacion de polines, claros, cargas), no lo definas tu: aclara que eso lo valida el asesor por seguridad, y solo ayuda a convertir metros lineales ya definidos a piezas.

Espiritu de venta: en cuanto el cliente decida un producto principal, sugiere en la misma respuesta (breve, no insistente) el complemento logico que le falta - cualquier lamina (galvanizada, economica, Zintro Alum, Galvateja) o plastiteja -> pija punta de broca para fijarla; plastiteja o Galvateja -> caballete o Campana para la cumbrera si no lo ha pedido; techo sin mencionar estructura -> polin C o perfil tubular rectangular. Ofrecelo una vez; si el cliente dice que no o lo ignora, no insistas de nuevo con lo mismo.

Tienes la tool send_product_photo (manda una foto real del producto por Messenger): usala cuando el cliente no sepa que es un producto (ej. no conoce el caballete), este decidiendo entre opciones (galvanizada vs plastiteja), o pregunte especificamente por un producto sin que ya le hayas mandado foto de ese producto en esta conversacion. La foto se manda aparte automaticamente en cuanto llamas la tool: no describas la imagen ni pongas un link en tu texto.

Solo llama build_whatsapp_handoff cuando se cumplan las 4 cosas: (1) el cliente confirmo explicitamente que quiere comprar o proceder (un "si" a una pregunta de cierre cuenta, no lo vuelvas a preguntar si ya lo dijo), (2) te dio su direccion de entrega exacta (calle, colonia o una referencia clara - la ciudad sola no basta, la direccion es lo que confirma si de verdad se puede entregar ahi), (3) esa ciudad ya tiene cobertura confirmada con check_delivery_coverage, y (4) ya guardaste nombre y contacto con save_lead. El envio siempre es gratis (costo $0), nunca lo menciones como algo a cobrar aparte. Incluye la direccion exacta en el resumen que le pasas a la tool. build_whatsapp_handoff es la UNICA entrega a un humano en todo el proceso: nunca le digas al cliente que despues lo van a pasar con otro asesor de envios, logistica o cualquier otro paso - es un solo asesor, el mismo, el que se encarga de todo desde ese momento.
Cobertura actual: solo zona sur-centro de Sonora (Hermosillo, Navojoa y alrededores), nacional aun no disponible.
Productos principales: lamina galvanizada, lamina economica, Zintro Alum, plastiteja roja, Galvateja (lamina con acabado tipo teja), Campana (remate decorativo), polin C, perfil tubular rectangular, perfiles rectangulares y pija punta de broca.
`.trim();

// Snapshot del catalogo de index.html - mismos precios que el sitio.
// Si cambian precios ahi, actualizar aqui tambien (no se leen del mismo array todavia).
const CATALOG_CONTEXT = [
  { id: "galvanizada-610", name: "Lamina galvanizada 6.10 x 0.82 m", category: "Lamina", price: 800, unit: "pieza" },
  { id: "galvanizada-550", name: "Lamina galvanizada 5.50 x 0.82 m", category: "Lamina", price: 785, unit: "pieza" },
  { id: "galvanizada-488", name: "Lamina galvanizada 4.88 x 0.82 m", category: "Lamina", price: 660, unit: "pieza" },
  { id: "galvanizada-427", name: "Lamina galvanizada 4.27 x 0.82 m", category: "Lamina", price: 580, unit: "pieza" },
  { id: "galvanizada-366", name: "Lamina galvanizada 3.66 x 0.82 m", category: "Lamina", price: 510, unit: "pieza" },
  { id: "galvanizada-305", name: "Lamina galvanizada 3.05 x 0.82 m", category: "Lamina", price: 425, unit: "pieza" },
  { id: "galvanizada-244", name: "Lamina galvanizada 2.44 x 0.82 m", category: "Lamina", price: 360, unit: "pieza" },
  { id: "zintro-alum-610", name: "Zintro Alum 6.10 x 0.83 m", category: "Lamina", price: 735, unit: "pieza" },
  { id: "zintro-alum-488", name: "Zintro Alum 4.88 x 0.83 m", category: "Lamina", price: 600, unit: "pieza" },
  { id: "zintro-alum-427", name: "Zintro Alum 4.27 x 0.83 m", category: "Lamina", price: 530, unit: "pieza" },
  { id: "zintro-alum-366", name: "Zintro Alum 3.66 x 0.83 m", category: "Lamina", price: 460, unit: "pieza" },
  { id: "zintro-alum-305", name: "Zintro Alum 3.05 x 0.83 m", category: "Lamina", price: 395, unit: "pieza" },
  { id: "economica-300", name: "Lamina economica 3.00 x 0.75 m", category: "Lamina", price: 290, unit: "pieza" },
  { id: "plastiteja-715", name: "Plastiteja roja 7.15 x 1.00 m", category: "Teja", price: 1570, unit: "pieza" },
  { id: "plastiteja-615", name: "Plastiteja roja 6.15 x 1.00 m", category: "Teja", price: 1360, unit: "pieza" },
  { id: "plastiteja-500", name: "Plastiteja roja 5.00 x 1.00 m", category: "Teja", price: 1120, unit: "pieza" },
  { id: "plastiteja-460", name: "Plastiteja roja 4.60 x 1.00 m", category: "Teja", price: 1030, unit: "pieza" },
  { id: "plastiteja-400", name: "Plastiteja roja 4.00 x 1.00 m", category: "Teja", price: 950, unit: "pieza" },
  { id: "plastiteja-366", name: "Plastiteja roja 3.66 x 1.00 m", category: "Teja", price: 830, unit: "pieza" },
  { id: "plastiteja-305", name: "Plastiteja roja 3.05 x 1.00 m", category: "Teja", price: 700, unit: "pieza" },
  { id: "plastiteja-250", name: "Plastiteja roja 2.50 x 1.00 m", category: "Teja", price: 585, unit: "pieza" },
  { id: "plastiteja-150", name: "Plastiteja roja 1.50 x 1.00 m", category: "Teja", price: 375, unit: "pieza" },
  { id: "plastiteja-110", name: "Plastiteja roja 1.10 x 1.00 m", category: "Teja", price: 290, unit: "pieza" },
  { id: "caballete-plastiteja-305", name: "Caballete de plastiteja 3.05 m", category: "Teja", price: 860, unit: "pieza" },
  { id: "caballete-plastiteja-177", name: "Caballete de plastiteja 1.77 m", category: "Teja", price: 470, unit: "pieza" },
  { id: "galvateja-610", name: "Galvateja 6.10 x 1.13 m", category: "Teja", price: 1525, unit: "pieza" },
  { id: "galvateja-488", name: "Galvateja 4.88 x 1.13 m", category: "Teja", price: 1235, unit: "pieza" },
  { id: "galvateja-427", name: "Galvateja 4.27 x 1.13 m", category: "Teja", price: 1080, unit: "pieza" },
  { id: "galvateja-366", name: "Galvateja 3.66 x 1.13 m", category: "Teja", price: 940, unit: "pieza" },
  { id: "galvateja-305", name: "Galvateja 3.05 x 1.13 m", category: "Teja", price: 790, unit: "pieza" },
  { id: "campana-305", name: "Campana 3.05 m", category: "Teja", price: 410, unit: "pieza" },
  { id: "polin-c-3", name: "Polin C 3 pulgadas", category: "Perfil", price: 510, unit: "pieza" },
  { id: "polin-c-4", name: "Polin C 4 pulgadas", category: "Perfil", price: 610, unit: "pieza" },
  { id: "perfil-3x1.5", name: "Perfil tubular rectangular 3 x 1.5 pulgadas", category: "Perfil", price: 460, unit: "pieza" },
  { id: "perfiles-rectangulares", name: "Perfiles rectangulares", category: "Perfil", availability: "Cotizar" },
  { id: "pija-punta-broca", name: "Pija punta de broca", category: "Ferreteria", price: 180, unit: "ciento" },
];

const PRODUCT_PHOTOS = {
  galvanizada: "https://www.eisenhaus.lat/assets/productos/galvanizada.jpeg",
  economica: "https://www.eisenhaus.lat/assets/productos/economica.jpeg",
  "zintro-alum": "https://www.eisenhaus.lat/assets/productos/zintro-alum.jpeg",
  plastiteja: "https://www.eisenhaus.lat/assets/productos/plastiteja.jpeg",
  galvateja: "https://www.eisenhaus.lat/assets/productos/galvateja.jpeg",
  campana: "https://www.eisenhaus.lat/assets/productos/campana.jpeg",
  "polin-c": "https://www.eisenhaus.lat/assets/productos/polin-c.jpeg",
  ptr: "https://www.eisenhaus.lat/assets/productos/ptr.jpeg",
  pija: "https://www.eisenhaus.lat/assets/productos/pija.jpeg",
};

const SEND_PRODUCT_PHOTO_TOOL = {
  type: "function",
  function: {
    name: "send_product_photo",
    description:
      "Manda una foto real del producto al cliente por Messenger. Usala cuando el cliente no sepa que es un producto, este decidiendo entre opciones (puedes llamarla varias veces, una por producto), o pregunte especificamente por un producto y todavia no le hayas mandado foto de ese producto en esta conversacion.",
    parameters: {
      type: "object",
      properties: {
        producto: { type: "string", enum: Object.keys(PRODUCT_PHOTOS) },
      },
      required: ["producto"],
    },
  },
};

function envValue(name, fallback = "") {
  const raw = process.env[name] || fallback;
  return String(raw).trim().replace(/^["']|["']$/g, "");
}

const ZERNIO_API_BASE = "https://zernio.com/api/v1";
const FACEBOOK_ACCOUNT_ID = "6a77e40cd0fe733d1a63f350"; // Grupo Eisenhaus, Facebook

function zernioHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${envValue("ZERNIO_API_KEY")}`,
  };
}

// Fallback en memoria: solo sobrevive mientras la instancia de Vercel siga
// caliente. Supabase (abajo) es la fuente real cuando esta configurado.
const conversations = new Map();

function supabaseConfig() {
  const url = envValue("SUPABASE_URL");
  const key = envValue("SUPABASE_SERVICE_KEY");
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

async function getHistory(conversationId) {
  const cfg = supabaseConfig();
  if (!cfg) return conversations.get(conversationId) || [];

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/bot_conversations?psid=eq.${encodeURIComponent(conversationId)}&select=messages`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
    );
    if (!res.ok) return conversations.get(conversationId) || [];
    const rows = await res.json();
    const stored = rows?.[0]?.messages || [];
    return stored.filter((m) => m.role === "user" || (m.role === "assistant" && !m.tool_calls));
  } catch (error) {
    console.error("[zernio-messenger:history_read_error]", error?.message || error);
    return conversations.get(conversationId) || [];
  }
}

async function setHistory(conversationId, messages) {
  const trimmed = messages
    .filter((m) => m.role === "user" || (m.role === "assistant" && !m.tool_calls))
    .slice(-10);
  conversations.set(conversationId, trimmed);

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
      body: JSON.stringify([{ psid: conversationId, platform: "messenger", messages: trimmed, updated_at: new Date().toISOString() }]),
    });
  } catch (error) {
    console.error("[zernio-messenger:history_write_error]", error?.message || error);
  }
}

async function getAiReply(conversationId, userText) {
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
    ...(await getHistory(conversationId)),
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
        tools: [...TOOL_DEFINITIONS, SEND_PRODUCT_PHOTO_TOOL],
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

        let result;
        if (call.function?.name === "send_product_photo") {
          const photoUrl = PRODUCT_PHOTOS[args.producto];
          if (photoUrl) {
            await sendZernioImage(conversationId, photoUrl);
            result = { sent: true };
          } else {
            result = { sent: false, reason: "Sin foto disponible para ese producto todavia." };
          }
        } else {
          result = await runTool(call.function?.name, args);
          if (call.function?.name === "build_whatsapp_handoff" && result?.url) {
            await notifyOwner(`🔥 LEAD CONFIRMADO (Messenger via Zernio):\n${args.resumen || "(sin resumen)"}`);
          }
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }

    const reply = msg.content?.trim() || "Pasame producto, medida/cantidad y ciudad para ayudarte a cotizar.";
    await setHistory(conversationId, [...messages, { role: "assistant", content: reply }]);
    return reply;
  }

  return "Se me complico armar la respuesta con tantos datos, ¿me repites lo ultimo que necesitas?";
}

async function sendZernioText(conversationId, text) {
  const url = `${ZERNIO_API_BASE}/inbox/conversations/${encodeURIComponent(conversationId)}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: zernioHeaders(),
    body: JSON.stringify({ message: text }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[zernio-messenger:send_error]", response.status, errorBody);
  }
}

async function sendZernioImage(conversationId, imageUrl) {
  const url = `${ZERNIO_API_BASE}/inbox/conversations/${encodeURIComponent(conversationId)}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: zernioHeaders(),
    body: JSON.stringify({ attachments: [{ type: "image", url: imageUrl }] }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[zernio-messenger:send_photo_error]", response.status, errorBody);
  }
}

async function notifyOwner(text) {
  const ownerPsid = envValue("OWNER_PSID");
  if (!ownerPsid) return;
  try {
    // Conversacion ya existente con el dueño (misma cuenta con la que probamos
    // el bot desde el inicio), asi que se puede mandar directo por su id.
    await sendZernioText(ownerPsid, text);
  } catch (error) {
    console.error("[zernio-messenger:notify_owner_error]", error?.message || error);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verificacion ligera por header compartido (no HMAC de cuerpo crudo: Vercel
  // ya parsea el body antes de que podamos leer los bytes originales, asi que
  // el HMAC de Zernio sobre el raw body no es viable aqui de forma confiable).
  const sharedSecret = envValue("ZERNIO_WEBHOOK_SECRET");
  if (sharedSecret && req.headers["x-internal-secret"] !== sharedSecret) {
    return res.status(401).json({ error: "Invalid secret" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  if (body.event !== "message.received") {
    return res.status(200).json({ ok: true, skipped: "not message.received" });
  }

  const message = body.message || {};
  const conversationId = message.conversationId;
  const text = message.text;
  const platform = message.platform;
  const direction = message.direction;

  // Process fully before responding: Vercel can freeze the function right
  // after the response is sent, killing any work still in flight.
  if (conversationId && text && platform === "facebook" && direction === "incoming") {
    try {
      const reply = await getAiReply(conversationId, text);
      await sendZernioText(conversationId, reply);
    } catch (error) {
      console.error("[zernio-messenger:webhook]", error?.message || error);
    }
  }

  return res.status(200).json({ ok: true });
};
