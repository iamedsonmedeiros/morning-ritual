import Script from "next/script";
import AppBottomNav from "@/components/app/app-bottom-nav";

const oneSignalAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "8169eb70-9bf2-4f6d-8ea7-2c105a57ef12";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-[100dvh] pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-0">
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
      />
      <Script
        id="onesignal-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            window.OneSignalDeferred.push(async function(OneSignal) {
              await OneSignal.init({
                appId: "${oneSignalAppId}",
              });
            });
          `,
        }}
      />
      {children}
      <AppBottomNav />
    </div>
  );
}
