# Security Audit Log - CoolCity Application
**Date:** March 2026
**Status:** Hardened & Ready for Deployment

## 1. Authentication & Session Management
- **Storage Strategy:** Implemented `ExpoSecureStoreAdapter` in `utils/supabase.js`. Real-time prioritization of hardware-encrypted `SecureStore`. Fallback to `AsyncStorage` on Android for payloads > 2k bytes to prevent session loss.
- **Session Injection:** Disabled `detectSessionInUrl` in Supabase client to prevent account takeover via malicious URL parameters.
- **Auth Flow:** Consistently use `supabase.auth.onAuthStateChange` to handle session lifecycles across components.

## 2. API & Backend Security (Edge Functions)
- **Identity Verification:** All routing requests in `get-route` are verified using `supabase.auth.getUser()`. Anonymous requests are rejected.
- **Abuse Prevention:** Implemented a daily quota (50 calls/day) per User ID stored in `api_usage` table.
- **Data Sanitization:** 
    - Incoming coordinates are verified as finite numbers.
    - Outgoing Google Maps payloads are stripped of sensitive metadata.
    - Navigation instructions are sanitized for XSS (preventing malicious HTML injection).
- **Error Handling:** Suppressed stack traces in production; generic error messages returned to clients.

## 3. Database Security (Supabase/PostGIS)
- **Row Level Security (RLS):**
    - `profiles`: Users can only read/update their own data.
    - `cooling_centers`: Public read (active only), Authenticated users can insert (crowdsourcing).
    - `api_usage`: Users can only query their own metrics.
    - `route_cache`: Shared cache (no PII), authenticated read-only.
- **Function Security:** Use `SECURITY DEFINER` with localized `search_path` to prevent search path hijacking.

## 4. Client-Side Resilience
- **Defense in Depth:** The `coolingCenterService.js` implements a 3-tier routing fallback:
    1. Secured Edge Function (Primary)
    2. Edge Function Proxy (Secondary)
    3. Direct Client Fetch (Tertiary)
    4. Polyline Fallback (Failsafe)
- **Deep Linking:** Hardened `app/_layout.jsx` to only route verified auth/recovery URLs, preventing open-redirect vulnerabilities.
- **OTA Updates:** Integrated `expo-updates` to ensure users are prompted to apply security patches immediately.

## 5. Vulnerabilities Addressed
| ID | Risk | Mitigation |
|---|---|---|
| CC-001 | Session Hijacking | Switched to SecureStore + Hybrid Adapter |
| CC-002 | API Abuse (routing) | Rate-limiting + Authenticated JWT check |
| CC-003 | XSS in Instructions | HTML Sanitization in Edge Function |
| CC-004 | IDOR in Profiles | Strict RLS using `auth.uid()` |
| CC-005 | PII Leakage | Cleared identifiable metadata from Maps responses |

## 6. Auditor Notes
- **Environment Variables:** Must be managed via EAS Secrets in production.
- **API Keys:** Google Maps keys are restricted to App ID/Bundle ID on the Google Cloud Console.
- **Supabase Keys:** Anon key used for client-side; service_role key restricted to Edge Functions only.
