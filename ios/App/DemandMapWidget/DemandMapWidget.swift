//
//  DemandMapWidget.swift
//  Home Screen widget showing today's top demand block in NYC for the
//  current time-of-day window. Polls demandmap.vercel.app/api/widget/today
//  every ~30 min.
//

import WidgetKit
import SwiftUI

@main
struct DemandMapWidget: Widget {
    let kind: String = "DemandMapWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DemandProvider()) { entry in
            DemandWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Today's Top Demand")
        .description("Where to be in NYC right now.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}
