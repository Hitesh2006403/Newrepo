# Feature Specification: Spatial UI, Theme Harmonization & Interactive Telemetry

## 1. Overview
The Spatial UI & Theme Harmonization suite elevates the **Share A Plate** user experience from standard web interfaces to a modern, dynamic, and visually engaging web application. It introduces tactile 3D perspective transforms, specular glare physics, real-time platform telemetry HUDs, dark mode toggling with persistent preferences, and refined glassmorphism styling across all user dashboards.

---

## 2. Core Architecture & Components

### 2.1 `SpatialCard.jsx` (`client/src/features/spatial/SpatialCard.jsx`)
- **Physics-driven Tilt**: Translates real-time cursor offsets ($X, Y$) relative to the element center into 3D rotations (`rotateX`, `rotateY`) and subtle $Z$-axis elevation (`translateZ(6px) scale3d(1.01, 1.01, 1.01)`).
- **Specular Glare Simulation**: Generates a dynamic radial glare gradient reflecting natural light across the card surface as the user's cursor moves across it.
- **Accessibility & Motion Safety**: Uses `window.matchMedia('(prefers-reduced-motion: reduce)')` to automatically disable 3D transformations for users with vestibular or motion sensitivity.

### 2.2 `SpatialImpactHUD.jsx` (`client/src/features/spatial/SpatialImpactHUD.jsx`)
- **Real-Time Telemetry Dashboard**: Presents live aggregate food-rescue statistics:
  - Total Meals Rescued from landfills.
  - Calculated CO₂ carbon emission offsets (kg).
  - Active Hot Food Rescues underway.
  - Fleet delivery distribution (Volunteer vs. Paid deliveries).
- **Glassmorphic Spatial Depth**: Multi-layer background gradients, blur orbs, and responsive telemetry tabs (`Overview`, `Eco Impact`, `Fleet Stats`).

### 2.3 `ThemeToggle.jsx` (`client/src/features/spatial/ThemeToggle.jsx`)
- **Seamless Dark/Light Transition**: Toggles the `.dark` class on `document.documentElement`.
- **System Preference Detection**: Defaults to the operating system's `prefers-color-scheme`.
- **Persistent Storage**: Retains user choice across sessions in `localStorage.getItem('sap_theme')`.

### 2.4 Style Foundations (`client/src/index.css`)
- **Tailwind v4 Theme Tokens**: `--color-brand-rose`, `--color-brand-amber`, `--color-brand-emerald`.
- **Glass Surfaces**: `.glass-surface` with backdrop filters (`blur(12px)`) and semi-transparent borders.
- **Spatial Elevation**: `.shadow-spatial` multi-layer depth shadow system tuned for light and dark modes.

---

## 3. Dashboard Integration Map

| Dashboard | Spatial Feature Integrated | Functionality |
| :--- | :--- | :--- |
| **Donor Hub** (`DonorDashboard.jsx`) | `SpatialImpactHUD` + `SpatialCard` | Displays platform-wide telemetry banner above surplus listings; wraps all food surplus cards in 3D tilt. |
| **Recipient Hub** (`RecipientDashboard.jsx`) | `SpatialCard` | Wraps all Smart Match surplus cards in tactile tilt with match scores and claim actions. |
| **Admin Operations** (`AdminDashboard.jsx`) | `SpatialImpactHUD` | Telemetry HUD positioned above critical batch alarms and central donation monitors. |
| **Global Navigation** (`Navbar.jsx`) | `ThemeToggle` | Persistent light/dark switcher accessible from top-right navigation header across all roles. |

---

## 4. Verification & Health Summary
- **Client Build**: Clean Vite build in 400ms (`vite build`), 0 errors.
- **Client Lint**: Clean static analysis (`oxlint`), 0 errors.
- **Backend Test Suite**: 264 passed across 15 test suites (`npm test`), 0 failures.
- **Smoke Tests**: 15 / 15 steps passed cleanly (`scripts/smoke.js`).
