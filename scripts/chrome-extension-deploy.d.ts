declare module "chrome-extension-deploy" {
  export function deploy(options: {
    extensionId: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    zip: string;
  }): Promise<void>;
}
