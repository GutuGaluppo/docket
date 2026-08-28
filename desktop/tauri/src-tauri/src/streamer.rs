use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use uuid::Uuid;

static PROCESS_MAP: Lazy<Mutex<HashMap<Uuid, Child>>> = Lazy::new(|| Mutex::new(HashMap::new()));

pub fn spawn_pnpm_stream_with_callbacks(
    args: Vec<String>,
    on_line: Arc<dyn Fn(&str, &str, Uuid) + Send + Sync + 'static>,
    on_done: Arc<dyn Fn(i32, Uuid) + Send + Sync + 'static>,
) -> Uuid {
    let op_id = Uuid::new_v4();

    let mut cmd = Command::new("pnpm");
    for a in args.iter() {
        cmd.arg(a);
    }
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            // report an immediate error via on_done with code -1
            on_done(-1, op_id);
            eprintln!("failed to spawn pnpm: {}", e);
            return op_id;
        }
    };

    // Insert into map
    {
        let mut m = PROCESS_MAP.lock().unwrap();
        m.insert(op_id, child);
    }

    // Take child out to access its stdout/stderr
    let child_opt = {
        let mut m = PROCESS_MAP.lock().unwrap();
        m.remove(&op_id)
    };

    if child_opt.is_none() {
        on_done(-1, op_id);
        return op_id;
    }

    let mut child = child_opt.unwrap();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Put child back into map so cancel can access it
    {
        let mut m = PROCESS_MAP.lock().unwrap();
        m.insert(op_id, child);
    }

    // Spawn thread to read stdout
    if let Some(out) = stdout {
        let op = op_id.clone();
        let on_line = on_line.clone();
        let reader = BufReader::new(out);
        thread::spawn(move || {
            for line in reader.lines() {
                match line {
                    Ok(l) => on_line("stdout", &l, op),
                    Err(e) => {
                        on_line("stderr", &format!("error reading stdout: {}", e), op);
                    }
                }
            }
        });
    }

    // Spawn thread to read stderr
    if let Some(err) = stderr {
        let op = op_id.clone();
        let on_line = on_line.clone();
        let reader = BufReader::new(err);
        thread::spawn(move || {
            for line in reader.lines() {
                match line {
                    Ok(l) => on_line("stderr", &l, op),
                    Err(e) => {
                        on_line("stderr", &format!("error reading stderr: {}", e), op);
                    }
                }
            }
        });
    }

    // Spawn thread to wait for child exit
    {
        let on_done = on_done.clone();
        thread::spawn(move || {
            // Remove and wait
            let child_opt = {
                let mut m = PROCESS_MAP.lock().unwrap();
                m.remove(&op_id)
            };

            if let Some(mut c) = child_opt {
                match c.wait() {
                    Ok(status) => {
                        let code = status.code().unwrap_or(-1);
                        on_done(code, op_id);
                    }
                    Err(e) => {
                        eprintln!("failed to wait on child: {}", e);
                        on_done(-1, op_id);
                    }
                }
            } else {
                on_done(-1, op_id);
            }
        });
    }

    op_id
}

pub fn cancel_op(op_id: Uuid) -> bool {
    let mut m = PROCESS_MAP.lock().unwrap();
    if let Some(mut child) = m.remove(&op_id) {
        match child.kill() {
            Ok(_) => true,
            Err(e) => {
                eprintln!("failed to kill child: {}", e);
                false
            }
        }
    } else {
        false
    }
}
