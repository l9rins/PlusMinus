export const config = { runtime: "edge" };
import { ImageResponse } from "@vercel/og";

export default function handler(req) {
    try {
        const { searchParams } = new URL(req.url);
        
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
             // calculate PL using standard logic
             const nOdds = parseFloat(odds);
             const nStake = parseFloat(stake);
             const profit = nOdds > 0 ? nStake * (nOdds / 100) : nStake * (100 / Math.abs(nOdds));
             plText = `+$${profit.toFixed(2)}`;
        } else if (result === "loss") {
             resultColor = "#f43f5e"; // loss (red)
             plColor = "#f43f5e";
             badgeText = "LOSS";
             plText = `-$${parseFloat(stake).toFixed(2)}`;
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
                                <span style={{ color: "#546480", fontSize: 24, marginBottom: 10 }}>Payout / P&L</span>
                                <span style={{ color: plColor, fontSize: 40, fontWeight: "bold" }}>
                                    {result === "pending" ? "To-Win" : ""} {plText}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
            }
        );
    } catch (e) {
        return new Response(`Failed to generate the image`, {
            status: 500,
        });
    }
}
