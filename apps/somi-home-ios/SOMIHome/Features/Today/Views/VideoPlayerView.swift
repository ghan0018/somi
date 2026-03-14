import SwiftUI
import AVKit
import Network

// MARK: - VideoPlayerView

struct VideoPlayerView: View {
    let mediaId: String

    @State private var player: AVPlayer?
    @State private var isOffline = false
    @State private var hasError = false
    /// Tracks whether the user has started playback. Once true, the play button
    /// overlay is dismissed and native AVKit controls take over.
    @State private var hasStartedPlayback = false

    var body: some View {
        ZStack {
            Color.black

            if isOffline {
                offlineView
            } else if hasError {
                errorView
            } else if let player {
                NativeVideoPlayer(player: player)
                // Show a persistent play button until the user taps — this
                // ensures the player looks interactive without requiring a tap
                // just to reveal the controls.
                if !hasStartedPlayback {
                    playButtonOverlay {
                        player.play()
                        hasStartedPlayback = true
                    }
                }
            } else {
                // Fetching signed URL
                ProgressView()
                    .tint(.white)
            }
        }
        .task {
            await loadVideoUrl()
        }
    }

    // MARK: - Sub-views

    private func playButtonOverlay(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(.black.opacity(0.5))
                    .frame(width: 64, height: 64)
                Image(systemName: "play.fill")
                    .font(.system(size: 28))
                    .foregroundColor(.white)
                    .offset(x: 3) // optical center for play triangle
            }
        }
        .buttonStyle(.plain)
    }

    private var offlineView: some View {
        VStack(spacing: 8) {
            Image(systemName: "wifi.slash")
                .font(.title2)
                .foregroundColor(.white.opacity(0.7))
            Text("Video unavailable offline")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var errorView: some View {
        VStack(spacing: 8) {
            Image(systemName: "play.slash")
                .font(.title2)
                .foregroundColor(.white.opacity(0.7))
            Text("Unable to load video")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Loading

    private func loadVideoUrl() async {
        let pathMonitor = NWPathMonitor()
        let connected = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            pathMonitor.pathUpdateHandler = { path in
                pathMonitor.cancel()
                continuation.resume(returning: path.status == .satisfied)
            }
            pathMonitor.start(queue: DispatchQueue(label: "com.somi.home.videoCheck"))
        }

        guard connected else {
            isOffline = true
            return
        }

        do {
            let response: VideoAccessResponse = try await APIClient.shared.fetch(
                Endpoint.accessUpload(uploadId: mediaId)
            )
            if let url = URL(string: response.accessUrl) {
                player = AVPlayer(url: url)
            } else {
                hasError = true
            }
        } catch APIError.networkUnavailable {
            isOffline = true
        } catch {
            hasError = true
        }
    }
}

// MARK: - NativeVideoPlayer (AVPlayerViewController wrapper)

/// Wraps AVPlayerViewController so we get native playback controls (play/pause,
/// scrubber, AirPlay) and the built-in fullscreen button out of the box.
struct NativeVideoPlayer: UIViewControllerRepresentable {
    let player: AVPlayer

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let vc = AVPlayerViewController()
        vc.player = player
        vc.showsPlaybackControls = true
        vc.videoGravity = .resizeAspect
        return vc
    }

    func updateUIViewController(_ uiViewController: AVPlayerViewController, context: Context) {
        uiViewController.player = player
    }
}
