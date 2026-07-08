// netlify/functions/score-and-route.js
// Receives Tally webhook, scores by label name, assigns PrismType,
// stores result for the profile redirect.
//
// Routing engine v2 (July 2026) — proportional scoring.
// Why: v1 collapsed each section to a single winning subtype before routing.
// Ties broke silently by list order, and nearest-neighbour ties broke by
// type-definition order — funnelling flat or mixed profiles into The Maker.
// Multi-select answers make mixed sections common, so the collapse is gone:
// every type is scored against the person's full score pattern.
//
// How it works:
//   For each type, each section contributes
//       weight × (points on the subtype this type expects ÷ total points in the section)
//   Sections with zero points contribute nothing (no false defaults).
//   S1/S3/S7 weight 2, S2/S4/S5/S6 weight 1. Highest total wins.
//   Exact ties (rare) break by primary-section (S1/S3/S7) score alone.
//
// Layer 1 (exact match) is kept on top: if S1, S3 and S7 each have a single
// undisputed winner and that trio matches a type exactly, route there directly.
// Layer 1 never fires on a tied section — ties always fall to proportional.

const { getStore } = require("@netlify/blobs");

const SITE_URL = "https://joyful-kangaroo-a13e66.netlify.app";

// All 10 PrismTypes defined by their full 7-section subtype profile
const PRISM_TYPES = {
  "The Maker":     { S1:"Initiator",   S2:"Linear",          S3:"Concrete",         S4:"Seeker",    S5:"Steady",       S6:"Boundaried", S7:"Builder"    },
  "The Visionary": { S1:"Initiator",   S2:"Associative",     S3:"Abstract",         S4:"Seeker",    S5:"Steady",       S6:"Interpreter",S7:"Experimenter"},
  "The Spark":     { S1:"Initiator",   S2:"Symbolic",        S3:"Metaphorical",     S4:"Seeker",    S5:"Reactive",     S6:"Absorber",   S7:"Improviser" },
  "The Catalyst":  { S1:"Initiator",   S2:"Associative",     S3:"Multidimensional", S4:"Seeker",    S5:"Reactive",     S6:"Absorber",   S7:"Improviser" },
  "The Anchor":    { S1:"Sustainer",   S2:"Linear",          S3:"Concrete",         S4:"Filtered",  S5:"Steady",       S6:"Boundaried", S7:"Builder"    },
  "The Weaver":    { S1:"Sustainer",   S2:"Layered",         S3:"Multidimensional", S4:"Sensitive", S5:"Reactive",     S6:"Absorber",   S7:"Integrator" },
  "The Navigator": { S1:"Adapter",     S2:"Layered",         S3:"Multidimensional", S4:"Filtered",  S5:"Steady",       S6:"Boundaried", S7:"Integrator" },
  "The Explorer":  { S1:"Adapter",     S2:"Symbolic",        S3:"Metaphorical",     S4:"Seeker",    S5:"Reactive",     S6:"DeepFeeler", S7:"Experimenter"},
  "The Architect": { S1:"Pauser",      S2:"Linear",          S3:"Abstract",         S4:"Filtered",  S5:"Steady",       S6:"Interpreter",S7:"Builder"    },
  "The Distiller": { S1:"Pauser",      S2:"Layered",         S3:"Multidimensional", S4:"Sensitive", S5:"Reactive",     S6:"Absorber",   S7:"Integrator" },
};

// Subtype fields per section, and section weights
const SECTIONS = {
  S1: { weight: 2, subtypes: ["S1_Initiator","S1_Sustainer","S1_Adapter","S1_Pauser"] },
  S2: { weight: 1, subtypes: ["S2_Linear","S2_Associative","S2_Layered","S2_Symbolic"] },
  S3: { weight: 2, subtypes: ["S3_Concrete","S3_Abstract","S3_Metaphorical","S3_Multidimensional"] },
  S4: { weight: 1, subtypes: ["S4_Seeker","S4_Filtered","S4_Sensitive","S4_Overwhelmed"] },
  S5: { weight: 1, subtypes: ["S5_Steady","S5_Reactive","S5_Hyperreactive","S5_Fluctuating"] },
  S6: { weight: 1, subtypes: ["S6_Absorber","S6_DeepFeeler","S6_Boundaried","S6_Interpreter"] },
  S7: { weight: 2, subtypes: ["S7_Integrator","S7_Improviser","S7_Experimenter","S7_Builder"] },
};

const PRIMARY_SECTIONS = ["S1", "S3", "S7"];

// Returns the section's single undisputed winner (subtype short name),
// or null if the section is tied or empty. Used only for Layer 1 and logging.
function strictWinner(scores, section) {
  const { subtypes } = SECTIONS[section];
  let max = 0, winner = null, tied = false;
  for (const s of subtypes) {
    const val = scores[s] || 0;
    if (val > max) { max = val; winner = s; tied = false; }
    else if (val === max && val > 0) { tied = true; }
  }
  if (max === 0 || tied) return null;
  return winner.split("_")[1];
}

// Share of a section's points that sit on one subtype (0..1). Empty section → 0.
function sectionShare(scores, section, subtypeShort) {
  const { subtypes } = SECTIONS[section];
  let total = 0;
  for (const s of subtypes) total += scores[s] || 0;
  if (total === 0) return 0;
  return (scores[`${section}_${subtypeShort}`] || 0) / total;
}

function assignPrismType(scores) {
  // Layer 1 — exact match on undisputed S1/S3/S7 winners
  const w1 = strictWinner(scores, "S1");
  const w3 = strictWinner(scores, "S3");
  const w7 = strictWinner(scores, "S7");
  if (w1 && w3 && w7) {
    for (const [type, profile] of Object.entries(PRISM_TYPES)) {
      if (profile.S1 === w1 && profile.S3 === w3 && profile.S7 === w7) {
        return { type, layer: 1 };
      }
    }
  }

  // Layer 2 — proportional similarity across all 7 sections
  let bestType = null, bestScore = -1, bestPrimary = -1;
  for (const [type, profile] of Object.entries(PRISM_TYPES)) {
    let total = 0, primary = 0;
    for (const [section, cfg] of Object.entries(SECTIONS)) {
      const share = sectionShare(scores, section, profile[section]);
      total += cfg.weight * share;
      if (PRIMARY_SECTIONS.includes(section)) primary += share;
    }
    if (total > bestScore + 1e-9 ||
        (Math.abs(total - bestScore) <= 1e-9 && primary > bestPrimary + 1e-9)) {
      bestScore = total;
      bestPrimary = primary;
      bestType = type;
    }
  }
  return { type: bestType, layer: 2 };
}

function getShadowLoad(scores) {
  if (
    (scores["S4_Overwhelmed"] || 0) > (scores["S4_Sensitive"] || 0) ||
    (scores["S5_Hyperreactive"] || 0) > (scores["S5_Reactive"] || 0) ||
    (scores["S6_Absorber"] || 0) > (scores["S6_DeepFeeler"] || 0)
  ) return "Heavy";
  if (
    (scores["S4_Sensitive"] || 0) > (scores["S4_Filtered"] || 0) ||
    (scores["S5_Reactive"] || 0) > (scores["S5_Steady"] || 0) ||
    (scores["S6_DeepFeeler"] || 0) > (scores["S6_Boundaried"] || 0)
  ) return "Medium";
  return "Light";
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const fields = body.data?.fields || [];
    const submissionId = body.data?.submissionId || "";

    // Extract scores by label name
    const scores = {};
    for (const field of fields) {
      if (field.type === "CALCULATED_FIELDS" && field.label) {
        scores[field.label] = Number(field.value) || 0;
      }
    }

    console.log("Scores received:", JSON.stringify(scores));
    console.log("Submission ID:", submissionId);

    const shadowLoad = getShadowLoad(scores);
    const { type: prismType, layer: routingLayer } = assignPrismType(scores);

    // Section winners for logging only ("mixed" = tied or empty section)
    const winners = {};
    for (const section of Object.keys(SECTIONS)) {
      winners[section] = strictWinner(scores, section) || "mixed";
    }
    console.log("Section winners:", JSON.stringify(winners));
    console.log(`PrismType: ${prismType} | Layer: ${routingLayer} | ShadowLoad: ${shadowLoad}`);

    // Store result so preparing.html can find it via get-result
    if (submissionId) {
      const store = getStore({
        name: "prism-results",
        siteID: "be64008c-c9b0-4755-81bd-54525292aff0",
        token: process.env.NETLIFY_TOKEN
      });
      await store.set(submissionId, prismType, { ttl: 3600 });
      console.log("Result stored for submission:", submissionId);
    } else {
      console.error("No submissionId in webhook payload — result not stored");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ prismType, routingLayer, shadowLoad }),
    };

  } catch (err) {
    console.error("Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
