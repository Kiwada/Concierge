export class RouteError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

export const isRouteError = (value: unknown): value is RouteError =>
  value instanceof RouteError;
