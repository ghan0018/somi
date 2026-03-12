import Foundation

@MainActor
final class MessagesViewModel: ObservableObject {
    @Published var thread: MessageThread?
    @Published var messages: [Message] = []
    @Published var inputText = ""
    @Published var isLoading = false
    @Published var isSending = false
    @Published var errorMessage: String?
    @Published var hasMore = false
    @Published var isOffline = false

    private var nextCursor: String?

    func loadThread() async {
        isLoading = true
        errorMessage = nil

        do {
            let threadResponse: MessageThread = try await APIClient.shared.fetch(Endpoint.getThread())
            thread = threadResponse
            await loadMessages(threadId: threadResponse.threadId)
        } catch APIError.serverError(404) {
            // No thread yet
            thread = nil
        } catch APIError.networkUnavailable {
            isOffline = true
            errorMessage = "No internet connection."
        } catch {
            errorMessage = "Failed to load messages."
        }

        isLoading = false
    }

    func loadMessages(threadId: String) async {
        do {
            let paged: PagedMessages = try await APIClient.shared.fetch(
                Endpoint.listMessages(threadId: threadId, cursor: nil, limit: 50)
            )
            messages = paged.items.reversed()
            nextCursor = paged.nextCursor
            hasMore = paged.nextCursor != nil
        } catch {
            errorMessage = "Failed to load messages."
        }
    }

    func loadMore() async {
        guard let thread, let cursor = nextCursor else { return }

        do {
            let paged: PagedMessages = try await APIClient.shared.fetch(
                Endpoint.listMessages(threadId: thread.threadId, cursor: cursor, limit: 50)
            )
            let older = paged.items.reversed()
            messages.insert(contentsOf: older, at: 0)
            nextCursor = paged.nextCursor
            hasMore = paged.nextCursor != nil
        } catch {
            // Silently fail on load more
        }
    }

    func sendMessage() async {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, let thread else { return }

        isSending = true
        inputText = ""

        do {
            let sent: Message = try await APIClient.shared.fetch(
                Endpoint.sendMessage(threadId: thread.threadId, text: text)
            )
            messages.append(sent)
        } catch APIError.networkUnavailable {
            isOffline = true
            inputText = text // restore input
        } catch {
            errorMessage = "Failed to send message."
            inputText = text
        }

        isSending = false
    }
}
