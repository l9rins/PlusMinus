// src/components/WebhookSettings.jsx
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Bell, BellOff, ExternalLink } from "lucide-react";

async function apiFetch(path, options, getToken) {
  const token = await getToken();
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
     const err = await res.json().catch(() => ({}));
     throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function WebhookSettings() {
  const { getToken } = useAuth();
  const [config, setConfig] = useState({ discord: false, telegram: false });
  const [discordUrl, setDiscordUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    apiFetch("/api/webhooks", {}, getToken).then(setConfig).catch(() => {});
  }, [getToken]);

  const saveDiscord = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const data = await apiFetch("/api/webhooks", {
        method: "PUT",
        body: JSON.stringify({ discord: discordUrl || null }),
      }, getToken);
      setConfig(data);
      setMsg(data.discord ? "✅ Discord connected!" : "Discord removed.");
      setDiscordUrl("");
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pm-card p-4 space-y-4">
      <div className="pm-label">Alert Webhooks</div>

      {/* Discord */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {config.discord
            ? <Bell size={13} className="text-win" />
            : <BellOff size={13} className="text-pitch-500" />}
          <span className="text-sm text-pitch-200">Discord</span>
          <span className={`pm-badge border text-[10px] ${config.discord ? "bg-win/10 text-win border-win/20" : "bg-pitch-700 text-pitch-500 border-pitch-600"}`}>
            {config.discord ? "Connected" : "Not set"}
          </span>
          
          <a
            href="https://support.discord.com/hc/en-us/articles/228383668"
            target="_blank" rel="noreferrer"
            className="ml-auto text-[10px] text-pitch-500 hover:text-accent flex items-center gap-1"
          >
            How to get webhook URL <ExternalLink size={9} />
          </a>
        </div>
        <div className="flex gap-2">
          <input
            value={discordUrl}
            onChange={e => setDiscordUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="flex-1 bg-pitch-700 border border-pitch-600 rounded-md px-3 py-1.5 text-sm
                       text-pitch-200 placeholder:text-pitch-500 focus:outline-none focus:border-accent/50"
          />
          <button
            onClick={saveDiscord}
            disabled={saving}
            className="px-4 py-1.5 bg-accent/15 text-accent border border-accent/30 rounded-md
                       text-sm font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
          >
            {saving ? "…" : config.discord ? "Update" : "Connect"}
          </button>
          {config.discord && (
            <button
              onClick={() => { setDiscordUrl(""); saveDiscord(); }}
              className="px-3 py-1.5 text-pitch-500 hover:text-loss border border-pitch-600 rounded-md text-sm transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {msg && <div className="text-[11px] text-pitch-300">{msg}</div>}

      <div className="text-[10px] text-pitch-500 leading-relaxed border-t border-pitch-600 pt-3">
        Line movement alerts (≥5 point moves) are pushed instantly to your Discord channel.
        No tab required — alerts arrive even when you're away from the app.
      </div>
    </div>
  );
}
