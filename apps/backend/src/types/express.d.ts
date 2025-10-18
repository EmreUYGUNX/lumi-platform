import type { AuthenticatedUser, RequestAuthState } from "../modules/auth/token.types.js";

declare global {
  namespace Express {
    interface Request {
      /**
       * Unique identifier assigned to the current request.
       */
      id: string;
      /**
       * Authenticated user context resolved by the authentication middleware.
       */
      user?: AuthenticatedUser;
    }

    /**
     * Response locals augmented by the middleware stack.
     */
    interface Locals {
      requestId?: string;
      auth?: RequestAuthState;
    }
  }
}

export {};
