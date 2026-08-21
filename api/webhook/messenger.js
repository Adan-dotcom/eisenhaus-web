const { TOOL_DEFINITIONS, runTool } = require("../lib/tools");
const { waitUntil } = require("@vercel/functions");

const FICHA_TECNICA = `
Lamina galvanizada (metalica, calibre 28, CON precio en catalogo): ideal para naves industriales, bodegas, techos de gran claro, cercos. Muy resistente a golpes/granizo, no se agrieta. Ligera, aislamiento termico/acustico bajo (se calienta mas, mas ruido con lluvia salvo que se agregue aislante). Estetica industrial, no imita teja. La opcion estandar de entrada.
Lamina economica (metalica, calibre 30, mas delgada que la galvanizada estandar, CON precio en catalogo): opcion de menor costo para presupuesto muy ajustado. Menos resistente que la galvanizada calibre 28 por ser mas delgada - si el proyecto necesita aguantar granizo fuerte o mucho trafico/impacto, mejor recomienda la galvanizada estandar.
Zintro Alum (metalica, aleacion zinc-silicio-aluminio, CON precio en catalogo desde 2026-08-13): mas resistente que la galvanizada estandar, mejor opcion en ambientes costeros o de alta humedad porque resiste mejor la corrosion. Es la opcion premium dentro de las laminas metalicas lisas.
Plastiteja (PVC, color ROJO, CON precio en catalogo): ideal para techos residenciales visibles, cocheras, fachada con acabado tipo teja. No se oxida ni corroe, buena tolerancia a intemperie, menor resistencia a impacto fuerte que lamina metalica calibre grueso. Mejor aislamiento termico/acustico (mas silenciosa con lluvia). Vida util larga, el color puede decolorarse con años de sol intenso. Mantenimiento minimo.
Galvateja (metalica, calibre 26, color ROJO tambien (troquelada y pintada con acabado tipo teja), CON precio en catalogo): la alternativa metalica a la plastiteja para quien quiere el aspecto de teja pero prefiere la resistencia a impacto del acero sobre el PVC.
IMPORTANTE sobre color: tanto Plastiteja como Galvateja son rojas. Si preguntan por "lamina roja" o "algo rojo" sin especificar cual, menciona AMBAS opciones (plastiteja PVC y Galvateja metalica) y deja que el cliente elija segun PVC vs metal.
Regla: bodega/nave/presupuesto ajustado/area no visible -> galvanizada o economica si el presupuesto es muy ajustado. Casa/cochera/fachada visible/quiere aspecto teja -> plastiteja (mas silenciosa, PVC) o Galvateja (metalica, mas resistente a impacto). Prioriza silencio bajo lluvia o aislamiento -> plastiteja. Ambiente costero/alta humedad -> Zintro Alum. Acompaña siempre aclarando en lenguaje simple que el asesor confirma el calibre exacto contigo antes de cerrar el pedido (sin decir "valida la estructura" ni tecnicismos parecidos).
`.trim();

const SYSTEM_PROMPT = `
Te llamas Valentina, eres la asesora de ventas de EISENHAUS, empresa que vende lamina y perfil estructural, operando desde Hermosillo y Navojoa (Sonora) y alrededores. Estas respondiendo por Messenger de Facebook, en texto plano (no hay botones ni tarjetas), asi que cuando tengas que compartir un link ponlo tal cual en el texto. Presentate como Valentina solo si te preguntan tu nombre o es el primer mensaje de una conversacion nueva, no lo repitas en cada respuesta. "El asesor" en este prompt siempre se refiere a la persona humana que sigue la venta despues del whatsapp handoff, nunca a ti.

REGLA 1: pide nombre y un contacto (telefono o correo) de forma breve, junto con tu primera respuesta al cliente - pero esto NUNCA bloquea nada. SIEMPRE contesta primero lo que el cliente pregunto o pidio (cobertura, precio, comparacion, calculo, lo que sea, usando las tools normales), y si todavia no tienes nombre/contacto agrega la peticion al final de esa misma respuesta. Si el cliente no te lo da y sigue preguntando otras cosas, contesta esas cosas con toda normalidad - nunca repitas la peticion de nombre/telefono en vez de contestar algo nuevo que pregunto. Insiste con la peticion como mucho una vez mas despues de la primera vez, no en cada turno. En cuanto te de nombre y contacto (en cualquier momento de la conversacion), llama la tool save_lead. Antes de llamar build_whatsapp_handoff si es obligatorio ya tener nombre y contacto guardados con save_lead - ese es el unico punto donde de verdad hace falta tenerlos.

No inventes calibres, grosores, largos, composicion del material, precios, existencias, tiempos de entrega ni cobertura de zonas. Para eso usa las tools, nunca calcules ni asumas a mano:
- check_delivery_coverage: si se entrega en una ciudad, en cuanto tiempo y con que costo.
- calc_lamina_pieces / calc_lamina_pieces_from_area: piezas de lamina o plastiteja necesarias.
- calc_barras_estructurales: piezas de PTR/polin C/perfil a partir de metros lineales ya definidos.
- build_whatsapp_handoff: arma el link final para mandar la cotizacion al asesor. Llama esta tool y comparte el link (url) que te regresa tal cual en tu respuesta de texto, ya que aqui en Messenger no hay boton aparte.

Precios y existencia SOLO salen del catalogo que se te da como contexto en cada mensaje, nunca de memoria ni de lo que dijiste en turnos anteriores si ya no aplica. Solo cotizas precio y calculas piezas para productos que traen "price" en ese catalogo. Los que no traen "price" (apareceran sin ese campo): para esos nunca inventes un precio ni asumas que miden igual que otro producto — di claro que se cotiza directo con el asesor. calc_barras_estructurales lo puedes usar para PTR/polin/perfiles cuando el cliente ya sabe los metros lineales que necesita (todos vienen en tramo comercial de 6m), eso no requiere precio.

Responde MUY breve y en espanol sencillo, como le hablarias a alguien sin estudios: frases cortas, una idea a la vez, sin palabras rebuscadas ni tecnicismos. No saludes en cada mensaje. Si el cliente ya dio parte de la informacion, no la repitas ni la vuelvas a pedir. Haz UNA sola pregunta por respuesta, nunca dos o mas juntas.

Nunca uses markdown (nada de **, guiones de lista, ni #): todo en texto plano. Si tienes que dar varios precios o partidas, ponlas en lineas separadas simples (una por renglon) y el total al final, sin simbolos ni formato, para que se lea facil en el celular.

No hagas preguntas de relleno como "para que proyecto es" o "cuentame mas de tu proyecto" - no ayudan a cotizar y fastidian al cliente. Ve directo a lo que si necesitas para avanzar: producto, medida o cantidad, y ciudad.

Estas son transacciones rapidas, no un interrogatorio ni un onboarding largo. Si el cliente ya te dio una lista con cantidades y medidas (aunque no sean exactas a lo que manejas), NO le pidas que confirme cada producto uno por uno antes de cotizar. Usa el equivalente mas cercano que tengas, dilo en una linea corta (ej. "lo mas cercano a 4x6 es el Polin C de 4 pulgadas"), calcula el total de TODO lo que pidio de una sola vez, y sigue avanzando. Pregunta "¿me confirmas...?" solo si de plano no hay ningun equivalente razonable - nunca como excusa para no cotizar algo que ya se puede resolver.

Si preguntan en general que vendes, que manejas, o piden precios sin especificar un producto, comparte de una vez la lista completa de precios de TODAS las categorias del catalogo (lamina galvanizada, plastiteja, polin C, PTR, pija), no nada mas una parte.

Si el cliente no sabe que material elegir entre metalica y plastica, usa esta ficha para comparar y recomendar (maximo 3 opciones, pros/contras practicos):
${FICHA_TECNICA}

Cuando el cliente de medidas del techo (area total, o ancho a cubrir + largo de pendiente), usa las tools de calculo de piezas, no calcules tu a mano ni "a ojo".
Si preguntan por diseno estructural (separacion de polines, claros, cargas), no lo definas tu: aclara que eso lo valida el asesor por seguridad, y solo ayuda a convertir metros lineales ya definidos a piezas.

Espiritu de venta: en cuanto el cliente decida un producto principal, sugiere en la misma respuesta (breve, no insistente) el complemento logico que le falta - cualquier lamina (galvanizada, economica, Zintro Alum, Galvateja) o plastiteja -> pija punta de broca para fijarla; plastiteja o Galvateja -> caballete o Campana para la cumbrera si no lo ha pedido; techo sin mencionar estructura -> polin C o perfil tubular rectangular. Ofrecelo una vez; si el cliente dice que no o lo ignora, no insistas de nuevo con lo mismo.

Tienes la tool send_product_photo (manda una foto real del producto por Messenger): mandala la PRIMERA VEZ que mencionas o cotizas un producto especifico en la conversacion, sin esperar a que el cliente la pida - ayuda mucho a que confirme que es justo lo que busca. Tambien usala si el cliente no sabe que es un producto (ej. no conoce el caballete) o esta decidiendo entre opciones (galvanizada vs plastiteja). No la repitas para el mismo producto en la misma conversacion. La foto se manda aparte automaticamente en cuanto llamas la tool: no describas la imagen ni pongas un link en tu texto.

Solo llama build_whatsapp_handoff cuando se cumplan las 4 cosas: (1) el cliente confirmo explicitamente que quiere comprar o proceder (un "si" a una pregunta de cierre cuenta, no lo vuelvas a preguntar si ya lo dijo), (2) te dio su direccion de entrega exacta (calle, colonia o una referencia clara - la ciudad sola no basta, la direccion es lo que confirma si de verdad se puede entregar ahi), (3) esa ciudad ya tiene cobertura confirmada con check_delivery_coverage, y (4) ya guardaste nombre y contacto con save_lead. El envio siempre es gratis (costo $0), nunca lo menciones como algo a cobrar aparte. Incluye la direccion exacta en el resumen que le pasas a la tool. build_whatsapp_handoff es la UNICA entrega a un humano en todo el proceso: nunca le digas al cliente que despues lo van a pasar con otro asesor de envios, logistica o cualquier otro paso - es un solo asesor, el mismo, el que se encarga de todo desde ese momento.
Cobertura actual: solo zona sur-centro de Sonora (Hermosillo, Navojoa y alrededores), nacional aun no disponible.
Productos principales: lamina galvanizada, lamina economica, Zintro Alum, plastiteja roja, Galvateja (lamina con acabado tipo teja), Campana (remate decorativo), polin C, perfil tubular rectangular, perfiles rectangulares y pija punta de broca.
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

// El modelo tiene la tool send_product_photo pero en la practica casi nunca
// la llama (revisado en conversaciones reales). Como red de seguridad,
// detectamos por texto que producto se menciono en la respuesta y mandamos
// la foto por codigo, sin depender de que el modelo se acuerde.
const PRODUCT_KEYWORD_PATTERNS = {
  galvanizada: /galvanizad/i,
  economica: /econ[oó]mic/i,
  "zintro-alum": /zintro/i,
  plastiteja: /plastiteja/i,
  galvateja: /galvateja/i,
  campana: /campana/i,
  "polin-c": /pol[ií]n/i,
  ptr: /\bptr\b|perfil tubular/i,
  pija: /\bpija/i,
};

function detectProducts(text) {
  if (!text) return [];
  return Object.keys(PRODUCT_KEYWORD_PATTERNS).filter((key) => PRODUCT_KEYWORD_PATTERNS[key].test(text));
}

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

// El modelo a veces manda markdown (negritas, vinetas) aunque el prompt lo
// prohiba. Messenger no lo renderiza, se ve como simbolos crudos (**texto**).
function stripMarkdown(text) {
  if (!text) return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^[-•]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

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
    const stored = rows?.[0]?.messages || [];
    // Autorepara filas viejas que se hayan guardado con un tool_call colgado
    // (bug ya corregido en setHistory, pero puede haber quedado guardado antes del fix).
    return stored.filter((m) => m.role === "user" || (m.role === "assistant" && !m.tool_calls));
  } catch (error) {
    console.error("[messenger:history_read_error]", error?.message || error);
    return conversations.get(psid) || [];
  }
}

async function setHistory(psid, messages) {
  // Solo guarda los turnos de usuario/asistente, no el system prompt ni tool calls.
  // Ojo: un mensaje "assistant" con tool_calls no cuenta como turno limpio -
  // si se guarda sin sus respuestas "tool" correspondientes (que el filtro de
  // arriba ya descarta), la siguiente llamada a la API truena porque queda
  // un tool_call colgado sin respuesta.
  const trimmed = messages
    .filter((m) => m.role === "user" || (m.role === "assistant" && !m.tool_calls))
    .slice(-10);
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
  const photosSentThisTurn = new Set();

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
            await sendMessengerImage(psid, photoUrl);
            photosSentThisTurn.add(args.producto);
            result = { sent: true };
          } else {
            result = { sent: false, reason: "Sin foto disponible para ese producto todavia." };
          }
        } else {
          result = await runTool(call.function?.name, args);
          if (call.function?.name === "build_whatsapp_handoff" && result?.url) {
            await notifyOwner(`🔥 LEAD CONFIRMADO (Messenger):\n${args.resumen || "(sin resumen)"}`);
          }
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }

    const reply = stripMarkdown(msg.content?.trim()) || "Pasame producto, medida/cantidad y ciudad para ayudarte a cotizar.";

    const mentionedNow = detectProducts(reply);
    if (mentionedNow.length > 0 && mentionedNow.length <= 2) {
      const priorAssistantText = messages
        .filter((m) => m.role === "assistant" && typeof m.content === "string")
        .map((m) => m.content)
        .join("\n");
      const alreadyMentioned = new Set(detectProducts(priorAssistantText));
      for (const key of mentionedNow) {
        if (alreadyMentioned.has(key) || photosSentThisTurn.has(key)) continue;
        const photoUrl = PRODUCT_PHOTOS[key];
        if (photoUrl) {
          await sendMessengerImage(psid, photoUrl);
          photosSentThisTurn.add(key);
        }
      }
    }

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

async function notifyOwner(text) {
  const ownerPsid = envValue("OWNER_PSID");
  if (!ownerPsid) return;
  try {
    await sendMessengerReply(ownerPsid, text);
  } catch (error) {
    console.error("[messenger:notify_owner_error]", error?.message || error);
  }
}

async function sendMessengerImage(psid, imageUrl) {
  const pageToken = envValue("META_PAGE_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageToken)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: psid },
      message: { attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } } },
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[messenger:send_photo_error]", response.status, errorBody);
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

  // Meta reintenta si no respondemos rapido, y getAiReply puede tardar varios
  // segundos (varias vueltas de tool-calling). Respondemos de inmediato y
  // procesamos en background con waitUntil para no disparar reintentos que
  // generen respuestas duplicadas (mismo bug encontrado en zernio-messenger.js).
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const psid = event.sender?.id;
      const text = event.message?.text;
      if (!psid || !text || event.message?.is_echo) continue;

      waitUntil(
        getAiReply(psid, text)
          .then((reply) => sendMessengerReply(psid, reply))
          .catch((error) => console.error("[messenger:webhook]", error?.message || error))
      );
    }
  }

  return res.status(200).send("EVENT_RECEIVED");
};
