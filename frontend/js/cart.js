// =====================================
// CART PAGE
// =====================================

const cartContainer = document.getElementById("cart-container");
const token = localStorage.getItem("token");

// =====================================
// CHECK LOGIN
// =====================================

if (!token) {
    cartContainer.innerHTML = `
        <div class="empty-cart">
            <h3>🔐 Please Login First</h3>
            <p>Login to view your cart.</p>
            <a href="login.html">Login</a>
        </div>
    `;
} else {
    loadCart();
}

// =====================================
// LOAD CART
// =====================================

async function loadCart() {
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

        displayCart(data.items, data.total);

    } catch (error) {
        console.error("Cart Error:", error);

        cartContainer.innerHTML = `
            <div class="empty-cart">
                <h3>❌ Unable to load cart</h3>
                <p>${escapeHtml(error.message)}</p>
                <button onclick="loadCart()">Try Again</button>
            </div>
        `;
    }
}

// =====================================
// DISPLAY CART
// =====================================

function displayCart(items, total) {
    if (!items || items.length === 0) {
        cartContainer.innerHTML = `
            <div class="empty-cart">
                <h3>🛒 Your Cart Is Empty</h3>
                <p>Add some delicious food!</p>
                <a href="menu.html">Browse Menu</a>
            </div>
        `;
        return;
    }

    let html = "";

    items.forEach(item => {
        html += `
            <div class="cart-item">
                <h3>${escapeHtml(item.food_name)}</h3>
                <p>${escapeHtml(item.description || "")}</p>
                <p>Price: ₹${Number(item.price).toFixed(2)}</p>
                ${Number(item.availability) === 1 ? "" : "<p><strong>⚠️ Currently unavailable — remove this item to check out.</strong></p>"}

                <div>
                    <button onclick="decreaseQuantity(${item.food_id}, ${item.quantity})">−</button>
                    <strong>${item.quantity}</strong>
                    <button onclick="increaseQuantity(${item.food_id}, ${item.quantity})">+</button>
                </div>

                <p>
                    <strong>Subtotal: ₹${Number(item.subtotal).toFixed(2)}</strong>
                </p>

                <button onclick="removeItem(${item.food_id})">🗑️ Remove</button>
            </div>
            <hr>
        `;
    });

    html += `
        <div class="cart-total">
            <h2>Total: ₹${Number(total).toFixed(2)}</h2>
            <button onclick="checkout()" ${items.some(item => Number(item.availability) !== 1) ? "disabled" : ""}>Proceed to Checkout</button>
        </div>
    `;

    cartContainer.innerHTML = html;
}

// =====================================
// INCREASE QUANTITY
// =====================================

function increaseQuantity(foodId, quantity) {
    updateQuantity(foodId, quantity + 1);
}

// =====================================
// DECREASE QUANTITY
// =====================================

function decreaseQuantity(foodId, quantity) {
    if (quantity <= 1) {
        removeItem(foodId);
        return;
    }

    updateQuantity(foodId, quantity - 1);
}

// =====================================
// UPDATE QUANTITY
// =====================================

async function updateQuantity(foodId, quantity) {
    try {
        const response = await fetch(`/api/cart/${foodId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                quantity: quantity
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert("❌ " + (data.message || "Unable to update cart"));
            return;
        }

        loadCart();

    } catch (error) {
        console.error("Update Error:", error);
        alert("❌ Unable to update cart.");
    }
}

// =====================================
// REMOVE ITEM
// =====================================

async function removeItem(foodId) {
    if (!confirm("Remove this item from cart?")) {
        return;
    }

    try {
        const response = await fetch(`/api/cart/${foodId}`, {
            method: "DELETE",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const data = await response.json();

        if (!response.ok) {
            alert("❌ " + (data.message || "Unable to remove item"));
            return;
        }

        alert("✅ Item removed");
        loadCart();

    } catch (error) {
        console.error("Remove Error:", error);
        alert("❌ Unable to remove item.");
    }
}

// =====================================
// CHECKOUT
// =====================================

function checkout() {
    window.location.href = "checkout.html";
}
