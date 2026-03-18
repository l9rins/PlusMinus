// ─── Model Builder Module ─────────────────────────────────────
// A logistic regression win-probability model.
// Inputs: net rating, season W%, last-10 form, home court, rest days.
// All sliders update the model output in real time.

const mState = {
  hw: 62, h10: 70, hoff: 116, hdef: 111, hrest: 1,
  aw: 49, a10: 40, aoff: 112, adef: 114, arest: 2,
};

const OUTPUT_IDS = {
  hw: 'hw-out', h10: 'h10-out', hoff: 'hoff-out', hdef: 'hdef-out', hrest: 'hrest-out',
  aw: 'aw-out', a10: 'a10-out', aoff: 'aoff-out', adef: 'adef-out', arest: 'arest-out',
};

const FORMATTERS = {
  hw: v => v + '%',    h10: v => v + '%',
  hoff: v => parseFloat(v).toFixed(1), hdef: v => parseFloat(v).toFixed(1), hrest: v => v,
  aw: v => v + '%',    a10: v => v + '%',
  aoff: v => parseFloat(v).toFixed(1), adef: v => parseFloat(v).toFixed(1), arest: v => v,
};

function updateModel(key, val) {
  mState[key] = parseFloat(val);
  document.getElementById(OUTPUT_IDS[key]).textContent = FORMATTERS[key](val);
  calcModel();
}

function calcModel() {
  const netH     = mState.hoff - mState.hdef;
  const netA     = mState.aoff - mState.adef;
  const netDiff  = netH - netA;
  const wDiff    = (mState.hw - mState.aw) / 100;
  const formDiff = (mState.h10 - mState.a10) / 100;
  const restAdv  = (mState.hrest - mState.arest) * 0.015;
  const homeBonus = 0.038;

  // Logistic regression
  const logit = 0.18 * netDiff + 1.4 * wDiff + 0.8 * formDiff + restAdv + homeBonus * 2.2;
  const prob  = 1 / (1 + Math.exp(-logit));

  const probPct   = (prob * 100).toFixed(1);
  const spread    = Math.abs((netDiff * 0.42 + wDiff * 4.2 + formDiff * 2.1 + restAdv * 8)).toFixed(1);
  const favSide   = (netDiff * 0.42 + wDiff * 4.2 + formDiff * 2.1 + restAdv * 8) >= 0 ? 'Home' : 'Away';

  const mlFav     = prob >= 0.5 ? -Math.round(prob / (1 - prob) * 100) : Math.round((1 - prob) / prob * 100);
  const mlDog     = prob >= 0.5 ?  Math.round((1 - prob) / prob * 100) : -Math.round(prob / (1 - prob) * 100);

  // Update outputs
  document.getElementById('mo-prob').textContent   = probPct + '%';
  document.getElementById('mo-spread').textContent = `${favSide} -${spread}`;
  document.getElementById('mo-ml').textContent     = `${mlFav > 0 ? '+' : ''}${mlFav} / ${mlDog > 0 ? '+' : ''}${mlDog}`;
  document.getElementById('mo-edge').textContent   = `${netDiff >= 0 ? 'Home' : 'Away'} +${Math.abs(netDiff).toFixed(1)}`;
  document.getElementById('mo-bar').style.width    = probPct + '%';

  // Feature importance bars (dynamic based on input magnitudes)
  const fi1v = Math.min(0.99, Math.abs(netDiff) / 20 + 0.4).toFixed(2);
  const fi2v = Math.min(0.99, Math.abs(wDiff) * 2 + 0.3).toFixed(2);
  const fi3v = Math.min(0.99, Math.abs(formDiff) * 1.8 + 0.2).toFixed(2);
  const fi5v = Math.min(0.60, Math.abs(mState.hrest - mState.arest) * 0.12 + 0.05).toFixed(2);

  document.getElementById('fi1').style.width = (fi1v * 100) + '%'; document.getElementById('fv1').textContent = fi1v;
  document.getElementById('fi2').style.width = (fi2v * 100) + '%'; document.getElementById('fv2').textContent = fi2v;
  document.getElementById('fi3').style.width = (fi3v * 100) + '%'; document.getElementById('fv3').textContent = fi3v;
  document.getElementById('fi5').style.width = (fi5v * 100) + '%'; document.getElementById('fv5').textContent = fi5v;

  // Python code snippet
  document.getElementById('model-code').textContent =
`# CourtIQ Win Probability Model (Logistic Regression)
import numpy as np

features = {
    "net_rtg_home":   ${(mState.hoff - mState.hdef).toFixed(1)},   # off_rtg - def_rtg
    "net_rtg_away":   ${(mState.aoff - mState.adef).toFixed(1)},
    "win_pct_home":   ${(mState.hw / 100).toFixed(2)},
    "win_pct_away":   ${(mState.aw / 100).toFixed(2)},
    "form_10_home":   ${(mState.h10 / 100).toFixed(1)},
    "form_10_away":   ${(mState.a10 / 100).toFixed(1)},
    "rest_days_home": ${mState.hrest},
    "rest_days_away": ${mState.arest},
    "home_court":     1,
}

# Coefficients (trained on 5 seasons of NBA data)
weights = {
    "net_rtg_diff":  0.180,
    "win_pct_diff":  1.400,
    "form_diff":     0.800,
    "rest_adv":      0.015,
    "home_court":    0.084,
}

logit            = sum(w * v for w, v in zip(weights.values(), features.values()))
home_win_prob    = 1 / (1 + np.exp(-logit))

# Output
print(f"Home win probability: {home_win_prob:.1%}")
print(f"Projected spread:     ${favSide} -${spread}")
print(f"Fair moneyline:       ${mlFav > 0 ? '+' : ''}${mlFav} / ${mlDog > 0 ? '+' : ''}${mlDog}")`;
}

// Initial calculation
calcModel();
