#[cfg(all(not(dev), desktop))]
use std::net::TcpListener;
#[cfg(desktop)]
use std::{
    io::{Read, Write},
    net::{TcpListener as LoopbackListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use tauri::{webview::WebviewWindowBuilder, State, WebviewUrl};
use tauri_plugin_opener::OpenerExt;

#[cfg(desktop)]
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoopbackAuthPayload {
    google_id_token: Option<String>,
    google_access_token: Option<String>,
    email: Option<String>,
    display_name: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LoopbackPollResponse {
    status: String,
    google_id_token: Option<String>,
    google_access_token: Option<String>,
    email: Option<String>,
    display_name: Option<String>,
    error: Option<String>,
}

#[cfg(desktop)]
struct ActiveLoopbackSession {
    status: String,
    write_secret: String,
    payload: Option<LoopbackAuthPayload>,
    error: Option<String>,
    cancel_flag: Arc<AtomicBool>,
}

#[cfg(desktop)]
struct LoopbackState {
    active: Arc<Mutex<Option<ActiveLoopbackSession>>>,
}

#[cfg(not(desktop))]
struct LoopbackState;

#[cfg(all(not(dev), desktop))]
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

#[tauri::command]
fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !trimmed.starts_with("https://") && !trimmed.starts_with("http://") {
        return Err("Only http/https URLs are permitted".to_string());
    }
    app.opener()
        .open_url(trimmed, None::<&str>)
        .map_err(|e| format!("Failed to open external browser: {}", e))
}

#[cfg(desktop)]
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (&x, &y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

#[cfg(desktop)]
fn is_allowed_localhost_origin(origin: &str) -> bool {
    origin.starts_with("http://localhost:")
        || origin == "http://localhost"
        || origin.starts_with("http://127.0.0.1:")
}

#[cfg(desktop)]
fn write_http_response(
    stream: &mut TcpStream,
    status: &str,
    content_type: &str,
    cors_origin: Option<&str>,
    body: &str,
) {
    let mut headers = format!(
        "HTTP/1.1 {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n",
        status,
        content_type,
        body.as_bytes().len()
    );
    if let Some(origin) = cors_origin {
        headers.push_str(&format!(
            "Access-Control-Allow-Origin: {}\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nVary: Origin\r\n",
            origin
        ));
    }
    headers.push_str("\r\n");
    let _ = stream.write_all(headers.as_bytes());
    let _ = stream.write_all(body.as_bytes());
    let _ = stream.flush();
}

#[cfg(desktop)]
fn read_http_request(stream: &mut TcpStream) -> Option<(String, String, Option<String>, String)> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let mut buf = Vec::with_capacity(4096);
    let mut chunk = [0u8; 2048];
    let mut header_end = None;

    while buf.len() < 32768 {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                buf.extend_from_slice(&chunk[..n]);
                if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                    header_end = Some(pos + 4);
                    break;
                }
            }
            Err(_) => break,
        }
    }

    let hdr_end = header_end?;
    let header_str = String::from_utf8_lossy(&buf[..hdr_end]).to_string();
    let mut lines = header_str.lines();
    let request_line = lines.next()?.trim().to_string();
    let mut parts = request_line.split_whitespace();
    let method = parts.next()?.to_string();
    let req_path = parts.next()?.to_string();

    let mut content_len: usize = 0;
    let mut origin: Option<String> = None;
    for line in lines {
        if let Some((k, v)) = line.split_once(':') {
            let key = k.trim().to_ascii_lowercase();
            let val = v.trim();
            if key == "content-length" {
                content_len = val.parse::<usize>().unwrap_or(0).min(32768);
            } else if key == "origin" && is_allowed_localhost_origin(val) {
                origin = Some(val.to_string());
            }
        }
    }

    while buf.len() < hdr_end + content_len {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => buf.extend_from_slice(&chunk[..n]),
            Err(_) => break,
        }
    }

    let body_end = (hdr_end + content_len).min(buf.len());
    let body = String::from_utf8_lossy(&buf[hdr_end..body_end]).to_string();
    Some((method, req_path, origin, body))
}

#[cfg(desktop)]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoopbackCompleteBody {
    write_secret: String,
    google_id_token: Option<String>,
    google_access_token: Option<String>,
    email: Option<String>,
    display_name: Option<String>,
    error: Option<String>,
}

#[tauri::command]
fn start_windows_loopback_auth(
    state: State<'_, LoopbackState>,
    write_secret: String,
) -> Result<u16, String> {
    #[cfg(not(desktop))]
    {
        let _ = (state, write_secret);
        return Err("Loopback auth is only supported on desktop".to_string());
    }

    #[cfg(desktop)]
    {
        if write_secret.len() < 16 || write_secret.len() > 128 {
            return Err("Invalid loopback auth secret".to_string());
        }

        let listener = LoopbackListener::bind("127.0.0.1:0")
            .map_err(|e| format!("Failed to bind local auth listener: {}", e))?;
        let port = listener
            .local_addr()
            .map_err(|e| format!("Failed to read local auth port: {}", e))?
            .port();
        listener
            .set_nonblocking(true)
            .map_err(|e| format!("Failed to configure nonblocking listener: {}", e))?;

        let cancel_flag = Arc::new(AtomicBool::new(false));
        let active_arc = Arc::clone(&state.active);

        {
            let mut guard = active_arc.lock().map_err(|_| "Lock poisoned".to_string())?;
            if let Some(prev) = guard.take() {
                prev.cancel_flag.store(true, Ordering::Relaxed);
            }
            *guard = Some(ActiveLoopbackSession {
                status: "pending".to_string(),
                write_secret,
                payload: None,
                error: None,
                cancel_flag: Arc::clone(&cancel_flag),
            });
        }

        std::thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(300);
            loop {
                if cancel_flag.load(Ordering::Relaxed) || Instant::now() >= deadline {
                    break;
                }
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        if let Some((method, req_path, origin, body)) = read_http_request(&mut stream)
                        {
                            let cors = origin.as_deref();
                            if method == "OPTIONS" {
                                write_http_response(&mut stream, "204 No Content", "text/plain", cors, "");
                                continue;
                            }
                            if method == "POST" && req_path == "/complete" {
                                if let Ok(parsed) = serde_json::from_str::<LoopbackCompleteBody>(&body) {
                                    let mut guard = match active_arc.lock() {
                                        Ok(g) => g,
                                        Err(_) => break,
                                    };
                                    if let Some(sess) = guard.as_mut() {
                                        if constant_time_eq(
                                            parsed.write_secret.as_bytes(),
                                            sess.write_secret.as_bytes(),
                                        ) {
                                            if let Some(err_msg) = parsed.error {
                                                sess.status = "error".to_string();
                                                sess.error = Some(err_msg);
                                            } else {
                                                sess.status = "completed".to_string();
                                                sess.payload = Some(LoopbackAuthPayload {
                                                    google_id_token: parsed.google_id_token,
                                                    google_access_token: parsed.google_access_token,
                                                    email: parsed.email,
                                                    display_name: parsed.display_name,
                                                });
                                            }
                                            write_http_response(
                                                &mut stream,
                                                "200 OK",
                                                "application/json",
                                                cors,
                                                "{\"ok\":true}",
                                            );
                                            break;
                                        }
                                    }
                                    write_http_response(
                                        &mut stream,
                                        "401 Unauthorized",
                                        "application/json",
                                        cors,
                                        "{\"error\":\"invalid secret\"}",
                                    );
                                    continue;
                                }
                                write_http_response(
                                    &mut stream,
                                    "400 Bad Request",
                                    "application/json",
                                    cors,
                                    "{\"error\":\"invalid payload\"}",
                                );
                                continue;
                            }
                            write_http_response(
                                &mut stream,
                                "404 Not Found",
                                "text/plain",
                                cors,
                                "Not Found",
                            );
                        }
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        std::thread::sleep(Duration::from_millis(60));
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(port)
    }
}

#[tauri::command]
fn poll_windows_loopback_auth(
    state: State<'_, LoopbackState>,
) -> Result<LoopbackPollResponse, String> {
    #[cfg(not(desktop))]
    {
        let _ = state;
        return Err("Loopback auth is only supported on desktop".to_string());
    }

    #[cfg(desktop)]
    {
        let mut guard = state
            .active
            .lock()
            .map_err(|_| "Lock poisoned".to_string())?;
        let Some(sess) = guard.as_ref() else {
            return Ok(LoopbackPollResponse {
                status: "none".to_string(),
                google_id_token: None,
                google_access_token: None,
                email: None,
                display_name: None,
                error: None,
            });
        };

        if sess.status == "completed" {
            let payload = sess.payload.clone();
            if let Some(done) = guard.take() {
                done.cancel_flag.store(true, Ordering::Relaxed);
            }
            return Ok(LoopbackPollResponse {
                status: "completed".to_string(),
                google_id_token: payload.as_ref().and_then(|p| p.google_id_token.clone()),
                google_access_token: payload.as_ref().and_then(|p| p.google_access_token.clone()),
                email: payload.as_ref().and_then(|p| p.email.clone()),
                display_name: payload.as_ref().and_then(|p| p.display_name.clone()),
                error: None,
            });
        }

        if sess.status == "error" {
            let err = sess.error.clone();
            if let Some(done) = guard.take() {
                done.cancel_flag.store(true, Ordering::Relaxed);
            }
            return Ok(LoopbackPollResponse {
                status: "error".to_string(),
                google_id_token: None,
                google_access_token: None,
                email: None,
                display_name: None,
                error: err,
            });
        }

        Ok(LoopbackPollResponse {
            status: "pending".to_string(),
            google_id_token: None,
            google_access_token: None,
            email: None,
            display_name: None,
            error: None,
        })
    }
}

#[tauri::command]
fn cancel_windows_loopback_auth(state: State<'_, LoopbackState>) -> Result<(), String> {
    #[cfg(not(desktop))]
    {
        let _ = state;
        return Ok(());
    }

    #[cfg(desktop)]
    {
        let mut guard = state
            .active
            .lock()
            .map_err(|_| "Lock poisoned".to_string())?;
        if let Some(prev) = guard.take() {
            prev.cancel_flag.store(true, Ordering::Relaxed);
        }
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    {
        builder = builder.manage(LoopbackState {
            active: Arc::new(Mutex::new(None)),
        });
    }
    #[cfg(not(desktop))]
    {
        builder = builder.manage(LoopbackState);
    }

    #[cfg(all(not(dev), desktop))]
    let port = pick_consistent_localhost_port();

    #[cfg(all(not(dev), desktop))]
    {
        builder = builder.plugin(tauri_plugin_localhost::Builder::new(port).build());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            open_external_url,
            start_windows_loopback_auth,
            poll_windows_loopback_auth,
            cancel_windows_loopback_auth
        ])
        .setup(move |app| {
            #[cfg(any(dev, mobile))]
            let url = WebviewUrl::App("index.html".into());

            #[cfg(all(not(dev), desktop))]
            let url = WebviewUrl::External(
                format!("http://localhost:{}", port)
                    .parse()
                    .expect("valid localhost URL"),
            );

            #[allow(unused_mut)]
            let mut win_builder = WebviewWindowBuilder::new(app, "main", url);

            #[cfg(desktop)]
            {
                win_builder = win_builder
                    .title("روان‌سنج صنعتی — آزمون‌های روان‌شناختی محیط کار")
                    .inner_size(1280.0, 840.0)
                    .min_inner_size(960.0, 640.0)
                    .resizable(true);
            }

            win_builder.build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
