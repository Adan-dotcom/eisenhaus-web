const { checkCoverage } = require("./delivery");
const { calcLaminaPieces, calcLaminaPiecesFromArea, calcBarrasEstructurales } = require("./materials");

// Debe coincidir con WHATSAPP en index.html.
const WHATSAPP_NUMBER = "14158735968";

const isProduction = process.env.VERCEL_ENV === "production";
function devLog(label, value) {
  if (isProduction) return;
  console.log(`[chat:tool:${label}] ${new Date().toISOString()}`, value);
}

async function saveLead({ nombre, contacto, ciudad, necesidad }) {
  devLog("save_lead", { nombre, contacto, ciudad, necesidad });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { saved: false, reason: "Supabase no configurado todavia (falta SUPABASE_URL/SUPABASE_SERVICE_KEY), lead solo quedo en logs." };
  }

  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/leads`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify([{ nombre, contacto, ciudad: ciudad || null, necesidad: necesidad || null }]),
    });
    if (!res.ok) {
      const text = await res.text();
      devLog("save_lead_error", text);
      return { saved: false, reason: "Error guardando el lead en Supabase." };
    }
    return { saved: true };
  } catch (error) {
    devLog("save_lead_exception", error?.message || error);
    return { saved: false, reason: "Excepcion guardando el lead." };
  }
}

function buildWhatsappHandoff({ resumen }) {
  const text = `Hola, quiero cotizar en EISENHAUS:\n${resumen}`;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  return { url, label: "Enviar por WhatsApp" };
}

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "check_delivery_coverage",
      description:
        "Revisa si EISENHAUS entrega en una ciudad/municipio dado. Cobertura real: lista fija de municipios del sur de Sonora que da el proveedor de Hermosillo (Hermosillo es el limite superior), mismo dia o dia siguiente, sin costo de envio. Baja California y EUA estan excluidos. Usa esta tool en vez de adivinar cobertura o tiempos de entrega.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "Ciudad o municipio que dio el cliente, tal cual lo escribio." },
        },
        required: ["city"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calc_lamina_pieces",
      description:
        "Calcula cuantas piezas de lamina/plastiteja se necesitan dando ancho a cubrir y largo de la pendiente del techo, ya con traslapes reales aplicados. Usa esto en vez de calcular a mano. zintro_alum no tiene medidas ni precio confirmados en el catalogo: la tool regresa un aviso de 'sin datos', no un calculo inventado.",
      parameters: {
        type: "object",
        properties: {
          producto: { type: "string", enum: ["galvanizada", "zintro_alum", "plastiteja"] },
          anchoCubrirM: { type: "number", description: "Ancho total a cubrir, en metros." },
          largoPendienteM: { type: "number", description: "Largo de la pendiente del techo (de canal a cumbrera), en metros." },
        },
        required: ["producto", "anchoCubrirM", "largoPendienteM"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calc_lamina_pieces_from_area",
      description:
        "Estima piezas de lamina/plastiteja cuando el cliente solo da el area total en m2 del techo (sin dimensiones separadas). Es un estimado aproximado, no exacto: si el cliente puede dar ancho y largo de pendiente por separado, usa calc_lamina_pieces en su lugar.",
      parameters: {
        type: "object",
        properties: {
          producto: { type: "string", enum: ["galvanizada", "zintro_alum", "plastiteja"] },
          areaM2: { type: "number", description: "Area total del techo en metros cuadrados." },
        },
        required: ["producto", "areaM2"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calc_barras_estructurales",
      description:
        "Convierte metros lineales de PTR/polin C/perfil ya definidos a numero de piezas, usando la barra comercial de 6m. No diseña separacion entre polines ni claros estructurales (eso es seguridad estructural, lo valida el asesor) - solo usa esto cuando el cliente o el asesor ya saben cuantos metros lineales necesitan.",
      parameters: {
        type: "object",
        properties: {
          metrosLinealesM: { type: "number", description: "Metros lineales totales requeridos." },
        },
        required: ["metrosLinealesM"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_lead",
      description:
        "Guarda el nombre y contacto del cliente. Debes llamar esta tool en cuanto el cliente te de su nombre y un contacto (telefono o correo), ANTES de seguir cotizando o calculando cualquier otra cosa. Puedes volver a llamarla despues con ciudad/necesidad si ya se conocen para actualizar el lead.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          contacto: { type: "string", description: "Telefono o correo del cliente." },
          ciudad: { type: "string" },
          necesidad: { type: "string", description: "Resumen breve de lo que quiere cotizar." },
        },
        required: ["nombre", "contacto"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "build_whatsapp_handoff",
      description:
        "Genera el link real de WhatsApp con el resumen de la cotizacion ya listo para mandar. Llama esto cuando ya tengas producto, cantidad/medidas, ciudad y contacto del cliente, y quieras cerrar la conversacion mandandolo con el asesor. No compongas el link de WhatsApp tu mismo en el texto, siempre usa esta tool.",
      parameters: {
        type: "object",
        properties: {
          resumen: { type: "string", description: "Resumen breve y claro de la cotizacion: producto(s), cantidad/medidas, ciudad, nombre y contacto." },
        },
        required: ["resumen"],
      },
    },
  },
];

async function runTool(name, args) {
  switch (name) {
    case "check_delivery_coverage":
      return checkCoverage(args.city);
    case "calc_lamina_pieces":
      return calcLaminaPieces(args);
    case "calc_lamina_pieces_from_area":
      return calcLaminaPiecesFromArea(args);
    case "calc_barras_estructurales":
      return calcBarrasEstructurales(args);
    case "save_lead":
      return saveLead(args);
    case "build_whatsapp_handoff":
      return buildWhatsappHandoff(args);
    default:
      return { error: `Tool desconocida: ${name}` };
  }
}

module.exports = { TOOL_DEFINITIONS, runTool, buildWhatsappHandoff };
