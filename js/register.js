// js/register.js
(() => {
  console.log("[register] loaded");

  // --- auth detection: tries common keys + your user-service if it exists ---
  function isLoggedIn() {
    try {
      if (window.userService && typeof userService.isLoggedIn === "function") {
        return !!userService.isLoggedIn();
      }
    } catch (_) {}

    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken");

    const userBlob = localStorage.getItem("user") || sessionStorage.getItem("user");
    return !!token || !!userBlob;
  }

  function apiBase() {
    return (
      (window.config && (config.apiBaseUrl || config.apiUrl || config.baseUrl)) ||
      window.API_BASE ||
      "http://localhost:8080"
    );
  }

  // --- find your login popup even if it's NOT bootstrap modal ---
  function findLoginPopup() {
    // look for a visible container that has a password input and a button that says login
    const pw = Array.from(document.querySelectorAll('input[type="password"]'))
      .find(el => el.offsetParent !== null); // visible

    if (!pw) return null;

    // look upward for a container that also has a LOGIN button
    let node = pw.closest("div");
    for (let i = 0; i < 8 && node; i++) {
      const btns = Array.from(node.querySelectorAll("button"));
      const hasLoginBtn = btns.some(b => (b.textContent || "").trim().toLowerCase() === "login");
      if (hasLoginBtn) return node;
      node = node.parentElement;
    }
    return null;
  }

  function injectIntoPopup(popup) {
    if (!popup) return;

    // If logged in: remove injected UI if it exists
    if (isLoggedIn()) {
      popup.querySelector("#openRegister")?.remove();
      popup.querySelector("#registerArea")?.remove();
      return;
    }

    // Find the LOGIN button in the popup
    const loginBtn = Array.from(popup.querySelectorAll("button"))
      .find(b => (b.textContent || "").trim().toLowerCase() === "login");
    if (!loginBtn) return;

    // 1) Add REGISTER button beside LOGIN (only once)
    if (!popup.querySelector("#openRegister")) {
      const regBtn = document.createElement("button");
      regBtn.id = "openRegister";
      regBtn.type = "button";
      regBtn.className = loginBtn.className || ""; // match styling if possible
      regBtn.textContent = "REGISTER";
      loginBtn.parentElement.insertBefore(regBtn, loginBtn);
    }

    // 2) Add register area at the BOTTOM of the popup (only once)
    if (!popup.querySelector("#registerArea")) {
      const wrap = document.createElement("div");
      wrap.id = "registerArea";
      wrap.style.display = "none";
      wrap.style.marginTop = "14px";

      wrap.innerHTML = `
        <hr/>
        <div style="font-weight:600; margin-bottom:8px;">Create account</div>

        <div style="margin-bottom:8px;">
          <input id="regUsername" class="form-control" placeholder="Username" type="text" autocomplete="username">
        </div>

        <div style="margin-bottom:8px;">
          <input id="regPassword" class="form-control" placeholder="Password" type="password" autocomplete="new-password">
        </div>

        <div style="margin-bottom:8px;">
          <input id="regConfirm" class="form-control" placeholder="Confirm password" type="password" autocomplete="new-password">
        </div>

        <div id="registerError" style="color:crimson; margin-top:8px;"></div>
        <div id="registerSuccess" style="color:green; margin-top:8px;"></div>

        <div style="margin-top:10px; display:flex; gap:8px;">
          <button id="submitRegister" type="button" class="btn btn-primary">Create account</button>
          <button id="cancelRegisterInside" type="button" class="btn btn-secondary">Cancel</button>
        </div>
      `;

      popup.appendChild(wrap);
    }
  }

  // --- click handlers (event delegation so it works with dynamic HTML) ---
  document.addEventListener("click", async (e) => {
    const t = e.target;

    if (t && t.id === "openRegister") {
      const popup = findLoginPopup();
      if (!popup || isLoggedIn()) return;
      popup.querySelector("#registerError").textContent = "";
      popup.querySelector("#registerSuccess").textContent = "";
      const area = popup.querySelector("#registerArea");
      area.style.display = (area.style.display === "none" || area.style.display === "") ? "block" : "none";
      return;
    }

    if (t && t.id === "cancelRegisterInside") {
      const popup = findLoginPopup();
      if (!popup) return;
      popup.querySelector("#registerError").textContent = "";
      popup.querySelector("#registerSuccess").textContent = "";
      popup.querySelector("#registerArea").style.display = "none";
      return;
    }

    if (t && t.id === "submitRegister") {
      const popup = findLoginPopup();
      if (!popup || isLoggedIn()) return;

      const base = apiBase();
      const username = (popup.querySelector("#regUsername").value || "").trim();
      const password = popup.querySelector("#regPassword").value || "";
      const confirmPassword = popup.querySelector("#regConfirm").value || "";

      const errEl = popup.querySelector("#registerError");
      const okEl = popup.querySelector("#registerSuccess");
      errEl.textContent = "";
      okEl.textContent = "";

      if (!username || !password || !confirmPassword) {
        errEl.textContent = "Please fill out all fields.";
        return;
      }
      if (password !== confirmPassword) {
        errEl.textContent = "Passwords do not match.";
        return;
      }

      try {
        await axios.post(`${base}/register`, {
          username,
          password,
          confirmPassword,
          role: "USER"
        });

        okEl.textContent = "Account created! Now log in.";
        popup.querySelector("#registerArea").style.display = "none";
      } catch (error) {
        const msg =
          error?.response?.data?.message ||
          (typeof error?.response?.data === "string" ? error.response.data : null) ||
          error?.message ||
          "Register failed.";
        errEl.textContent = msg;
      }
    }
  });

  // --- keep trying to inject whenever the login popup appears ---
  function tick() {
    const popup = findLoginPopup();
    if (popup) injectIntoPopup(popup);
  }

  document.addEventListener("DOMContentLoaded", tick);
  const obs = new MutationObserver(tick);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(tick, 500);
})();