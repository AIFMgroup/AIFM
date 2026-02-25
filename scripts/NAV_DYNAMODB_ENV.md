# NAV Engine – DynamoDB and environment variables

## Create tables

From repo root (with AWS CLI configured):

```bash
cd aifm-frontend
AWS_REGION=eu-north-1 ./scripts/create-nav-tables.sh
```

Tables created: `aifm-nav-records`, `aifm-nav-approvals`, `aifm-nav-runs`, `aifm-fund-config`, `aifm-fund-registry`, `aifm-nav-settings`.

## Environment variables (ECS task / .env)

The deploy script injects these into the **web** container when deploying frontend:

| Variable | Value | Purpose |
|----------|--------|---------|
| `FUND_REGISTRY_TABLE` | aifm-fund-registry | Fund Registry storage |
| `NAV_RECORDS_TABLE` | aifm-nav-records | NAV history |
| `NAV_APPROVALS_TABLE` | aifm-nav-approvals | Approval workflow |
| `NAV_RUNS_TABLE` | aifm-nav-runs | Run logs |
| `NAV_SETTINGS_TABLE` | aifm-nav-settings | NAV automation settings |
| `FUND_CONFIG_TABLE` | aifm-fund-config | Fund configuration |
| `AWS_REGION` | eu-north-1 | DynamoDB region |

For local development, add to `.env.local`:

```
FUND_REGISTRY_TABLE=aifm-fund-registry
NAV_RECORDS_TABLE=aifm-nav-records
NAV_APPROVALS_TABLE=aifm-nav-approvals
NAV_RUNS_TABLE=aifm-nav-runs
FUND_CONFIG_TABLE=aifm-fund-config
NAV_SETTINGS_TABLE=aifm-nav-settings
AWS_REGION=eu-north-1
```

## IAM permissions (ECS task role)

The ECS task role (e.g. `ecsTaskExecutionRole` or the role used by the **web** service) needs DynamoDB access. Add a policy like:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:ConditionCheckItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-north-1:798076332693:table/aifm-fund-registry",
        "arn:aws:dynamodb:eu-north-1:798076332693:table/aifm-nav-records",
        "arn:aws:dynamodb:eu-north-1:798076332693:table/aifm-nav-approvals",
        "arn:aws:dynamodb:eu-north-1:798076332693:table/aifm-nav-runs",
        "arn:aws:dynamodb:eu-north-1:798076332693:table/aifm-fund-config",
        "arn:aws:dynamodb:eu-north-1:798076332693:table/aifm-nav-settings",
        "arn:aws:dynamodb:eu-north-1:798076332693:table/aifm-nav-records/index/*",
        "arn:aws:dynamodb:eu-north-1:798076332693:table/aifm-nav-approvals/index/*",
        "arn:aws:dynamodb:eu-north-1:798076332693:table/aifm-nav-runs/index/*",
        "arn:aws:dynamodb:eu-north-1:798076332693:table/aifm-fund-config/index/*"
      ]
    }
  ]
}
```

Replace `798076332693` with your AWS account ID if different.
