# NAV daglig trigger – EventBridge (15:00 CET)

För att köra NAV-pipelinen dagligen kl 15:00 CET kan du använda AWS EventBridge tillsammans med en Lambda som anropar worker-endpointen.

## Worker-endpoint

- **URL:** `POST https://<din-app>/api/nav/worker`
- **Body:** `{ "navDate": "YYYY-MM-DD" }` (valfritt; default idag)
- **Header:** `x-aifm-cron-secret: <AIFM_CRON_SECRET>`

Worker gör: SEB-synk (om konfigurerad) → NAV-beräkning (LSEG/ECB) → spara körning och skapa approval-request.

## Alternativ 1: EventBridge Rule + Lambda

1. Skapa en Lambda (Node 20) som anropar worker med cron-secret:

```javascript
// Lambda handler
const https = require('https');
const url = new URL(process.env.NAV_WORKER_URL); // https://din-app/api/nav/worker
const secret = process.env.AIFM_CRON_SECRET;

exports.handler = async () => {
  const body = JSON.stringify({});
  const opts = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-aifm-cron-secret': secret,
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
        else reject(new Error(`Worker returned ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
};
```

2. Sätt miljövariabler på Lambda: `NAV_WORKER_URL`, `AIFM_CRON_SECRET`.

3. Skapa EventBridge-regel (15:00 CET = 14:00 UTC vintertid, 13:00 UTC sommartid; använd `Europe/Stockholm` om Scheduler används):

```bash
# Cron: 14:00 UTC (15:00 CET vintertid) – justera om du vill använda sommartid
aws events put-rule \
  --name aifm-nav-daily \
  --schedule-expression "cron(0 14 * * ? *)" \
  --state ENABLED \
  --description "Trigger NAV worker daily at 15:00 CET (winter)"

# Lägg till Lambda som target
aws events put-targets \
  --rule aifm-nav-daily \
  --targets "Id"="1","Arn"="arn:aws:lambda:eu-north-1:ACCOUNT_ID:function:NAV_WORKER_FUNCTION_NAME"

# Ge EventBridge rätt att anropa Lambda
aws lambda add-permission \
  --function-name NAV_WORKER_FUNCTION_NAME \
  --statement-id AllowEventBridge \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:eu-north-1:ACCOUNT_ID:rule/aifm-nav-daily
```

För helår 15:00 Stockholm (CET/CEST) kan du istället använda **EventBridge Scheduler** med flexibel tidszon:

```bash
aws scheduler create-schedule \
  --name aifm-nav-daily \
  --schedule-expression "at(15:00)" \
  --schedule-expression-timezone "Europe/Stockholm" \
  --flexible-time-window '{"Mode": "OFF"}' \
  --target '{
    "Arn": "arn:aws:lambda:eu-north-1:ACCOUNT_ID:function:NAV_WORKER_FUNCTION_NAME",
    "RoleArn": "arn:aws:iam::ACCOUNT_ID:role/EventBridgeSchedulerRole"
  }'
```

## Alternativ 2: ECS Scheduled Task

Kör en one-off container som curl:ar worker-endpointen (samma URL och header som ovan). Konfigurera ECS Scheduled Task eller Step Functions som triggas av EventBridge enligt din infrastruktur.

## Säkerhet

- Använd alltid `AIFM_CRON_SECRET` och skicka det endast i header från Lambda/trusted job.
- Begränsa Lambda/ECS IAM till minsta nödvändiga behörigheter.
- Om appen ligger bakom VPC, se till att Lambda har nätverksåtkomst till appen (eller använd public URL med secret).
