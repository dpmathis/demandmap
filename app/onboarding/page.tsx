"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const VERTICALS = [
  { value: "coffee", label: "Coffee / Beverage", emoji: "&#9749;" },
  { value: "food_truck", label: "Food Truck", emoji: "&#127828;" },
  { value: "retail", label: "Retail Pop-Up", emoji: "&#128717;" },
  { value: "political", label: "Political Canvass", emoji: "&#128227;" },
  { value: "events", label: "Event Planning", emoji: "&#127914;" },
  { value: "custom", label: "Custom / Other", emoji: "&#9881;" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [invited, setInvited] = useState(false);
  const [invitedToOrg, setInvitedToOrg] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((d) => {
        if (d.invited) {
          setInvited(true);
          setInvitedToOrg(d.tenantName);
        }
      })
      .finally(() => setChecking(false));
  }, []);

  async function handleComplete() {
    setLoading(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, orgName, vertical }),
      });
    } catch { /* silent */ }
    router.push("/map");
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Simplified flow for invited users — just ask for name
  if (invited) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-white">You&apos;re invited!</h2>
              <p className="text-sm text-zinc-400 mt-1">
                You&apos;ve been added to <strong className="text-white">{invitedToOrg ?? "a team"}</strong> on NYC DemandMap.
              </p>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Your name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoFocus
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <button
              onClick={handleComplete}
              disabled={!name || loading}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {loading ? "Joining..." : "Join team"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full onboarding for new users
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex gap-2 mb-8 justify-center">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 w-12 rounded-full transition-colors ${i <= step ? "bg-teal-500" : "bg-zinc-800"}`}
            />
          ))}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white">Welcome to NYC DemandMap</h2>
                <p className="text-sm text-zinc-400 mt-1">What should we call you?</p>
              </div>
              <input
                type="text" value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoFocus
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={() => setStep(1)}
                disabled={!name}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Continue
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white">What are you planning for?</h2>
                <p className="text-sm text-zinc-400 mt-1">This customizes your demand model</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {VERTICALS.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => setVertical(v.value)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      vertical === v.value ? "border-teal-500 bg-teal-500/10" : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-lg" dangerouslySetInnerHTML={{ __html: v.emoji }} />
                    <p className="text-xs font-medium text-white mt-1">{v.label}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!vertical}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white">Name your organization</h2>
                <p className="text-sm text-zinc-400 mt-1">This is your team workspace</p>
              </div>
              <input
                type="text" value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Dan's Coffee Truck"
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={handleComplete}
                disabled={!orgName || loading}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {loading ? "Setting up..." : "Launch NYC DemandMap"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
