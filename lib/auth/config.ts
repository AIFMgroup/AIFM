type AuthConfig = {
  region: string;
  userPoolId: string;
  clientId: string;
  domain: string;
  redirectUri: string;
  logoutUri: string;
  cookieName: string;
};

const requiredEnv = [
  "COGNITO_REGION",
  "COGNITO_USER_POOL_ID",
  "COGNITO_CLIENT_ID",
  "COGNITO_DOMAIN",
  "COGNITO_REDIRECT_URI",
  "COGNITO_LOGOUT_URI",
] as const;

export const getAuthConfig = (): AuthConfig => {
  const values = requiredEnv.reduce<Record<string, string>>((acc, key) => {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required auth environment variable: ${key}`);
    }
    acc[key] = value;
    return acc;
  }, {});

  return {
    region: values.COGNITO_REGION,
    userPoolId: values.COGNITO_USER_POOL_ID,
    clientId: values.COGNITO_CLIENT_ID,
    domain: values.COGNITO_DOMAIN.replace(/\/$/, ""),
    redirectUri: values.COGNITO_REDIRECT_URI,
    logoutUri: values.COGNITO_LOGOUT_URI,
    cookieName: "__Host-aifm_id_token",
  };
};

export const getIssuer = () => {
  const { region, userPoolId } = getAuthConfig();
  return `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
};

