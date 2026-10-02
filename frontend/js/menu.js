const API_URL = "/api/foods";

async function loadFoodItems() {

    const foodContainer = document.getElementById("food-container");

    try {

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Failed to fetch food items");
        }

        const foods = await response.json();

        foodContainer.innerHTML = "";

        foods.forEach(food => {

            const foodCard = document.createElement("div");

            foodCard.className = "food-card";

            const foodImage = document.createElement("img");
            foodImage.className = "food-card-image";
            foodImage.alt = food.food_name;
            foodImage.loading = "lazy";
            setFoodImage(foodImage, food);

            foodCard.innerHTML = `
                <h3>${escapeHtml(food.food_name)}</h3>

                <p>${escapeHtml(food.description || "")}</p>

                <p>
                    <strong>Category:</strong>
                    ${escapeHtml(food.category_name)}
                </p>

                <p>
                    <strong>Price:</strong>
                    ₹${Number(food.price).toFixed(2)}
                </p>

                <p>
                    <strong>Status:</strong>
                    ${food.availability == 1
                        ? "Available"
                        : "Not Available"}
                </p>

                <button
                    onclick="addToCart(${food.food_id})"
                    ${food.availability == 1 ? "" : "disabled"}>
                    Add to Cart
                </button>
            `;

            foodCard.prepend(foodImage);
            foodContainer.appendChild(foodCard);
        });

    } catch (error) {

        console.error("Error:", error);

        foodContainer.innerHTML = `
            <p>❌ Unable to load food items.</p>
        `;
    }
}


// =====================================
// ADD TO CART
// =====================================

async function addToCart(foodId) {

    const user = JSON.parse(
        localStorage.getItem("user")
    );
    const token = localStorage.getItem("token");

    if (!user || !token) {

        alert("Please login first.");

        window.location.href = "login.html";

        return;
    }

    try {

        const response = await fetch("/api/cart", {

            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },

            body: JSON.stringify({
                food_id: foodId,

                quantity: 1
            })
        });

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        const data = await response.json();

        if (!response.ok) {

            alert("❌ " + data.message);

            return;
        }

        alert("✅ " + data.message);

    } catch (error) {

        console.error(error);

        alert("❌ Unable to add item to cart.");
    }
}


loadFoodItems();