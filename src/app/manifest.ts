import type { MetadataRoute } from "next";

// ホーム画面に追加したときのアプリ名・アイコン（Android / Chrome 向け）。
// iPhone のアイコンは src/app/apple-icon.png が使われます。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pocke - 家計簿アプリ",
    short_name: "Pocke",
    description: "事前予算配分型の家計簿アプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Android は機種によってアイコンを丸や角丸に切り抜くため、
      // 切れないように余白を付けた版を "maskable" として用意しています。
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
