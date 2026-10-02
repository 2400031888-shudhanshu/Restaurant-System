const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const message = document.getElementById("message");

    try {

        const response = await fetch("/api/auth/login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {

            message.textContent = "❌ " + data.message;

            return;
        }

        // Save login information
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        message.textContent = "✅ Login successful!";

        setTimeout(() => {

            window.location.href = "index.html";

        }, 1000);

    } catch (error) {

        console.error(error);

        message.textContent =
            "❌ Unable to connect to server.";
    }

});