declare global {
  interface ImportMetaEnv {
    readonly NODE_ENV: "development" | "production" | "test";
    readonly BASE_URL: string;
    readonly DEV: boolean;
    readonly PROD: boolean;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.md" {
  const content: string;
  export default content;
}

export {};
