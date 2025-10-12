declare global {
  namespace Express {
    interface Request {
      /**
       * Unique identifier assigned to the current request.
       */
      id: string;
    }

    /**
     * Response locals augmented by the middleware stack.
     */
    interface Locals {
      requestId?: string;
    }
  }
}

export {};
