package com.somi.home.features.today

import android.app.Activity
import android.content.pm.ActivityInfo
import android.view.ViewGroup
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.somi.home.R
import com.somi.home.ui.components.LoadingSkeleton
import com.somi.home.ui.components.ParameterChipsRow
import com.somi.home.ui.theme.SomiTeal

@kotlin.OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExerciseDetailScreen(
    viewModel: ExerciseDetailViewModel = hiltViewModel(),
    onBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val isOnline by viewModel.isOnline.collectAsStateWithLifecycle()
    val context = LocalContext.current

    var isVideoFullscreen by remember { mutableStateOf(false) }

    // Sync orientation on every recomposition — avoids disposal ordering races
    SideEffect {
        (context as? Activity)?.requestedOrientation = if (isVideoFullscreen)
            ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        else
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    }

    // Restore unspecified orientation when leaving this screen entirely
    DisposableEffect(Unit) {
        onDispose {
            (context as? Activity)?.requestedOrientation =
                ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }

    // Back press in fullscreen exits fullscreen instead of navigating back
    BackHandler(enabled = isVideoFullscreen) {
        isVideoFullscreen = false
    }

    // Full-screen video overlay — covers the entire window including top bar
    if (isVideoFullscreen) {
        val videoUrl = (uiState as? ExerciseDetailUiState.Success)?.videoUrl
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            VideoPlayerComposable(
                videoUrl = videoUrl,
                isOnline = isOnline,
                isFullscreen = true,
                // ExoPlayer's new PlayerView starts in "not fullscreen" internally, so any
                // button tap in this overlay should always exit fullscreen
                onToggleFullscreen = { isVideoFullscreen = false },
                modifier = Modifier.fillMaxSize()
            )
        }
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    val title = (uiState as? ExerciseDetailUiState.Success)?.title ?: ""
                    Text(title)
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        }
    ) { padding ->
        when (val state = uiState) {
            is ExerciseDetailUiState.Loading -> LoadingSkeleton(modifier = Modifier.padding(padding))

            is ExerciseDetailUiState.Error -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = state.message,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            is ExerciseDetailUiState.Success -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                ) {
                    if (state.mediaId != null) {
                        VideoPlayerComposable(
                            videoUrl = state.videoUrl,
                            isOnline = isOnline,
                            isFullscreen = false,
                            onToggleFullscreen = { isVideoFullscreen = it },
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(16f / 9f)
                        )
                    }

                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = state.title,
                            style = MaterialTheme.typography.headlineMedium
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        ParameterChipsRow(params = state.params)

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = state.description,
                            style = MaterialTheme.typography.bodyLarge
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = "${state.completedCount} / ${state.totalCount} completed",
                            style = MaterialTheme.typography.labelLarge,
                            color = SomiTeal
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = { viewModel.toggleComplete() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (state.isCompleteForCurrentOccurrence)
                                    SomiTeal.copy(alpha = 0.7f)
                                else
                                    SomiTeal
                            )
                        ) {
                            if (state.isCompleteForCurrentOccurrence) {
                                Icon(
                                    Icons.Filled.CheckCircle,
                                    contentDescription = null,
                                    modifier = Modifier.size(20.dp),
                                    tint = Color.White
                                )
                                Spacer(modifier = Modifier.size(8.dp))
                                Text(
                                    text = "Completed \u2014 Tap to Undo",
                                    color = Color.White,
                                    fontWeight = FontWeight.Medium
                                )
                            } else {
                                Text(stringResource(R.string.mark_complete), color = Color.White)
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(UnstableApi::class)
@Composable
fun VideoPlayerComposable(
    videoUrl: String?,
    isOnline: Boolean,
    isFullscreen: Boolean = false,
    onToggleFullscreen: (Boolean) -> Unit = {},
    modifier: Modifier = Modifier
) {
    if (!isOnline) {
        Box(modifier = modifier, contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = Icons.Default.WifiOff,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = SomiTeal.copy(alpha = 0.5f)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.video_offline_message),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }
        }
        return
    }

    if (videoUrl == null) {
        Box(modifier = modifier, contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = SomiTeal, modifier = Modifier.size(32.dp))
        }
        return
    }

    var player by remember { mutableStateOf<ExoPlayer?>(null) }
    val context = LocalContext.current

    DisposableEffect(videoUrl) {
        val exoPlayer = ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(videoUrl))
            prepare()
        }
        player = exoPlayer
        onDispose {
            exoPlayer.release()
            player = null
        }
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                this.player = player
                useController = true
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                setFullscreenButtonClickListener { enterFullscreen ->
                    onToggleFullscreen(enterFullscreen)
                }
            }
        },
        modifier = modifier,
        update = { view -> view.player = player }
    )
}
