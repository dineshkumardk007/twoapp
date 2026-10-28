package app.two.android.features.sync

import android.annotation.SuppressLint
import android.app.ActivityManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import java.util.Locale

/**
 * The phone's own settings screens that decide whether Two may keep running
 * when it is closed: the battery exemption, notifications, and the extra
 * Autostart and background switches some brands add on top of Android's.
 *
 * Xiaomi, vivo and OPPO phones (and their sister brands) close apps that are
 * swiped away unless those switches are on, foreground service or not. Their
 * screens are other apps' activities whose names change between versions of
 * the phone's software, so each is tried in turn, and the app's own details
 * screen - which every phone has - is the last resort.
 */
object OemSettings {

    private val XIAOMI = setOf("xiaomi", "redmi", "poco")
    private val VIVO = setOf("vivo", "iqoo")
    private val OPPO = setOf("oppo", "realme", "oneplus")

    /** The brand family of this phone for the page's one-time card: xiaomi, vivo, oppo or "". */
    fun phoneFamily(): String = family(Build.MANUFACTURER, Build.BRAND)

    /**
     * The family from the maker and the brand, either of which may carry it:
     * a Redmi says Xiaomi as its maker, an iQOO says vivo.
     */
    fun family(manufacturer: String?, brand: String?): String {
        val names = listOf(manufacturer, brand).map { it.orEmpty().trim().lowercase(Locale.ROOT) }
        return when {
            names.any { it in XIAOMI } -> "xiaomi"
            names.any { it in VIVO } -> "vivo"
            names.any { it in OPPO } -> "oppo"
            else -> ""
        }
    }

    /** The brand's Autostart or background screen; true when any screen opened. */
    fun open(context: Context): Boolean {
        val pkg = context.packageName
        val screens = when (phoneFamily()) {
            "xiaomi" -> listOf(
                screen("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
                screen("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity")
                    .putExtra("package_name", pkg)
                    .putExtra("package_label", label(context))
            )
            "vivo" -> listOf(
                screen("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
                screen("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
                screen("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager")
            )
            "oppo" -> listOf(
                screen("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
                screen("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
                screen("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
                screen("com.oplus.battery", "com.oplus.powermanager.fuelgaue.PowerUsageModelActivity")
            )
            else -> emptyList()
        }
        for (intent in screens) {
            if (start(context, intent)) return true
        }
        return start(context, appDetails(context))
    }

    /**
     * Asks once to leave Two out of battery optimisation, which is what lets
     * a closed Two keep its connection through the phone's deep sleep.
     *
     * A phone set to "Restricted" for Two refuses its background service
     * outright, and the exemption prompt cannot change that, so it goes to
     * the app's details screen instead, where the battery choice is. True when
     * a screen opened; false when Two is already exempt.
     */
    @SuppressLint("BatteryLife")
    fun askBatteryExemption(context: Context): Boolean {
        val pkg = context.packageName
        if (isRestricted(context)) return start(context, appDetails(context))
        val power = context.getSystemService(PowerManager::class.java)
        if (power?.isIgnoringBatteryOptimizations(pkg) == true) return false
        return start(context, Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$pkg"))) ||
            start(context, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) ||
            start(context, appDetails(context))
    }

    /** Two's notification settings, for a "New message" notice the phone has blocked. */
    fun openNotificationSettings(context: Context): Boolean {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        return start(context, intent) || start(context, appDetails(context))
    }

    /** "Restricted" battery for Two in the phone's settings (Android 9 and later). */
    fun isRestricted(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return false
        val activities = context.getSystemService(ActivityManager::class.java) ?: return false
        return activities.isBackgroundRestricted
    }

    fun isIgnoringBattery(context: Context): Boolean {
        val power = context.getSystemService(PowerManager::class.java) ?: return false
        return power.isIgnoringBatteryOptimizations(context.packageName)
    }

    private fun screen(pkg: String, cls: String): Intent = Intent().setComponent(ComponentName(pkg, cls))

    private fun appDetails(context: Context): Intent =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))

    private fun label(context: Context): String = try {
        context.applicationInfo.loadLabel(context.packageManager).toString()
    } catch (_: Exception) {
        "Two"
    }

    /**
     * One screen, in its own task. A screen this phone does not have is
     * ActivityNotFoundException; one its maker has closed to other apps is
     * SecurityException. Either way the next one is tried.
     */
    private fun start(context: Context, intent: Intent): Boolean = try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    } catch (_: Exception) {
        false
    }
}
