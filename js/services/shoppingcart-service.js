let cartService;

class ShoppingCartService {
  cart = { items: [], total: 0 };

  // ---------- Helpers ----------
  _toInt(val, fallback = 0) {
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  _toNumber(val, fallback = 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  _maxAllowed(stock) {
    const s = this._toInt(stock, 0);
    return Math.max(0, Math.min(3, s)); // max 3 AND cannot exceed stock
  }

  _findItem(productId) {
    return this.cart.items.find((i) => i?.product?.productId === productId);
  }

  _toast(msg) {
    const t = document.getElementById("cart-toast");
    if (!t) return;
    t.innerText = msg;
    t.style.display = "block";
    setTimeout(() => (t.style.display = "none"), 1600);
  }

  _flashMessage(msg) {
    templateBuilder.append("message", { message: msg }, "errors");
    setTimeout(() => {
      const e = document.getElementById("errors");
      if (e) e.innerHTML = "";
    }, 1800);
  }

  _flashError(msg) {
    templateBuilder.append("error", { error: msg }, "errors");
  }

  // ---------- Cart I/O ----------
  setCart(data) {
    this.cart = { items: [], total: 0 };
    if (!data || !data.items) return;

    this.cart.total = data.total ?? 0;

    for (const [, value] of Object.entries(data.items)) {
      this.cart.items.push(value);
    }
  }

  loadCart() {
    if (!userService.isLoggedIn()) {
      this.cart = { items: [], total: 0 };
      this.updateCartDisplay();
      return Promise.resolve(this.cart);
    }

    const url = `${config.baseUrl}/cart`;

    return axios
      .get(url)
      .then((response) => {
        if (response.status === 204 || !response.data) {
          this.cart = { items: [], total: 0 };
        } else {
          this.setCart(response.data);
        }
        this.updateCartDisplay();
        return this.cart;
      })
      .catch(() => {
        this._flashError("Load cart failed.");
        return this.cart;
      });
  }

  // ---------- Actions ----------
  addToCart(productId, quantity = 1, stock = 999999) {
    if (!userService.isLoggedIn()) {
      this._flashError("Please log in to add items to your cart.");
      return;
    }

    const pid = this._toInt(productId);
    const requested = Math.max(1, this._toInt(quantity, 1));
    const maxAllowed = this._maxAllowed(stock);

    if (maxAllowed === 0) {
      this._flashError("This item is out of stock.");
      return;
    }

    const url = `${config.baseUrl}/cart/products/${pid}`;

    this.loadCart()
      .then(() => {
        const existingItem = this._findItem(pid);
        const existingQty = existingItem ? this._toInt(existingItem.quantity, 0) : 0;
        const targetQty = Math.min(existingQty + requested, maxAllowed);

        if (targetQty === existingQty) {
          this._flashMessage(
            `Only ${maxAllowed} available per customer (limited by stock and max 3).`
          );
          return;
        }

        if (!existingItem) {
          return axios.post(url, {}).then(() => {
            if (targetQty > 1) {
              return axios.put(url, { quantity: targetQty });
            }
          });
        }

        return axios.put(url, { quantity: targetQty });
      })
      .then(() => this.loadCart())
      .then(() => {
        this.updateCartDisplay();
        try {
          this.loadCartPage();
        } catch (e) {}
        this._toast("Added to cart! (Limit: 3 per customer)");
      })
      .catch(() => {
        this._flashError("Add to cart failed.");
      });
  }

  updateQuantity(productId, quantity, stock = 999999) {
    if (!userService.isLoggedIn()) {
      this._flashError("Please log in to update your cart.");
      return;
    }

    const pid = this._toInt(productId);
    const requested = Math.max(1, this._toInt(quantity, 1));
    const maxAllowed = this._maxAllowed(stock);

    if (maxAllowed === 0) {
      this._flashError("This item is out of stock.");
      return;
    }

    const clamped = Math.min(requested, maxAllowed);
    const url = `${config.baseUrl}/cart/products/${pid}`;

    axios
      .put(url, { quantity: clamped })
      .then(() => this.loadCart())
      .then(() => {
        this.updateCartDisplay();
        this.loadCartPage();

        if (requested !== clamped) {
          this._flashMessage(
            `Quantity adjusted to ${clamped}. (Limit: 3 per customer and cannot exceed stock)`
          );
        } else {
          this._toast("Cart updated! (Limit: 3 per customer)");
        }
      })
      .catch((error) => {
        const msg =
          error?.response?.status === 404
            ? "That item isn't in your cart yet."
            : "Update quantity failed.";
        this._flashError(msg);
      });
  }

  clearCart() {
    if (!userService.isLoggedIn()) {
      this._flashError("Please log in to clear your cart.");
      return;
    }

    const url = `${config.baseUrl}/cart`;

    axios
      .delete(url)
      .then(() => this.loadCart())
      .then(() => {
        this.updateCartDisplay();
        const errors = document.getElementById("errors");
        if (errors) errors.innerHTML = "";

        templateBuilder.append("message", { message: "Cleared cart." }, "errors");
        setTimeout(() => {
          const e = document.getElementById("errors");
          if (e) e.innerHTML = "";
        }, 2000);

        this.loadCartPage();
      })
      .catch(() => {
        this._flashError("Empty cart failed.");
      });
  }

  // ---------- CHECKOUT / ORDER ----------
  placeOrder() {
    if (!userService.isLoggedIn()) {
      this._flashError("Please log in to place an order.");
      return;
    }

    if (!this.cart.items || this.cart.items.length === 0) {
      this._flashError("Your cart is empty.");
      return;
    }

    const cartSnapshot = JSON.parse(JSON.stringify(this.cart));

    axios
      .get(`${config.baseUrl}/profile`)
      .then((res) => res.data)
      .then((profile) => {
        const missing =
          !profile?.email ||
          !profile?.phone ||
          !profile?.address ||
          !profile?.city ||
          !profile?.state ||
          !profile?.zip;

        if (missing) {
          this._flashError(
            "Please complete your Profile (email, phone, address, city, state, zip) before checkout."
          );
          throw new Error("MISSING_PROFILE_FIELDS");
        }

        return axios
          .post(`${config.baseUrl}/orders`, {})
          .then((orderRes) => ({ order: orderRes.data, profile }));
      })
      .then(({ order, profile }) => {
        this._showOrderConfirmation(order, profile, cartSnapshot);
        return this.loadCart().then(() => this.updateCartDisplay());
      })
      .catch((err) => {
        if (err?.message === "MISSING_PROFILE_FIELDS") return;

        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Checkout failed. (Make sure POST /orders works in your backend.)";
        this._flashError(msg);
      });
  }

  // ✅ FULL PAGE CONFIRMATION (updated)
  _showOrderConfirmation(order, profile, cartSnapshot) {
    const main = document.getElementById("main");
    if (!main) return;

    // Make main full width (removes boxed layout behavior)
    main.innerHTML = "";
    main.style.padding = "0";
    main.style.margin = "0";

    const orderId = order?.orderId ?? order?.id ?? order?.order_id ?? "(unknown)";

    const shipName =
      `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() ||
      userService.getUserName();

    const shipAddress = profile?.address ?? "";
    const shipCity = profile?.city ?? "";
    const shipState = profile?.state ?? "";
    const shipZip = profile?.zip ?? "";

    const emailDisplay = profile?.email ?? "(no email)";
    const phoneDisplay = profile?.phone ?? "(no phone)";

    // Use backend lineItems if present; else use cart snapshot
    let items = [];
    if (Array.isArray(order?.lineItems) && order.lineItems.length > 0) {
      items = order.lineItems.map((li) => {
        const name = li.product?.name ?? `Product ${li.productId}`;
        const qty = this._toInt(li.quantity, 0);
        const unit = this._toNumber(li.salesPrice ?? li.price ?? 0, 0);
        return { name, qty, unit, lineTotal: unit * qty };
      });
    } else {
      items = (cartSnapshot?.items ?? []).map((ci) => {
        const name = ci.product?.name ?? "Item";
        const qty = this._toInt(ci.quantity, 0);
        const unit = this._toNumber(ci.product?.price, 0);
        return { name, qty, unit, lineTotal: unit * qty };
      });
    }

    const subtotalNum = items.reduce((sum, x) => sum + (x.lineTotal || 0), 0);
    const shippingNum = this._toNumber(order?.shippingAmount, 0);

    const totalNum =
      Number.isFinite(this._toNumber(order?.orderTotal, NaN))
        ? this._toNumber(order?.orderTotal, subtotalNum + shippingNum)
        : this._toNumber(cartSnapshot?.total, subtotalNum + shippingNum);

    const itemsRows = items
      .map(
        (x) => `
        <tr>
          <td>${x.name}</td>
          <td class="text-end">$${x.unit.toFixed(2)}</td>
          <td class="text-end">${x.qty}</td>
          <td class="text-end">$${x.lineTotal.toFixed(2)}</td>
        </tr>
      `
      )
      .join("");

    // Full-width container (no max width, no rounded box)
    const wrap = document.createElement("div");
    wrap.className = "content-form";
    wrap.style.width = "100%";
    wrap.style.maxWidth = "none";
    wrap.style.margin = "0";
    wrap.style.borderRadius = "0";
    wrap.style.padding = "32px";
    wrap.style.minHeight = "calc(100vh - 70px)"; // adjust if your header height differs
    wrap.style.boxSizing = "border-box";

    wrap.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <h1 style="margin:0;">Order Confirmed</h1>
        <span style="font-size:28px;">✅</span>
      </div>

      <div style="margin-top:10px;">
        <div style="font-weight:700;">Order # ${orderId}</div>
        <div style="margin-top:6px;">
          We emailed your receipt to <strong>${emailDisplay}</strong> and texted updates to <strong>${phoneDisplay}</strong>.
        </div>
      </div>

      <div style="display:flex; gap: 40px; flex-wrap: wrap; margin-top: 28px;">
        <div style="flex: 1; min-width: 320px;">
          <h3 style="margin-bottom:10px;">Shipping To</h3>
          <div style="font-weight:700;">${shipName}</div>
          <div>${shipAddress}</div>
          <div>${shipCity}, ${shipState} ${shipZip}</div>
        </div>

        <div style="flex: 1; min-width: 320px;">
          <h3 style="margin-bottom:10px;">Order Summary</h3>

          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Subtotal</span><span>$${subtotalNum.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <span>Shipping</span><span>$${shippingNum.toFixed(2)}</span>
          </div>
          <hr />
          <div style="display:flex; justify-content:space-between; font-size: 1.2em; margin-top:10px;">
            <strong>Total</strong><strong>$${totalNum.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <h3 style="margin-top: 34px;">Items</h3>
      <table class="table table-striped" style="width:100%;">
        <thead>
          <tr>
            <th>Item</th>
            <th class="text-end">Unit</th>
            <th class="text-end">Qty</th>
            <th class="text-end">Line Total</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <div style="margin-top: 22px;">
        <button id="continue-shopping" class="btn btn-primary">CONTINUE SHOPPING</button>
      </div>
    `;

    main.appendChild(wrap);

    const btn = document.getElementById("continue-shopping");
    if (btn) btn.addEventListener("click", () => loadHome());
  }

  // ---------- UI ----------
  updateCartDisplay() {
    try {
      const itemCount = this.cart.items.length;
      const cartControl = document.getElementById("cart-items");
      if (cartControl) cartControl.innerText = itemCount;
    } catch (e) {}
  }

  loadCartPage() {
    const main = document.getElementById("main");
    if (!main) return;

    main.innerHTML = "";

    const filterSpacer = document.createElement("div");
    filterSpacer.classList = "filter-box";
    main.appendChild(filterSpacer);

    const contentDiv = document.createElement("div");
    contentDiv.id = "content";
    contentDiv.classList.add("content-form");

    const cartHeader = document.createElement("div");
    cartHeader.classList.add("cart-header");

    const h1 = document.createElement("h1");
    h1.innerText = "Cart";
    cartHeader.appendChild(h1);

    const totalEl = document.createElement("div");
    totalEl.style.marginLeft = "auto";
    totalEl.style.fontWeight = "600";
    totalEl.innerText = `Total: $${this._toNumber(this.cart.total, 0).toFixed(2)}`;
    cartHeader.appendChild(totalEl);

    const placeOrderBtn = document.createElement("button");
    placeOrderBtn.classList.add("btn", "btn-success");
    placeOrderBtn.style.marginLeft = "8px";
    placeOrderBtn.innerText = "Place Order";
    placeOrderBtn.addEventListener("click", () => this.placeOrder());
    cartHeader.appendChild(placeOrderBtn);

    const clearBtn = document.createElement("button");
    clearBtn.classList.add("btn", "btn-danger");
    clearBtn.innerText = "Clear";
    clearBtn.addEventListener("click", () => this.clearCart());
    cartHeader.appendChild(clearBtn);

    contentDiv.appendChild(cartHeader);
    main.appendChild(contentDiv);

    if (this.cart.items.length === 0) {
      const empty = document.createElement("div");
      empty.style.marginTop = "12px";
      empty.innerText = "Your cart is empty.";
      contentDiv.appendChild(empty);
      return;
    }

    this.cart.items.forEach((item) => this.buildItem(item, contentDiv));
  }

  buildItem(item, parent) {
    const outerDiv = document.createElement("div");
    outerDiv.classList.add("cart-item");

    const titleDiv = document.createElement("div");
    outerDiv.appendChild(titleDiv);

    const h4 = document.createElement("h4");
    h4.innerText = item.product.name;
    titleDiv.appendChild(h4);

    const photoDiv = document.createElement("div");
    photoDiv.classList.add("photo");

    const img = document.createElement("img");
    img.src = `/images/products/${item.product.imageUrl}`;
    img.addEventListener("click", () => showImageDetailForm(item.product.name, img.src));
    photoDiv.appendChild(img);

    outerDiv.appendChild(photoDiv);

    const descriptionDiv = document.createElement("div");
    descriptionDiv.innerText = item.product.description;
    outerDiv.appendChild(descriptionDiv);

    const stockInfo = document.createElement("small");
    stockInfo.innerText = `In stock: ${item.product.stock}`;
    outerDiv.appendChild(stockInfo);

    const unitPrice = this._toNumber(item.product.price, 0);
    const qty = this._toInt(item.quantity, 0);

    const computedLineTotal = unitPrice * qty;
    const lineTotal =
      item.lineTotal != null ? this._toNumber(item.lineTotal, computedLineTotal) : computedLineTotal;

    const priceBox = document.createElement("div");
    priceBox.style.marginTop = "8px";
    priceBox.innerHTML = `
      <div><strong>Unit:</strong> $${unitPrice.toFixed(2)}</div>
      <div><strong>Qty:</strong> ${qty}</div>
      <div><strong>Line Total:</strong> $${lineTotal.toFixed(2)}</div>
    `;
    outerDiv.appendChild(priceBox);

    const qtyRow = document.createElement("div");
    qtyRow.style.display = "flex";
    qtyRow.style.alignItems = "center";
    qtyRow.style.gap = "8px";
    qtyRow.style.marginTop = "10px";

    const qtyLabel = document.createElement("span");
    qtyLabel.innerText = "Update Qty:";
    qtyRow.appendChild(qtyLabel);

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "1";

    const maxAllowed = this._maxAllowed(item.product.stock);
    qtyInput.max = String(Math.max(1, maxAllowed));
    qtyInput.value = String(Math.min(qty, Math.max(1, maxAllowed)));
    qtyInput.style.width = "70px";
    qtyRow.appendChild(qtyInput);

    const saveBtn = document.createElement("button");
    saveBtn.classList.add("btn", "btn-success");
    saveBtn.innerText = "Update";
    saveBtn.addEventListener("click", () => {
      this.updateQuantity(item.product.productId, qtyInput.value, item.product.stock);
    });
    qtyRow.appendChild(saveBtn);

    outerDiv.appendChild(qtyRow);
    parent.appendChild(outerDiv);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cartService = new ShoppingCartService();
  if (userService.isLoggedIn()) cartService.loadCart();
});