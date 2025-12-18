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
    return this.cart.items.find(i => i?.product?.productId === productId);
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
        templateBuilder.append("error", { error: "Load cart failed." }, "errors");
        return this.cart;
      });
  }

  // ---------- Actions ----------
  addToCart(productId, quantity = 1, stock = 999999) {
    if (!userService.isLoggedIn()) {
      templateBuilder.append("error", { error: "Please log in to add items to your cart." }, "errors");
      return;
    }

    const pid = this._toInt(productId);
    const requested = Math.max(1, this._toInt(quantity, 1));
    const maxAllowed = this._maxAllowed(stock);

    if (maxAllowed === 0) {
      templateBuilder.append("error", { error: "This item is out of stock." }, "errors");
      return;
    }

    const url = `${config.baseUrl}/cart/products/${pid}`;

    // Refresh cart first so we can add (existing + requested) safely
    this.loadCart()
      .then(() => {
        const existingItem = this._findItem(pid);
        const existingQty = existingItem ? this._toInt(existingItem.quantity, 0) : 0;

        // target quantity = existing + requested, capped by maxAllowed
        const targetQty = Math.min(existingQty + requested, maxAllowed);

        if (targetQty === existingQty) {
          this._flashMessage(`Only ${maxAllowed} available per customer (limited by stock and max 3).`);
          return;
        }

        // If not yet in cart: POST once (creates row at qty=1), then PUT to set target
        if (!existingItem) {
          return axios.post(url, {}).then(() => {
            if (targetQty > 1) {
              return axios.put(url, { quantity: targetQty });
            }
          });
        }

        // Already in cart: PUT to the new quantity
        return axios.put(url, { quantity: targetQty });
      })
      .then(() => this.loadCart())
      .then(() => {
        this.updateCartDisplay();
        try { this.loadCartPage(); } catch (e) {}

        // Always remind of the cap (your request)
        this._toast("Added to cart! (Limit: 3 per customer)");
      })
      .catch(() => {
        templateBuilder.append("error", { error: "Add to cart failed." }, "errors");
      });
  }

  updateQuantity(productId, quantity, stock = 999999) {
    if (!userService.isLoggedIn()) {
      templateBuilder.append("error", { error: "Please log in to update your cart." }, "errors");
      return;
    }

    const pid = this._toInt(productId);
    const requested = Math.max(1, this._toInt(quantity, 1));
    const maxAllowed = this._maxAllowed(stock);

    if (maxAllowed === 0) {
      templateBuilder.append("error", { error: "This item is out of stock." }, "errors");
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
          this._flashMessage(`Quantity adjusted to ${clamped}. (Limit: 3 per customer and cannot exceed stock)`);
        } else {
          this._toast("Cart updated! (Limit: 3 per customer)");
        }
      })
      .catch((error) => {
        const msg =
          error?.response?.status === 404
            ? "That item isn't in your cart yet."
            : "Update quantity failed.";
        templateBuilder.append("error", { error: msg }, "errors");
      });
  }

  clearCart() {
    if (!userService.isLoggedIn()) {
      templateBuilder.append("error", { error: "Please log in to clear your cart." }, "errors");
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
        templateBuilder.append("error", { error: "Empty cart failed." }, "errors");
      });
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

    // Total (updates whenever loadCartPage runs)
    const totalEl = document.createElement("div");
    totalEl.style.marginLeft = "auto";
    totalEl.style.fontWeight = "600";
    totalEl.innerText = `Total: $${this._toNumber(this.cart.total, 0).toFixed(2)}`;
    cartHeader.appendChild(totalEl);

    const button = document.createElement("button");
    button.classList.add("btn", "btn-danger");
    button.innerText = "Clear";
    button.addEventListener("click", () => this.clearCart());
    cartHeader.appendChild(button);

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

    // ---- Price block (Unit + Qty + Line Total) ----
    const unitPrice = this._toNumber(item.product.price, 0);
    const qty = this._toInt(item.quantity, 0);

    // Prefer backend-provided lineTotal if present, else compute
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

    // ---- Quantity controls (respect max 3 + stock) ----
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