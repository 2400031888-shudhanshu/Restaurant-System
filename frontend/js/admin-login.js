const adminLoginForm = document.getElementById("adminLoginForm");
const adminLoginMessage = document.getElementById("message");

adminLoginForm.addEventListener("submit", async event => {
    event.preventDefault();
    adminLoginMessage.textContent = "Signing in...";

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: document.getElementById("email").value.trim(),
                password: document.getElementById("password").value
            })
        });
        const data = await response.json();

        if (!response.ok) {
            adminLoginMessage.textContent = data.message || "Unable to sign in.";
            return;
        }

        if (!["ADMIN", "STAFF", "DELIVERY"].includes(data.user?.role)) {
            adminLoginMessage.textContent = "This account does not have staff access.";
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        window.location.href = "admin.html";
    } catch (error) {
        console.error(error);
        adminLoginMessage.textContent = "Unable to connect to the server.";
    }
});