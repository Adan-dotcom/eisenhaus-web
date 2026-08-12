-- EisenHaus: leads + ordenes/pago/factura.
-- Aplicar con la MCP de Supabase (apply_migration) o `supabase db push` una vez
-- que se conecte el proyecto real. Se accede solo con la service role key desde
-- las funciones serverless (api/lib/tools.js, api/orders/create.js), por eso RLS
-- se deja activado sin policies publicas: el service role siempre pasa RLS.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null,
  contacto text not null,
  ciudad text,
  necesidad text,
  resumen_conversacion text
);

alter table leads enable row level security;

create type order_status as enum ('pending', 'confirmed', 'delivered', 'cancelled');
create type payment_method as enum ('cod', 'stripe');
create type payment_status as enum ('pending', 'paid', 'failed');
create type invoice_timing as enum ('checkout', 'delivery');

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid references leads(id),
  status order_status not null default 'pending',
  payment_method payment_method not null default 'cod',
  payment_status payment_status not null default 'pending',
  invoice_requested boolean not null default false,
  invoice_timing invoice_timing,
  delivery_city text not null,
  delivery_address text,
  delivery_eta text,
  subtotal numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  stripe_checkout_session_id text
);

alter table orders enable row level security;

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  qty integer not null check (qty > 0),
  unit_price numeric(12, 2) not null,
  line_total numeric(12, 2) not null
);

alter table order_items enable row level security;

-- Datos de facturacion: se llenan en checkout (invoice_timing = 'checkout') o
-- quedan nulos hasta la entrega (invoice_timing = 'delivery'). Esto es solo
-- captura de datos: NO genera un CFDI valido ante el SAT por si solo, eso
-- requiere una integracion aparte con un PAC (ej. Facturama, Alegra, SW Sapien).
create table if not exists invoice_details (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  razon_social text,
  rfc text,
  uso_cfdi text,
  email text
);

alter table invoice_details enable row level security;

create index if not exists orders_lead_id_idx on orders(lead_id);
create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists invoice_details_order_id_idx on invoice_details(order_id);
