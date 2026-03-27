const ROUNDS = [
  { round: 1, target: "code.claude.com/docs/llms.txt", pages: 4, quality: 0.75, status: "PASS" },
  { round: 2, target: "code + platform llms.txt", pages: 17, quality: 0.76, status: "PASS" },
  { round: 3, target: "platform.claude.com (full)", pages: 38, quality: 0.73, status: "PASS" },
  { round: 4, target: "llms-full.txt (code 71 + platform 200)", pages: 271, quality: 0.74, status: "PASS" },
  { round: 5, target: "All 4 llms-full.txt files", pages: 2477, quality: 0.77, status: "PASS" },
];

export default function RoundsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Crawl Rounds</h1>
        <p className="text-zinc-400 mt-2">
          Quality progression across 5 iterative crawl rounds. Each round builds
          on the previous with context delta steering.
        </p>
      </div>

      {/* Quality trend */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase mb-4">Quality Trend</h2>
        <div className="flex items-end gap-2 h-40">
          {ROUNDS.map((r) => (
            <div key={r.round} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-xs text-zinc-500">{r.quality.toFixed(2)}</div>
              <div
                className="w-full bg-green-600 rounded-t"
                style={{ height: `${(r.quality / 1.0) * 100}%` }}
              />
              <div className="text-xs text-zinc-400">R{r.round}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-zinc-600 mt-2">
          <span>Threshold: 0.65</span>
          <span>All rounds PASS</span>
        </div>
      </div>

      {/* Round details */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left p-3 text-zinc-500 font-medium">Round</th>
              <th className="text-left p-3 text-zinc-500 font-medium">Target</th>
              <th className="text-right p-3 text-zinc-500 font-medium">Pages</th>
              <th className="text-right p-3 text-zinc-500 font-medium">Avg Quality</th>
              <th className="text-right p-3 text-zinc-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ROUNDS.map((r) => (
              <tr key={r.round} className="border-b border-zinc-800/50">
                <td className="p-3 text-white font-mono">Round {r.round}</td>
                <td className="p-3 text-zinc-400">{r.target}</td>
                <td className="p-3 text-right text-zinc-300">{r.pages.toLocaleString()}</td>
                <td className="p-3 text-right">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    r.quality >= 0.75 ? "bg-green-900/50 text-green-400" : "bg-yellow-900/50 text-yellow-400"
                  }`}>{r.quality.toFixed(2)}</span>
                </td>
                <td className="p-3 text-right">
                  <span className="text-green-400 font-medium">{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-700">
              <td className="p-3 text-white font-bold">Total</td>
              <td className="p-3 text-zinc-400">All sources</td>
              <td className="p-3 text-right text-white font-bold">
                {ROUNDS.reduce((s, r) => s + r.pages, 0).toLocaleString()}
              </td>
              <td className="p-3 text-right text-white font-bold">0.74</td>
              <td className="p-3 text-right text-green-400 font-bold">ALL PASS</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
