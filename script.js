// --- Vijay Cafe - Main Script ---

const SUPABASE_URL = "https://wlmhpwamorpbyjtnfcfl.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsbWhwd2Ftb3JwYnlqdG5mY2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NjQzOTAsImV4cCI6MjA4ODQ0MDM5MH0.zNNXs29mO00h-cvhceoAXbzZLwlNU5jL8oQSUQTEqAA";

let supabaseClient;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log("Supabase client initialized");
} catch (e) {
  console.error("Failed to load Supabase:", e);
}

let globalSettings = { cgst: 0, sgst: 0, offer_items: [], is_offline: false };
let settingsSubscription = null;
let menuSubscription = null;
let allMenuItems = [];
let cart = [];
let promosData = [];
let appliedPromo = null;

// Auth State
let currentUser = null;

// Add this function to fetch settings
async function fetchSettings() {
  try {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
      .from('settings')
      .select('*')
      .eq('id', 'site_config')
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (data) {
      globalSettings = data.value || { cgst: 0, sgst: 0, is_offline: false };
      if (typeof updateCartUI === 'function') {
        updateCartUI();
      }
      if (typeof updateTaxLabels === 'function') {
        updateTaxLabels();
      }
      if (typeof updateOfflineStatusUI === 'function') {
        updateOfflineStatusUI();
      }
      console.log('Settings updated:', globalSettings);
    }
  } catch (err) {
    console.error("Error fetching settings:", err);
  }
}

function updateTaxLabels() {
  const cgstLabel = document.getElementById('cgst-label');
  const sgstLabel = document.getElementById('sgst-label');

  if (cgstLabel) {
    cgstLabel.textContent = `CGST (${globalSettings.cgst || 0}%)`;
  }
  if (sgstLabel) {
    sgstLabel.textContent = `SGST (${globalSettings.sgst || 0}%)`;
  }
}

function setupRealtimeMenu() {
  if (!supabaseClient) return;

  if (menuSubscription) {
    supabaseClient.removeChannel(menuSubscription);
  }

  menuSubscription = supabaseClient
    .channel('menu-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'menu_items'
      },
      (payload) => {
        console.log('Menu updated in real-time:', payload);
        if (typeof showToast === 'function') {
          showToast('Menu updated! Refreshing page...', 'info');
        }
        setTimeout(() => window.location.reload(), 2000);

        if (payload.eventType === 'INSERT') {
          allMenuItems.push(payload.new);
          if (typeof showToast === 'function') {
            showToast(`New item "${payload.new.name}" added to menu!`);
          }
        }
        else if (payload.eventType === 'UPDATE') {
          const index = allMenuItems.findIndex(item => item.id === payload.new.id);
          if (index !== -1) {
            const wasAvailable = allMenuItems[index].is_available;
            const isNowAvailable = payload.new.is_available;

            allMenuItems[index] = payload.new;

            if (typeof showToast === 'function') {
              if (wasAvailable !== isNowAvailable) {
                if (isNowAvailable) {
                  showToast(`"${payload.new.name}" is now available!`);
                } else {
                  showToast(`"${payload.new.name}" is now out of stock`);
                }
              } else {
                showToast(`Menu item "${payload.new.name}" updated!`);
              }
            }

            validateCartAgainstMenu();
          }
        }
        else if (payload.eventType === 'DELETE') {
          allMenuItems = allMenuItems.filter(item => item.id !== payload.old.id);
          if (typeof showToast === 'function') {
            showToast('Menu item removed');
          }
          validateCartAgainstMenu();
        }

        // Only render menu cards if we're on a page with menu grid
        const menuGrid = document.getElementById('menu-grid');
        if (menuGrid) {
          renderMenuCards();
        }

        if (typeof filterMenu === 'function') {
          filterMenu();
        }

        updateCartUI();
      }
    )
    .subscribe();
}

let offersSubscription = null;

function setupRealtimeOffers() {
  if (!supabaseClient) return;

  if (offersSubscription) {
    supabaseClient.removeChannel(offersSubscription);
  }

  offersSubscription = supabaseClient
    .channel('offers-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'offers'
      },
      (payload) => {
        console.log('Offers updated in real-time:', payload);
        if (typeof showToast === 'function') {
          showToast('Offers updated! Refreshing page...', 'info');
        }
        setTimeout(() => window.location.reload(), 2000);
      }
    )
    .subscribe();
}

function setupRealtimeSettings() {
  if (!supabaseClient) return;

  if (settingsSubscription) {
    supabaseClient.removeChannel(settingsSubscription);
  }

  settingsSubscription = supabaseClient
    .channel('settings-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'settings',
        filter: 'id=eq.site_config'
      },
      (payload) => {
        console.log('Settings updated in real-time:', payload);
        if (payload.new && payload.new.value) {
          globalSettings = payload.new.value;
          if (typeof updateCartUI === 'function') {
            updateCartUI();
          }
          if (typeof updateTaxLabels === 'function') {
            updateTaxLabels();
          }
          if (typeof updateOfflineStatusUI === 'function') {
            updateOfflineStatusUI();
          }
        }
      }
    )
    .subscribe();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Load cart from localStorage first
    try {
      const savedCart = localStorage.getItem("cart");
      if (savedCart) cart = JSON.parse(savedCart);
    } catch (e) {
      console.error("Could not parse cart from localStorage", e);
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'site_update') {
        if (typeof showToast === 'function') showToast('Site updated! Refreshing page...', 'info');
        setTimeout(() => window.location.reload(), 2000);
      }
    });

    if (supabaseClient) {
      supabaseClient.channel('system-updates')
        .on('broadcast', { event: 'site_update' }, (payload) => {
          console.log('Site update received:', payload);

          // If the broadcast contains settings, update globally and UI without reload
          if (payload.payload && payload.payload.settings) {
            globalSettings = payload.payload.settings;
            updateOfflineStatusUI();
            if (typeof updateTaxLabels === 'function') updateTaxLabels();
            if (typeof updateCartUI === 'function') updateCartUI();
            return; // Skip reload
          }

          if (typeof showToast === 'function') showToast('Site updated! Refreshing page...', 'info');
          setTimeout(() => window.location.reload(), 2000);
        })
        .subscribe();

      // Start settings sync
      setupRealtimeSettings();
      fetchSettings();
    }

    // Get DOM elements - check if they exist first
    const mobileToggle = document.querySelector(".mobile-toggle");
    const navLinks = document.querySelector(".nav-links");
    const navItems = document.querySelectorAll(".nav-links a");
    const header = document.querySelector(".header");
    const sections = document.querySelectorAll("section");
    const themeToggle = document.getElementById("theme-toggle");
    const htmlElement = document.documentElement;
    const themeIcon = themeToggle ? themeToggle.querySelector("i") : null;

    // Menu page specific elements
    const filterBtns = document.querySelectorAll(".menu-filters .filter-btn");
    const dietToggleBtns = document.querySelectorAll(".diet-toggle-btn");
    const vegSwitch = document.getElementById("veg-toggle-switch");
    const nonVegSwitch = document.getElementById("non-veg-toggle-switch");
    const searchInput = document.getElementById("menu-search-input");
    const menuGrid = document.getElementById("menu-grid");
    const noResultsMsg = document.getElementById("no-results-msg");

    // Cart elements
    const cartToggleBtn = document.getElementById("cart-toggle");
    const closeCartBtn = document.getElementById("close-cart");
    const cartSidebar = document.getElementById("cart-sidebar");
    const cartOverlay = document.getElementById("cart-overlay");
    const cartItemsContainer = document.getElementById("cart-items");
    const cartCountDisplay = document.querySelector(".cart-count");
    const cartTotalPriceDisplay = document.getElementById("cart-total-price");

    // Checkout elements
    const checkoutModal = document.getElementById("checkout-modal");
    const closeCheckoutModal = document.getElementById("close-checkout-modal");
    const checkoutForm = document.getElementById("checkout-form");
    const checkoutBtn = document.getElementById("checkout-btn");
    const placeOrderBtn = document.getElementById("place-order-btn");

    // Offers elements (only on menu page)
    const claimOfferBtn = document.querySelector(".offers-banner .btn");

    // --- 1. Mobile Navigation Toggle ---
    if (mobileToggle && navLinks) {
      mobileToggle.addEventListener("click", () => {
        navLinks.classList.toggle("active");
        const icon = mobileToggle.querySelector("i");
        if (navLinks.classList.contains("active")) {
          icon.classList.remove("fa-bars");
          icon.classList.add("fa-xmark");
        } else {
          icon.classList.remove("fa-xmark");
          icon.classList.add("fa-bars");
        }
      });
    }

    // Close mobile menu on link click
    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        if (navLinks && navLinks.classList.contains("active")) {
          navLinks.classList.remove("active");
          const icon = mobileToggle.querySelector("i");
          icon.classList.remove("fa-xmark");
          icon.classList.add("fa-bars");
        }
      });
    });

    // --- 2. Navbar Scroll Effect & Active State & Back To Top ---
    const backToTopBtn = document.getElementById("back-to-top");
    if (backToTopBtn) {
      backToTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    if (header) {
      window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
          header.classList.add("nav-scrolled");
        } else {
          header.classList.remove("nav-scrolled");
        }

        if (backToTopBtn) {
          if (window.scrollY > 300) {
            backToTopBtn.classList.add("visible");
          } else {
            backToTopBtn.classList.remove("visible");
          }
        }

        let current = "";
        sections.forEach((section) => {
          const sectionTop = section.offsetTop;
          if (scrollY >= sectionTop - 200) {
            current = section.getAttribute("id");
          }
        });

        navItems.forEach((a) => {
          a.classList.remove("active");
          if (a.getAttribute("href").includes(current) && current !== "") {
            a.classList.add("active");
          }
        });
      });
    }

    // --- 3. Dark Mode Toggle ---
    if (themeToggle && themeIcon) {
      let savedTheme = null;
      try {
        savedTheme = localStorage.getItem("theme");
      } catch (err) { }

      if (savedTheme === "dark") {
        htmlElement.setAttribute("data-theme", "dark");
        themeIcon.classList.remove("fa-moon");
        themeIcon.classList.add("fa-sun");
      }

      themeToggle.addEventListener("click", () => {
        if (htmlElement.getAttribute("data-theme") === "light") {
          htmlElement.setAttribute("data-theme", "dark");
          try {
            localStorage.setItem("theme", "dark");
          } catch (err) { }
          themeIcon.classList.remove("fa-moon");
          themeIcon.classList.add("fa-sun");
        } else {
          htmlElement.setAttribute("data-theme", "light");
          try {
            localStorage.setItem("theme", "light");
          } catch (err) { }
          themeIcon.classList.remove("fa-sun");
          themeIcon.classList.add("fa-moon");
        }
      });
    }

    // --- 4. Initialize AOS ---
    if (typeof AOS !== "undefined") {
      AOS.init({
        duration: 1000,
        easing: "ease-out-cubic",
        once: false,
        mirror: true,
        offset: 50,
      });
    }

    // --- 5. Initialize Swiper for Reviews ---
    if (typeof Swiper !== "undefined" && document.querySelector(".review-swiper")) {
      const reviewSwiper = new Swiper(".review-swiper", {
        slidesPerView: 1,
        spaceBetween: 30,
        loop: true,
        loopedSlides: 5,
        observer: true,
        observeParents: true,
        autoplay: {
          delay: 4000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        },
        pagination: {
          el: ".swiper-pagination",
          clickable: true,
        },
        breakpoints: {
          768: { slidesPerView: 2 },
          1024: { slidesPerView: 3 },
        },
      });

      // Manual Navigation Handlers for Unique Buttons
      const btnNext = document.getElementById('review-next-unique');
      const btnPrev = document.getElementById('review-prev-unique');

      if (btnNext) {
        btnNext.addEventListener('click', () => {
          reviewSwiper.slideNext();
        });
      }

      if (btnPrev) {
        btnPrev.addEventListener('click', () => {
          reviewSwiper.slidePrev();
        });
      }
    }

    // --- 6. Initialize GSAP Animations ---
    if (typeof gsap !== "undefined" && document.querySelector(".hero-title")) {
      const tl = gsap.timeline();
      tl.from(".hero-title", {
        duration: 1,
        y: 50,
        opacity: 0,
        ease: "power3.out",
        delay: 0.2,
      })
        .from(
          ".hero-subtitle",
          {
            duration: 0.8,
            y: 30,
            opacity: 0,
            ease: "power3.out",
          },
          "-=0.5",
        )
        .from(
          ".hero-buttons",
          {
            duration: 0.8,
            y: 20,
            opacity: 0,
            ease: "power3.out",
          },
          "-=0.5",
        )
        .from(
          ".hero-visual",
          {
            duration: 1.5,
            scale: 0.8,
            opacity: 0,
            ease: "elastic.out(1, 0.5)",
          },
          "-=0.8",
        );
    }

    // --- 7. Fetch Menu Items ---
    async function fetchMenuItems() {
      try {
        if (!supabaseClient)
          throw new Error("Supabase internal client not loaded");

        await fetchSettings();
        setupRealtimeSettings();
        if (typeof setupRealtimeOffers === 'function') setupRealtimeOffers();

        const { data, error } = await supabaseClient
          .from("menu_items")
          .select("*")
          .order("created_at", { ascending: true }); // "first entry" rule

        if (error) throw error;
        allMenuItems = data || [];

        // Only render menu cards if we're on menu page
        if (menuGrid) {
          setupPublicMenuCategories();
          renderMenuCards();
        }

        setupRealtimeMenu();
      } catch (error) {
        console.error("Error fetching menu items:", error);
        if (menuGrid) {
          menuGrid.innerHTML =
            '<p class="text-center text-danger w-100">Failed to load menu items.</p>';
        }
      }
    }

    function validateCartAgainstMenu() {
      if (!cart.length || !allMenuItems.length) return;

      const updatedCart = [];
      let cartChanged = false;
      let itemsRemoved = [];

      cart.forEach(cartItem => {
        const menuItem = allMenuItems.find(item => item.name === cartItem.name);

        if (menuItem && menuItem.is_available !== false) {
          const discount = menuItem.discount_percentage || 0;
          const currentPrice = discount > 0
            ? menuItem.price - (menuItem.price * (discount / 100))
            : menuItem.price;

          if (Math.abs(currentPrice - cartItem.price) > 0.01) {
            cartItem.price = currentPrice;
            cartChanged = true;
          }

          updatedCart.push(cartItem);
        } else {
          cartChanged = true;
          itemsRemoved.push(cartItem.name);
        }
      });

      if (itemsRemoved.length > 0) {
        if (typeof showToast === 'function') {
          showToast(`${itemsRemoved.join(', ')} ${itemsRemoved.length > 1 ? 'are' : 'is'} no longer available and ${itemsRemoved.length > 1 ? 'have' : 'has'} been removed from cart`, 'warning');
        }
      }

      if (cartChanged) {
        cart = updatedCart;
        updateCartUI();
      }
    }

    function validateCartOnLoad() {
      if (!cart.length || !allMenuItems.length) return;

      const validCart = cart.filter(cartItem => {
        const menuItem = allMenuItems.find(item => item.name === cartItem.name);
        return menuItem && menuItem.is_available !== false;
      });

      if (validCart.length !== cart.length) {
        console.log('Cart contained invalid items, cleaning up...');
        cart = validCart;
        updateCartUI();

        try {
          localStorage.setItem("cart", JSON.stringify(cart));
        } catch (e) { }
      }
    }

    window.testAvailability = function () {
      console.log('Current allMenuItems:', allMenuItems);
      console.log('Cart before validation:', JSON.parse(JSON.stringify(cart)));
      validateCartAgainstMenu();
      console.log('Cart after validation:', JSON.parse(JSON.stringify(cart)));
    }

    // Render menu cards - only used on menu page
    function renderMenuCards() {
      if (!menuGrid) return;
      menuGrid.innerHTML = "";
      if (allMenuItems.length === 0) {
        menuGrid.innerHTML =
          '<p class="text-center text-muted w-100" style="grid-column: 1 / -1; padding: 2rem;">Menu is currently being updated. Check back soon!</p>';
        return;
      }

      allMenuItems.forEach((item, index) => {
        const iconHtml =
          item.diet_type === "veg"
            ? '<span class="diet-icon veg" title="Vegetarian"><i class="fa-regular fa-circle-dot"></i></span>'
            : '<span class="diet-icon non-veg" title="Non-Vegetarian"><i class="fa-solid fa-square-caret-up"></i></span>';

        const isAvailable = item.is_available !== false;
        const discount = item.discount_percentage || 0;
        const originalPrice = item.price;
        const finalPrice = discount > 0
          ? originalPrice - originalPrice * (discount / 100)
          : originalPrice;

        const cardHTML = `
          <div class="food-card" data-category="${item.category}" data-diet="${item.diet_type}" data-aos="fade-up" data-aos-delay="${(index % 4) * 100}">
            <div class="food-img" style="position:relative;">
              ${discount > 0 ? `<div class="discount-badge">${discount}% OFF</div>` : ""}
              ${iconHtml}
              <img src="${item.image_url || "https://via.placeholder.com/600x400"}" alt="${item.name}">
              ${!isAvailable
            ? `<div class="out-of-stock-overlay"><div class="out-of-stock-text">Out of Stock</div></div>`
            : (globalSettings.is_offline
              ? `<button class="add-to-cart-btn" disabled style="background:#d1d5db; color:#9ca3af; cursor:not-allowed; box-shadow:none;"><i class="fa-solid fa-plus"></i></button>`
              : `<button class="add-to-cart-btn" data-id="${item.id}" data-name="${item.name}" data-img="${item.image_url}"><i class="fa-solid fa-plus"></i></button>`
            )
          }
            </div>
            <div class="food-info">
              <div class="food-header">
                <h3 class="food-name">${item.name}</h3>
                <div class="price">
                  ${discount > 0 ? `<span class="original-price">₹${originalPrice}</span>` : ""}₹${finalPrice.toFixed(0)}
                </div>
              </div>
              <p class="food-desc">${item.description || ""}</p>
            </div>
          </div>
        `;
        menuGrid.insertAdjacentHTML("beforeend", cardHTML);
      });

      // After rendering, if "All" is active, re-sort the DOM elements based on category priority
      const activeCategoryBtn = document.querySelector(".menu-filters .filter-btn.active");
      const activeCategory = activeCategoryBtn ? activeCategoryBtn.getAttribute("data-filter") : "all";

      if (activeCategory === "all") {
        const foodCards = Array.from(document.querySelectorAll(".food-card"));
        const priorities = globalSettings.category_priorities || {};

        foodCards.sort((a, b) => {
          const catA = a.getAttribute("data-category");
          const catB = b.getAttribute("data-category");
          const prioA = priorities[catA] || 999;
          const prioB = priorities[catB] || 999;

          if (prioA !== prioB) return prioA - prioB;
          // If priorities are same, keep their relative order (already sorted by created_at)
          return 0;
        });

        foodCards.forEach(card => menuGrid.appendChild(card));
      }

      if (typeof filterMenu === 'function') {
        filterMenu();
      }
      if (typeof AOS !== "undefined") AOS.refresh();
    }

    function updateOfflineStatusUI() {
      if (!globalSettings) return;

      const offlineNote = document.getElementById('offline-notice');
      const checkoutBtn = document.getElementById('checkout-btn');

      if (globalSettings.is_offline === true) {
        // Show offline notice banner
        if (!offlineNote) {
          const notice = document.createElement('div');
          notice.id = 'offline-notice';
          notice.style = "background: #EF4444; color: white; text-align: center; padding: 12px; font-weight: 700; position: fixed; top: 0; left: 0; width: 100%; z-index: 10001; box-shadow: 0 2px 10px rgba(0,0,0,0.2); font-size: 0.95rem; border-bottom: 2px solid rgba(0,0,0,0.1);";
          notice.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-2"></i> Our shop is currently offline. We are not accepting new orders at this moment.';
          document.body.prepend(notice);
          document.body.style.paddingTop = "45px";
          const header = document.querySelector('.header');
          if (header) header.style.top = "45px";
        }

        // Disable checkout button
        if (checkoutBtn) {
          checkoutBtn.disabled = true;
          checkoutBtn.innerHTML = '<i class="fa-solid fa-ban mr-2"></i> Shop Offline';
          checkoutBtn.classList.add('btn-disabled');
        }
      } else {
        // Remove offline notice
        if (offlineNote) {
          offlineNote.remove();
          document.body.style.paddingTop = "0";
          const header = document.querySelector('.header');
          if (header) header.style.top = "0";
        }

        // Re-enable checkout button
        if (checkoutBtn) {
          checkoutBtn.disabled = false;
          checkoutBtn.innerHTML = 'Proceed to Checkout';
          checkoutBtn.classList.remove('btn-disabled');
        }
      }

      // Re-render menu cards to update "Add to Cart" buttons status
      const menuGrid = document.getElementById('menu-grid');
      if (menuGrid && typeof renderMenuCards === 'function') {
        renderMenuCards();
      }
    }

    // Filter menu function - only used on menu page
    function filterMenu() {
      if (!menuGrid) return;

      const foodCards = document.querySelectorAll(".food-card");
      const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
      const activeCategoryBtn = document.querySelector(".menu-filters .filter-btn.active");
      const activeCategory = activeCategoryBtn ? activeCategoryBtn.getAttribute("data-filter") : "all";
      // Checkbox-based diet filter: read checked state
      const isVegOn = vegSwitch && vegSwitch.checked;
      const isNonVegOn = nonVegSwitch && nonVegSwitch.checked;
      const activeDiet = isVegOn ? "veg" : (isNonVegOn ? "non-veg" : "all");

      let visibleCount = 0;

      foodCards.forEach((card) => {
        const itemName = card.querySelector(".food-name").textContent.toLowerCase();
        const itemDesc = card.querySelector(".food-desc").textContent.toLowerCase();
        const itemCategory = card.getAttribute("data-category");
        const itemDiet = card.getAttribute("data-diet");

        const matchesSearch = itemName.includes(searchTerm) || itemDesc.includes(searchTerm);
        const matchesCategory = activeCategory === "all" || itemCategory === activeCategory;
        const matchesDiet = activeDiet === "all" || itemDiet === activeDiet;

        if (matchesSearch && matchesCategory && matchesDiet) {
          card.style.display = "block";
          setTimeout(() => {
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
          }, 10);
          visibleCount++;
        } else {
          card.style.opacity = "0";
          card.style.transform = "translateY(20px)";
          setTimeout(() => {
            if (card.style.opacity === "0") {
              card.style.display = "none";
            }
          }, 300);
        }
      });

      if (noResultsMsg) {
        if (visibleCount === 0) {
          setTimeout(() => noResultsMsg.classList.remove("d-none"), 300);
        } else {
          noResultsMsg.classList.add("d-none");
        }
      }
    }

    // Setup dynamic category filters for public menu
    function setupPublicMenuCategories() {
      const filtersContainer = document.querySelector(".menu-filters");
      if (!filtersContainer || !allMenuItems.length) return;

      const categories = [...new Set(allMenuItems.map(item => item.category.trim().toLowerCase()))].filter(Boolean);

      // Sort categories by priority
      const priorities = globalSettings.category_priorities || {};
      const sortedCategories = [...categories].sort((a, b) => {
        const prioA = priorities[a] || 999;
        const prioB = priorities[b] || 999;
        return prioA - prioB;
      });

      const buttonsHtml = [
        '<button class="filter-btn active" data-filter="all">All</button>',
        ...sortedCategories.map(cat => `<button class="filter-btn" data-filter="${cat}" style="text-transform: capitalize;">${cat}</button>`)
      ].join('');

      filtersContainer.innerHTML = buttonsHtml;

      // Re-attach event listeners
      const newFilterBtns = document.querySelectorAll(".menu-filters .filter-btn");
      newFilterBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          newFilterBtns.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          filterMenu();
        });
      });
    }

    // Filter event listeners (initial attach for any hardcoded ones, though we overwrote them)
    if (filterBtns && document.querySelector(".menu-filters")) {
      filterBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          filterBtns.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          filterMenu();
        });
      });
    }

    // Diet switch (checkbox) event handler — mutual exclusivity
    function handleDietSwitch(changedSwitch, otherSwitch) {
      if (!changedSwitch) return;
      changedSwitch.addEventListener("change", () => {
        if (changedSwitch.checked && otherSwitch && otherSwitch.checked) {
          otherSwitch.checked = false;
        }
        filterMenu();
      });
    }
    handleDietSwitch(vegSwitch, nonVegSwitch);
    handleDietSwitch(nonVegSwitch, vegSwitch);

    // Legacy button toggle handling (in case old buttons still exist)
    if (dietToggleBtns.length > 0) {
      dietToggleBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const wasActive = btn.classList.contains("active");
          dietToggleBtns.forEach((b) => b.classList.remove("active"));
          if (!wasActive) btn.classList.add("active");
          filterMenu();
        });
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", filterMenu);
    }

    // Toast Notification
    function showToast(message, type = 'success') {
      const toastContainer = document.getElementById("toast-container");
      if (!toastContainer) return;

      const toast = document.createElement("div");
      toast.className = `toast ${type}`;

      let icon = 'fa-circle-check';
      if (type === 'warning') icon = 'fa-triangle-exclamation';
      if (type === 'error') icon = 'fa-circle-xmark';

      toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
      toastContainer.appendChild(toast);
      toast.offsetHeight;
      toast.classList.add("show");

      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    // Toggle Cart
    function toggleCart() {
      if (cartSidebar && cartOverlay) {
        cartSidebar.classList.toggle("active");
        cartOverlay.classList.toggle("active");

        // Toggle body scroll
        if (cartSidebar.classList.contains("active")) {
          document.body.style.overflow = "hidden";
        } else {
          document.body.style.overflow = "";
        }
      }
    }

    if (cartToggleBtn && closeCartBtn && cartOverlay) {
      cartToggleBtn.addEventListener("click", toggleCart);
      closeCartBtn.addEventListener("click", toggleCart);
      cartOverlay.addEventListener("click", toggleCart);
    }

    // Event delegation for Add to Cart buttons - only on menu page
    if (menuGrid) {
      let addToCartPending = false;
      menuGrid.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.add-to-cart-btn');
        if (!addBtn) return;
        if (addToCartPending) return;

        e.preventDefault();

        const name = addBtn.dataset.name;
        const menuItem = allMenuItems.find(item => item.name === name);

        if (!menuItem) {
          showToast(`${name} not found in menu`, 'error');
          return;
        }

        if (menuItem.is_available === false) {
          showToast(`${name} is currently out of stock`, 'warning');

          const card = addBtn.closest('.food-card');
          if (card) {
            const foodImg = card.querySelector('.food-img');
            const addBtn = foodImg.querySelector('.add-to-cart-btn');
            if (addBtn) addBtn.style.display = 'none';

            if (!foodImg.querySelector('.out-of-stock-overlay')) {
              const overlayHTML = `<div class="out-of-stock-overlay"><div class="out-of-stock-text">Out of Stock</div></div>`;
              foodImg.insertAdjacentHTML('beforeend', overlayHTML);
            }
          }
          return;
        }

        addToCartPending = true;

        const discount = menuItem.discount_percentage || 0;
        const currentPrice = discount > 0
          ? menuItem.price - (menuItem.price * (discount / 100))
          : menuItem.price;

        const imgSrc = menuItem.image_url;

        const existingItemIndex = cart.findIndex(item => item.name === name);
        if (existingItemIndex > -1) {
          cart[existingItemIndex].quantity += 1;
        } else {
          cart.push({
            name,
            price: currentPrice,
            img: imgSrc,
            quantity: 1,
            id: menuItem.id
          });
        }

        updateCartUI();
        showToast(`${name} added to cart!`);

        const icon = addBtn.querySelector('i');
        if (icon) {
          icon.classList.remove('fa-plus');
          icon.classList.add('fa-check');
          setTimeout(() => {
            icon.classList.remove('fa-check');
            icon.classList.add('fa-plus');
          }, 1000);
        }
        setTimeout(() => { addToCartPending = false; }, 300);
      });

      // Event delegation for quantity controls
      menuGrid.addEventListener('click', (e) => {
        const plusBtn = e.target.closest('.card-plus');
        const minusBtn = e.target.closest('.card-minus');

        if (plusBtn) {
          const name = plusBtn.dataset.name;
          const item = cart.find(i => i.name === name);
          if (item) {
            item.quantity++;
            updateCartUI();
          }
        }

        if (minusBtn) {
          const name = minusBtn.dataset.name;
          const itemIndex = cart.findIndex(i => i.name === name);
          if (itemIndex > -1) {
            if (cart[itemIndex].quantity > 1) {
              cart[itemIndex].quantity--;
            } else {
              cart.splice(itemIndex, 1);
              showToast(`${name} removed from cart`);
            }
            updateCartUI();
          }
        }
      });
    }

    // Update Cart UI
    function updateCartUI() {
      if (!cartCountDisplay) return;

      const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
      cartCountDisplay.textContent = totalItems;

      const cgstRate = (globalSettings.cgst || 0) / 100;
      const sgstRate = (globalSettings.sgst || 0) / 100;

      const subTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

      // Calculate Discount
      let discountAmount = 0;
      const discountRow = document.getElementById("cart-discount-row");
      const discountValEl = document.getElementById("cart-discount-value");
      const appliedDisplay = document.getElementById("applied-promo-display");
      const promoInputGroup = document.getElementById("promo-input-group");

      if (appliedPromo) {
        if (subTotal < appliedPromo.min_cart_value) {
          showToast(`Cart must be at least ₹${appliedPromo.min_cart_value} for this code`, 'warning');
          appliedPromo = null;
        } else {
          if (appliedPromo.discount_type === 'percentage') {
            discountAmount = (subTotal * appliedPromo.discount_value) / 100;
          } else {
            discountAmount = appliedPromo.discount_value;
          }
          // Cap discount at subtotal
          discountAmount = Math.min(discountAmount, subTotal);
        }
      }

      const promoSection = document.querySelector(".cart-promo-section");

      if (appliedPromo) {
        if (discountRow) discountRow.classList.remove('d-none');
        if (discountValEl) discountValEl.textContent = `-₹${discountAmount.toFixed(0)}`;
        if (appliedDisplay) {
          appliedDisplay.classList.remove('d-none');
          document.getElementById('applied-promo-code').textContent = appliedPromo.code;
          document.getElementById('applied-promo-discount').textContent = `-₹${discountAmount.toFixed(0)}`;
        }
        if (promoInputGroup) promoInputGroup.classList.add('d-none');
        if (promoSection) promoSection.classList.remove('d-none');
      } else {
        if (discountRow) discountRow.classList.add('d-none');
        if (appliedDisplay) appliedDisplay.classList.add('d-none');
        if (promoInputGroup) promoInputGroup.classList.remove('d-none');
        const promoInput = document.getElementById('promo-code-input');
        if (promoInput) promoInput.value = '';

        // Hide entire section if no applied promo AND no public promos available
        const hasPublicPromos = promosData.some(p => p.is_public && p.is_active);
        if (!hasPublicPromos && promoSection) {
          promoSection.classList.add('d-none');
        } else if (promoSection) {
          promoSection.classList.remove('d-none');
        }
      }

      const discountedSubtotal = Math.max(0, subTotal - discountAmount);
      const cgstAmount = discountedSubtotal * cgstRate;
      const sgstAmount = discountedSubtotal * sgstRate;
      const totalPrice = discountedSubtotal + cgstAmount + sgstAmount;

      const subTotalEl = document.getElementById("cart-subtotal-price");
      const cgstEl = document.getElementById("cart-cgst-price");
      const sgstEl = document.getElementById("cart-sgst-price");
      const cgstLabel = document.getElementById("cgst-label");
      const sgstLabel = document.getElementById("sgst-label");

      if (subTotalEl) subTotalEl.textContent = `₹${subTotal.toFixed(2)}`;
      if (cgstEl) cgstEl.textContent = `₹${cgstAmount.toFixed(2)}`;
      if (sgstEl) sgstEl.textContent = `₹${sgstAmount.toFixed(2)}`;
      if (cgstLabel) cgstLabel.textContent = `CGST (${globalSettings.cgst || 0}%)`;
      if (sgstLabel) sgstLabel.textContent = `SGST (${globalSettings.sgst || 0}%)`;
      if (cartTotalPriceDisplay) cartTotalPriceDisplay.textContent = `₹${totalPrice.toFixed(2)}`;

      // Update food cards UI - only if on menu page
      if (menuGrid) {
        document.querySelectorAll(".food-card").forEach((card) => {
          const name = card.querySelector(".food-name").textContent;
          const cartItem = cart.find((item) => item.name === name);
          const btnContainer = card.querySelector(".food-img");
          const existingControls = card.querySelector(".card-qty-controls");
          if (existingControls) existingControls.remove();

          const addBtn = card.querySelector(".add-to-cart-btn");

          if (cartItem) {
            if (addBtn) addBtn.style.display = "none";
            const controlsHTML = `
              <div class="card-qty-controls">
                <button class="card-qty-btn card-minus" data-name="${name}"><i class="fa-solid fa-minus"></i></button>
                <span class="card-qty">${cartItem.quantity}</span>
                <button class="card-qty-btn card-plus" data-name="${name}"><i class="fa-solid fa-plus"></i></button>
              </div>
            `;
            btnContainer.insertAdjacentHTML("beforeend", controlsHTML);
          } else {
            if (addBtn) addBtn.style.display = "";
          }
        });
      }

      // Render Cart Items
      if (cartItemsContainer) {
        cartItemsContainer.innerHTML = "";
        if (cart.length === 0) {
          cartItemsContainer.innerHTML = `<div class="empty-cart-msg">Your cart is empty.</div>`;
        } else {
          cart.forEach((item, index) => {
            const itemHTML = `
              <div class="cart-item">
                <img src="${item.img}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-details">
                  <h4 class="cart-item-title">${item.name}</h4>
                  <div class="cart-item-price">₹${item.price}</div>
                  <div class="cart-item-controls">
                    <button class="qty-btn minus" data-index="${index}"><i class="fa-solid fa-minus"></i></button>
                    <span class="item-qty">${item.quantity}</span>
                    <button class="qty-btn plus" data-index="${index}"><i class="fa-solid fa-plus"></i></button>
                  </div>
                </div>
                <button class="cart-item-remove" data-index="${index}"><i class="fa-solid fa-trash-can"></i></button>
              </div>
            `;
            cartItemsContainer.insertAdjacentHTML("beforeend", itemHTML);
          });

          // Cart interaction listeners
          document.querySelectorAll(".minus").forEach(btn =>
            btn.addEventListener("click", (e) => {
              const index = e.target.closest("button").dataset.index;
              if (cart[index].quantity > 1) {
                cart[index].quantity--;
              } else {
                cart.splice(index, 1);
              }
              updateCartUI();
            })
          );

          document.querySelectorAll(".plus").forEach(btn =>
            btn.addEventListener("click", (e) => {
              const index = e.target.closest("button").dataset.index;
              cart[index].quantity++;
              updateCartUI();
            })
          );

          document.querySelectorAll(".cart-item-remove").forEach(btn =>
            btn.addEventListener("click", (e) => {
              const index = e.target.closest("button").dataset.index;
              const itemName = cart[index].name;
              cart.splice(index, 1);
              showToast(`${itemName} removed from cart`);
              updateCartUI();
            })
          );
        }
      }

      try {
        localStorage.setItem("cart", JSON.stringify(cart));
      } catch (e) {
        console.error("Could not save cart to localStorage", e);
      }
    }

    // Checkout Logic
    if (checkoutBtn && checkoutModal && closeCheckoutModal) {
      checkoutBtn.addEventListener("click", () => {
        if (cart.length === 0) {
          showToast("Your cart is empty!");
          return;
        }
        toggleCart();
        checkoutModal.classList.add("active");
      });

      closeCheckoutModal.addEventListener("click", () => {
        checkoutModal.classList.remove("active");
      });

      checkoutModal.addEventListener("click", (e) => {
        if (e.target === checkoutModal) {
          checkoutModal.classList.remove("active");
        }
      });
    }

    // --- Promo Code Handlers ---
    async function fetchPromos() {
      try {
        if (!supabaseClient) return;
        const { data, error } = await supabaseClient
          .from('promo_codes')
          .select('*')
          .eq('is_active', true);

        if (error) throw error;
        promosData = data || [];
        renderAvailablePromos();
        updateCartUI(); // Force refresh to show/hide sections correctly
      } catch (err) {
        console.error("Error fetching promos:", err);
      }
    }

    function renderAvailablePromos() {
      const container = document.getElementById('available-promos-container');
      const promoSection = document.querySelector(".cart-promo-section");
      if (!container) return;

      const publicPromos = promosData.filter(p => p.is_public);
      if (publicPromos.length === 0) {
        container.classList.add('d-none');
        return;
      }

      container.classList.remove('d-none');
      if (promoSection) promoSection.classList.remove('d-none'); // Ensure parent is visible

      container.innerHTML = `
            <p>Available Offers:</p>
            <div class="promo-scroll-wrapper">
                ${publicPromos.map(promo => `
                    <div class="promo-pill" data-code="${promo.code}">
                        <span class="code">${promo.code}</span>
                        <span class="desc">${promo.discount_type === 'percentage' ? `${promo.discount_value}% OFF` : `₹${promo.discount_value} OFF`}</span>
                    </div>
                `).join('')}
            </div>
        `;

      container.querySelectorAll('.promo-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          const code = pill.dataset.code;
          document.getElementById('promo-code-input').value = code;
          applyPromo(code);
        });
      });
    }

    function applyPromo(code = null) {
      const inputField = document.getElementById('promo-code-input');
      const enteredCode = (code || inputField.value).trim().toUpperCase();

      if (!enteredCode) {
        showToast('Please enter a promo code', 'warning');
        return;
      }

      const promo = promosData.find(p => p.code === enteredCode);
      if (!promo) {
        showToast('Invalid or expired promo code', 'error');
        return;
      }

      const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
      if (subtotal < promo.min_cart_value) {
        showToast(`Minimum order of ₹${promo.min_cart_value} required`, 'warning');
        return;
      }

      appliedPromo = promo;
      showToast('Promo code applied!', 'success');
      updateCartUI();
    }

    const applyPromoBtn = document.getElementById('apply-promo-btn');
    if (applyPromoBtn) {
      applyPromoBtn.addEventListener('click', () => applyPromo());
    }

    const removePromoBtn = document.getElementById('remove-promo-btn');
    if (removePromoBtn) {
      removePromoBtn.addEventListener('click', () => {
        appliedPromo = null;
        showToast('Promo code removed');
        updateCartUI();
      });
    }

    if (checkoutForm && placeOrderBtn) {
      checkoutForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const tableNo = document.getElementById("table-number").value;
        const mobileNo = document.getElementById("mobile-number").value;

        placeOrderBtn.disabled = true;
        placeOrderBtn.textContent = "Placing Order...";

        try {
          const now = new Date();
          const dateStr = now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, "0") +
            now.getDate().toString().padStart(2, "0");
          const timeStr = now.getHours().toString().padStart(2, "0") +
            now.getMinutes().toString().padStart(2, "0") +
            now.getSeconds().toString().padStart(2, "0");

          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          const { count, error: countError } = await supabaseClient
            .from("orders")
            .select("*", { count: "exact", head: true })
            .gte("created_at", startOfDay);

          let orderNumber = 1;
          if (!countError && count !== null) {
            orderNumber = count + 1;
          }

          const orderIdStr = `ORDID${dateStr}${timeStr}${orderNumber}`;
          const totalAmount = cartTotalPriceDisplay ? parseFloat(cartTotalPriceDisplay.textContent.replace("₹", "")) : 0;

          const orderPayload = {
            order_id: orderIdStr,
            table_number: tableNo,
            phone_number: mobileNo,
            items: cart,
            total_price: totalAmount,
            status: "Pending",
          };

          if (currentUser) {
            orderPayload.user_id = currentUser.id;
          }

          if (appliedPromo) {
            orderPayload.promo_code = appliedPromo.code;
            orderPayload.discount_amount = parseFloat(document.getElementById('applied-promo-discount').textContent.replace('-₹', '')) || 0;
          }

          const { error: insertError } = await supabaseClient
            .from("orders")
            .insert([orderPayload]);

          if (insertError) throw insertError;

          checkoutModal.classList.remove("active");
          cart = [];
          appliedPromo = null;
          updateCartUI();
          showToast(`Order ${orderIdStr} placed successfully!`);
          checkoutForm.reset();
        } catch (err) {
          console.error("Order failed:", err);
          showToast(`Failed to place order. Please try again.`, "error");
        } finally {
          placeOrderBtn.disabled = false;
          placeOrderBtn.textContent = "Place Order";
        }
      });
    }

    // Fetch Offers - only if offers container exists
    async function fetchOffers() {
      const offersContainer = document.getElementById("offers-container");
      if (!offersContainer) return;

      try {
        if (!supabaseClient) throw new Error("Supabase internal client not loaded");
        const { data, error } = await supabaseClient
          .from("offers")
          .select("*")
          .eq("is_active", true);

        if (error) throw error;

        if (data && data.length > 0) {
          offersContainer.innerHTML = data.map(offer => `
            <div class="offer-box">
              <h3>${offer.title.replace(" ", " <br><span>").replace(/$/, "</span>")}</h3>
              <p>${offer.condition || offer.subtitle}</p>
            </div>
          `).join("");
        } else {
          offersContainer.innerHTML = '<div class="offer-box"><h3>Special Offers <br><span>Coming Soon</span></h3><p>Stay tuned for amazing discounts!</p></div>';
        }
      } catch (error) {
        console.error("Error fetching offers:", error);
        offersContainer.innerHTML = '<div class="offer-box"><h3>Special Offers</h3><p>Check back later.</p></div>';
      }
    }

    // Poll for settings changes
    setInterval(async () => {
      if (document.visibilityState === 'visible') {
        await fetchSettings();
      }
    }, 30000);



    // Initialize everything
    await fetchMenuItems();
    await fetchPromos();
    await fetchOffers();
    validateCartOnLoad();
    updateCartUI();

    // --- Auth & Account Logic ---
    const authToggleBtn = document.getElementById('auth-toggle');
    const authModal = document.getElementById('auth-modal');
    const closeAuthModalBtn = document.getElementById('close-auth-modal');
    const accountModal = document.getElementById('account-modal');
    const closeAccountModalBtn = document.getElementById('close-account-modal');

    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const showSignupLnk = document.getElementById('show-signup');
    const showLoginLnk = document.getElementById('show-login');

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const logoutBtn = document.getElementById('logout-btn');
    const googleLoginBtn = document.getElementById('google-login-btn');

    if (supabaseClient) {
      // Listen for Auth Changes
      supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session ? session.user : null;

        if (currentUser) {
          if (authModal && authModal.classList.contains('active')) {
            authModal.classList.remove('active');
          }

          // Auto-fill phone number in checkout if we have it in metadata
          const mobileInput = document.getElementById("mobile-number");
          if (mobileInput && currentUser.user_metadata?.phone) {
            mobileInput.value = currentUser.user_metadata.phone;
          }
        }
      });

      // Check initial session
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        currentUser = session ? session.user : null;
      });
    }

    // Handlers for Modals
    if (authToggleBtn) {
      authToggleBtn.addEventListener('click', () => {
        if (currentUser) {
          if (accountModal) {
            accountModal.classList.add('active');
            document.getElementById('account-user-email').textContent = currentUser.email;
            fetchUserOrders();
          }
        } else {
          if (authModal) {
            authModal.classList.add('active');
            loginView.style.display = 'block';
            signupView.style.display = 'none';
          }
        }
      });
    }

    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', () => authModal.classList.remove('active'));
    if (closeAccountModalBtn) closeAccountModalBtn.addEventListener('click', () => accountModal.classList.remove('active'));

    if (showSignupLnk) {
      showSignupLnk.addEventListener('click', (e) => {
        e.preventDefault();
        loginView.style.display = 'none';
        signupView.style.display = 'block';
      });
    }
    if (showLoginLnk) {
      showLoginLnk.addEventListener('click', (e) => {
        e.preventDefault();
        signupView.style.display = 'none';
        loginView.style.display = 'block';
      });
    }

    // Login Submission
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const btn = document.getElementById('login-btn');
        const errorMsg = document.getElementById('login-error-msg');

        btn.disabled = true;
        btn.textContent = 'Logging in...';
        errorMsg.style.display = 'none';

        const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });

        if (error) {
          errorMsg.textContent = error.message;
          errorMsg.style.display = 'block';
        } else {
          showToast('Successfully logged in!', 'success');
          authModal.classList.remove('active');
          loginForm.reset();
        }
        btn.disabled = false;
        btn.textContent = 'Login';
      });
    }

    // Signup Submission
    if (signupForm) {
      signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const pass = document.getElementById('signup-password').value;
        const btn = document.getElementById('signup-btn');
        const errorMsg = document.getElementById('signup-error-msg');

        btn.disabled = true;
        btn.textContent = 'Creating account...';
        errorMsg.style.display = 'none';

        const { data, error } = await supabaseClient.auth.signUp({ email, password: pass });

        if (error) {
          errorMsg.textContent = error.message;
          errorMsg.style.display = 'block';
        } else {
          // If email verification is OFF in Supabase, they log in immediately
          showToast('Account created successfully!', 'success');
          authModal.classList.remove('active');
          signupForm.reset();
        }
        btn.disabled = false;
        btn.textContent = 'Sign Up';
      });
    }

    // Logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        accountModal.classList.remove('active');
        showToast('Logged out successfully', 'info');
      });
    }

    // Google Login
    if (googleLoginBtn) {
      googleLoginBtn.addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + window.location.pathname
          }
        });
        if (error) {
          showToast('Failed to initialize Google Login: ' + error.message, 'error');
        }
      });
    }

    // Fetch User Orders
    async function fetchUserOrders() {
      const tbody = document.getElementById('user-orders-body');
      if (!tbody || !currentUser) return;

      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Loading orders...</td></tr>';

      try {
        const { data, error } = await supabaseClient
          .from('orders')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        if (!data || data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">You have no past orders yet.</td></tr>';
          return;
        }

        tbody.innerHTML = data.map(order => {
          const dateObj = new Date(order.created_at);
          const dateStr = dateObj.toLocaleDateString();

          let itemsHTML = '<ul style="padding-left: 15px; margin: 0; font-size: 0.85rem; text-align: left;">';
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
              itemsHTML += `<li>${item.quantity}x ${item.name}</li>`;
            });
          }
          itemsHTML += '</ul>';

          const reorderData = encodeURIComponent(JSON.stringify(order.items));

          return `
            <tr>
              <td data-label="Order ID" style="font-weight:600; font-size:0.85rem;">${order.order_id}</td>
              <td data-label="Date" style="font-size:0.85rem;">${dateStr}</td>
              <td data-label="Items">${itemsHTML}</td>
              <td data-label="Total" style="font-weight:600;">₹${order.total_price}</td>
              <td data-label="Status">
                  <span style="padding:2px 8px; border-radius:12px; font-size:0.75rem; background: ${order.status === 'Completed' ? '#D1FAE5; color: #065F46' :
              order.status === 'Pending' ? '#FEF3C7; color: #92400E' :
                order.status === 'Cancelled' ? '#FEE2E2; color: #991B1B' : '#DBEAFE; color: #1E40AF'
            }">
                      ${order.status}
                  </span>
              </td>
              <td data-label="Action">
                <button class="btn btn-outline" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="reorderItems('${reorderData}')">
                  <i class="fa-solid fa-rotate-right mr-1"></i> Reorder
                </button>
              </td>
            </tr>
          `;
        }).join('');
      } catch (err) {
        console.error('Error fetching user orders:', err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger" style="padding:2rem;">Failed to load orders.</td></tr>';
      }
    }

    // Global helper for re-ordering
    window.reorderItems = function (encodedItems) {
      try {
        const items = JSON.parse(decodeURIComponent(encodedItems));
        let addedCount = 0;
        let unavailableCount = 0;

        items.forEach(pastItem => {
          const menuItem = allMenuItems.find(m => m.name === pastItem.name);
          if (menuItem && menuItem.is_available !== false) {
            const discount = menuItem.discount_percentage || 0;
            const currentPrice = discount > 0 ? menuItem.price - (menuItem.price * (discount / 100)) : menuItem.price;

            const existingItem = cart.find(c => c.name === menuItem.name);
            if (existingItem) {
              existingItem.quantity += pastItem.quantity;
            } else {
              cart.push({
                id: menuItem.id,
                name: menuItem.name,
                price: currentPrice,
                quantity: pastItem.quantity,
                image_url: menuItem.image_url
              });
            }
            addedCount++;
          } else {
            unavailableCount++;
          }
        });
        updateCartUI();

        const accModal = document.getElementById('account-modal');
        if (accModal) accModal.classList.remove('active');

        const cartOverlayElement = document.getElementById("cart-overlay");
        const cartSidebarElement = document.getElementById("cart-sidebar");
        if (cartOverlayElement && cartSidebarElement) {
          cartOverlayElement.classList.add("active");
          cartSidebarElement.classList.add("active");
        }

        if (unavailableCount > 0) {
          showToast(`${addedCount} items added. ${unavailableCount} items are no longer available.`, 'warning');
        } else {
          showToast(`Successfully added ${addedCount} items to your cart!`, 'success');
        }
      } catch (e) {
        console.error(e);
        showToast('Error reordering items', 'error');
      }
    };

  } catch (criticalError) {
    console.error("Critical Front-end Error:", criticalError);
    // Don't show alert on index page if menu elements are missing
    if (document.getElementById('menu-grid')) {
      alert("Sorry, there was an issue loading the dynamic features: " + criticalError.message);
    }
  }
});