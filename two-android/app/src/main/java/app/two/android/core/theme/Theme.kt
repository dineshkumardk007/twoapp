package app.two.android.core.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

enum class AppThemeMode {
    WARM_LINEN,
    MIDNIGHT_SLATE,
    FOREST_MIST,
    KYOTO_TERRACOTTA
}

private val LinenColorScheme = lightColorScheme(
    background = LinenBackground,
    surface = LinenSurface,
    surfaceVariant = LinenSurfaceVariant,
    primary = LinenPrimary,
    secondary = LinenSecondary,
    tertiary = LinenAccent,
    outline = LinenBorder
)

private val SlateColorScheme = darkColorScheme(
    background = SlateBackground,
    surface = SlateSurface,
    surfaceVariant = SlateSurfaceVariant,
    primary = SlatePrimary,
    secondary = SlateSecondary,
    tertiary = SlateAccent,
    outline = SlateBorder
)

private val ForestColorScheme = lightColorScheme(
    background = ForestBackground,
    surface = ForestSurface,
    primary = ForestPrimary,
    secondary = ForestSecondary,
    tertiary = ForestAccent
)

private val TerracottaColorScheme = lightColorScheme(
    background = TerracottaBackground,
    surface = TerracottaSurface,
    primary = TerracottaPrimary,
    secondary = TerracottaSecondary,
    tertiary = TerracottaAccent
)

@Composable
fun TwoTheme(
    themeMode: AppThemeMode = AppThemeMode.WARM_LINEN,
    content: @Composable () -> Unit
) {
    val colorScheme = when (themeMode) {
        AppThemeMode.WARM_LINEN -> LinenColorScheme
        AppThemeMode.MIDNIGHT_SLATE -> SlateColorScheme
        AppThemeMode.FOREST_MIST -> ForestColorScheme
        AppThemeMode.KYOTO_TERRACOTTA -> TerracottaColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = SpaceTypography,
        content = content
    )
}
