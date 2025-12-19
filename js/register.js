// js/register.js

function showRegisterForm() {
  // Render the register modal in the same "login" container used by showLoginForm()
  templateBuilder.build("register-form", {}, "login");
}

function registerAccount() {
  const msg = document.getElementById("reg-msg");
  if (msg) {
    msg.style.color = "crimson";
    msg.textContent = "";
  }

  const username = (document.getElementById("reg-username")?.value || "").trim();
  const password = document.getElementById("reg-password")?.value || "";
  const confirm = document.getElementById("reg-confirm")?.value || "";

  if (!username || !password || !confirm) {
    if (msg) msg.textContent = "Please fill out all fields.";
    return;
  }

  if (password !== confirm) {
    if (msg) msg.textContent = "Passwords do not match.";
    return;
  }

  const payload = {
    username: username,
    password: password,
    confirmPassword: confirm,
    role: "USER",
  };

  if (msg) {
    msg.style.color = "#333";
    msg.textContent = "Creating account...";
  }

  axios
    .post(`${config.baseUrl}/register`, payload)
    .then(() => {
      if (msg) {
        msg.style.color = "green";
        msg.textContent = "Account created! Please login.";
      }

      // Prefill username on login screen
      setTimeout(() => {
        showLoginForm();
        setTimeout(() => {
          const u = document.getElementById("username");
          if (u) u.value = username;
        }, 50);
      }, 700);
    })
    .catch((err) => {
      const apiMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Registration failed.";
      if (msg) {
        msg.style.color = "crimson";
        msg.textContent = apiMsg;
      }
    });
}