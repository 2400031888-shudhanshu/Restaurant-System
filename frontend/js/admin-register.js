const adminRegisterForm = document.getElementById("adminRegisterForm");
const message = document.getElementById("message");
const token = localStorage.getItem("token");

if (!token) {
    window.location.replace("login.html");
} else {
    adminRegisterForm.addEventListener("submit", async event => {
        event.preventDefault();

        const account = {
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            password: document.getElementById("password").value
        };

        try {
            const response = await fetch("/api/admin/users", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(account)
            });
            const data = await response.json();

            if (!response.ok) {
                message.textContent = data.message || "Unable to create admin account.";
                return;
            }

            message.textContent = data.message;
            adminRegisterForm.reset();
        } catch (error) {
            console.error(error);
            message.textContent = "Unable to connect to the server.";
        }
    });
}