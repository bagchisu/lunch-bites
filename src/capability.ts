export interface UserInfo {
  budget_name?: string;
  primary_currency?: string;
  [key: string]: any;
}

export interface CapabilityContext {
  accessToken: string;
  userInfo: UserInfo;
  getInfo: (endpoint: string) => Promise<any>;
}
