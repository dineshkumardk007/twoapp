import java.io.FileInputStream
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

android {
    namespace = "app.two.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.two.android"
        minSdk = 26
        targetSdk = 35
        /*
         * Numbered by the CI build that made it, so two phones can tell
         * whether they are running the same build (Android settings -> Apps
         * -> Two shows it). GitHub's run number only ever goes up, which is
         * also what Android needs to accept each build as an update - so
         * keep the workflow file's name: a new one would count from 1 again
         * and phones would refuse its builds as downgrades. A build on a
         * developer's machine has no run number and stays at 1.
         */
        val buildNumber = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }


    /**
     * Release signing, supplied from outside the repository.
     *
     * Read from keystore.properties beside the project, or from the
     * environment so a CI runner can pass it as secrets. Neither the keystore
     * nor its passwords belong in version control.
     */
    val keystoreProperties = Properties().apply {
        val file = rootProject.file("keystore.properties")
        if (file.exists()) FileInputStream(file).use { load(it) }
    }

    fun signingValue(key: String, environmentVariable: String): String? =
        keystoreProperties.getProperty(key) ?: System.getenv(environmentVariable)

    val releaseStoreFile = signingValue("storeFile", "TWO_KEYSTORE_FILE")
    val hasReleaseKeystore = releaseStoreFile != null && file(releaseStoreFile).exists()

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = file(releaseStoreFile!!)
                storePassword = signingValue("storePassword", "TWO_KEYSTORE_PASSWORD")
                keyAlias = signingValue("keyAlias", "TWO_KEY_ALIAS")
                keyPassword = signingValue("keyPassword", "TWO_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            /*
             * Signed with the real key when one is configured, and left
             * unsigned when it is not.
             *
             * This used to fall back to the debug keystore, which is worse than
             * being unsigned in both directions: the APK looked shippable while
             * Play would refuse it, and because the debug key ships inside every
             * Android SDK, anyone at all could sign an update over the top of an
             * installed copy. An unsigned APK simply cannot be installed, which
             * is a failure you notice.
             */
            signingConfig = if (hasReleaseKeystore) signingConfigs.getByName("release") else null
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api",
            "-opt-in=kotlinx.coroutines.ExperimentalCoroutinesApi"
        )
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // Core & Lifecycle
    implementation(libs.androidx.core.ktx)
    // The launch screen: the leaf on linen, held until the page has drawn
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    // Jetpack Compose & Material 3
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)

    // Room Database
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    // Background Sync & WorkManager
    implementation(libs.androidx.work.runtime.ktx)


    // Security & Biometrics
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.webkit)

    // Live radio that keeps playing with the app in the background
    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.androidx.media3.exoplayer.hls)
    implementation(libs.androidx.media3.session)

    implementation(libs.zxing.core)

    // Coroutines & Serialization
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    // Testing
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}
