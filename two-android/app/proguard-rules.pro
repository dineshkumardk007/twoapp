# Two ProGuard Rules for Libsodium, SQLCipher, and Tink

# Libsodium / Lazysodium
-keep class com.goterl.lazysodium.** { *; }
-keep class com.sun.jna.** { *; }
-dontwarn com.sun.jna.**

# SQLCipher
-keep class net.zetetic.database.sqlcipher.** { *; }
-dontwarn net.zetetic.database.sqlcipher.**

# Google Tink
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.crypto.tink.**

# Kotlin Serialization
-keepattributes *Annotation*,InnerClasses
-dontnote kotlinx.serialization.SerializationKt
-keepclassmembers class * {
    @kotlinx.serialization.Serializable <fields>;
}

# Keep data models
-keep class app.two.android.core.database.** { *; }
-keep class app.two.android.core.crypto.** { *; }

# The WebView bridge.
# The web app calls these methods by name from JavaScript, which the shrinker
# cannot see - without this it removes or renames every one of them, and the
# release app loses speaker switching, headset detection, the call keep-alive
# and the proximity sensor without a single error anywhere.
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Media3 (live radio) brings Guava, whose compile-time-only annotations are
# not on the runtime classpath; R8 would otherwise stop on the missing classes.
-dontwarn com.google.errorprone.annotations.**
-dontwarn com.google.j2objc.annotations.**
-dontwarn org.checkerframework.**
-dontwarn javax.annotation.**
-dontwarn org.codehaus.mojo.animal_sniffer.**
