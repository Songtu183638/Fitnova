# FITNOVA frontend

Responsive Korean React web app with a black/neon-green visual system. The same Vite build can be packaged for Android using Capacitor.

## Run locally
```bash
npm install
npm run dev
```

Set `VITE_API_URL` to the deployed FastAPI base URL (without trailing slash). Local default is `http://localhost:8000`.

## Android shell
```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
Use Android Studio to configure the SDK and generate an APK/AAB. Do not set a production API to localhost; configure `VITE_API_URL` before building for a device.

## Android push notifications
1. Create a Firebase project and register an Android app with package ID `com.fitnova.app`.
2. Download that app's `google-services.json` into `frontend/android/app/` after running `npx cap add android`. Enable Firebase Cloud Messaging for the project, then sync and rebuild the APK.
3. Install `firebase-admin` on the API server and set `FIREBASE_SERVICE_ACCOUNT_JSON` to the Firebase Admin service-account JSON. Store it only in the hosting provider's secret environment settings; never commit it.
4. Sign in to FITNOVA on the installed APK and choose **설정 → 휴대폰 알림 켜기**. Allow notifications when Android asks.

The server associates each FCM token with the authenticated account and sends a notification for each new DM. Opening a conversation marks incoming messages as read; the sender then sees **읽음** in the conversation. The thread list shows unread counts. Push delivery requires both Firebase app configuration in the APK and Admin credentials on the server.

