import * as Router from "expo-router";

export * from "expo-router";

declare module "expo-router" {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams:
        | {
            pathname: Router.RelativePathString;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: Router.ExternalPathString;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(auth)"}/login` | `/login`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(auth)"}/signup` | `/signup`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(tabs)"}/archive` | `/archive`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(tabs)"}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(tabs)"}/profile` | `/profile`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/listening/[videoId]`;
            params: Router.UnknownInputParams & { videoId: string | number };
          }
        | {
            pathname: `/shadowing/[videoId]`;
            params: Router.UnknownInputParams & { videoId: string | number };
          }
        | {
            pathname: `/study/[videoId]`;
            params: Router.UnknownInputParams & { videoId: string | number };
          };
      hrefOutputParams:
        | {
            pathname: Router.RelativePathString;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: Router.ExternalPathString;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(auth)"}/login` | `/login`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(auth)"}/signup` | `/signup`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(tabs)"}/archive` | `/archive`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(tabs)"}` | `/`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(tabs)"}/profile` | `/profile`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/listening/[videoId]`;
            params: Router.UnknownOutputParams & { videoId: string };
          }
        | {
            pathname: `/shadowing/[videoId]`;
            params: Router.UnknownOutputParams & { videoId: string };
          }
        | {
            pathname: `/study/[videoId]`;
            params: Router.UnknownOutputParams & { videoId: string };
          };
      href:
        | Router.RelativePathString
        | Router.ExternalPathString
        | `/_sitemap${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/login${`?${string}` | `#${string}` | ""}`
        | `/login${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/signup${`?${string}` | `#${string}` | ""}`
        | `/signup${`?${string}` | `#${string}` | ""}`
        | `${"/(tabs)"}/archive${`?${string}` | `#${string}` | ""}`
        | `/archive${`?${string}` | `#${string}` | ""}`
        | `${"/(tabs)"}${`?${string}` | `#${string}` | ""}`
        | `/${`?${string}` | `#${string}` | ""}`
        | `${"/(tabs)"}/profile${`?${string}` | `#${string}` | ""}`
        | `/profile${`?${string}` | `#${string}` | ""}`
        | {
            pathname: Router.RelativePathString;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: Router.ExternalPathString;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(auth)"}/login` | `/login`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(auth)"}/signup` | `/signup`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(tabs)"}/archive` | `/archive`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(tabs)"}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(tabs)"}/profile` | `/profile`;
            params?: Router.UnknownInputParams;
          }
        | `/listening/${Router.SingleRoutePart<T>}`
        | `/shadowing/${Router.SingleRoutePart<T>}`
        | `/study/${Router.SingleRoutePart<T>}`
        | {
            pathname: `/listening/[videoId]`;
            params: Router.UnknownInputParams & { videoId: string | number };
          }
        | {
            pathname: `/shadowing/[videoId]`;
            params: Router.UnknownInputParams & { videoId: string | number };
          }
        | {
            pathname: `/study/[videoId]`;
            params: Router.UnknownInputParams & { videoId: string | number };
          };
    }
  }
}
