const staffForm = document.getElementById("staffForm");
const staffMessage = document.getElementById("staffMessage");
const staffList = document.getElementById("staffList");
const staffToken = localStorage.getItem("token");
const signedInUser = JSON.parse(localStorage.getItem("user") || "null");

if (!staffToken) {
    window.location.replace("admin-login.html");
} else if (signedInUser?.role !== "ADMIN") {
    staffForm.hidden = true;
    staffList.textContent = "Administrator access is required to manage staff.";
} else {
    loadStaff();
}

staffForm.addEventListener("submit", async event => {
    event.preventDefault();
    staffMessage.textContent = "Creating account...";

    const staff = {
        name: document.getElementById("staffName").value.trim(),
        email: document.getElementById("staffEmail").value.trim(),
        phone: document.getElementById("staffPhone").value.trim(),
        role: document.getElementById("staffRole").value,
        password: document.getElementById("staffPassword").value
    };

    try {
        const response = await fetch("/api/admin/staff", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${staffToken}`
            },
            body: JSON.stringify(staff)
        });
        const data = await response.json();

        if (!response.ok) {
            staffMessage.textContent = data.message || "Unable to create staff account.";
            return;
        }

        staffMessage.textContent = data.message;
        staffForm.reset();
        await loadStaff();
    } catch (error) {
        console.error(error);
        staffMessage.textContent = "Unable to connect to the server.";
    }
});

async function loadStaff() {
    try {
        const response = await fetch("/api/admin/staff", {
            headers: {
                "Authorization": `Bearer ${staffToken}`
            }
        });
        const staff = await response.json();

        if (!response.ok) {
            throw new Error(staff.message || "Unable to load staff.");
        }

        staffList.replaceChildren();
        if (staff.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 5;
            cell.textContent = "No active staff accounts.";
            row.appendChild(cell);
            staffList.appendChild(row);
            return;
        }

        staff.forEach(member => {
            const row = document.createElement("tr");
            [member.name, member.email, member.phone || "—", member.role === "DELIVERY" ? "Delivery" : "Staff"].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            const actions = document.createElement("td");
            const removeButton = document.createElement("button");
            removeButton.className = "staff-remove-button";
            removeButton.type = "button";
            removeButton.textContent = "Remove access";
            removeButton.addEventListener("click", () => removeStaff(member.user_id));
            actions.appendChild(removeButton);
            row.appendChild(actions);
            staffList.appendChild(row);
        });
    } catch (error) {
        console.error(error);
        staffList.textContent = error.message;
    }
}

async function removeStaff(userId) {
    if (!window.confirm("Remove this staff member's access? Their order history will be preserved.")) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/staff/${userId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${staffToken}`
            }
        });
        const data = await response.json();

        if (!response.ok) {
            staffMessage.textContent = data.message || "Unable to remove staff access.";
            return;
        }

        staffMessage.textContent = data.message;
        await loadStaff();
    } catch (error) {
        console.error(error);
        staffMessage.textContent = "Unable to connect to the server.";
    }
}