const { getStore } = require("@netlify/blobs");

exports.handler = async function(event) {
  const submissionId = event.queryStringParameters && event.queryStringParameters.submissionId;
  if (!submissionId) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing submissionId" }) };
  }

  try {
    const store = getStore({
      name: "prism-results",
      siteID: "be64008c-c9b0-4755-81bd-54525292aff0",
      token: process.env.NETLIFY_TOKEN
    });

    const prismType = await store.get(submissionId);

    if (!prismType) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ready: false })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ready: true, prismType })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
