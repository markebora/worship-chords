# Disciples — Android app (Capacitor) with push notifications

Do these once, in order. Only steps 4–6 need your computer's Android Studio.

## 1. Firebase: register the Android app
1. Firebase Console → your project → Project settings → General → **Add app → Android**.
2. Package name: `app.disciples.worship` (must match `appId` in `capacitor.config.json`).
3. Download **google-services.json** (keep it for step 5). Skip the "add SDK" steps.

## 2. Firebase: service account key for the server
Firebase Console → Project settings → **Service accounts → Generate new private key**.
Vercel → Project → Settings → Environment Variables → add
`FIREBASE_SERVICE_ACCOUNT_KEY` = the entire JSON file contents. (It's the same
JSON your GitHub reminders workflow already uses.)

## 3. Deploy the backend
Commit and push this project so Vercel redeploys. It now installs `firebase-admin`
and `/api/push-subscribe` accepts Android tokens.

## 4. Install tools
Node.js (LTS) and Android Studio (it installs its own JDK and the Android SDK).

## 5. Create the Android project
```
cd native
npm install @capacitor/core @capacitor/app @capacitor/push-notifications @capacitor/filesystem @capacitor/share
npm install -D @capacitor/cli
npx cap add android
```
Copy `google-services.json` into `native/android/app/`.

Copy the files from `native/android-extras/` into the Android project:
- `FolderSavePlugin.java` and `MainActivity.java` -> `android/app/src/main/java/app/disciples/worship/` (replace the generated MainActivity)
- In `android/app/build.gradle` add under `dependencies`: `implementation "androidx.documentfile:documentfile:1.0.1"`
- Add everything in `AndroidManifest-additions.xml` to `android/app/src/main/AndroidManifest.xml`
  (camera, microphone and notification permissions; without them the QR scanner and mic fail in the app).

Then, in that manifest, these two lines go inside the `<application>` tag (already in the file above):
```
<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="disciples-updates" />
<meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_name" />
```
For the second line, create the icon in Android Studio: right-click `res` →
New → Image Asset → Icon Type **Notification Icons**, name it `ic_stat_name`
(a simple white shape; colored images show as a white square on Android).

## 6. Build and install
After ANY change to plugins or the manifest you must run `npm run sync` and rebuild the APK.
```
npm run sync
npm run open
```
In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**, then copy the
APK to a phone. (To share beyond testing, use Build → Generate Signed Bundle / APK
and keep the keystore file safe — you need the same one for every future update.)

## 7. Test push
Open the app → Profile → Notifications → **Turn On** → allow. Then either run the
"Lineup reminders" workflow manually on GitHub, or:
```
curl -X POST https://worship-chords-rho.vercel.app/api/notify-new-song \
  -H "Content-Type: application/json" -H "X-Notify-Secret: YOUR_SECRET" \
  -d '{"title":"Test song","heading":"Test notification"}'
```
The response shows `fcm: { sent, total }` — `total` is how many Android devices are registered.

## Live site vs. bundled files
`capacitor.config.json` has `server.url`, so the app loads your live website: every
Vercel deploy updates everyone instantly, and offline works through your existing
service worker. To ship the files inside the APK instead, delete the `"server"` block
and run `npm run sync` (then each index.html change needs a new APK).

## Changing the package name
Only before step 5's `npx cap add android`: edit `appId` here and use the same name in
step 1. (The old TWA used `app.vercel.worship_chords_rho.twa`; using a new name means
people install the new app next to the old one, then delete the old one.)

## Build the APK on GitHub (no Android Studio)
The workflow `.github/workflows/build-android.yml` creates the Android project, adds the
plugins/permissions and builds the APK. Set it up once:

1. GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret:
   - `GOOGLE_SERVICES_JSON_BASE64` (required): `base64 -w0 google-services.json`
   - `DEBUG_KEYSTORE_BASE64` (recommended): makes every build use the same signing key so a
     new APK installs OVER the old one. Create once with:
     `keytool -genkey -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"`
     then `base64 -w0 debug.keystore`. Keep that file safe.
2. Actions tab -> **Build Android APK** -> Run workflow.
3. When it finishes, open the run and download the **Disciples-apk** artifact (zip), unzip and install the APK.

It also runs automatically on pushes that change `native/`. Normal web changes (index.html)
don't need a new APK, since the app loads the live site.
