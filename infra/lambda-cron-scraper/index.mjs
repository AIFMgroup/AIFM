/**
 * Lambda function triggered weekly by EventBridge Scheduler.
 * Calls the scheduled-scrape API endpoint on the AIFM frontend
 * to check for new/updated fund and holding documents.
 */

import https from 'https';

const TARGET_URL = process.env.TARGET_URL || 'https://d31zvrvfawczta.cloudfront.net/api/admin/scheduled-scrape?type=funds';
const CRON_SECRET = process.env.CRON_SECRET || '';

function makeRequest(url, secret) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-aifm-cron-secret': secret,
      },
      timeout: 280000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.end();
  });
}

export const handler = async (event) => {
  console.log('Scheduled scraper triggered:', JSON.stringify(event));

  try {
    const result = await makeRequest(TARGET_URL, CRON_SECRET);
    console.log('Scraper response:', JSON.stringify(result));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Scheduled scrape completed',
        apiResponse: result,
      }),
    };
  } catch (err) {
    console.error('Scheduled scrape failed:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
