plugins {
    id("com.android.application") version "8.13.2" apply false
}

tasks.register("clean", Delete::class) {
    delete(rootProject.layout.buildDirectory)
}
