const adminModules = document.querySelector(".home-admin-modules");
const customerModules = document.querySelector(".home-modules:not(.home-admin-modules)");
const loginLink = document.getElementById("login-link");
const registerLink = document.getElementById("register-link");
const logoutButton = document.getElementById("logout-button");
const homeMenuGrid = document.getElementById("home-menu-grid");
const feedbackForm = document.getElementById("feedback-form");
const token = localStorage.getItem("token");
async function loadHomeMenu() {
    if (!homeMenuGrid) {
        return;
    }

    try {
        const response = await fetch("/api/foods");
        const foods = await response.json();
        if (!response.ok) {
            throw new Error(foods.message || "Unable to load the menu.");
        }

        const availableFoods = foods.filter(food => Number(food.availability) === 1);
        if (!availableFoods.length) {
            homeMenuGrid.innerHTML = "<p>Our menu is being refreshed. Please check back shortly.</p>";
            return;
        }

        homeMenuGrid.innerHTML = availableFoods.map(food => {
            return `
                <article class="home-menu-item">
                    <img alt="${escapeHtml(food.food_name)}" loading="lazy">
                    <div class="home-menu-item-copy">
                        <p class="home-menu-category">${escapeHtml(food.category_name)}</p>
                        <h3>${escapeHtml(food.food_name)}</h3>
                        <p>${escapeHtml(food.description || "Prepared fresh to order.")}</p>
                        <strong>₹${Number(food.price).toFixed(2)}</strong>
                    </div>
                </article>
            `;
        }).join("");
        homeMenuGrid.querySelectorAll(".home-menu-item img").forEach((image, index) => {
            setFoodImage(image, availableFoods[index]);
        });
    } catch (error) {
        console.error("Unable to load homepage menu:", error);
        homeMenuGrid.innerHTML = "<p>Menu is temporarily unavailable. <a href=\"menu.html\">Open the full menu</a>.</p>";
    }
}

loadHomeMenu();

feedbackForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const status = document.getElementById("feedback-status");
    const formData = new FormData(feedbackForm);
    status.textContent = "Sending...";

    try {
        const response = await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.fromEntries(formData))
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || "Unable to send feedback.");
        }

        status.textContent = result.message;
        feedbackForm.reset();
    } catch (error) {
        status.textContent = error.message;
    }
});

if (customerModules && token) {
    fetch("/api/auth/me", {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    })
        .then(response => {
            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
            }
            return response.ok ? response.json() : null;
        })
        .then(user => {
            if (!user) {
                return;
            }

            customerModules.hidden = false;
            loginLink.hidden = true;
            registerLink.hidden = true;
            logoutButton.hidden = false;

            if (user.role === "ADMIN") {
                adminModules.hidden = false;
            }
        })
        .catch(error => console.error("Unable to verify admin access:", error));
}

logoutButton.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
});