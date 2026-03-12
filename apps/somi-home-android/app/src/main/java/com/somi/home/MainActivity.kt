package com.somi.home

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.somi.home.core.auth.AuthRepository
import com.somi.home.navigation.AppNavigation
import com.somi.home.ui.theme.SOMIHomeTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var authRepository: AuthRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SOMIHomeTheme {
                AppNavigation(authRepository = authRepository)
            }
        }
    }
}
