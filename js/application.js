
function showLoginForm()
{
    templateBuilder.build('login-form', {}, 'login');
}

function hideModalForm()
{
    templateBuilder.clear('login');
}

function login()
{
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    userService.login(username, password);
    hideModalForm()
}

function showImageDetailForm(product, imageUrl)
{
    const imageDetail = {
        name: product,
        imageUrl: imageUrl
    };

    templateBuilder.build('image-detail',imageDetail,'login')
}

function loadHome()
{
    templateBuilder.build('home',{},'main')

    productService.search();
    categoryService.getAllCategories(loadCategories);
}

function editProfile()
{
    profileService.loadProfile();
}

function saveProfile()
{
    const firstName = document.getElementById("firstName").value;
    const lastName = document.getElementById("lastName").value;
    const phone = document.getElementById("phone").value;
    const email = document.getElementById("email").value;
    const address = document.getElementById("address").value;
    const city = document.getElementById("city").value;
    const state = document.getElementById("state").value;
    const zip = document.getElementById("zip").value;

    const profile = {
        firstName,
        lastName,
        phone,
        email,
        address,
        city,
        state,
        zip
    };

    profileService.updateProfile(profile);
}

function showCart()
{
    cartService.loadCartPage();
}

function clearCart()
{
    cartService.clearCart();
    cartService.loadCartPage();
}

function setCategory(control)
{
    productService.addCategoryFilter(control.value);
    productService.search();

}

function setSubcategory(control)
{
    productService.addSubcategoryFilter(control.value);
    productService.search();

}
let priceTimer;
function debouncedSearch() {
    clearTimeout(priceTimer);
    priceTimer = setTimeout(() => productService.search(), 200);
}

function setMinPrice(control)
{
    // CHANGED: live label update
    const minLabel = document.getElementById("min-price-display");
    minLabel.innerText = control.value;

    // CHANGED: prevent min > max
    const maxSlider = document.getElementById("max-price");
    const maxLabel = document.getElementById("max-price-display");

    const minVal = Number(control.value);
    let maxVal = Number(maxSlider.value);

    if (minVal > maxVal) {
        maxVal = minVal;
        maxSlider.value = String(maxVal);
        maxLabel.innerText = String(maxVal);
    }
    // CHANGED: default checks now use 500 (not 200)
        const minFilter = (minVal !== 0) ? String(minVal) : "";
        const maxFilter = (maxVal !== 3000) ? String(maxVal) : "";

        productService.addMinPriceFilter(minFilter);
        productService.addMaxPriceFilter(maxFilter);

        // CHANGED: debounced search (better with oninput)
        debouncedSearch();
    }

function setMaxPrice(control)
{
    // CHANGED: prevent max < min
        const minSlider = document.getElementById("min-price");
        const minVal = Number(minSlider.value);

        let maxVal = Number(control.value);
        if (maxVal < minVal) {
            maxVal = minVal;
            control.value = String(maxVal);
        }

        // CHANGED: live label update
        const maxLabel = document.getElementById("max-price-display");
        maxLabel.innerText = String(maxVal);

        // CHANGED: default checks now use 500 (not 200)
        const minFilter = (minVal !== 0) ? String(minVal) : "";
        const maxFilter = (maxVal !== 3000) ? String(maxVal) : "";

        productService.addMinPriceFilter(minFilter);
        productService.addMaxPriceFilter(maxFilter);

        // CHANGED: debounced search (better with oninput)
        debouncedSearch();

}

function closeError(control)
{
    setTimeout(() => {
        control.click();
    },3000);
}

document.addEventListener('DOMContentLoaded', () => {

    loadHome();
});
