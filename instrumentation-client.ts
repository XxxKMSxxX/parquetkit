import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// DSN未設定(ローカル・fork環境)では監視を無効化する。
// ユーザーのファイル名・ファイル内容・クエリ文字列は絶対に送信しない
// (「データはブラウザの外に出ない」という本サイトの約束を監視系にも適用する)。
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.query_string;
        delete event.request.data;
      }
      return event;
    },
  });
}
