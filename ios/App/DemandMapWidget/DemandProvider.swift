//
//  DemandProvider.swift
//  TimelineProvider that fetches the current top demand block from the API
//  and emits an entry. WidgetKit refreshes ~every 30 minutes per the policy
//  set in getTimeline.
//

import WidgetKit
import Foundation

struct DemandEntry: TimelineEntry {
    let date: Date
    let ntaName: String
    let borough: String
    let score: Int
    let timeWindow: String
    let isPlaceholder: Bool
}

struct DemandProvider: TimelineProvider {
    private let apiURL = URL(string: "https://demandmap.vercel.app/api/widget/today")!

    func placeholder(in context: Context) -> DemandEntry {
        DemandEntry(
            date: Date(),
            ntaName: "Midtown",
            borough: "Manhattan",
            score: 92,
            timeWindow: "09-11",
            isPlaceholder: true
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (DemandEntry) -> Void) {
        if context.isPreview {
            completion(placeholder(in: context))
            return
        }
        Task {
            let entry = await fetchEntry()
            completion(entry)
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DemandEntry>) -> Void) {
        Task {
            let entry = await fetchEntry()
            let nextRefresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
            let timeline = Timeline(entries: [entry], policy: .after(nextRefresh))
            completion(timeline)
        }
    }

    private func fetchEntry() async -> DemandEntry {
        do {
            var request = URLRequest(url: apiURL)
            request.timeoutInterval = 10
            request.cachePolicy = .reloadIgnoringLocalCacheData
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                return errorEntry()
            }
            let decoded = try JSONDecoder().decode(WidgetResponse.self, from: data)
            guard let top = decoded.topBlock else {
                return DemandEntry(
                    date: Date(),
                    ntaName: "No data",
                    borough: "",
                    score: 0,
                    timeWindow: decoded.timeWindow ?? "—",
                    isPlaceholder: false
                )
            }
            return DemandEntry(
                date: Date(),
                ntaName: top.ntaName,
                borough: top.borough,
                score: top.score,
                timeWindow: top.timeWindow,
                isPlaceholder: false
            )
        } catch {
            return errorEntry()
        }
    }

    private func errorEntry() -> DemandEntry {
        DemandEntry(
            date: Date(),
            ntaName: "—",
            borough: "",
            score: 0,
            timeWindow: "—",
            isPlaceholder: false
        )
    }
}

private struct WidgetResponse: Decodable {
    let topBlock: TopBlock?
    let timeWindow: String?
}

private struct TopBlock: Decodable {
    let ntaName: String
    let borough: String
    let score: Int
    let timeWindow: String
}
