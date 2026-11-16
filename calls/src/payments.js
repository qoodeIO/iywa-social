// Direct purchases with Stripe Connect.
//
// Every seller connects their own Stripe account (Express). Buyers pay with
// Stripe Checkout; the money goes straight to the seller's account and Space
// keeps an application fee. Prices always come from the server copy of the
// seller's catalogue, never from the buyer's request.
//
// Config (calls/.dev.vars locally, `wrangler secret put` in production):
//   STRIPE_SECRET_KEY      sk_test_... (use test mode until login is real)
//   STRIPE_WEBHOOK_SECRET  whsec_...   (from the webhook endpoint or `stripe listen`)
//   PLATFORM_FEE_PERCENT   e.g. 5
//
// Identity note: the hub trusts the handle the client declares. Until Space has
// real authentication, keep Stripe in test mode.

const STRIPE = "https://api.stripe.com/v1";
const MAX_QTY = 20;

const clean = (value, max) => String(value ?? "").trim().slice(0, max);
const handleOf = (value) => clean(value, 40).toLowerCase().replace(/[^a-z0-9._-]/g, "");

export function migratePayments(sql) {
  sql.exec(`
    CREATE TABLE IF NOT EXISTS pay_accounts (
      handle TEXT PRIMARY KEY, account_id TEXT NOT NULL,
      charges_enabled INTEGER NOT NULL DEFAULT 0, details_submitted INTEGER NOT NULL DEFAULT 0,
      payouts_enabled INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS pay_products (
      seller TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, price_cents INTEGER NOT NULL,
      image TEXT, stock INTEGER, made_to_order INTEGER, service INTEGER NOT NULL DEFAULT 0,
      shop TEXT, updated_at INTEGER NOT NULL, PRIMARY KEY (seller, id));
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, buyer TEXT NOT NULL, seller TEXT NOT NULL, product_id TEXT NOT NULL,
      name TEXT NOT NULL, image TEXT, variant TEXT, qty INTEGER NOT NULL,
      unit_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL, fee_cents INTEGER NOT NULL,
      status TEXT NOT NULL, session_id TEXT, shipping TEXT, created_at INTEGER NOT NULL, paid_at INTEGER);
    CREATE INDEX IF NOT EXISTS orders_by_buyer ON orders(buyer, created_at);
    CREATE INDEX IF NOT EXISTS orders_by_seller ON orders(seller, created_at);
  `);
}

// Stripe's API takes form-encoded bodies with bracketed keys for nested data.
export function formEncode(data, prefix = "", out = []) {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item !== null && typeof item === "object") formEncode(item, `${name}[${index}]`, out);
        else out.push(`${encodeURIComponent(`${name}[${index}]`)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof value === "object") {
      formEncode(value, name, out);
    } else {
      out.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
    }
  }
  return out.join("&");
}

async function stripe(env, method, path, body) {
  const response = await fetch(`${STRIPE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": "2024-06-20",
    },
    body: body ? formEncode(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `stripe ${response.status}`);
    error.status = 502;
    throw error;
  }
  return data;
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Verifies the Stripe-Signature header (t=...,v1=...) over "<t>.<raw body>".
export async function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(String(header).split(",").map((item) => item.split("=")).filter((pair) => pair.length === 2));
  const stamp = Number(parts.t);
  if (!stamp || Math.abs(now / 1000 - stamp) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${stamp}.${rawBody}`)));
  const given = String(header).split(",").filter((item) => item.startsWith("v1=")).map((item) => item.slice(3));
  return given.some((value) => value.length === signature.length && timingSafeEqual(value, signature));
}

function timingSafeEqual(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function safeReturn(value, request) {
  // Only send people back to the app that called us.
  try {
    const url = new URL(String(value || ""));
    const origin = request.headers.get("origin");
    if (origin && url.origin !== origin) return null;
    if (!/^https?:$/.test(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

function orderOut(row) {
  if (!row) return null;
  return {
    id: row.id,
    buyer: row.buyer,
    seller: row.seller,
    productId: row.product_id,
    name: row.name,
    image: row.image,
    variant: row.variant || "",
    qty: row.qty,
    unit: row.unit_cents / 100,
    total: row.total_cents / 100,
    fee: row.fee_cents / 100,
    status: row.status,
    shipping: row.shipping ? JSON.parse(row.shipping) : null,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

export async function handlePayments(hub, request, url) {
  const env = hub.env;
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
  const path = url.pathname.replace(/^\/calls\/api/, "");
  const configured = Boolean(env.STRIPE_SECRET_KEY);
  const feePercent = Math.max(0, Math.min(30, Number(env.PLATFORM_FEE_PERCENT ?? 5)));
  const body = request.method === "POST" && path !== "/stripe/webhook" ? await request.json().catch(() => ({})) : {};
  const one = (query, ...args) => hub.one(query, ...args);
  const userExists = (handle) => Boolean(handle && one("SELECT 1 AS ok FROM users WHERE handle = ?", handle));

  try {
    if (path === "/config") return json({ enabled: configured, feePercent, testMode: String(env.STRIPE_SECRET_KEY || "").startsWith("sk_test_") });

    // Public shop of a seller (only what the seller published to the server).
    if (path === "/shop" && request.method === "GET") {
      const seller = handleOf(url.searchParams.get("handle"));
      const account = one("SELECT * FROM pay_accounts WHERE handle = ?", seller);
      const products = hub.rows("SELECT * FROM pay_products WHERE seller = ? ORDER BY updated_at DESC", seller).map((row) => ({
        id: row.id, name: row.name, price: row.price_cents / 100, images: row.image ? [row.image] : [], stock: row.stock, madeToOrder: row.made_to_order, service: Boolean(row.service),
      }));
      const shop = products.length ? JSON.parse(hub.rows("SELECT shop FROM pay_products WHERE seller = ? LIMIT 1", seller)[0]?.shop || "null") : null;
      return json({ seller, shop, products, payments: Boolean(account?.charges_enabled) && configured });
    }

    // Every seller with a published catalogue, for the Shop section.
    if (path === "/shops" && request.method === "GET") {
      const rows = hub.rows("SELECT seller, count(*) AS n, max(shop) AS shop, max(updated_at) AS at FROM pay_products GROUP BY seller ORDER BY at DESC LIMIT 60");
      const shops = rows.map((row) => {
        const account = one("SELECT charges_enabled FROM pay_accounts WHERE handle = ?", row.seller);
        const products = hub.rows("SELECT * FROM pay_products WHERE seller = ? ORDER BY updated_at DESC LIMIT 12", row.seller).map((item) => ({
          id: item.id, name: item.name, price: item.price_cents / 100, images: item.image ? [item.image] : [], stock: item.stock, madeToOrder: item.made_to_order, service: Boolean(item.service),
        }));
        return { seller: row.seller, shop: JSON.parse(row.shop || "null"), count: row.n, products, payments: Boolean(account?.charges_enabled) && configured };
      });
      return json({ shops });
    }

    if (path === "/products/sync" && request.method === "POST") {
      const seller = handleOf(body.handle);
      if (!userExists(seller)) return json({ error: "unknown-user" }, 404);
      const list = Array.isArray(body.products) ? body.products.slice(0, 200) : [];
      const shop = body.shop ? JSON.stringify({ title: clean(body.shop.title, 60), city: clean(body.shop.city, 40), category: clean(body.shop.category, 40) }) : null;
      const now = Date.now();
      hub.sql.exec("DELETE FROM pay_products WHERE seller = ?", seller);
      for (const item of list) {
        const cents = Math.round(Number(item.price) * 100);
        if (!item.id || !Number.isFinite(cents) || cents < 50 || cents > 5_000_000) continue;
        const image = /^https:\/\//.test(String(item.image || "")) ? clean(item.image, 600) : null;
        hub.sql.exec(
          "INSERT INTO pay_products (seller, id, name, price_cents, image, stock, made_to_order, service, shop, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          seller, clean(item.id, 64), clean(item.name, 120) || "Prodotto", cents, image,
          item.stock == null ? null : Math.max(0, Math.round(Number(item.stock) || 0)),
          item.madeToOrder ? Math.max(1, Math.round(Number(item.madeToOrder))) : null,
          item.service ? 1 : 0, shop, now,
        );
      }
      return json({ ok: true, count: hub.one("SELECT count(*) AS n FROM pay_products WHERE seller = ?", seller).n });
    }

    if (path === "/orders" && request.method === "GET") {
      const handle = handleOf(url.searchParams.get("handle"));
      return json({
        bought: hub.rows("SELECT * FROM orders WHERE buyer = ? AND status != 'pending' ORDER BY created_at DESC LIMIT 100", handle).map(orderOut),
        sold: hub.rows("SELECT * FROM orders WHERE seller = ? AND status != 'pending' ORDER BY created_at DESC LIMIT 100", handle).map(orderOut),
      });
    }

    if (path === "/orders/ship" && request.method === "POST") {
      const seller = handleOf(body.handle);
      const order = one("SELECT * FROM orders WHERE id = ? AND seller = ?", clean(body.orderId, 64), seller);
      if (!order || order.status !== "paid") return json({ error: "not-found" }, 404);
      hub.sql.exec("UPDATE orders SET status = 'shipped' WHERE id = ?", order.id);
      const out = orderOut(one("SELECT * FROM orders WHERE id = ?", order.id));
      hub.sendTo(order.buyer, { type: "order", order: out, event: "shipped" });
      hub.sendTo(order.seller, { type: "order", order: out, event: "shipped" });
      return json({ order: out });
    }

    if (path === "/stripe/webhook" && request.method === "POST") {
      const raw = await request.text();
      const ok = await verifyStripeSignature(raw, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
      if (!ok) return json({ error: "signature" }, 400);
      const event = JSON.parse(raw);
      const object = event.data?.object || {};
      if (event.type === "checkout.session.completed" && object.payment_status === "paid") {
        for (const row of hub.rows("SELECT id FROM orders WHERE session_id = ?", object.id)) markPaid(hub, row.id, object);
      }
      if (event.type === "account.updated") {
        hub.sql.exec(
          "UPDATE pay_accounts SET charges_enabled = ?, details_submitted = ?, payouts_enabled = ?, updated_at = ? WHERE account_id = ?",
          object.charges_enabled ? 1 : 0, object.details_submitted ? 1 : 0, object.payouts_enabled ? 1 : 0, Date.now(), object.id,
        );
      }
      return json({ received: true });
    }

    if (!configured) return json({ error: "stripe-not-configured" }, 503);

    if (path === "/connect/status" && request.method === "GET") {
      const handle = handleOf(url.searchParams.get("handle"));
      const row = one("SELECT * FROM pay_accounts WHERE handle = ?", handle);
      if (!row) return json({ connected: false });
      const account = await stripe(env, "GET", `/accounts/${row.account_id}`);
      hub.sql.exec(
        "UPDATE pay_accounts SET charges_enabled = ?, details_submitted = ?, payouts_enabled = ?, updated_at = ? WHERE handle = ?",
        account.charges_enabled ? 1 : 0, account.details_submitted ? 1 : 0, account.payouts_enabled ? 1 : 0, Date.now(), handle,
      );
      return json({ connected: true, chargesEnabled: Boolean(account.charges_enabled), detailsSubmitted: Boolean(account.details_submitted), payoutsEnabled: Boolean(account.payouts_enabled), accountId: row.account_id });
    }

    if (path === "/connect/onboard" && request.method === "POST") {
      const handle = handleOf(body.handle);
      if (!userExists(handle)) return json({ error: "unknown-user" }, 404);
      const back = safeReturn(body.returnUrl, request);
      if (!back) return json({ error: "return-url" }, 400);
      let row = one("SELECT * FROM pay_accounts WHERE handle = ?", handle);
      if (!row) {
        const account = await stripe(env, "POST", "/accounts", {
          type: "express",
          country: clean(body.country, 2).toUpperCase() || "IT",
          email: clean(body.email, 120) || undefined,
          business_profile: { name: clean(body.shopName, 80) || undefined, product_description: "Prodotti artigianali venduti su Space" },
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          metadata: { space_handle: handle },
        });
        hub.sql.exec("INSERT INTO pay_accounts (handle, account_id, updated_at) VALUES (?, ?, ?)", handle, account.id, Date.now());
        row = one("SELECT * FROM pay_accounts WHERE handle = ?", handle);
      }
      const done = new URL(back);
      done.searchParams.set("stripe", "return");
      const again = new URL(back);
      again.searchParams.set("stripe", "refresh");
      const link = await stripe(env, "POST", "/account_links", { account: row.account_id, refresh_url: again.toString(), return_url: done.toString(), type: "account_onboarding" });
      return json({ url: link.url });
    }

    if (path === "/connect/dashboard" && request.method === "POST") {
      const row = one("SELECT * FROM pay_accounts WHERE handle = ?", handleOf(body.handle));
      if (!row) return json({ error: "not-connected" }, 404);
      const link = await stripe(env, "POST", `/accounts/${row.account_id}/login_links`);
      return json({ url: link.url });
    }

    if (path === "/checkout" && request.method === "POST") {
      const buyer = handleOf(body.buyer);
      const seller = handleOf(body.seller);
      if (!userExists(buyer)) return json({ error: "unknown-user" }, 404);
      if (buyer === seller) return json({ error: "own-product" }, 400);
      const account = one("SELECT * FROM pay_accounts WHERE handle = ?", seller);
      if (!account?.charges_enabled) return json({ error: "seller-not-ready" }, 409);
      const back = safeReturn(body.returnUrl, request);
      if (!back) return json({ error: "return-url" }, 400);
      // One product (productId) or a cart from the same seller (items).
      const wanted = (Array.isArray(body.items) && body.items.length ? body.items : [{ productId: body.productId, qty: body.qty, variant: body.variant }]).slice(0, 20);
      const lines = [];
      for (const item of wanted) {
        const product = one("SELECT * FROM pay_products WHERE seller = ? AND id = ?", seller, clean(item.productId, 64));
        if (!product) return json({ error: "product" }, 404);
        const qty = Math.max(1, Math.min(MAX_QTY, Math.round(Number(item.qty) || 1)));
        if (product.stock != null && !product.made_to_order && product.stock < qty) return json({ error: "stock", productId: product.id }, 409);
        lines.push({ product, qty, variant: clean(item.variant, 40) });
      }
      const physical = lines.some((line) => !line.product.service);
      const goods = lines.reduce((sum, line) => sum + line.product.price_cents * line.qty, 0);
      const shippingCents = physical && goods < 8000 ? 690 : 0;
      const session = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const ids = [];
      const now = Date.now();
      for (const line of lines) {
        const total = line.product.price_cents * line.qty;
        const fee = Math.round((total * feePercent) / 100);
        const id = `ord_${session}_${ids.length + 1}`;
        ids.push({ id, fee });
        hub.sql.exec(
          "INSERT INTO orders (id, buyer, seller, product_id, name, image, variant, qty, unit_cents, total_cents, fee_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
          id, buyer, seller, line.product.id, line.product.name, line.product.image, line.variant, line.qty, line.product.price_cents, total, fee, now,
        );
      }
      const ok = new URL(back);
      ok.searchParams.set("checkout", "success");
      ok.searchParams.set("order", ids[0].id);
      const ko = new URL(back);
      ko.searchParams.set("checkout", "cancel");
      ko.searchParams.set("order", ids[0].id);
      const checkout = await stripe(env, "POST", "/checkout/sessions", {
        mode: "payment",
        success_url: ok.toString(),
        cancel_url: ko.toString(),
        client_reference_id: ids[0].id,
        line_items: [
          ...lines.map((line) => ({
            quantity: line.qty,
            price_data: {
              currency: "eur",
              unit_amount: line.product.price_cents,
              product_data: { name: line.variant ? `${line.product.name} · ${line.variant}` : line.product.name, images: line.product.image ? [line.product.image] : undefined },
            },
          })),
          ...(shippingCents ? [{ quantity: 1, price_data: { currency: "eur", unit_amount: shippingCents, product_data: { name: "Spedizione" } } }] : []),
        ],
        payment_intent_data: { application_fee_amount: ids.reduce((sum, item) => sum + item.fee, 0), transfer_data: { destination: account.account_id }, metadata: { order_id: ids[0].id } },
        shipping_address_collection: physical ? { allowed_countries: ["IT", "SM", "VA", "FR", "DE", "AT", "CH", "ES"] } : undefined,
        phone_number_collection: { enabled: true },
        metadata: { order_id: ids[0].id, buyer, seller },
        locale: "it",
      });
      for (const item of ids) hub.sql.exec("UPDATE orders SET session_id = ? WHERE id = ?", checkout.id, item.id);
      return json({ url: checkout.url, orderId: ids[0].id, orders: ids.map((item) => item.id) });
    }

    // Confirms an order after the redirect back, without waiting for the webhook.
    if (path === "/orders/confirm" && request.method === "POST") {
      const order = one("SELECT * FROM orders WHERE id = ? AND buyer = ?", clean(body.orderId, 64), handleOf(body.handle));
      if (!order) return json({ error: "not-found" }, 404);
      if (order.status === "pending" && order.session_id) {
        const session = await stripe(env, "GET", `/checkout/sessions/${order.session_id}`);
        if (session.payment_status === "paid") {
          for (const row of hub.rows("SELECT id FROM orders WHERE session_id = ?", order.session_id)) markPaid(hub, row.id, session);
        }
      }
      return json({ order: orderOut(one("SELECT * FROM orders WHERE id = ?", order.id)) });
    }

    return json({ error: "not-found" }, 404);
  } catch (error) {
    return json({ error: "stripe", detail: String(error?.message || error) }, error?.status || 500);
  }
}

// Paid once: stock goes down and both sides hear about it live.
export function markPaid(hub, orderId, session) {
  const order = hub.one("SELECT * FROM orders WHERE id = ?", orderId);
  if (!order || order.status !== "pending") return;
  const shipping = session?.shipping_details || session?.collected_information?.shipping_details || null;
  hub.sql.exec("UPDATE orders SET status = 'paid', paid_at = ?, shipping = ? WHERE id = ?", Date.now(), shipping ? JSON.stringify(shipping) : null, orderId);
  hub.sql.exec("UPDATE pay_products SET stock = max(0, stock - ?) WHERE seller = ? AND id = ? AND stock IS NOT NULL AND made_to_order IS NULL", order.qty, order.seller, order.product_id);
  const out = orderOut(hub.one("SELECT * FROM orders WHERE id = ?", orderId));
  hub.sendTo(order.seller, { type: "order", order: out, event: "sold" });
  hub.sendTo(order.buyer, { type: "order", order: out, event: "paid" });
}
