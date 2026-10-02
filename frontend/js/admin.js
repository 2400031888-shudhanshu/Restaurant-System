const ordersContainer =
    document.getElementById("admin-orders");

const currentUser = JSON.parse(localStorage.getItem("user") || "null");

if (!localStorage.getItem("token") || !["ADMIN", "STAFF", "DELIVERY"].includes(currentUser?.role)) {
    window.location.replace("admin-login.html");
}

if (currentUser?.role !== "ADMIN") {
    document.querySelectorAll(".admin-only").forEach(link => {
        link.hidden = true;
    });
}

if (currentUser?.role === "DELIVERY") {
    document.querySelector("main h2").textContent = "Delivery Desk";
}


// =====================================
// LOAD ALL ORDERS
// =====================================

async function loadAllOrders() {

    try {

        const token =
    localStorage.getItem("token");

const response = await fetch(
    "/api/orders/admin/all",
    {
        headers: {
            "Authorization":
                `Bearer ${token}`
        }
    }
);


        if (response.status === 401) {
            handleExpiredSession("admin-login.html");
            return;
        }

        if (!response.ok) {

            throw new Error(
                "Unable to fetch orders"
            );

        }


        const orders =
            await response.json();


        displayOrders(orders);


    } catch (error) {

        console.error(error);

        ordersContainer.innerHTML = `
            <p>
                ❌ Unable to load orders.
            </p>
        `;

    }

}


// =====================================
// DISPLAY ORDERS
// =====================================

function displayOrders(orders) {

    if (orders.length === 0) {

        ordersContainer.innerHTML = `
            <div class="empty-orders">

                <h3>
                    📦 No orders found
                </h3>

            </div>
        `;

        return;
    }


    let html = "";


    orders.forEach(order => {

        const orderDate =
            new Date(order.order_date)
                .toLocaleString();

        const orderItems = (order.items || []).map(item => `
            <li>${escapeHtml(item.food_name)} × ${Number(item.quantity)}
                <span>₹${Number(item.price).toFixed(2)} each</span>
                <strong>₹${Number(item.subtotal).toFixed(2)}</strong>
            </li>
        `).join("");

        const statuses = currentUser?.role === "DELIVERY"
            ? order.order_status === "READY"
                ? ["READY", "OUT_FOR_DELIVERY"]
                : order.order_status === "OUT_FOR_DELIVERY"
                    ? ["OUT_FOR_DELIVERY", "DELIVERED"]
                    : [order.order_status]
            : ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

        const statusOptions = statuses.map(status => `
            <option value="${status}" ${order.order_status === status ? "selected" : ""}>
                ${status.replaceAll("_", " ")}
            </option>
        `).join("");

        const canConfirmPayment = order.payment_status === "PENDING" &&
            (currentUser?.role !== "DELIVERY" ||
                (order.payment_method === "COD" && order.order_status === "DELIVERED"));
        const confirmPaymentButton = canConfirmPayment
            ? `<button type="button" onclick="confirmPayment(${order.order_id})">${order.payment_method === "COD" ? "Confirm cash received" : "Confirm UPI payment"}</button>`
            : "";


        html += `

            <div class="admin-order-card" id="order-${order.order_id}">

                <div class="admin-order-header">

                    <h3>
                        Order #${order.order_id}
                    </h3>

                    <strong>₹${Number(order.total_amount).toFixed(2)}</strong>

                </div>


                <p><strong>Customer:</strong> ${escapeHtml(order.customer_name || `#${order.user_id}`)}</p>
                <p><strong>Email:</strong> ${escapeHtml(order.customer_email || "Not provided")}</p>
                <p><strong>Phone:</strong> ${escapeHtml(order.customer_phone || "Not provided")}</p>

                <h4>Items</h4>
                <ul class="order-item-list">${orderItems || "<li>Item details unavailable</li>"}</ul>

                <p><strong>Payment:</strong> ${escapeHtml(order.payment_method || "Not recorded")} · ${escapeHtml(order.payment_status || "PENDING")}</p>
                ${order.transaction_id ? `<p><strong>UPI reference:</strong> ${escapeHtml(order.transaction_id)}</p>` : ""}


                <p>
                    <strong>Delivery Address:</strong>
                    ${escapeHtml(order.delivery_address)}
                </p>


                <p>
                    <strong>Order Date:</strong>
                    ${orderDate}
                </p>


                <p>
                    <strong>Status:</strong>
                    <span class="order-status">
                        ${escapeHtml(order.order_status || "PENDING")}
                    </span>
                </p>


                <select
                    aria-label="Update order ${order.order_id} status"
                    onchange="updateOrderStatus(
                        ${order.order_id},
                        this.value
                    )"
                >

                    ${statusOptions}
                </select>

                ${confirmPaymentButton}

                <button class="print-order-button" type="button" onclick="printOrder(${order.order_id})">
                    Print order
                </button>

            </div>

        `;

    });


    ordersContainer.innerHTML = html;

}

function printOrder(orderId) {
    const orderCard = document.getElementById(`order-${orderId}`);
    if (!orderCard) {
        return;
    }

    document.querySelectorAll(".print-target").forEach(card => {
        card.classList.remove("print-target");
    });
    orderCard.classList.add("print-target");

    const clearPrintTarget = () => orderCard.classList.remove("print-target");
    window.addEventListener("afterprint", clearPrintTarget, { once: true });
    window.print();
    setTimeout(clearPrintTarget, 2000);
}


// =====================================
// UPDATE ORDER STATUS
// =====================================

async function updateOrderStatus(
    orderId,
    newStatus
) {

    try {

        const token =
    localStorage.getItem("token");

const response = await fetch(
    `/api/orders/${orderId}/status`,
    {
        method: "PUT",

        headers: {
            "Content-Type":
                "application/json",

            "Authorization":
                `Bearer ${token}`
        },

                body: JSON.stringify({
                    order_status: newStatus
                })
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                "❌ " + data.message
            );

            return;
        }


        alert(
            "✅ Order status updated"
        );


        loadAllOrders();


    } catch (error) {

        console.error(error);

        alert(
            "❌ Unable to update order status."
        );

    }

}

async function confirmPayment(orderId) {
    try {
        const response = await fetch(`/api/orders/${orderId}/payment/confirm`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Unable to confirm payment.");
        }

        await loadAllOrders();
    } catch (error) {
        alert(error.message);
    }
}


// Load orders
loadAllOrders();