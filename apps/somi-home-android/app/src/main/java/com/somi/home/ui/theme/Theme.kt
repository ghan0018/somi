package com.somi.home.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val SomiLightColorScheme = lightColorScheme(
    primary = SomiNavy,
    secondary = SomiTeal,
    tertiary = SomiGold,
    background = SomiMint,
    surface = SomiCardBg,
    onPrimary = SomiCardBg,
    onSecondary = SomiCardBg,
    onTertiary = SomiNavy,
    onBackground = SomiNavy,
    onSurface = SomiNavy,
    surfaceVariant = SomiMint,
    outline = SomiTeal
)

@Composable
fun SOMIHomeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SomiLightColorScheme,
        typography = SomiTypography,
        content = content
    )
}
