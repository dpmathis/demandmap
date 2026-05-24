//
//  DemandWidgetEntryView.swift
//  SwiftUI layout for the small Home Screen widget. Dark navy background
//  matches the app's login/dashboard theme.
//

import SwiftUI
import WidgetKit

struct DemandWidgetEntryView: View {
    var entry: DemandProvider.Entry

    private let background = Color(red: 10/255, green: 15/255, blue: 30/255)
    private let teal = Color(red: 20/255, green: 184/255, blue: 166/255)
    private let tealLight = Color(red: 45/255, green: 212/255, blue: 191/255)
    private let zinc = Color(red: 161/255, green: 161/255, blue: 170/255)

    var body: some View {
        ZStack(alignment: .topLeading) {
            background.ignoresSafeArea()
            // Subtle teal glow upper-left
            RadialGradient(
                gradient: Gradient(colors: [teal.opacity(0.18), .clear]),
                center: .topLeading,
                startRadius: 0,
                endRadius: 140
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Header pip
                HStack(spacing: 4) {
                    Circle()
                        .fill(teal)
                        .frame(width: 6, height: 6)
                    Text("HOT BLOCK")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .tracking(1.5)
                        .foregroundStyle(teal)
                }
                .padding(.bottom, 8)

                // Neighborhood name
                Text(entry.ntaName)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                    .multilineTextAlignment(.leading)

                if !entry.borough.isEmpty {
                    Text(entry.borough)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(zinc)
                        .padding(.top, 2)
                }

                Spacer(minLength: 4)

                // Score + window
                HStack(alignment: .bottom, spacing: 8) {
                    VStack(alignment: .leading, spacing: -2) {
                        Text("\(entry.score)")
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                            .foregroundStyle(tealLight)
                        Text("DEMAND")
                            .font(.system(size: 8, weight: .semibold, design: .monospaced))
                            .tracking(1)
                            .foregroundStyle(zinc)
                    }
                    Spacer()
                    Text(humanizedWindow(entry.timeWindow))
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundStyle(zinc)
                        .padding(.bottom, 2)
                }
            }
            .padding(14)
        }
        .containerBackground(for: .widget) {
            background
        }
    }

    private func humanizedWindow(_ tw: String) -> String {
        // "09-11" → "9a–11a", "13-15" → "1p–3p", etc.
        let parts = tw.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 2 else { return tw }
        return "\(formatHour(parts[0]))–\(formatHour(parts[1]))"
    }

    private func formatHour(_ h: Int) -> String {
        let suffix = h < 12 ? "a" : "p"
        let display = h <= 12 ? h : h - 12
        return "\(display)\(suffix)"
    }
}

#Preview(as: .systemSmall) {
    DemandMapWidget()
} timeline: {
    DemandEntry(date: .now, ntaName: "Midtown-Times Square", borough: "Manhattan", score: 98, timeWindow: "09-11", isPlaceholder: false)
    DemandEntry(date: .now, ntaName: "SoHo-Little Italy", borough: "Manhattan", score: 87, timeWindow: "13-15", isPlaceholder: false)
}
