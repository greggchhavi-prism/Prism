const { getStore } = require("@netlify/blobs");

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { submissionId, prismType } = JSON.parse(event.body);
    if (!submissionId || !prismType) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing submissionId or prismType" }) };
    }

    const store = getStore({
      name: "prism-results",
      siteID: "be64008c-c9b0-4755-81bd-54525292aff0",
      token: process.env.NETLIFY_TOKEN
    });

    await store.set(submissionId, prismType, { ttl: 3600 });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
