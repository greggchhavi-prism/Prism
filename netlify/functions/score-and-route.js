// netlify/functions/score-and-route.js
// Receives Tally webhook, scores by label name, assigns PrismType, sends Brevo email

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SITE_URL = "https://joyful-kangaroo-a13e66.netlify.app";

function getPrimary(scores, subtypes) {
  let max = -1;
  let winner = subtypes[0];
  for (const s of subtypes) {
    const val = scores[s] || 0;
    if (val > max) { max = val; winner = s; }
  }
  return winner.split("_")[1];
}

// All 10 PrismTypes defined by their full 7-section subtype profile
// S1, S3, S7 are primary dimensions (weight 2)
// S2, S4, S5, S6 are supporting dimensions (weight 1)
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

// Primary dimensions carry double weight in routing
const PRIMARY_SECTIONS = ["S1", "S3", "S7"];
const SUPPORTING_SECTIONS = ["S2", "S4", "S5", "S6"];

function assignPrismType(s1, s2, s3, s4, s5, s6, s7) {
  const actual = { S1:s1, S2:s2, S3:s3, S4:s4, S5:s5, S6:s6, S7:s7 };

  // Layer 1 — exact match on primary dimensions S1, S3, S7
  for (const [type, profile] of Object.entries(PRISM_TYPES)) {
    if (profile.S1 === s1 && profile.S3 === s3 && profile.S7 === s7) {
      return { type, layer: 1 };
    }
  }

  // Layer 2 — nearest neighbour using all 7 sections
  // Primary sections (S1, S3, S7) weighted at 2, supporting at 1
  let bestType = null;
  let bestScore = -1;

  for (const [type, profile] of Object.entries(PRISM_TYPES)) {
    let matchScore = 0;
    for (const s of PRIMARY_SECTIONS) {
      if (profile[s] === actual[s]) matchScore += 2;
    }
    for (const s of SUPPORTING_SECTIONS) {
      if (profile[s] === actual[s]) matchScore += 1;
    }
    if (matchScore > bestScore) {
      bestScore = matchScore;
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

    // Extract email
    let email = "";
    for (const field of fields) {
      if (field.type === "INPUT_EMAIL") {
        email = field.value || "";
      }
    }

    // Extract scores by label name
    const scores = {};
    for (const field of fields) {
      if (field.type === "CALCULATED_FIELDS" && field.label) {
        scores[field.label] = Number(field.value) || 0;
      }
    }

    console.log("Scores received:", JSON.stringify(scores));

    // Score each section
    const s1 = getPrimary(scores, ["S1_Initiator","S1_Sustainer","S1_Adapter","S1_Pauser"]);
    const s2 = getPrimary(scores, ["S2_Linear","S2_Associative","S2_Layered","S2_Symbolic"]);
    const s3 = getPrimary(scores, ["S3_Concrete","S3_Abstract","S3_Metaphorical","S3_Multidimensional"]);
    const s4 = getPrimary(scores, ["S4_Seeker","S4_Filtered","S4_Sensitive","S4_Overwhelmed"]);
    const s5 = getPrimary(scores, ["S5_Steady","S5_Reactive","S5_Hyperreactive","S5_Fluctuating"]);
    const s6 = getPrimary(scores, ["S6_Absorber","S6_DeepFeeler","S6_Boundaried","S6_Interpreter"]);
    const s7 = getPrimary(scores, ["S7_Integrator","S7_Improviser","S7_Experimenter","S7_Builder"]);
    const shadowLoad = getShadowLoad(scores);
    const { type: prismType, layer: routingLayer } = assignPrismType(s1, s2, s3, s4, s5, s6, s7);

    console.log(`S1=${s1} S2=${s2} S3=${s3} S4=${s4} S5=${s5} S6=${s6} S7=${s7}`);
    console.log(`PrismType: ${prismType} | Layer: ${routingLayer} | ShadowLoad: ${shadowLoad}`);

    const profileUrl = `${SITE_URL}/?type=${encodeURIComponent(prismType)}`;

    // Send Brevo email
    if (email && BREVO_API_KEY) {
      const emailBody = {
        sender: { name: "Prism", email: "gregg.chhavi@gmail.com" },
        to: [{ email }],
        subject: "Your Prism Profile is ready",
        htmlContent: `<p>Your Prism profile is ready.</p><p><a href="${profileUrl}">View your Prism Profile →</a></p><p>Prism — mapping how you experience the world and the potential that unlocks.</p>`,
        replyTo: { name: "Prism", email: "gregg.chhavi@gmail.com" },
      };

      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": BREVO_API_KEY,
        },
        body: JSON.stringify(emailBody),
      });

      if (!brevoRes.ok) {
        const err = await brevoRes.text();
        console.error("Brevo error:", err);
      } else {
        console.log("Email sent to", email);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ prismType, routingLayer, s1, s2, s3, s4, s5, s6, s7, shadowLoad }),
    };

  } catch (err) {
    console.error("Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
