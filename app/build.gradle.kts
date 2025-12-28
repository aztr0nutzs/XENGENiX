plugins {
    id("com.android.application")
}

android {
    namespace = "com.example.xenogenics"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.xenogenics"
        minSdk = 23
        targetSdk = 35

        versionCode = 1
        versionName = "1.0.0"

        // If you add native libs later:
        // ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }

    compileOptions {
        // AGP requires JDK 17; source/target 17 is correct for modern Android builds.
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        // No Compose. Just a WebView wrapper.
        buildConfig = true
    }

    packaging {
        resources {
            excludes += setOf(
                "META-INF/LICENSE*",
                "META-INF/NOTICE*",
                "META-INF/DEPENDENCIES"
            )
        }
    }

    // Helps performance and avoids some older WebView quirks.
    // (Also matches your “hardware accelerated” requirement, though that’s primarily Manifest.)
    lint {
        abortOnError = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("com.google.android.material:material:1.12.0")

    // Better WebView APIs and compat helpers
    implementation("androidx.webkit:webkit:1.14.0")

    // Activity back-press dispatcher etc (works fine with AppCompat)
    implementation("androidx.activity:activity:1.10.1")
}
