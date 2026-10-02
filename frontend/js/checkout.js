// =====================================
// CHECKOUT PAGE
// =====================================

const checkoutContainer = document.getElementById("checkout-container");

// =====================================
// GET LOGIN USER
// =====================================

const user = JSON.parse(localStorage.getItem("user") || "null");
const token = localStorage.getItem("token");

// =====================================
// CHECK LOGIN
// =====================================

if (!checkoutContainer) {
    console.warn("checkout-container not found on this page.");
} else if (!user || !token) {
    checkoutContainer.innerHTML = `
        <div class="empty-cart">
            <h3>🔐 Please Login First</h3>
            <p>Login to continue checkout.</p>
            <a href="login.html">Login</a>
        </div>
    `;
} else {
    loadCheckout();
}

// =====================================
// LOAD CART
// =====================================

async function loadCheckout() {
    try {
        const response = await fetch("/api/cart", {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load cart");
        }

        const paymentResponse = await fetch("/api/orders/payment-options");
        const paymentOptions = paymentResponse.ok
            ? await paymentResponse.json()
            : { upi_vpa: "" };

        displayCheckout(data.items, data.total, paymentOptions);

    } catch (error) {
        console.error("Checkout Error:", error);

        if (checkoutContainer) {
            checkoutContainer.innerHTML = `
                <div>
                    <h3>❌ Unable to load checkout</h3>
                    <p>${escapeHtml(error.message)}</p>
                    <button onclick="loadCheckout()">Try Again</button>
                </div>
            `;
        }
    }
}

// =====================================
// DISPLAY CHECKOUT
// =====================================

function displayCheckout(items, total, upiOptions) {
    if (!checkoutContainer) {
        return;
    }

    if (!items || items.length === 0) {
        checkoutContainer.innerHTML = `
            <div class="empty-cart">
                <h3>🛒 Your Cart Is Empty</h3>
                <p>Add food before checkout.</p>
                <a href="menu.html">Browse Menu</a>
            </div>
        `;
        return;
    }

    const upiVpa = upiOptions.upi_vpa;
    const upiPayeeName = upiOptions.upi_payee_name || "Restaurant";

    let html = `
        <h3>Order Summary</h3>
        <div class="checkout-items">
    `;

    items.forEach(item => {
        html += `
            <div class="cart-item">
                <h4>${escapeHtml(item.food_name)}</h4>
                <p>Price: ₹${Number(item.price).toFixed(2)}</p>
                <p>Quantity: ${item.quantity}</p>
                <p><strong>Subtotal: ₹${Number(item.subtotal).toFixed(2)}</strong></p>
            </div>
            <hr>
        `;
    });

    html += `
        </div>
        <div class="cart-total">
            <h2>Total: ₹${Number(total).toFixed(2)}</h2>
        </div>
        <h3>Payment method</h3>
        <fieldset class="payment-options">
            <legend>Choose how to pay</legend>
            <label><input type="radio" name="payment_method" value="COD" checked> Cash on delivery</label>
            <label><input type="radio" name="payment_method" value="UPI"> UPI</label>
        </fieldset>
        <div id="upi-details" hidden>
            ${upiVpa
                     ? `<p>Pay <strong>₹${Number(total).toFixed(2)}</strong> to <strong>${escapeHtml(upiPayeeName)}</strong> (${escapeHtml(upiVpa)}) using your UPI app.</p>
                         <a class="button-link" href="upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent(upiPayeeName)}&cu=INR&tn=Restaurant%20order%20payment">Open UPI app</a>`
                : "<p>The restaurant UPI ID is not configured yet. Add UPI_VPA to backend/.env before accepting UPI payments.</p>"}
            <label for="upi-transaction-id">UPI transaction reference (optional)</label>
            <input id="upi-transaction-id" maxlength="100" autocomplete="off" placeholder="Enter UPI reference after paying">
            <p>UPI payments remain pending until staff verifies them.</p>
        </div>
        <h3>Delivery Address</h3>
        <textarea id="delivery-address" rows="5" cols="50" placeholder="Enter your complete delivery address"></textarea>
        <br><br>
        <button onclick="placeOrder()">🛍️ Place Order</button>
        <button onclick="goBackToCart()">← Back to Cart</button>
    `;

    checkoutContainer.innerHTML = html;
    document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
        radio.addEventListener("change", () => {
            document.getElementById("upi-details").hidden =
                document.querySelector('input[name="payment_method"]:checked').value !== "UPI";
        });
    });
}

// =====================================
// PLACE ORDER
// =====================================

async function placeOrder() {
    const addressElement = document.getElementById("delivery-address");

    if (!addressElement) {
        alert("Delivery address field not found.");
        return;
    }

    const deliveryAddress = addressElement.value.trim();
    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value;
    const transactionId = document.getElementById("upi-transaction-id")?.value.trim() || "";

    if (!deliveryAddress) {
        alert("Please enter your delivery address.");
        return;
    }

    try {
        const response = await fetch("/api/orders/place", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                delivery_address: deliveryAddress,
                payment_method: paymentMethod,
                transaction_id: paymentMethod === "UPI" ? transactionId : ""
            })
        });

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            alert("❌ " + (data.message || "Unable to place order"));
            return;
        }

        alert("✅ Order placed successfully!");
        window.location.href = "orders.html";

    } catch (error) {
        console.error("Place Order Error:", error);
        alert("❌ Unable to connect to server.");
    }
}

// =====================================
// BACK TO CART
// =====================================

function goBackToCart() {
    window.location.href = "cart.html";
}
