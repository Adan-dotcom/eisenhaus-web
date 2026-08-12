const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");
const { checkCoverage } = require("../lib/delivery");
const { buildWhatsappHandoff } = require("../lib/tools");

const isProduction = process.env.VERCEL_ENV === "production";
function devLog(label, value) {
  if (isProduction) return;
  console.log(`[orders:${label}] ${new Date().toISOString()}`, value);
}

function envValue(name) {
  const raw = process.env[name];
  return raw ? String(raw).trim().replace(/^["']|["']$/g, "") : "";
}

function getSupabase() {
  const url = envValue("SUPABASE_URL");
  const key = envValue("SUPABASE_SERVICE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

function getStripe() {
  const key = envValue("STRIPE_SECRET_KEY");
  if (!key) return null;
  return new Stripe(key);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const nombre = String(body.nombre || "").trim();
  const contacto = String(body.contacto || "").trim();
  const ciudad = String(body.ciudad || "").trim();
  const direccion = String(body.direccion || "").trim();
  const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  const paymentMethod = body.paymentMethod === "stripe" ? "stripe" : "cod";
  const invoiceRequested = Boolean(body.invoiceRequested);
  const invoiceTiming = body.invoiceTiming === "checkout" ? "checkout" : "delivery";
  const invoice = body.invoice || {};

  if (!nombre || !contacto) {
    return res.status(400).json({ error: "Falta nombre o contacto." });
  }
  if (!ciudad) {
    return res.status(400).json({ error: "Falta ciudad de entrega." });
  }
  if (!items.length) {
    return res.status(400).json({ error: "El carrito esta vacio." });
  }

  const coverage = checkCoverage(ciudad);
  if (!coverage.covered) {
    return res.status(422).json({
      error: "Fuera de cobertura",
      coverage,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  const total = subtotal; // sin costo de envio dentro de cobertura; impuestos/factura se manejan aparte

  const supabase = getSupabase();
  let leadId = null;
  let orderId = null;
  let persisted = false;

  if (supabase) {
    try {
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert({ nombre, contacto, ciudad, necesidad: `Orden con ${items.length} producto(s)` })
        .select("id")
        .single();
      if (leadError) throw leadError;
      leadId = lead.id;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          lead_id: leadId,
          status: "pending",
          payment_method: paymentMethod,
          payment_status: "pending",
          invoice_requested: invoiceRequested,
          invoice_timing: invoiceRequested ? invoiceTiming : null,
          delivery_city: coverage.city,
          delivery_address: direccion || null,
          delivery_eta: coverage.deliveryEta,
          subtotal,
          total,
        })
        .select("id")
        .single();
      if (orderError) throw orderError;
      orderId = order.id;

      const orderItems = items.map((item) => ({
        order_id: orderId,
        product_id: String(item.id || ""),
        product_name: String(item.name || ""),
        qty: Number(item.qty || 0),
        unit_price: Number(item.price || 0),
        line_total: Number(item.price || 0) * Number(item.qty || 0),
      }));
      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      if (invoiceRequested && invoiceTiming === "checkout") {
        const { error: invoiceError } = await supabase.from("invoice_details").insert({
          order_id: orderId,
          razon_social: invoice.razonSocial || null,
          rfc: invoice.rfc || null,
          uso_cfdi: invoice.usoCfdi || null,
          email: invoice.email || null,
        });
        if (invoiceError) throw invoiceError;
      }

      persisted = true;
    } catch (error) {
      devLog("db_error", error?.message || error);
      // seguimos sin tronar: el pedido se puede cerrar por WhatsApp aunque no se haya guardado
    }
  } else {
    devLog("db_not_configured", { nombre, contacto, ciudad, items, paymentMethod });
  }

  const resumen = items.map((item) => `${item.qty} x ${item.name}`).join(", ");
  const whatsapp = buildWhatsappHandoff({
    resumen: `${resumen}\nEntrega en ${coverage.city} (${coverage.deliveryEta}).\nPago: ${paymentMethod === "stripe" ? "en linea" : "contra entrega"}.\n${nombre} - ${contacto}`,
  });

  if (paymentMethod === "stripe") {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(200).json({
        persisted,
        leadId,
        orderId,
        paymentMethod,
        stripeConfigured: false,
        message: "Pago en linea aun no esta activo (falta STRIPE_SECRET_KEY). Usa pago contra entrega o cierra por WhatsApp mientras tanto.",
        whatsapp,
      });
    }

    try {
      const appUrl = envValue("APP_URL") || "https://www.eisenhaus.lat";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: items.map((item) => ({
          price_data: {
            currency: "mxn",
            product_data: { name: String(item.name || "Producto EISENHAUS") },
            unit_amount: Math.round(Number(item.price || 0) * 100),
          },
          quantity: Number(item.qty || 1),
        })),
        success_url: `${appUrl}/?order=${orderId || "ok"}&pago=exitoso`,
        cancel_url: `${appUrl}/?order=${orderId || "cancelado"}&pago=cancelado`,
        metadata: { orderId: orderId || "", leadId: leadId || "" },
      });

      if (supabase && orderId) {
        await supabase.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", orderId);
      }

      return res.status(200).json({
        persisted,
        leadId,
        orderId,
        paymentMethod,
        stripeConfigured: true,
        checkoutUrl: session.url,
      });
    } catch (error) {
      devLog("stripe_error", error?.message || error);
      return res.status(502).json({ error: "No se pudo crear el checkout de Stripe.", whatsapp });
    }
  }

  return res.status(200).json({
    persisted,
    leadId,
    orderId,
    paymentMethod,
    coverage,
    whatsapp,
  });
};
