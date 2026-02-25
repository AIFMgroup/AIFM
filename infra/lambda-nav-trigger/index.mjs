/**
 * Lambda function triggered daily by EventBridge Scheduler at 15:00 CET.
 * Calls the NAV worker endpoint to run the full NAV calculation pipeline:
 * ISEC sync → SEB custody sync → NAV calculation → approval workflow.
 */

import https from 'https';

const NAV_WORKER_URL = process.env.NAV_WORKER_URL || 'https://d31zvrvfawczta.cloudfront.net/api/nav/worker';
const CRON_SECRET = process.env.CRON_SECRET || '';

function callWorker(url, secret, body = '{}') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
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
      reject(new Error('Request timed out after 280s'));
    });

    req.end(body);
  });
}

export const handler = async (event) => {
  console.log('NAV daily trigger invoked:', JSON.stringify(event));

  const navDate = event?.navDate || new Date().toISOString().split('T')[0];
  console.log(`Running NAV for date: ${navDate}`);

  try {
    const result = await callWorker(
      NAV_WORKER_URL,
      CRON_SECRET,
      JSON.stringify({ navDate })
    );

    console.log('NAV worker response:', JSON.stringify(result));

    if (result.statusCode >= 400) {
      throw new Error(`NAV worker returned ${result.statusCode}: ${JSON.stringify(result.body)}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `NAV calculation completed for ${navDate}`,
        navDate,
        apiResponse: result,
      }),
    };
  } catch (err) {
    console.error('NAV trigger failed:', err);
    throw err;
  }
};
