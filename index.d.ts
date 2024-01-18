export type LocatsCacheBackendOptions = {
    prefix?: string;
    checkEtagPath?: string;
    expirationTime?: number;
    versions?: { [key: string]: string };
    defaultVersion?: string;
    store?: any;
}

export default class I18LocatsCacheBackend
  implements BackendModule<LocatsCacheBackendOptions>
{
  static type: "backend";
  constructor(services?: any, options?: LocatsCacheBackendOptions);
  init(services?: any, options?: LocatsCacheBackendOptions): void;
  read(language: string, namespace: string, callback: ReadCallback): void;
  save(language: string, namespace: string, data: any): void;
  type: "backend";
  services: any;
  options: LocatsCacheBackendOptions;
}