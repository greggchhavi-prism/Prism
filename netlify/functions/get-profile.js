exports.handler = async function(event) {
  const type = event.queryStringParameters && event.queryStringParameters.type;

  if (!type) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing type parameter' }) };
  }

  const AIRTABLE_TOKEN = 'pat0wtzilUrgFyWpv.b10873d37fe76a5a5d1646b66bbdaa56a701d197cc81a26afd956091ad4c1626';
  const BASE_ID = 'appDk2mVEQWg0aQTM';
  const TABLE_ID = 'tblB12L3ROrf1bL0I';

  const filterFormula = encodeURIComponent(`{PrismType}="${type}"`);
  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${filterFormula}&maxRecords=1`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });
    const data = await response.json();

    if (!data.records || data.records.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Profile not found' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data.records[0])
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
