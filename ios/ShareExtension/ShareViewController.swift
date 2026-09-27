import UIKit
import UniformTypeIdentifiers

/// Share a WHOOP export straight from the WHOOP app (or Mail/Files). The extension never touches
/// credentials: it drops the file in the App Group inbox and the app uploads it on next open.
final class ShareViewController: UIViewController {
    private let label = UILabel()
    private let button = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0x06 / 255, green: 0x08 / 255, blue: 0x0F / 255, alpha: 1)

        label.textColor = UIColor(red: 0xE8 / 255, green: 0xEC / 255, blue: 1, alpha: 1)
        label.font = .preferredFont(forTextStyle: .headline)
        label.adjustsFontForContentSizeCategory = true
        label.numberOfLines = 0
        label.textAlignment = .center
        label.text = "Saving your WHOOP export…"

        button.setTitle("Done", for: .normal)
        button.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        button.tintColor = UIColor(red: 0x2F / 255, green: 0x7D / 255, blue: 1, alpha: 1)
        button.addAction(UIAction { [weak self] _ in self?.finish() }, for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [label, button])
        stack.axis = .vertical
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor, constant: -16),
        ])

        Task { await save() }
    }

    private func save() async {
        let ok = await saveFirstAttachment()
        label.text = ok
            ? "Saved. Open Shadow Forum to finish the upload — it starts automatically."
            : "That doesn't look like a WHOOP export. Share the .zip WHOOP emailed you."
        UIAccessibility.post(notification: .announcement, argument: label.text)
    }

    private func saveFirstAttachment() async -> Bool {
        let group = Bundle.main.object(forInfoDictionaryKey: "SFAppGroup") as? String ?? ""
        guard let inbox = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?
            .appending(path: "Inbox"),
            let items = extensionContext?.inputItems as? [NSExtensionItem]
        else { return false }

        let providers = items.flatMap { $0.attachments ?? [] }
        let types = [UTType.zip, .commaSeparatedText, .fileURL]
        for provider in providers {
            guard let type = types.first(where: { provider.hasItemConformingToTypeIdentifier($0.identifier) }) else { continue }
            guard let url = await loadFile(provider, type: type) else { continue }
            let ext = url.pathExtension.lowercased()
            guard ext == "zip" || ext == "csv" else { continue }
            do {
                try FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
                let dest = inbox.appending(path: "\(Int(Date().timeIntervalSince1970))-\(url.lastPathComponent)")
                try FileManager.default.copyItem(at: url, to: dest)
                return true
            } catch {
                continue
            }
        }
        return false
    }

    /// The provider's file is only valid inside the callback, so copy it out there.
    private func loadFile(_ provider: NSItemProvider, type: UTType) async -> URL? {
        await withCheckedContinuation { cont in
            _ = provider.loadFileRepresentation(for: type) { url, _, _ in
                guard let url else { return cont.resume(returning: nil) }
                let tmp = FileManager.default.temporaryDirectory.appending(path: url.lastPathComponent)
                try? FileManager.default.removeItem(at: tmp)
                do {
                    try FileManager.default.copyItem(at: url, to: tmp)
                    cont.resume(returning: tmp)
                } catch {
                    cont.resume(returning: nil)
                }
            }
        }
    }

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
