plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.callcanary.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.callcanary.app"
        // Android 10 introduced the call screening role.
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        // The website's checking service (email, link and text analysis).
        buildConfigField("String", "API_BASE", "\"https://10-3-2026-utsahackathon.vercel.app\"")
        // Phones are ARM; x86_64 covers current emulators. 32-bit x86 (old emulators only) would add 10 MB of speech engine.
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64") }
    }

    buildTypes {
        release {
            // Shrinking drops unused code (most of the extended icon set): about 50 MB smaller.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Signed with the debug key so the APK can be sideloaded for demos; use a real key before any store release.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    // The FTC reported-numbers index is shared with the website: one file in the repo's data/ folder.
    sourceSets["main"].assets.srcDir("../../data")
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    // Call-screen icons for the demo (mute, keypad, speaker, end call).
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    debugImplementation("androidx.compose.ui:ui-tooling")
    // Offline speech recognition for live call protection (open source; the model downloads on first use).
    implementation("com.alphacephei:vosk-android:0.3.75@aar")
    implementation("net.java.dev.jna:jna:5.18.1@aar")

    testImplementation("junit:junit:4.13.2")
    // Real org.json for unit tests (the Android one is a stub off-device).
    testImplementation("org.json:json:20240303")
}
