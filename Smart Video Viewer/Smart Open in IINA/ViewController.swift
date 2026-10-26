//
//  ViewController.swift
//  Smart Open in IINA
//
//  Maintained by the Smart Video Viewer contributors.
//

import Cocoa
import SafariServices
import SwiftUI

let extensionBundleIdentifier = "com.local.smartopeniniina.Extension"

class ViewController: NSViewController {

    override func loadView() {
        let background = NSVisualEffectView(frame: NSRect(x: 0, y: 0, width: 420, height: 380))
        background.material = .underWindowBackground
        background.blendingMode = .behindWindow
        let content = NSHostingView(rootView: SetupView())
        content.frame = background.bounds
        content.autoresizingMask = [.width, .height]
        background.addSubview(content)
        view = background
    }

}

struct SetupView: View {
    @State private var enabled: Bool?

    var body: some View {
        VStack(spacing: 18) {
            Image(nsImage: NSApp.applicationIconImage)
                .resizable()
                .frame(width: 96, height: 96)
                .accessibilityHidden(true)
            Text("视频观影与 IINA")
                .font(.title2.weight(.semibold))
            Label(status, systemImage: enabled == true ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                .symbolRenderingMode(.multicolor)
                .font(.callout)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity)
                .glassSurface()
            Button("打开 Safari 扩展设置", action: openPreferences)
                .controlSize(.large)
                .keyboardShortcut(.defaultAction)
                .prominentGlassButton()
        }
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 32)
        .padding(.top, 36)
        .padding(.bottom, 28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear(perform: refresh)
        // The user enables the extension in Safari, then comes back here.
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in refresh() }
    }

    private var status: String {
        switch enabled {
        case true?: return "扩展已启用。打开有视频的网页，点击工具栏中的扩展图标，选择“进入独立观影”。已打开的网页需先刷新。"
        case false?: return "扩展尚未启用。请在 Safari 设置中启用，并允许访问需要观看视频的网站。"
        case nil: return "请在 Safari 设置的“扩展”中启用 Smart Open in IINA。"
        }
    }

    private func refresh() {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { state, error in
            DispatchQueue.main.async { enabled = error == nil ? state?.isEnabled : nil }
        }
    }

    private func openPreferences() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in
            DispatchQueue.main.async { NSApplication.shared.terminate(nil) }
        }
    }
}

private extension View {
    @ViewBuilder func glassSurface() -> some View {
        if #available(macOS 26, *) {
            glassEffect(.regular, in: .rect(cornerRadius: 18))
        } else {
            background(.quaternary, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }

    @ViewBuilder func prominentGlassButton() -> some View {
        if #available(macOS 26, *) {
            buttonStyle(.glassProminent)
        } else {
            buttonStyle(.borderedProminent)
        }
    }
}
