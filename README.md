# NUSHOPA API

Run the backend checks with `npm run validate`. The unit tests cover the
health and not-found routes; the production smoke test runs the health check
with `NODE_ENV=production`. These checks are also run by the backend CI
workflow and do not require a live database.

## Firebase Admin (FCM)

The backend uses the same Firebase Admin initializer for local and production
push notifications.

- Locally, place the Firebase service-account JSON at the ignored
  `serviceAccountKey.json` in the backend root. This file is preferred over
  split credential variables, so the same project and key are used consistently.
- In production, mount the same service-account JSON at
  `/etc/secrets/serviceAccountKey.json`, or set
  `FIREBASE_SERVICE_ACCOUNT_PATH` (or `GOOGLE_APPLICATION_CREDENTIALS`) to its
  mounted path. Alternatively, configure `FIREBASE_PROJECT_ID`,
  `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` as hosting-platform
  secrets. The key file is never copied into the Docker image.
- Do not commit service-account credentials. Startup fails with a clear error
  if the credentials are missing or incomplete.

The runtime is Node.js 22, which is required by the installed Firebase Admin
SDK.

## Local order and payment testing

- Start the storefront with `npm run dev` in `nushopa`; it uses
  `http://localhost:5173`. Its local `.env` should point `VITE_BASE_URL` to
  `http://localhost:3000/`.
- Start the backend with `npm run dev` in `farm2home-backend`; it loads `.env`.
  Set local `F_URL` to `http://localhost:5173/`, `SQUAD_BASE_URL` to Squad's
  sandbox API, and `SQUAD_SECRET_KEY` to a sandbox secret key. Keep
  `.env.production` pointed at the production storefront and Squad API.
- Use a development/test Mongo database with a customer cart, delivery address,
  and `PriceList` entry for that address's city. The order total and delivery
  availability are computed from these records by the backend.
- The web checkout requests standard and fast quotes from
  `POST /checkout/delivery-options`. Standard delivery uses the city's
  `PriceList.estimatePrice`; fast delivery is optional and can be configured by
  an admin in the dashboard. The customer checkout sends the selected quote ID
  to payment initialization, and the backend snapshots its delivery mode and
  fee into the pending and fulfilled order. Quotes expire after 15 minutes.
- The provider integration uses a generic contract: the backend POSTs
  `{ "deliveryMode": "fast", "address": { ... }, "currency": "NGN" }` to the
  configured endpoint with `Authorization: Bearer <API key>`. The provider
  must return a JSON response whose configured fee path (default `amount`) is
  a non-negative amount in naira, for example `{ "data": { "amount": 2500 } }`
  with fee path `data.amount`. The API key is never returned by the admin
  settings endpoint or sent to the browser. The provider endpoint must use
  HTTPS in production.
- The local callback returns to `/order-status/:reference`; that page polls the
  backend, which verifies pending payments with Squad. The Squad webhook cannot
  reach a private localhost server unless you expose a public development
  tunnel, but polling is the local fallback.

## Push notifications and analytics

- Email is sent through Resend; SMTP is not used. Configure `RESEND_API_KEY`
  and `RESEND_FROM` in the backend's local `.env` and `.env.production` files.
  `RESEND_FROM` must be a sender identity verified for your Resend domain, for
  example `Nushopa <info@nushopa.com>`. Configure both as backend-only
  environment secrets in production. Never put the Resend API key in a web or
  mobile app. Missing configuration and Resend delivery failures are reported
  by the sending flow; notification delivery failures are logged without
  suppressing the corresponding in-app notification.
- All four web apps use Firebase project `nushopa-3e02e`. Each web app needs
  `VITE_FIREBASE_VAPID_KEY` (the project's public Web Push certificate) and
  `VITE_BASE_URL` (the backend URL). Set both in local and deployed web-app
  environments. The VAPID key is public; Firebase service-account credentials
  must remain backend-only.
- Customer and merchant mobile apps use Expo push tokens, delivered by the
  backend through Expo Push Service. Their Expo configuration must include the
  EAS project ID and Firebase native service files matching each app's bundle
  identifiers. The merchant app is configured as
  `com.believefuture.merchant`; build a new native binary after changing native
  identifiers or service files.
- For store builds, configure the iOS APNs key and Android FCM v1 credentials
  in EAS, then create fresh iOS/Android builds. These credentials are separate
  from the Firebase client configuration files.
- The backend Firebase Admin service-account key previously shared outside the
  backend must be revoked and replaced. Configure the replacement only as a
  backend secret/file; never add it to a web app or EAS.
- Verify end-to-end by enabling notifications while signed in, confirming the
  device is associated with the expected backend user, and sending test
  notifications to a physical mobile device and supported browser. A web push
  test requires HTTPS (localhost is also supported by browsers).
- The mobile apps expose an opt-in Google Analytics setting. Web analytics
  reuses each web app's existing GA4 property. No SMS provider or SMS delivery
  is used.
