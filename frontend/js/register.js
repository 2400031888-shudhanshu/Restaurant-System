const registerForm = document.getElementById("registerForm");

registerForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const phone = document.getElementById("phone").value;
    const password = document.getElementById("password").value;

    const message = document.getElementById("message");

    try {

        const response = await fetch("/api/auth/register", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name: name,
                email: email,
                phone: phone,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {

            message.textContent = "❌ " + data.message;

            return;
        }

        message.textContent = "✅ Registration successful!";

        registerForm.reset();

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1500);

    } catch (error) {

        console.error(error);

        message.textContent =
            "❌ Unable to connect to server.";
    }

});