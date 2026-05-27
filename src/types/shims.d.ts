declare module 'express' {
  import * as http from 'http';
  const express: any;
  export default express;
  export type Request = any;
  export type Response = any;
}

declare module 'cors' {
  const cors: any;
  export default cors;
}

declare module 'pg' {
  export class Pool {
    constructor(opts?: any);
    connect(): Promise<any>;
    query(text: any, params?: any): Promise<any>;
    end(): Promise<void>;
    on(evt: string, cb: (...args: any[]) => void): void;
  }
}

declare module 'uuid' {
  export function v4(): string;
}
