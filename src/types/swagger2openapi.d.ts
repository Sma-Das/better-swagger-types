declare module 'swagger2openapi' {
  interface ConvertOptions {
    patch?: boolean;
    warnOnly?: boolean;
  }

  interface ConvertResult {
    openapi: Record<string, unknown>;
  }

  interface Swagger2OpenApi {
    convertObj(swagger: Record<string, unknown>, options?: ConvertOptions): Promise<ConvertResult>;
    convertFile(filename: string, options?: ConvertOptions): Promise<ConvertResult>;
  }

  const swagger2openapi: Swagger2OpenApi;
  export default swagger2openapi;
}
