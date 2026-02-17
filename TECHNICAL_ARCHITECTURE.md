# Technical Architecture: Cool City

## 1️⃣ Project Structure

### Folder Overview
*   **`app/`**: Contains the Expo Router file-based routing logic.
    *   **`_layout.jsx`**: The root layout wrapping the app in `AuthProvider` and `WeatherProvider`.
    *   **`(tabs)/`**: Main application screens (Home, Map, Alerts, Profile) accessible via tab bar.
*   **`components/`**: Reusable UI components.
    *   **`HomeScreen.js`**: Main dashboard display logic.
    *   **`MapScreen.js`**: Map interface with platform-specific implementations.
    *   **`AuthScreen.js`**: Login and Registration forms.
*   **`context/`**: React Context for global state.
    *   **`AuthContext.js`**: Manages authentication state and session.
*   **`hooks/`**: Custom hooks for logic reuse.
    *   **`useWeather.js`**: Central data hub for fetching and managing weather/risk data.
*   **`utils/`**: Configuration utilities.
    *   **`supabase.js`**: Supabase client initialization.
*   **`services/`**: Background services.
    *   **`backgroundWeather.js`**: Background fetch tasks for location and weather updates.

## 2️⃣ Authentication Flow

### Implementation
*   **Supabase Auth**: The app uses `@supabase/supabase-js` to handle authentication.
*   **State Management**: `AuthContext` provides `session`, `user`, and `loading` state to the entire app.
*   **Persistence**:
    *   **Native (iOS/Android)**: Uses `expo-secure-store` via a custom `ExpoSecureStoreAdapter`. This ensures auth tokens are encrypted on the device.
    *   **Web**: Persistence is limited/memory-only by default in this configuration.
*   **Session Handling**:
    *   On app launch, `AuthContext` calls `supabase.auth.getSession()`.
    *   It sets up a real-time listener with `supabase.auth.onAuthStateChange()`.
    *   A **Loading Gate** (`if (loading) return null`) prevents the app from rendering protected screens until the session check is complete.

## 3️⃣ Supabase Configuration

### Initialization (`utils/supabase.js`)
*   **Client**: Initialized with `createClient` using `react-native-url-polyfill`.
*   **Environment Variables**:
    *   `process.env.EXPO_PUBLIC_SUPABASE_URL`
    *   `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`
*   **Safety Mechanisms**:
    *   **Fallback**: If environment variables are missing, the client initializes with "placeholder" values (`https://placeholder.supabase.co`).
    *   **Alerting**: Logs a `CRITICAL ERROR` to the console if keys are missing, but **prevents the app from crashing** immediately on launch.

## 4️⃣ Data Flow

### Architecture: Service/Hook Pattern
The app does **not** query Supabase from individual screens. Instead, all data fetching is centralized in the `useWeather` hook.

### Supabase Queries
1.  **`heat_reports`**:
    *   **Query**: `select('*').order('created_at', { ascending: false }).limit(5)`
    *   **Purpose**: Fetches the 5 most recent heat reports for the dashboard.
2.  **`risk_predictions`**:
    *   **Query**: `select('*').limit(1)`
    *   **Purpose**: Fetches the latest system risk prediction data.

### Error Handling
*   **Supabase Errors**: Explicitly caught in `fetchSupabaseData`. Errors are logged, and the app gracefully falls back to default/empty data arrays.
*   **Null Data**: The code explicitly checks `if (!data || data.length === 0)` before attempting to access array indices (e.g., `data[0]`).

## 5️⃣ Navigation Structure

### Expo Router
*   **Root Layout**: `app/_layout.jsx` initializes Providers (`Auth`, `Weather`) and Theme.
*   **Tab Layout**: `app/(tabs)/_layout.jsx` manages the main navigation bar.

### Route Protection
*   **Public-First**: The Home, Map, and Alerts screens are publicly accessible without login.
*   **Protected Routes**:
    *   **Profile Tab**: Checks `!session`. If no session, it accepts the navigation but renders the `<AuthScreen />` component instead of the profile content.
*   **Loading State**: Managed globally by `AuthContext`. The entire app tree waits for auth initialization before rendering.

## 6️⃣ Environment Setup

### Configuration
*   **Local Development**: Uses `.env` file to supply `EXPO_PUBLIC_` variables.
*   **Production (EAS)**:
    *   **Env Vars**: `EXPO_PUBLIC_` variables are natively supported by EAS Build. Secrets must be set via `eas secret:create`.
    *   **`app.json`**: Standard Expo configuration. Supports `expo-secure-store` plugin for auth persistence.

### Native Safety
*   **Dynamic Imports**: `app/_layout.jsx` dynamically imports `expo-notifications` and background services to prevent crashes in the **Expo Go** client, which might lack certain native permissions or background capabilities.

## 7️⃣ Crash Risk Analysis

### ✅ Mitigated Risks
*   **Undefined Env Vars**: **Fixed.** App now falls back to placeholders instead of crashing on Supabase client init.
*   **Null Data Access**: **Fixed.** `useWeather.js` safely checks array length before access.
*   **Unhandled Async Errors**: **Fixed.** Critical initialization logic in `AuthContext` and `useWeather` is wrapped in `try/catch` blocks.
*   **Auth Race Conditions**: **Fixed.** Loading gate prevents UI from rendering before `session` is defined.

### ⚠️ Residual Risks (Functional Only)
*   **Missing Credentials**: If the app is built without setting EAS secrets, it will **not crash**, but authentication and data fetching will fail (logged to console). This is a safe failure state.
*   **Empty Tables**: If Supabase tables are empty, the dashboard will show default "Stable" values. This is a safe UI state.

---
**Status**: The application architecture is robust and defensive. It is ready for EAS Build and production deployment, provided environment variables are correctly set in the EAS dashboard.
