// netlify/functions/score-and-route.js
// Receives Tally webhook, scores 28 fields, assigns PrismType, sends Brevo email

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SITE_URL = "https://joyful-kangaroo-a13e66.netlify.app";

// Field UUID to subtype mapping
const FIELD_MAP = {
  "9530ca94-1edb-482a-814a-07e32704fa05": "S1_Initiator",
  "6d77d6cf-e94e-4a17-bb2c-d03b5a8a64a6": "S1_Sustainer",
  "be9a9329-38b3-4bda-88cc-a16c2b9dd651": "S1_Adapter",
  "4cde4885-4092-4bb5-a64d-a5e213198c18": "S1_Pauser",
  "9b5df7d0-4125-4596-91c8-b8d2a85f41d7": "S2_Linear",
  "09d07dbe-1b24-4e05-a6e4-2f29e613c971": "S2_Associative",
  "01a2bb07-9d77-44ea-b75b-32dd97d242be": "S2_Layered",
  "de779edd-04b6-4fb3-9d83-814f5baca367": "S2_Symbolic",
  "e3346987-9873-49ca-a54e-6194bbcb7185": "S3_Concrete",
  "24ca29af-d244-4188-b402-d9dba4ea326e": "S3_Abstract",
  "1a90a016-b4db-4ec6-b795-504231a64777": "S3_Metaphorical",
  "96aac8cb-ec2f-40d0-9369-fa4bf674a1f6": "S3_Multidimensional",
  "df93ec0c-c88a-4608-89f7-16ed1864d018": "S4_Seeker",
  "ddda1127-9702-4dca-9561-1b0443ea543e": "S4_Filtered",
  "526175ce-5df2-4729-bf3c-1b13cf959e0f": "S4_Sensitive",
  "837881ca-85a1-497f-8c9d-29292cd91fa3": "S4_Overwhelmed",
  "10824ca0-220e-4e97-9079-30dac36fe905": "S5_Steady",
  "373e6bd7-611e-4036-90a9-3be765480f78": "S5_Reactive",
  "65e97df8-0856-4dd1-b1fd-de3df555bf7b": "S5_Hyperreactive",
  "ff2c2e1d-2916-4d13-aae0-43eaa70f4b75": "S5_Fluctuating",
  "e71f88d0-45a8-477a-ae89-5b43a8d856a2": "S6_Absorber",
  "9d3c4144-feca-41de-920a-39e8b2a732a1": "S6_DeepFeeler",
  "a9a68239-bd71-4219-8445-b8f93404f4a0": "S6_Boundaried",
  "4f7d4961-8728-4ed8-9cf8-e30dca325c85": "S6_Interpreter",
  "2e5b1843-0b18-46df-8aff-f3c222e86072": "S7_Integrator",
  "a6efef17-2d52-47d2-b14a-dc441d9ec92c": "S7_Improviser",
  "3bbde689-0bda-453e-8421-fd9be5fff5e3": "S7_Experimenter",
  "2486e32e-4482-4b5f-b5be-d5a6afbe0b4b": "S7_Builder",
};

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
    let emailName = "";
    for (const field of fields) {
      if (field.type === "EMAIL") {
        email = field.value || "";
      }
    }

    // Extract calculated field scores by UUID
    const scores = {};
    for (const field of fields) {
      if (field.type === "CALCULATED_FIELDS") {
        const uuid = field.id;
        const subtype = FIELD_MAP[uuid];
        if (subtype) scores[subtype] = Number(field.value) || 0;
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

    // Build profile URL
    const profileUrl = `${SITE_URL}/?type=${encodeURIComponent(prismType)}`;

    // Send Brevo email if we have an address
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
