package com.somi.home

import androidx.activity.ComponentActivity
import dagger.hilt.android.AndroidEntryPoint

/**
 * A minimal Activity with no content, used as the host for Compose UI tests.
 * This is in the main source set so it runs in the app process during instrumented tests.
 */
@AndroidEntryPoint
class HiltComponentActivity : ComponentActivity()
