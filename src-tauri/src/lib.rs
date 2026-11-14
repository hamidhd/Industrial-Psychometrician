use std::net::TcpListener;
use tauri::{webview::WebviewWindowBuilder, WebviewUrl};

fn pick_consistent_localhost_port() -> u16 {
    for port in 43210..=43225 {
        if let Ok(listener) = TcpListener::bind(("127.0.0.1", port)) {
            drop(listener);
            return port;
        }
    }
    TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|addr| addr.port())
        .unwrap_or(43210)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port = pick_consistent_localhost_port();
    let mut builder = tauri::Builder::default();

    #[cfg(not(dev))]
    {
        builder = builder.plugin(tauri_plugin_localhost::Builder::new(port).build());
    }

    builder
        .setup(move |app| {
            let url = if cfg!(dev) {
                WebviewUrl::App("index.html".into())
            } else {
                WebviewUrl::External(
                    format!("http://localhost:{}", port)
                        .parse()
                        .expect("valid localhost URL"),
                )
            };

            WebviewWindowBuilder::new(app, "main", url)
                .title("روان‌سنج صنعتی — آزمون‌های روان‌شناختی محیط کار")
                .inner_size(1280.0, 840.0)
                .min_inner_size(960.0, 640.0)
                .resizable(true)
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
