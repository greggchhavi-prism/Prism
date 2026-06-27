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

function assignPrismType(s1, s3) {
  const map = {
    "Initiator-Concrete": "The Maker",
    "Initiator-Abstract": "The Visionary",
    "Initiator-Metaphorical": "The Spark",
    "Initiator-Multidimensional": "The Catalyst",
    "Sustainer-Concrete": "The Anchor",
    "Sustainer-Multidimensional": "The Weaver",
    "Adapter-Multidimensional": "The Navigator",
    "Adapter-Metaphorical": "The Explorer",
    "Pauser-Abstract": "The Architect",
    "Pauser-Multidimensional": "The Distiller",
  };
  return map[`${s1}-${s3}`] || "The Navigator";
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
    const prismType = assignPrismType(s1, s3);

    console.log(`S1=${s1} S2=${s2} S3=${s3} S4=${s4} S5=${s5} S6=${s6} S7=${s7}`);
    console.log(`PrismType: ${prismType} | ShadowLoad: ${shadowLoad}`);

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
      body: JSON.stringify({ prismType, s1, s2, s3, s4, s5, s6, s7, shadowLoad }),
    };

  } catch (err) {
    console.error("Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
