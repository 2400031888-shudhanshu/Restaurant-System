// ORDERS PAGE
// =====================================

const ordersContainer =
    document.getElementById("orders-container");
const token = localStorage.getItem("token");



// =====================================
// CHECK LOGIN
// =====================================

if (!token) {

    ordersContainer.innerHTML = `
        <div class="empty-orders">

            <h3>🔐 Please Login First</h3>

            <p>
                Login to view your orders.
            </p>

            <a href="login.html">
                Login
            </a>

        </div>
    `;

} else {

    loadOrders();

}


// =====================================
// LOAD MY ORDERS
// =====================================

async function loadOrders() {

    try {

        const response =
            await fetch(
                "/api/orders/my-orders",
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            "Bearer " + token,

                        "Content-Type":
                            "application/json"
                    }
                }
            );


        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        // Get response as TEXT first
        // This prevents Unexpected token '<'
        const text =
            await response.text();



        // Try converting response to JSON
        let data;

        try {

            data = JSON.parse(text);

        } catch (jsonError) {

            console.error(
                "Server returned non-JSON response:",
                text
            );

            throw new Error(
                "Server returned an invalid response. Check API URL."
            );

        }


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to load orders"
            );

        }


        displayOrders(data);


    } catch (error) {

        console.error(
            "Orders Error:",
            error
        );


        ordersContainer.innerHTML = `

            <div class="empty-orders">

                <h3>
                    ❌ Unable to load orders
                </h3>

                <p>
                    ${escapeHtml(error.message)}
                </p>

                <button onclick="loadOrders()">
                    Try Again
                </button>

            </div>

        `;

    }

}


// =====================================
// DISPLAY ORDERS
// =====================================

function displayOrders(orders) {

    if (!orders || orders.length === 0) {

        ordersContainer.innerHTML = `

            <div class="empty-orders">

                <h3>
                    📦 No Orders Yet
                </h3>

                <p>
                    You have not placed any orders.
                </p>

                <a href="menu.html">
                    Browse Menu
                </a>

            </div>

        `;

        return;
    }


    let html = "";


    orders.forEach(order => {

        const amount =
            Number(order.total_amount || 0)
            .toFixed(2);


        const orderDate =
            order.order_date
                ? new Date(
                    order.order_date
                  ).toLocaleString()
                : "N/A";

        const orderItems = (order.items || []).map(item => `
            <li>${escapeHtml(item.food_name)} × ${Number(item.quantity)}
                <span>₹${Number(item.price).toFixed(2)} each</span>
                <strong>₹${Number(item.subtotal).toFixed(2)}</strong>
            </li>
        `).join("");


        html += `

            <div class="order-card" id="order-${order.order_id}">

                <div class="order-header">

                    <h3>
                        🧾 Order #${order.order_id}
                    </h3>

                    <span class="order-status">
                        ${escapeHtml(order.order_status || "PENDING")}
                    </span>
                </div>


                <p>
                    <strong>Total:</strong>
                    ₹${amount}
                </p>

                <p>
                    <strong>Payment:</strong>
                    ${escapeHtml(order.payment_method || "Not recorded")} ·
                    ${escapeHtml(order.payment_status || "PENDING")}
                </p>

                ${order.transaction_id
                    ? `<p><strong>UPI reference:</strong> ${escapeHtml(order.transaction_id)}</p>`
                    : ""}

                <h4>Items</h4>
                <ul class="order-item-list">${orderItems || "<li>Item details unavailable</li>"}</ul>


                <p>
                    <strong>Delivery Address:</strong>
                    ${escapeHtml(order.delivery_address)}
                </p>


                <p>
                    <strong>Order Date:</strong>
                    ${orderDate}
                </p>

                <button class="print-order-button" type="button" onclick="printOrder(${order.order_id})">
                    Print order
                </button>

            </div>

            <hr>

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