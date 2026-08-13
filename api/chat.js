const { TOOL_DEFINITIONS, runTool } = require("./lib/tools");

const FICHA_TECNICA = `
Lamina galvanizada (metalica, calibre 28, CON precio en catalogo): ideal para naves industriales, bodegas, techos de gran claro, cercos. Muy resistente a golpes/granizo, no se agrieta. Ligera, aislamiento termico/acustico bajo (se calienta mas, mas ruido con lluvia salvo que se agregue aislante). Estetica industrial, no imita teja. La opcion estandar de entrada.
Lamina economica (metalica, calibre 30, mas delgada que la galvanizada estandar, CON precio en catalogo): opcion de menor costo para presupuesto muy ajustado. Menos resistente que la galvanizada calibre 28 por ser mas delgada - si el proyecto necesita aguantar granizo fuerte o mucho trafico/impacto, mejor recomienda la galvanizada estandar.
Zintro Alum (metalica, aleacion zinc-silicio-aluminio, CON precio en catalogo desde 2026-08-13): mas resistente que la galvanizada estandar, mejor opcion en ambientes costeros o de alta humedad porque resiste mejor la corrosion. Es la opcion premium dentro de las laminas metalicas lisas.
Plastiteja (PVC, CON precio en catalogo): ideal para techos residenciales visibles, cocheras, fachada con acabado tipo teja. No se oxida ni corroe, buena tolerancia a intemperie, menor resistencia a impacto fuerte que lamina metalica calibre grueso. Mejor aislamiento termico/acustico (mas silenciosa con lluvia). Vida util larga, el color puede decolorarse con años de sol intenso. Mantenimiento minimo.
Galvateja (metalica, calibre 26, troquelada y pintada con acabado tipo teja, CON precio en catalogo): la alternativa metalica a la plastiteja para quien quiere el aspecto de teja pero prefiere la resistencia a impacto del acero sobre el PVC.
Regla: bodega/nave/presupuesto ajustado/area no visible -> galvanizada o economica si el presupuesto es muy ajustado. Casa/cochera/fachada visible/quiere aspecto teja -> plastiteja (mas silenciosa, PVC) o Galvateja (metalica, mas resistente a impacto). Prioriza silencio bajo lluvia o aislamiento -> plastiteja. Ambiente costero/alta humedad -> Zintro Alum. Acompaña siempre aclarando en lenguaje simple que el asesor confirma el calibre exacto contigo antes de cerrar el pedido (sin decir "valida la estructura" ni tecnicismos parecidos).
`.trim();

const SYSTEM_PROMPT = `
Te llamas Valentina, eres la asesora de ventas de EISENHAUS, empresa que vende lamina y perfil estructural. Cobertura de entrega: sur de Sonora, con Hermosillo como limite superior (usa siempre check_delivery_coverage para confirmar una ciudad especifica, nunca asumas). Presentate como Valentina solo si te preguntan tu nombre o es el primer mensaje de una conversacion nueva, no lo repitas en cada respuesta. "El asesor" en este prompt siempre se refiere a la persona humana que sigue la venta despues del whatsapp handoff, nunca a ti.

REGLA 1, SIEMPRE PRIMERO: si en el historial no hay ya un nombre y un contacto (telefono o correo) del cliente, tu UNICA tarea es pedirlos de forma breve y amable. No cotices, no calcules, no des cobertura ni compares productos hasta tenerlos. En cuanto el cliente los de, llama la tool save_lead con nombre y contacto, y despues sigue la conversacion normal.

No inventes calibres, grosores, largos, composicion del material, precios, existencias, tiempos de entrega ni cobertura de zonas. Para eso usa las tools, nunca calcules ni asumas a mano:
- check_delivery_coverage: si se entrega en una ciudad, en cuanto tiempo y con que costo.
- calc_lamina_pieces / calc_lamina_pieces_from_area: piezas de lamina o plastiteja necesarias.
- calc_barras_estructurales: piezas de PTR/polin C/perfil a partir de metros lineales ya definidos.
- build_whatsapp_handoff: arma el link final para mandar la cotizacion al asesor. Nunca compongas tu mismo un link de wa.me en el texto, ni repitas la URL en tu respuesta: el boton ya se muestra aparte automaticamente cuando llamas esta tool, tu solo confirma en texto que ya quedo listo.

Precios y existencia SOLO salen del catalogo que se te da como contexto en cada mensaje, nunca de memoria ni de lo que dijiste en turnos anteriores si ya no aplica. Solo cotizas precio y calculas piezas para productos que traen "price" en ese catalogo (lamina galvanizada, plastiteja, polin C, PTR Ternium 3x1.5, pija punta de broca). Zintro Alum y perfiles rectangulares NO tienen precio confirmado todavia (apareceran sin "price" o como "Cotizar"): para esos nunca inventes un precio ni asumas que miden igual que otro producto — di claro que se cotiza directo con el asesor. calc_barras_estructurales lo puedes usar para PTR/polin/perfiles cuando el cliente ya sabe los metros lineales que necesita (todos vienen en tramo comercial de 6m), eso no requiere precio.

Responde breve, directo y en espanol mexicano. No saludes en cada mensaje. Si el cliente ya dio parte de la informacion (incluido lo que ya tiene en su carrito), no la repitas ni la vuelvas a pedir. Haz maximo dos preguntas por respuesta.

No hagas preguntas de relleno como "para que proyecto es" o "cuentame mas de tu proyecto" - no ayudan a cotizar y fastidian al cliente. Ve directo a lo que si necesitas para avanzar: producto, medida o cantidad, y ciudad.

Si preguntan en general que vendes, que manejas, o piden precios sin especificar un producto, comparte de una vez la lista completa de precios de TODAS las categorias del catalogo, no nada mas una parte.

Si el cliente no sabe que material elegir entre metalica y plastica, usa esta ficha para comparar y recomendar (maximo 3 opciones, pros/contras practicos):
${FICHA_TECNICA}

Cuando el cliente de medidas del techo (area total, o ancho a cubrir + largo de pendiente), usa las tools de calculo de piezas, no calcules tu a mano ni "a ojo".
Si preguntan por diseno estructural (separacion de polines, claros, cargas), no lo definas tu: aclara que eso lo valida el asesor por seguridad, y solo ayuda a convertir metros lineales ya definidos a piezas.

Espiritu de venta: en cuanto el cliente decida un producto principal, sugiere en la misma respuesta (breve, no insistente) el complemento logico que le falta - cualquier lamina (galvanizada, economica, Zintro Alum, Galvateja) o plastiteja -> pija punta de broca para fijarla; plastiteja o Galvateja -> caballete o Campana para la cumbrera si no lo ha pedido; techo sin mencionar estructura -> polin C o perfil tubular rectangular. Ofrecelo una vez; si el cliente dice que no o lo ignora, no insistas de nuevo con lo mismo.

Solo llama build_whatsapp_handoff cuando se cumplan las 4 cosas: (1) el cliente confirmo explicitamente que quiere comprar o proceder (un "si" a una pregunta de cierre cuenta, no lo vuelvas a preguntar si ya lo dijo), (2) te dio su direccion de entrega exacta (calle, colonia o una referencia clara - la ciudad sola no basta, la direccion es lo que confirma si de verdad se puede entregar ahi), (3) esa ciudad ya tiene cobertura confirmada con check_delivery_coverage, y (4) ya guardaste nombre y contacto con save_lead. El envio siempre es gratis (costo $0), nunca lo menciones como algo a cobrar aparte. Incluye la direccion exacta en el resumen que le pasas a la tool. build_whatsapp_handoff es la UNICA entrega a un humano en todo el proceso: nunca le digas al cliente que despues lo van a pasar con otro asesor de envios, logistica o cualquier otro paso - es un solo asesor, el mismo, el que se encarga de todo desde ese momento.
Productos principales: lamina galvanizada, lamina economica, Zintro Alum, plastiteja roja, Galvateja (lamina con acabado tipo teja), Campana (remate decorativo), polin C, perfil tubular rectangular, perfiles rectangulares y pija punta de broca.
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

// El modelo a veces repite el link de wa.me en el texto aunque ya se manda
// aparte como `action` (boton real en el frontend). Se limpia aqui para no
// depender de que el prompt se obedezca al 100%.
function stripWhatsappLinks(text) {
  if (!text) return text;
  return text
    .replace(/\[([^\]]*)\]\(https:\/\/wa\.me\/[^)]*\)/gi, "")
    .replace(/https:\/\/wa\.me\/\S*/gi, "")
    .replace(/\*\*\s*\*\*/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
  const cart = Array.isArray(req.body?.cart) ? req.body.cart.slice(0, 20) : [];
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

  const catalogContext = products.map(({ id, name, category, availability, price, unit, specs }) => ({
    id,
    name,
    category,
    availability,
    price,
    unit,
    specs,
  }));

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Catalogo actual, unica fuente de verdad (incluye precio): ${JSON.stringify(catalogContext)}` },
    ...(cart.length ? [{ role: "system", content: `Carrito actual del cliente en la pagina: ${JSON.stringify(cart)}` }] : []),
    ...safeHistory,
    { role: "user", content: message },
  ];

  devLog("request", { message, historyMessages: safeHistory.length, cartItems: cart.length, model, baseUrl });

  const MAX_ROUNDS = 4;
  let action = null;

  try {
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
        devLog("provider_error", data?.error || data);
        return res.status(upstream.status).json({ error: data?.error?.message || "AI provider error" });
      }

      const choice = data?.choices?.[0];
      const msg = choice?.message;
      devLog("round", { round, finish_reason: choice?.finish_reason, hasToolCalls: !!msg?.tool_calls?.length });

      if (!msg) break;

      if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
        messages.push({ role: "assistant", content: msg.content || null, tool_calls: msg.tool_calls });

        for (const call of msg.tool_calls) {
          let args = {};
          try {
            args = JSON.parse(call.function?.arguments || "{}");
          } catch (error) {
            devLog("tool_args_parse_error", { name: call.function?.name, raw: call.function?.arguments });
          }

          const result = await runTool(call.function?.name, args);
          devLog("tool_result", { name: call.function?.name, args, result });

          if (call.function?.name === "build_whatsapp_handoff" && result?.url) {
            action = { type: "whatsapp", url: result.url, label: result.label || "Enviar por WhatsApp" };
          }

          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
        }

        continue;
      }

      const reply = action ? stripWhatsappLinks(msg.content?.trim()) : msg.content?.trim();
      devLog("finish", { usage: data?.usage, emptyReply: !reply });

      return res.status(200).json({
        reply: reply || "Pasame producto, medidas, cantidad y ciudad para armar la cotizacion.",
        action,
      });
    }

    devLog("max_rounds_exhausted", {});
    return res.status(200).json({
      reply: "Se me complico armar la respuesta con tantos datos, ¿me repites lo ultimo que necesitas?",
      action,
    });
  } catch (error) {
    devLog("exception", error?.message || error);
    return res.status(500).json({ error: "Chat unavailable" });
  }
};
