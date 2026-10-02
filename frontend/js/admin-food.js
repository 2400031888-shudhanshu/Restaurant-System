const API_URL =
    "/api/admin/foods";

const CATEGORY_URL =
    "/api/categories";


// =====================================
// ELEMENTS
// =====================================

const foodForm =
    document.getElementById("foodForm");

const foodList =
    document.getElementById("foodList");

const categorySelect =
    document.getElementById("categoryId");

const formTitle =
    document.getElementById("form-title");

const formMessage =
    document.getElementById("formMessage");

const cancelButton =
    document.getElementById("cancelButton");


// =====================================
// TOKEN
// =====================================

const token =
    localStorage.getItem("token");


if (!token) {

    alert("Please login first.");

    window.location.href =
        "login.html";
}


// =====================================
// LOAD CATEGORIES
// =====================================

async function loadCategories() {

    try {

        const response =
            await fetch(CATEGORY_URL);

        if (!response.ok) {
            throw new Error(
                "Unable to load categories"
            );
        }

        const categories =
            await response.json();


        categories.forEach(category => {

            const option =
                document.createElement("option");

            option.value =
                category.category_id;

            option.textContent =
                category.category_name;

            categorySelect.appendChild(option);

        });

    } catch (error) {

        console.error(error);

        categorySelect.innerHTML = `
            <option value="">
                Unable to load categories
            </option>
        `;
    }
}


// =====================================
// LOAD FOOD ITEMS
// =====================================

async function loadFoods() {

    try {

        const response =
            await fetch(API_URL, {

                headers: {
                    "Authorization":
                        `Bearer ${token}`
                }

            });


        const foods =
            await response.json();


        if (!response.ok) {

            throw new Error(
                foods.message ||
                "Unable to load food items"
            );

        }


        displayFoods(foods);


    } catch (error) {

        console.error(error);

        foodList.innerHTML = `
            <p>
                ❌ ${escapeHtml(error.message)}
            </p>
        `;
    }
}


// =====================================
// DISPLAY FOODS
// =====================================

function displayFoods(foods) {

    if (foods.length === 0) {

        foodList.innerHTML = `
            <p>
                No food items found.
            </p>
        `;

        return;
    }


    let html = "";


    foods.forEach(food => {

        const status =
            food.availability == 1
                ? "Available"
                : "Not Available";


        html += `

            <div class="admin-food-card">

                <div>

                    <h3>
                        ${escapeHtml(food.food_name)}
                    </h3>

                    <p>
                        Category:
                        ${escapeHtml(food.category_name || "N/A")}
                    </p>

                    <p>
                        Price:
                        ₹${Number(
                            food.price
                        ).toFixed(2)}
                    </p>

                    <p>
                        ${escapeHtml(food.description || "")}
                    </p>

                    <strong>
                        ${status}
                    </strong>

                </div>


                <div class="food-admin-buttons">

                    <button
                        onclick="editFood(
                            ${food.food_id}
                        )"
                    >
                        Edit
                    </button>


                    <button
                        onclick="toggleAvailability(
                            ${food.food_id},
                            ${food.availability}
                        )"
                    >
                        ${
                            food.availability == 1
                                ? "Disable"
                                : "Enable"
                        }
                    </button>


                    <button
                        onclick="deleteFood(
                            ${food.food_id}
                        )"
                    >
                        Delete
                    </button>

                </div>

            </div>

        `;

    });


    foodList.innerHTML = html;
}


// =====================================
// ADD / UPDATE FOOD
// =====================================

foodForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        const foodId =
            document.getElementById(
                "foodId"
            ).value;


        const foodData = {

            category_id:
                document.getElementById(
                    "categoryId"
                ).value,

            food_name:
                document.getElementById(
                    "foodName"
                ).value.trim(),

            description:
                document.getElementById(
                    "description"
                ).value.trim(),

            price:
                document.getElementById(
                    "price"
                ).value,

            image_url:
                document.getElementById(
                    "imageUrl"
                ).value.trim(),

            availability:
                Number(
                    document.getElementById(
                        "availability"
                    ).value
                )

        };


        try {

            let url = API_URL;

            let method = "POST";


            // EDIT
            if (foodId) {

                url =
                    `${API_URL}/${foodId}`;

                method = "PUT";

            }


            const response =
                await fetch(url, {

                    method,

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body:
                        JSON.stringify(foodData)

                });


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Operation failed"
                );

            }


            formMessage.textContent =
                "✅ " + data.message;


            resetForm();

            loadFoods();


        } catch (error) {

            console.error(error);

            formMessage.textContent =
                "❌ " + error.message;

        }

    }
);


// =====================================
// EDIT FOOD
// =====================================

async function editFood(foodId) {

    try {

        const response =
            await fetch(API_URL, {

                headers: {

                    "Authorization":
                        `Bearer ${token}`

                }

            });


        const foods =
            await response.json();


        const food =
            foods.find(
                item =>
                    item.food_id == foodId
            );


        if (!food) {

            alert(
                "Food item not found."
            );

            return;
        }


        document.getElementById(
            "foodId"
        ).value =
            food.food_id;


        document.getElementById(
            "categoryId"
        ).value =
            food.category_id;


        document.getElementById(
            "foodName"
        ).value =
            food.food_name;


        document.getElementById(
            "description"
        ).value =
            food.description || "";


        document.getElementById(
            "price"
        ).value =
            food.price;


        document.getElementById(
            "imageUrl"
        ).value =
            food.image_url || "";


        document.getElementById(
            "availability"
        ).value =
            food.availability;


        formTitle.textContent =
            "Edit Food";


        cancelButton.style.display =
            "inline-block";


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });


    } catch (error) {

        console.error(error);

        alert(
            "Unable to load food item."
        );
    }
}


// =====================================
// DELETE FOOD
// =====================================

async function deleteFood(foodId) {

    const confirmDelete =
        confirm(
            "Are you sure you want to delete this food item?"
        );


    if (!confirmDelete) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/${foodId}`,
                {

                    method: "DELETE",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`

                    }

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to delete food"
            );

        }


        alert(
            "✅ " + data.message
        );


        loadFoods();


    } catch (error) {

        console.error(error);

        alert(
            "❌ " + error.message
        );
    }
}


// =====================================
// TOGGLE AVAILABILITY
// =====================================

async function toggleAvailability(
    foodId,
    currentAvailability
) {

    try {

        const response =
            await fetch(
                `${API_URL}/${foodId}/availability`,
                {

                    method: "PUT",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body:
                        JSON.stringify({

                            availability:
                                currentAvailability == 0

                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to update availability"
            );

        }


        loadFoods();


    } catch (error) {

        console.error(error);

        alert(
            "❌ " + error.message
        );
    }
}


// =====================================
// RESET FORM
// =====================================

function resetForm() {

    foodForm.reset();


    document.getElementById(
        "foodId"
    ).value = "";


    formTitle.textContent =
        "Add New Food";


    cancelButton.style.display =
        "none";


    formMessage.textContent = "";
}


// =====================================
// INITIAL LOAD
// =====================================

loadCategories();
loadFoods();