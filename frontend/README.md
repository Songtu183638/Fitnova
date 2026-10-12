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
