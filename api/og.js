export const config = { runtime: "edge" };
import { ImageResponse } from "@vercel/og";

export default async function handler(req) {
    if (req.method === "POST") {
        try {
            const { bets = [], balance, roi } = await req.json();
            const slipBets = bets.slice(0, 5); // max 5 on the slip

            return new ImageResponse(
                <div
                    style={{
                        display: "flex", flexDirection: "column",
                        width: "1200px", height: "630px",
                        background: "#0d1117",
                        fontFamily: "monospace",
                        padding: "48px",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
                        <div style={{ fontSize: 32, fontWeight: 900, color: "#00d4aa", letterSpacing: 6 }}>
                            ±PLUSMINUS
                        </div>
                        <div style={{ fontSize: 14, color: "#546480", marginLeft: "auto" }}>
                            Paper Bet Slip
                        </div>
                    </div>

                    {slipBets.map((b, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #2e3a50" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                <div style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 600 }}>{b.pick}</div>
                                <div style={{ color: "#546480", fontSize: 12, marginTop: 4 }}>{b.matchup}</div>
                            </div>
                            <div style={{ textAlign: "right", display: "flex", flexDirection: "column" }}>
                                <div style={{ color: "#00d4aa", fontSize: 16, fontWeight: 700 }}>
                                    {b.odds > 0 ? "+" : ""}{b.odds}
                                </div>
                                <div style={{ color: "#7d91ab", fontSize: 12 }}>{b.stake} PMC</div>
                            </div>
                        </div>
                    ))}

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", paddingTop: 24 }}>
                        <div style={{ color: "#546480", fontSize: 13 }}>
                            Balance: <span style={{ color: "#e2e8f0" }}>{balance} PMC</span>
                        </div>
                        <div style={{ color: roi >= 0 ? "#10b981" : "#f43f5e", fontSize: 18, fontWeight: 700 }}>
                            ROI: {roi >= 0 ? "+" : ""}{roi}%
                        </div>
                    </div>
                </div>,
                { width: 1200, height: 630 }
            );
        } catch (e) {
            return new Response(`Failed to generate the slip`, { status: 500 });
        }
    }

    try {
        const { searchParams } = new URL(req.url);
        // ... existing GET logic ...
        const matchup = searchParams.get("matchup") || "Matchup";
        const team = searchParams.get("team") || "";
        const player = searchParams.get("player");
        const market = searchParams.get("market");
        const odds = searchParams.get("odds") || "";
        const stake = searchParams.get("stake") || "0";
        const result = searchParams.get("result") || "pending";
        const date = searchParams.get("date") || "";
        
        let plText = "";
        let resultColor = "#546480"; // pending (gray)
        let plColor = "#546480";
        let badgeText = "PENDING";
        
        if (result === "win") {
             resultColor = "#10b981"; // win (green)
             plColor = "#10b981";
             badgeText = "WIN";
             const nOdds = parseFloat(odds);
             const nStake = parseFloat(stake);
             const profit = nOdds > 0 ? nStake * (nOdds / 100) : nStake * (100 / Math.abs(nOdds));
             plText = `+$${profit.toFixed(2)}`;
        } else if (result === "loss") {
             resultColor = "#f43f5e"; // loss (red)
             plColor = "#f43f5e";
             badgeText = "LOSS";
             plText = `-$${parseFloat(stake).toFixed(2)}`;
        } else {
             const nOdds = parseFloat(odds);
             const nStake = parseFloat(stake);
             if (!isNaN(nOdds) && !isNaN(nStake) && nStake > 0) {
                 const toWin = nOdds > 0 ? nStake * (nOdds / 100) : nStake * (100 / Math.abs(nOdds));
                 plText = `+$${toWin.toFixed(2)}`;
             }
        }

        const titleText = player ? `${player} ${market}` : matchup;
        const subTitle = player ? matchup : team;

        return new ImageResponse(
            (
                <div
                    style={{
                        height: "100%",
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        backgroundColor: "#0d1117",
                        backgroundImage: "radial-gradient(circle at 50% 50%, #161b28 0%, #0d1117 80%)",
                        fontFamily: "sans-serif",
                    }}
                >
                    {/* Top Bar */}
                    <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "40px",
                        borderBottom: "2px solid #2e3a50",
                        width: "100%",
                    }}>
                        <div style={{ color: "#00d4aa", fontSize: 40, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "2px" }}>
                            PlusMinus
                        </div>
                        <div style={{ color: "#7d91ab", fontSize: 24 }}>
                            plusminus.app
                        </div>
                    </div>

                    {/* Result Badge */}
                    <div style={{
                        position: "absolute",
                        top: 140,
                        right: 40,
                        padding: "10px 20px",
                        backgroundColor: `${resultColor}20`,
                        color: resultColor,
                        border: `2px solid ${resultColor}`,
                        borderRadius: "8px",
                        fontSize: 24,
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        letterSpacing: "2px"
                    }}>
                        {badgeText}
                    </div>

                    {/* Content */}
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        padding: "60px 40px",
                        flexGrow: 1,
                    }}>
                        <div style={{ color: "#c8d5e8", fontSize: 72, fontWeight: "bold", lineHeight: 1.1, marginBottom: 20, maxWidth: "80%" }}>
                            {titleText}
                        </div>
                        {subTitle && (
                            <div style={{ color: "#7d91ab", fontSize: 36, marginBottom: 40 }}>
                                {subTitle}
                            </div>
                        )}
                        <div style={{
                            display: "flex",
                            alignItems: "baseline",
                            marginBottom: 40,
                        }}>
                            <span style={{ color: "#546480", fontSize: 36, marginRight: 20 }}>Odds</span>
                            <span style={{ color: resultColor, fontSize: 64, fontWeight: "bold", fontFamily: "monospace" }}>
                                {parseFloat(odds) > 0 ? `+${odds}` : odds}
                            </span>
                        </div>
                        
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            borderTop: "2px solid #2e3a50",
                            paddingTop: 40,
                            marginTop: "auto"
                        }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ color: "#546480", fontSize: 24, marginBottom: 10 }}>Stake</span>
                                <span style={{ color: "#c8d5e8", fontSize: 40, fontWeight: "bold" }}>${parseFloat(stake).toFixed(2)}</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                <span style={{ color: "#546480", fontSize: 24, marginBottom: 10 }}>
                                    {result === "pending" ? "To Win" : "P/L"}
                                </span>
                                <span style={{ color: plColor, fontSize: 40, fontWeight: "bold" }}>
                                    {plText || "—"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            { width: 1200, height: 630 }
        );
    } catch (e) {
        return new Response(`Failed to generate the image`, { status: 500 });
    }
}
