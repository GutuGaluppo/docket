use serde_json::json;
use std::fs;
use std::sync::Arc;
use tauri::Emitter;

mod streamer;

#[tauri::command]
fn open_in_browser(url: String) -> Result<(), String> {
  // macOS `open` for now to avoid tauri api compatibility issues
  std::process::Command::new("open")
    .arg(&url)
    .status()
    .map_err(|e| e.to_string())
    .and_then(|s| {
      if s.success() {
        Ok(())
      } else {
        Err(format!("open failed: {:?}", s.code()))
      }
    })
}

#[tauri::command]
fn save_file(content: String, filename_hint: Option<String>) -> Result<String, String> {
  // Write to a file in the current working directory when a native file dialog isn't available
  let filename = filename_hint.unwrap_or_else(|| "log.txt".to_string());
  let mut p = std::env::current_dir().map_err(|e| e.to_string())?;
  p.push(filename);
  fs::write(&p, content).map_err(|e| e.to_string())?;
  Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
  let status = std::process::Command::new("open")
    .arg(&path)
    .status()
    .map_err(|e| e.to_string())?;
  if status.success() {
    Ok(())
  } else {
    Err(format!("open failed with: {:?}", status.code()))
  }
}

#[tauri::command]
fn run_node_action(url: String, method: Option<String>, body: Option<String>) -> Result<String, String> {
  // Simple blocking HTTP helper for dev-only node-helper interactions
  let client = reqwest::blocking::Client::new();
  let m = method.unwrap_or_else(|| "GET".into()).to_uppercase();
  let res = if m == "GET" {
    client.get(&url).send()
  } else if m == "POST" {
    client.post(&url).body(body.unwrap_or_default()).send()
  } else {
    return Err(format!("unsupported method: {}", m));
  };

  let resp = res.map_err(|e| e.to_string())?;
  let text = resp.text().map_err(|e| e.to_string())?;
  Ok(text)
}

#[tauri::command]
fn run_node_action_stream(args: Vec<String>, window: tauri::Window) -> Result<String, String> {
  // spawn pnpm with provided args and stream output back to renderer via events
  let w = window.clone();
  let args_clone = args.clone();
  let on_line = Arc::new(move |stream: &str, line: &str, op: uuid::Uuid| {
    let payload = json!({"stream": stream, "line": line, "op_id": op.to_string()});
    let _ = w.emit("drizzle-line", payload);
  });
  let w2 = window.clone();
  let on_done = Arc::new(move |code: i32, op: uuid::Uuid| {
    let payload = json!({"code": code, "op_id": op.to_string()});
    let _ = w2.emit("drizzle-complete", payload);
  });

  let op_id = streamer::spawn_pnpm_stream_with_callbacks(args_clone, on_line, on_done);
  Ok(op_id.to_string())
}

#[tauri::command]
fn run_node_action_cancel(op_id: String) -> Result<bool, String> {
  match uuid::Uuid::parse_str(&op_id) {
    Ok(u) => Ok(streamer::cancel_op(u)),
    Err(e) => Err(e.to_string()),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      open_in_browser,
      save_file,
      open_path,
      run_node_action,
      run_node_action_stream,
      run_node_action_cancel
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
