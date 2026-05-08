# ☕ Vijay Cafe: Full-Stack Cafe Management & Customer Experience

**Vijay Cafe** is a sophisticated, real-time web application designed to bridge the gap between customer convenience and administrative efficiency. Built with a focus on modern UI/UX principles and real-time data synchronization, this project showcases a robust architecture capable of handling live orders, dynamic stock management, and complex sales analytics.

---

## 🚀 The Elevator Pitch
Most cafe websites are static menus. **Vijay Cafe** is a living ecosystem. It features a high-performance customer storefront and a full-fledged **Enterprise Admin Dashboard (ERP/POS)**. Whether it's a customer ordering from their table or an admin analyzing monthly revenue trends, the application provides a seamless, zero-latency experience powered by a real-time backend.

---

## 🛠️ Technical Architecture & Stack

### **Frontend Engineering**
- **Vanilla Core**: Developed using professional-grade HTML5, CSS3, and JavaScript (ES6+), avoiding framework overhead for maximum performance and full control over the DOM.
- **Design System**: A custom-themed system with **Glassmorphism**, silky-smooth **AOS** scroll animations, and **DarkMode** support.
- **State Management**: Client-side state persistence using **LocalStorage** for a resilient shopping cart experience.

### **Backend & Infrastructure**
- **Database**: **PostgreSQL** hosted on **Supabase** for relational data integrity.
- **Real-time Engine**: Leverages **WebSockets (Supabase Broadcast)** for instant order notifications and menu updates without page refreshes.
- **Security**: **JWT-based Authentication** with support for **OAuth (Google)** and Role-Based Access Control (RBAC) patterns.

---

## 💎 Engineering Highlights (For Interviewers)

### **1. Real-time Synchronization Engine**
The app implements a reactive data layer. When an admin updates a price or hides an out-of-stock item, the change is broadcasted across all connected customer clients instantly.
> *Technical Detail: Uses PostgreSQL CDC (Change Data Capture) and Supabase Channels.*

### **2. Integrated POS & Billing System**
Developed a dual-purpose billing module. It handles both customer-initiated online orders and staff-initiated manual walk-ins (POS), providing a unified data stream for sales analysis.

### **3. Data-Driven Decision Making**
The Admin Dashboard isn't just for management; it's for growth.
- **Live Metrics**: Total Revenue, AOV (Average Order Value), and Order Volume.
- **Visual Analytics**: Interactive charts using **Chart.js** to track revenue trends over custom date ranges.
- **Exporting**: One-click **CSV export** for financial auditing.

### **4. Performance-First UX**
- **Zero-Layout Shift**: Optimized image loading and skeleton-style UI hints.
- **Accessibility**: Semantic HTML and ARIA labels for screen reader compatibility.

---

## 📸 Visual Showcase

### **Customer Interface**
*(Add your beautiful Hero section and Menu screenshots here)*
![Home Page Placeholder](https://via.placeholder.com/1200x600?text=Home+Page+Preview)

### **Interactive Menu & Cart**
*(Add your Menu filters and Cart sidebar screenshots here)*
![Menu Page Placeholder](https://via.placeholder.com/1200x600?text=Menu+and+Cart+Preview)

### **Admin Intelligence Dashboard**
*(Add your Admin Analytics and Order List screenshots here)*
![Admin Dashboard Placeholder](https://via.placeholder.com/1200x600?text=Admin+Dashboard+Preview)

---

## 📂 Core Features

### **For Customers**
- **Dynamic Filtering**: Instant search and toggle between Veg/Non-Veg categories.
- **Smart Checkout**: Intelligent tax calculation (CGST/SGST) and promo code validation.
- **Order Tracking**: Personalized order history tied to user accounts.

### **For Admins**
- **Operational Control**: "Global Shop Status" to toggle ordering availability site-wide.
- **Inventory Mgmt**: Real-time CRUD for menu items, discounts, and categories.
- **Marketing Engine**: Dynamic Special Offers banner management.

---

## 🛤️ Future Roadmap
- [ ] **Kitchen Display System (KDS)**: Real-time status updates for kitchen staff.
- [ ] **PWA Integration**: Enable offline viewing and push notifications.
- [ ] **Reservation System**: Real-time table booking and calendar integration.

---

## 🏁 Getting Started
1. **Clone**: `git clone https://github.com/your-username/vijay-cafe.git`
2. **Back-end Setup**: Replace `SUPABASE_URL` and `SUPABASE_KEY` in `script.js` and `admin.js`.
3. **Run**: Launch `index.html` via **Live Server**.

---
*Developed by a Passionate Software Engineer. Let's build something great.*
