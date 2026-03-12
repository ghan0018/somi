import SwiftUI

struct MessagesView: View {
    @StateObject private var viewModel = MessagesViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if viewModel.isLoading && viewModel.messages.isEmpty {
                    Spacer()
                    ProgressView()
                    Spacer()
                } else if viewModel.thread == nil && !viewModel.isLoading {
                    EmptyStateView(
                        systemImage: "message",
                        title: "No Messages",
                        message: "Your therapist will start a conversation with you here."
                    )
                } else {
                    messagesList
                    inputBar
                }
            }
            .navigationTitle("Messages")
            .task {
                await viewModel.loadThread()
            }
        }
    }

    private var messagesList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                if viewModel.hasMore {
                    Button("Load older messages") {
                        Task { await viewModel.loadMore() }
                    }
                    .font(.footnote)
                    .foregroundColor(.somiTeal)
                    .padding(.top, 8)
                }

                LazyVStack(spacing: 8) {
                    ForEach(viewModel.messages) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
            .onChange(of: viewModel.messages.count) { _, _ in
                if let last = viewModel.messages.last {
                    withAnimation {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }

    private var inputBar: some View {
        HStack(spacing: 12) {
            TextField("Type a message...", text: $viewModel.inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...4)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(Color.gray.opacity(0.1))
                )

            Button {
                Task { await viewModel.sendMessage() }
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundColor(canSend ? .somiTeal : .gray.opacity(0.4))
            }
            .disabled(!canSend)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            Rectangle()
                .fill(Color.white)
                .shadow(color: .black.opacity(0.05), radius: 4, y: -2)
        )
    }

    private var canSend: Bool {
        !viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !viewModel.isSending
            && !viewModel.isOffline
    }
}

// MARK: - Message Bubble

private struct MessageBubble: View {
    let message: Message

    private var isFromPatient: Bool {
        message.senderRole == "client"
    }

    var body: some View {
        HStack {
            if isFromPatient { Spacer(minLength: 60) }

            VStack(alignment: isFromPatient ? .trailing : .leading, spacing: 4) {
                Text(message.text)
                    .font(.body)
                    .foregroundColor(isFromPatient ? .white : .primary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(isFromPatient ? Color.somiTeal : Color.gray.opacity(0.12))
                    )

                Text(formattedTime)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            if !isFromPatient { Spacer(minLength: 60) }
        }
    }

    private var formattedTime: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: message.createdAt) else {
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: message.createdAt) else {
                return ""
            }
            return timeString(from: date)
        }
        return timeString(from: date)
    }

    private func timeString(from date: Date) -> String {
        let display = DateFormatter()
        display.dateStyle = .none
        display.timeStyle = .short
        return display.string(from: date)
    }
}
