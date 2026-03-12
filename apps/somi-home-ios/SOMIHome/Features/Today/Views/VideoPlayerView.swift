import SwiftUI
import AVKit
import Network

struct VideoPlayerView: View {
    let mediaId: String

    @State private var accessUrl: String?
    @State private var isOffline = false
    @State private var isLoadingUrl = true
    @State private var player: AVPlayer?

    var body: some View {
        Group {
            if isOffline {
                offlineView
            } else if let player {
                VideoPlayer(player: player)
            } else if isLoadingUrl {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black.opacity(0.05))
            } else {
                errorView
            }
        }
        .task {
            await loadVideoUrl()
        }
    }

    private var offlineView: some View {
        VStack(spacing: 8) {
            Image(systemName: "wifi.slash")
                .font(.title2)
                .foregroundColor(.secondary)
            Text("Video unavailable offline")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.gray.opacity(0.1))
    }

    private var errorView: some View {
        VStack(spacing: 8) {
            Image(systemName: "play.slash")
                .font(.title2)
                .foregroundColor(.secondary)
            Text("Unable to load video")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.gray.opacity(0.1))
    }

    private func loadVideoUrl() async {
        // Quick connectivity check
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
            isLoadingUrl = false
            return
        }

        do {
            let response: VideoAccessResponse = try await APIClient.shared.fetch(
                Endpoint.accessUpload(uploadId: mediaId)
            )
            accessUrl = response.accessUrl
            if let url = URL(string: response.accessUrl) {
                player = AVPlayer(url: url)
            }
        } catch APIError.networkUnavailable {
            isOffline = true
        } catch {
            // leave accessUrl nil, show error
        }

        isLoadingUrl = false
    }
}
