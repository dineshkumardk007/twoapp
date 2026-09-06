# Signing a release build

Debug builds need nothing here. This is only for the release APK or the AAB you
would upload to Play.

## Why it changed

The release build used to be signed with the debug keystore. That is worse than
being unsigned in both directions: the APK looked shippable when Play would
refuse it, and the debug key ships inside every copy of the Android SDK, so
anybody at all could sign an update over an installed copy.

The release build is now signed with a real key when one is configured, and left
unsigned when it is not — a failure you notice, because an unsigned APK will not
install.

## Create your key

Once, and then never again. **If you lose this file or its password you can
never update the app on Play** — the listing is tied to the key, not to your
account. Back it up somewhere you would not lose a passport.

```bash
keytool -genkeypair -v -keystore two-release.jks -keyalg RSA -keysize 4096 -validity 10000 -alias two
```

It will ask for a password and a few details. Keep the file outside the
repository — the `.gitignore` covers `*.jks` and `keystore.properties`, but the
safest place is somewhere the repo cannot reach at all.

## Point the build at it

Either create `two-android/keystore.properties`:

```properties
storeFile=/absolute/path/to/two-release.jks
storePassword=…
keyAlias=two
keyPassword=…
```

…or set `TWO_KEYSTORE_FILE`, `TWO_KEYSTORE_PASSWORD`, `TWO_KEY_ALIAS` and
`TWO_KEY_PASSWORD` in the environment, which is how a CI runner would pass them
as secrets. The properties file wins if both are present.

Then:

```bash
./gradlew assembleRelease
```

To confirm what signed it:

```bash
apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk
```

A debug-signed APK says `CN=Android Debug`. Yours should say whatever you typed
into keytool.
