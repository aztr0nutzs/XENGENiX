# XENO-GENICS - WebView wrapper
-keep class android.webkit.** { *; }
-dontwarn android.webkit.**

# Keep app classes (safe default early on)
-keep class com.example.xenogenics.** { *; }

# If you later embed JS bridges (addJavascriptInterface), keep those annotated methods:
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
