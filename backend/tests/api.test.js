// End-to-end API tests against a throw-away database (restaurant_db_test).
// Uses the DB_* values from backend/.env (or the environment) and needs a
// MySQL user allowed to create/drop databases.
require("dotenv").config();

process.env.DB_NAME = "restaurant_db_test";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
delete process.env.SMTP_HOST;

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const mysql = require("mysql2/promise");

const root = path.resolve(__dirname, "..");
let server;
let base;

async function api(method, url, { token, body } = {}) {
    const response = await fetch(base + url, {
        method,
        headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await response.json(); } catch { /* empty body */ }
    return { status: response.status, data };
}

async function login(email, password) {
    const result = await api("POST", "/api/auth/login", { body: { email, password } });
    assert.equal(result.status, 200, `login failed for ${email}`);
    return result.data.token;
}

before(async () => {
    const admin = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        port: Number(process.env.DB_PORT) || 3306
    });
    await admin.query("DROP DATABASE IF EXISTS restaurant_db_test");
    await admin.end();

    execFileSync("node", ["scripts/initDb.js"], { cwd: root, env: process.env, stdio: "pipe" });
    execFileSync("node", ["scripts/createAdmin.js", "Test Admin", "admin@test.dev", "AdminPass123"], {
        cwd: root, env: process.env, stdio: "pipe"
    });

    const app = require("../server");
    await new Promise(resolve => {
        server = app.listen(0, resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise(resolve => server.close(resolve));
    require("../config/database").end(() => {});
    const admin = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        port: Number(process.env.DB_PORT) || 3306
    });
    await admin.query("DROP DATABASE IF EXISTS restaurant_db_test");
    await admin.end();
});

test("health check and public menu work", async () => {
    assert.equal((await api("GET", "/api/health")).data.database, "connected");
    const foods = await api("GET", "/api/foods");
    assert.equal(foods.status, 200);
    assert.ok(foods.data.length >= 12);
    assert.equal((await api("GET", "/api/nope")).status, 404);
});

test("registration validates input and rejects duplicates", async () => {
    assert.equal((await api("POST", "/api/auth/register", { body: { name: "A", email: "bad", password: "12345678" } })).status, 400);
    assert.equal((await api("POST", "/api/auth/register", { body: { name: "A", email: "a@test.dev", password: "short" } })).status, 400);
    const ok = await api("POST", "/api/auth/register", { body: { name: "Cust", email: "Cust@Test.dev", password: "CustPass123" } });
    assert.equal(ok.status, 201);
    const dup = await api("POST", "/api/auth/register", { body: { name: "Cust", email: "cust@test.dev", password: "CustPass123" } });
    assert.equal(dup.status, 409);
});

test("login works, wrong password and missing token are rejected", async () => {
    assert.equal((await api("POST", "/api/auth/login", { body: { email: "cust@test.dev", password: "wrong" } })).status, 401);
    assert.ok(await login("CUST@test.dev", "CustPass123"));
    assert.equal((await api("GET", "/api/cart")).status, 401);
});

test("customers cannot use admin or staff APIs", async () => {
    const token = await login("cust@test.dev", "CustPass123");
    assert.equal((await api("GET", "/api/admin/foods", { token })).status, 403);
    assert.equal((await api("GET", "/api/admin/users", { token })).status, 403);
    assert.equal((await api("GET", "/api/orders/admin/all", { token })).status, 403);
});

test("admin food management validates and saves", async () => {
    const token = await login("admin@test.dev", "AdminPass123");
    const categories = (await api("GET", "/api/categories")).data;
    const bad = await api("POST", "/api/admin/foods", { token, body: { category_id: categories[0].category_id, food_name: "Bad", price: -5 } });
    assert.equal(bad.status, 400);
    const missingCategory = await api("POST", "/api/admin/foods", { token, body: { category_id: 9999, food_name: "Ghost", price: 10 } });
    assert.equal(missingCategory.status, 400);
    const good = await api("POST", "/api/admin/foods", { token, body: { category_id: categories[0].category_id, food_name: "Test Dish", price: 50, availability: 1 } });
    assert.equal(good.status, 201);
});

test("full order flow: cart -> order -> staff updates -> payment -> history survives menu deletion", async () => {
    const customer = await login("cust@test.dev", "CustPass123");
    const admin = await login("admin@test.dev", "AdminPass123");

    const foods = (await api("GET", "/api/foods")).data;
    const dish = foods.find(food => food.food_name === "Test Dish");

    assert.equal((await api("POST", "/api/cart", { token: customer, body: { food_id: dish.food_id, quantity: 0 } })).status, 400);
    assert.equal((await api("POST", "/api/cart", { token: customer, body: { food_id: 99999, quantity: 1 } })).status, 404);
    assert.equal((await api("POST", "/api/cart", { token: customer, body: { food_id: dish.food_id, quantity: 2 } })).status, 201);
    const again = await api("POST", "/api/cart", { token: customer, body: { food_id: dish.food_id, quantity: 1 } });
    assert.equal(again.status, 200);
    assert.equal(again.data.quantity, 3);

    // Unavailable items cannot be ordered
    await api("PUT", `/api/admin/foods/${dish.food_id}/availability`, { token: admin, body: { availability: false } });
    const blocked = await api("POST", "/api/orders/place", { token: customer, body: { delivery_address: "Home", payment_method: "COD" } });
    assert.equal(blocked.status, 409);
    await api("PUT", `/api/admin/foods/${dish.food_id}/availability`, { token: admin, body: { availability: true } });

    assert.equal((await api("POST", "/api/orders/place", { token: customer, body: { delivery_address: "", payment_method: "COD" } })).status, 400);
    assert.equal((await api("POST", "/api/orders/place", { token: customer, body: { delivery_address: "Home", payment_method: "BITCOIN" } })).status, 400);

    const placed = await api("POST", "/api/orders/place", { token: customer, body: { delivery_address: "12 Test Street", payment_method: "UPI", transaction_id: "REF123" } });
    assert.equal(placed.status, 201);
    assert.equal(placed.data.total_amount, 150);

    const cart = await api("GET", "/api/cart", { token: customer });
    assert.equal(cart.data.items.length, 0);

    const mine = await api("GET", "/api/orders/my-orders", { token: customer });
    assert.equal(mine.data.length, 1);
    assert.equal(mine.data[0].items[0].food_name, "Test Dish");

    const orderId = placed.data.order_id;
    assert.equal((await api("PUT", `/api/orders/${orderId}/status`, { token: admin, body: { order_status: "NOPE" } })).status, 400);
    assert.equal((await api("PUT", `/api/orders/${orderId}/status`, { token: admin, body: { order_status: "CONFIRMED" } })).status, 200);

    // regression: this route used to be nested inside the status handler
    const paid = await api("PUT", `/api/orders/${orderId}/payment/confirm`, { token: admin });
    assert.equal(paid.status, 200);
    assert.equal((await api("PUT", `/api/orders/${orderId}/payment/confirm`, { token: admin })).status, 409);

    const all = await api("GET", "/api/orders/admin/all", { token: admin });
    assert.equal(all.data[0].payment_status, "PAID");

    // Deleting the dish must not erase or rename past order lines
    assert.equal((await api("DELETE", `/api/admin/foods/${dish.food_id}`, { token: admin })).status, 200);
    const after = await api("GET", "/api/orders/my-orders", { token: customer });
    assert.equal(after.data[0].items[0].food_name, "Test Dish");
    assert.equal(after.data[0].items[0].quantity, 3);
});

test("delivery accounts are limited to delivery progress", async () => {
    const admin = await login("admin@test.dev", "AdminPass123");
    const created = await api("POST", "/api/admin/staff", { token: admin, body: { name: "Rider", email: "rider@test.dev", password: "RiderPass123", role: "DELIVERY" } });
    assert.equal(created.status, 201);
    const rider = await login("rider@test.dev", "RiderPass123");

    const orders = (await api("GET", "/api/orders/admin/all", { token: rider })).data;
    const orderId = orders[0].order_id;
    assert.equal((await api("PUT", `/api/orders/${orderId}/status`, { token: rider, body: { order_status: "PREPARING" } })).status, 403);
    assert.equal((await api("PUT", `/api/orders/${orderId}/status`, { token: rider, body: { order_status: "OUT_FOR_DELIVERY" } })).status, 409);
    assert.equal((await api("GET", "/api/admin/users", { token: rider })).status, 403);

    // deactivated staff lose access immediately
    const staff = (await api("GET", "/api/admin/staff", { token: admin })).data;
    await api("DELETE", `/api/admin/staff/${staff[0].user_id}`, { token: admin });
    assert.equal((await api("GET", "/api/orders/admin/all", { token: rider })).status, 401);
});

test("last active admin cannot be deactivated", async () => {
    const admin = await login("admin@test.dev", "AdminPass123");
    const me = await api("GET", "/api/auth/me", { token: admin });
    const result = await api("PUT", `/api/admin/users/${me.data.user_id}/access`, { token: admin, body: { is_active: false } });
    assert.equal(result.status, 409);
});
